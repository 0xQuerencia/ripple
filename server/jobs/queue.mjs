const SQL = [
  "CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, status TEXT NOT NULL, lease_owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, pause_requested INTEGER NOT NULL DEFAULT 0, checkpoint_seq INTEGER NOT NULL DEFAULT 0, spent_calls INTEGER NOT NULL DEFAULT 0, spent_tokens INTEGER NOT NULL DEFAULT 0, rounds INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, error_code TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(status, lease_until, created_at)"
].join(";\n") + ";";

const boundedInteger = (value, low, high) =>
  Number.isInteger(value) && value >= low && value <= high;
const toJob = (row) => row ? {
  id: row.id, ownerId: row.owner_id, runId: row.run_id, status: row.status,
  leaseOwner: row.lease_owner, leaseUntil: row.lease_until,
  attempts: row.attempts, maxAttempts: row.max_attempts,
  pauseRequested: Boolean(row.pause_requested),
  checkpointSeq: row.checkpoint_seq, spentCalls: row.spent_calls,
  spentTokens: row.spent_tokens, rounds: row.rounds, errorCode: row.error_code
} : null;

export class SqliteJobQueue {
  constructor(store) {
    this.store = store;
    this.db = store.db;
    this.db.exec(SQL);
  }

  enqueue({ id, ownerId, runId, rounds, maxAttempts = 3, now = Date.now() }) {
    if (typeof id !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(id))
      throw new Error("Invalid job ID");
    if (!boundedInteger(rounds, 1, 12) || !boundedInteger(maxAttempts, 1, 10))
      throw new Error("Invalid job limits");
    if (!this.store.getRun(ownerId, runId)) throw new Error("Run not found");
    const prior = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id);
    const active = this.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE owner_id = ? AND status IN ('queued','running')")
      .get(ownerId).count;
    if (!prior && active >= 2) throw new Error("Only two active jobs per owner");
    if (prior) {
      if (prior.owner_id !== ownerId || prior.run_id !== runId || prior.rounds !== rounds)
        throw new Error("Conflicting job");
      return toJob(prior);
    }
    this.db.prepare(
      "INSERT INTO jobs(id,owner_id,run_id,status,rounds,max_attempts,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)"
    ).run(id, ownerId, runId, "queued", rounds, maxAttempts, now, now);
    return this.get(ownerId, id);
  }

  get(ownerId, id) {
    return toJob(this.db.prepare("SELECT * FROM jobs WHERE id = ? AND owner_id = ?").get(id, ownerId));
  }

  getByRun(ownerId, runId) {
    return toJob(this.db.prepare("SELECT * FROM jobs WHERE owner_id = ? AND run_id = ? ORDER BY created_at DESC LIMIT 1")
      .get(ownerId, runId));
  }

  claim(workerId, { now = Date.now(), leaseMs = 30_000 } = {}) {
    if (!workerId || !boundedInteger(leaseMs, 1, 600_000)) throw new Error("Invalid lease");
    return this.store.transaction(() => {
      this.db.prepare(
        "UPDATE jobs SET status='failed', error_code='retry_limit', lease_owner=NULL WHERE status='running' AND lease_until <= ? AND attempts >= max_attempts"
      ).run(now);
      const row = this.db.prepare(
        "SELECT * FROM jobs WHERE status='queued' OR (status='running' AND lease_until <= ?) ORDER BY created_at, id LIMIT 1"
      ).get(now);
      if (!row) {
        return null;
      }
      this.db.prepare(
        "UPDATE jobs SET status='running', lease_owner=?, lease_until=?, attempts=attempts+1, updated_at=? WHERE id=?"
      ).run(workerId, now + leaseMs, now, row.id);
      return this.get(row.owner_id, row.id);
    });
  }

  heartbeat(ownerId, id, workerId, { now = Date.now(), leaseMs = 30_000 } = {}) {
    return this.db.prepare(
      "UPDATE jobs SET lease_until=?, updated_at=? WHERE id=? AND owner_id=? AND lease_owner=? AND status='running' AND lease_until > ?"
    ).run(now + leaseMs, now, id, ownerId, workerId, now).changes === 1;
  }

  pause(ownerId, id) {
    const job = this.get(ownerId, id);
    if (!job || !["queued", "running"].includes(job.status)) return false;
    if (job.status === "queued") {
      this.db.prepare("UPDATE jobs SET status='paused' WHERE id=? AND owner_id=?").run(id, ownerId);
    } else {
      this.db.prepare("UPDATE jobs SET pause_requested=1 WHERE id=? AND owner_id=?").run(id, ownerId);
    }
    return true;
  }

  resume(ownerId, id) {
    return this.db.prepare(
      "UPDATE jobs SET status='queued', pause_requested=0, lease_owner=NULL, lease_until=0 WHERE id=? AND owner_id=? AND status='paused'"
    ).run(id, ownerId).changes === 1;
  }

  cancel(ownerId, id) {
    return this.db.prepare(
      "UPDATE jobs SET status='cancelled', lease_owner=NULL, lease_until=0 WHERE id=? AND owner_id=? AND status IN ('queued','running','paused')"
    ).run(id, ownerId).changes === 1;
  }

  progress(ownerId, id, workerId, { seq, calls = 0, tokens = 0, now = Date.now() }) {
    const job = this.get(ownerId, id);
    if (!job || job.status !== "running" || job.leaseOwner !== workerId || job.leaseUntil <= now)
      throw new Error("Job lease lost");
    if (!boundedInteger(seq, job.checkpointSeq, Number.MAX_SAFE_INTEGER) ||
      !boundedInteger(calls, 0, 1000) || !boundedInteger(tokens, 0, 10_000_000))
      throw new Error("Invalid progress");
    const status = job.pauseRequested ? "paused" : "running";
    this.db.prepare(
      "UPDATE jobs SET checkpoint_seq=?, spent_calls=spent_calls+?, spent_tokens=spent_tokens+?, status=?, lease_owner=CASE WHEN ?='paused' THEN NULL ELSE lease_owner END, updated_at=? WHERE id=?"
    ).run(seq, calls, tokens, status, status, now, id);
    return this.get(ownerId, id);
  }

  complete(ownerId, id, workerId) {
    return this.db.prepare(
      "UPDATE jobs SET status='done', lease_owner=NULL, lease_until=0 WHERE id=? AND owner_id=? AND lease_owner=? AND status='running' AND pause_requested=0"
    ).run(id, ownerId, workerId).changes === 1;
  }

  fail(ownerId, id, workerId, code = "worker_error") {
    if (!/^[a-z_]{1,40}$/.test(code)) code = "worker_error";
    return this.db.prepare(
      "UPDATE jobs SET status='failed', error_code=?, lease_owner=NULL WHERE id=? AND owner_id=? AND lease_owner=? AND status='running'"
    ).run(code, id, ownerId, workerId).changes === 1;
  }
}
