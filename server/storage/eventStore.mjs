import { validateProject, validateRun, validateEvent, validateCheckpoint, validateSource, validateClaim, validateScenario } from "../../shared/simulation/schema.mjs";
import { hashState } from "./stateHash.mjs";

const TABLES = [
  "PRAGMA foreign_keys = ON",
  "CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, payload TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, payload TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_runs_owner_project ON runs(owner_id, project_id)",
  "CREATE TABLE IF NOT EXISTS events (run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, seq INTEGER NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, seq), UNIQUE(run_id, event_id))",
  "CREATE TABLE IF NOT EXISTS checkpoints (run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, seq INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, seq))"
].join(";\n") + ";";

export class SqliteEventStoreCore {
  constructor(db, { native = false } = {}) {
    this.db = db;
    if (native) {
      this.db.exec("PRAGMA journal_mode=WAL");
      this.db.exec("PRAGMA busy_timeout=5000");
    }
    this.db.exec(native ? TABLES : TABLES.replace("PRAGMA foreign_keys = ON;\\n", ""));
  }

  transaction(callback) {
    if (typeof this.db.transactionSync === "function") return this.db.transactionSync(callback);
    this.db.exec("BEGIN IMMEDIATE");
    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  close() {
    this.db.close();
  }

  putProject(project) {
    validateProject(project);
    const payload = JSON.stringify(project);
    const existing = this.db.prepare("SELECT payload FROM projects WHERE id = ?").get(project.id);
    if (existing) {
      if (existing.payload !== payload) throw new Error("Conflicting project");
      return project;
    }
    this.db.prepare("INSERT INTO projects VALUES (?, ?, ?)").run(project.id, project.ownerId, payload);
    return project;
  }

  getProject(ownerId, projectId) {
    const row = this.db.prepare("SELECT payload FROM projects WHERE id = ? AND owner_id = ?").get(projectId, ownerId);
    return row ? JSON.parse(row.payload) : null;
  }

  listProjects(ownerId) {
    return this.db.prepare("SELECT payload FROM projects WHERE owner_id = ? ORDER BY id")
      .all(ownerId).map((row) => JSON.parse(row.payload));
  }

  putRun(ownerId, projectId, run) {
    validateRun(run);
    if (ownerId !== run.ownerId || !this.getProject(ownerId, projectId))
      throw new Error("Project not found");
    const payload = JSON.stringify(run);
    const existing = this.db.prepare("SELECT payload FROM runs WHERE id = ?").get(run.id);
    if (existing) {
      if (existing.payload !== payload) throw new Error("Conflicting run");
      return run;
    }
    this.db.prepare("INSERT INTO runs VALUES (?, ?, ?, ?)").run(run.id, ownerId, projectId, payload);
    return run;
  }

  getRun(ownerId, runId) {
    const row = this.db.prepare("SELECT payload FROM runs WHERE id = ? AND owner_id = ?").get(runId, ownerId);
    return row ? JSON.parse(row.payload) : null;
  }

  listRuns(ownerId, projectId) {
    if (!this.getProject(ownerId, projectId)) return [];
    return this.db.prepare("SELECT payload FROM runs WHERE owner_id = ? AND project_id = ? ORDER BY id")
      .all(ownerId, projectId).map((row) => JSON.parse(row.payload));
  }

  appendEvents(ownerId, runId, events, checkpoint = null) {
    if (!Array.isArray(events) || events.length > 1000) throw new Error("Invalid event batch");
    if (!this.getRun(ownerId, runId)) throw new Error("Run not found");
    return this.transaction(() => {
      const stored = this.db.prepare("SELECT seq, event_id, payload FROM events WHERE run_id = ? ORDER BY seq")
        .all(runId);
      const known = new Set(stored.map((row) => row.event_id));
      const bySeq = new Map(stored.map((row) => [row.seq, row.payload]));
      let nextSeq = (stored.at(-1)?.seq ?? 0) + 1;
      const insert = this.db.prepare("INSERT INTO events(run_id, seq, event_id, payload) VALUES (?, ?, ?, ?)");
      for (const event of events) {
        validateEvent(event);
        if (event.runId !== runId || event.ownerId !== ownerId) throw new Error("Event ownership mismatch");
        const payload = JSON.stringify(event);
        if (bySeq.has(event.seq)) {
          if (bySeq.get(event.seq) !== payload) throw new Error("Conflicting event");
          continue;
        }
        if (event.seq !== nextSeq) throw new Error("Event sequence gap");
        if (known.has(event.id)) throw new Error("Duplicate event ID");
        if (event.parentEventIds.some((parent) => !known.has(parent)))
          throw new Error("Unknown event parent");
        insert.run(runId, event.seq, event.id, payload);
        known.add(event.id);
        nextSeq++;
      }
      if (checkpoint) {
        validateCheckpoint(checkpoint);
        if (checkpoint.runId !== runId || checkpoint.ownerId !== ownerId)
          throw new Error("Checkpoint ownership mismatch");
        if (checkpoint.seq >= nextSeq) throw new Error("Checkpoint beyond event history");
        if (hashState(checkpoint.serializedState) !== checkpoint.stateHash)
          throw new Error("Checkpoint hash mismatch");
        const payload = JSON.stringify(checkpoint);
        const existing = this.db.prepare("SELECT payload FROM checkpoints WHERE run_id = ? AND seq = ?")
          .get(runId, checkpoint.seq);
        if (existing && existing.payload !== payload) throw new Error("Conflicting checkpoint");
        if (!existing)
          this.db.prepare("INSERT INTO checkpoints(run_id, seq, payload) VALUES (?, ?, ?)")
            .run(runId, checkpoint.seq, payload);
      }
    });
  }

  readEvents(ownerId, runId, { after = 0, limit = 500 } = {}) {
    if (!this.getRun(ownerId, runId)) throw new Error("Run not found");
    if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1000)
      throw new Error("Invalid event cursor");
    return this.db.prepare(
      "SELECT payload FROM events WHERE run_id = ? AND seq > ? ORDER BY seq LIMIT ?"
    ).all(runId, after, limit).map((row) => JSON.parse(row.payload));
  }

  getCheckpoint(ownerId, runId) {
    if (!this.getRun(ownerId, runId)) throw new Error("Run not found");
    const row = this.db.prepare(
      "SELECT payload FROM checkpoints WHERE run_id = ? ORDER BY seq DESC LIMIT 1"
    ).get(runId);
    return row ? JSON.parse(row.payload) : null;
  }

  replay(ownerId, runId, initialState, applyEvent) {
    if (typeof applyEvent !== "function") throw new TypeError("Missing event reducer");
    if (!this.getRun(ownerId, runId)) throw new Error("Run not found");
    let state = structuredClone(initialState);
    let cursor = 0;
    for (;;) {
      const chunk = this.readEvents(ownerId, runId, { after: cursor, limit: 500 });
      if (!chunk.length) break;
      for (const event of chunk) {
        state = applyEvent(state, event);
        cursor = event.seq;
        const checkpoint = this.db.prepare(
          "SELECT payload FROM checkpoints WHERE run_id = ? AND seq = ?"
        ).get(runId, cursor);
        if (checkpoint && JSON.parse(checkpoint.payload).stateHash !== hashState(state))
          throw new Error("Replay hash mismatch");
      }
    }
    return { state, seq: cursor, stateHash: hashState(state) };
  }

  initSources() {
    this.db.exec("CREATE TABLE IF NOT EXISTS sources (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, metadata TEXT NOT NULL, parsed TEXT NOT NULL)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_sources_project ON sources(owner_id, project_id)");
  }

  putSource(ownerId, projectId, source, parsed) {
    this.initSources();
    validateSource(source);
    if (parsed?.hash !== source.hash || parsed?.bytes !== source.bytes ||
        parsed?.kind !== source.kind || typeof parsed.text !== "string")
      throw new Error("Source metadata does not match parsed content");
    if (source.ownerId !== ownerId || source.projectId !== projectId || !this.getProject(ownerId, projectId))
      throw new Error("Project not found");
    const duplicate = this.db.prepare("SELECT metadata FROM sources WHERE owner_id = ? AND project_id = ?")
      .all(ownerId, projectId).find((row) => JSON.parse(row.metadata).hash === source.hash);
    if (duplicate) return JSON.parse(duplicate.metadata);
    const existingFiles = this.listSources(ownerId, projectId);
    if (existingFiles.length >= 50 ||
        existingFiles.reduce((total, file) => total + file.bytes, 0) + source.bytes > 5 * 1024 * 1024)
      throw new Error("Project evidence storage limit reached");
    this.db.prepare("INSERT INTO sources VALUES (?, ?, ?, ?, ?)")
      .run(source.id, ownerId, projectId, JSON.stringify(source), JSON.stringify(parsed));
    return source;
  }

  listSources(ownerId, projectId) {
    this.initSources();
    if (!this.getProject(ownerId, projectId)) return [];
    return this.db.prepare("SELECT metadata FROM sources WHERE owner_id = ? AND project_id = ? ORDER BY rowid")
      .all(ownerId, projectId).map((row) => JSON.parse(row.metadata));
  }

  getSource(ownerId, projectId, sourceId) {
    this.initSources();
    const row = this.db.prepare("SELECT metadata, parsed FROM sources WHERE id = ? AND owner_id = ? AND project_id = ?")
      .get(sourceId, ownerId, projectId);
    return row ? { source: JSON.parse(row.metadata), parsed: JSON.parse(row.parsed) } : null;
  }

  deleteSource(ownerId, projectId, sourceId) {
    this.initSources();
    const record = this.getSource(ownerId, projectId, sourceId);
    if (!record) return false;
    this.initClaims();
    return this.transaction(() => {
      for (const claim of this.listClaims(ownerId, projectId)) {
        if (claim.sourceSpans.some((span) => span.sourceId === sourceId))
          this.deleteClaim(ownerId, projectId, claim.id);
      }
      const removed = this.db.prepare("DELETE FROM sources WHERE id = ? AND owner_id = ? AND project_id = ?")
        .run(sourceId, ownerId, projectId).changes > 0;
      return removed;
    });
  }

  initClaims() {
    this.db.exec("CREATE TABLE IF NOT EXISTS claims (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, payload TEXT NOT NULL)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_claims_project ON claims(owner_id, project_id)");
  }

  putClaims(ownerId, projectId, claims) {
    this.initClaims();
    if (!this.getProject(ownerId, projectId) || !Array.isArray(claims) || claims.length > 200)
      throw new Error("Invalid claims batch");
    const existing = this.listClaims(ownerId, projectId);
    if (existing.length + claims.length > 1000)
      throw new Error("Too many claims in this project");
    const spans = new Set(existing.map((claim) => {
      const span = claim.sourceSpans[0];
      return span?.sourceId + ":" + (span?.row ?? span?.charStart);
    }));
    const insert = this.db.prepare("INSERT INTO claims VALUES (?, ?, ?, ?)");
    return this.transaction(() => {
      for (const claim of claims) {
        validateClaim(claim);
        if (claim.ownerId !== ownerId || claim.projectId !== projectId)
          throw new Error("Claim ownership mismatch");
        for (const span of claim.sourceSpans) {
          if (!this.getSource(ownerId, projectId, span.sourceId))
            throw new Error("Source not found");
        }
        const span = claim.sourceSpans[0];
        const key = span?.sourceId + ":" + (span?.row ?? span?.charStart);
        if (spans.has(key)) continue;
        insert.run(claim.id, ownerId, projectId, JSON.stringify(claim));
        spans.add(key);
      }
    });
    return this.listClaims(ownerId, projectId);
  }

  listClaims(ownerId, projectId) {
    this.initClaims();
    if (!this.getProject(ownerId, projectId)) return [];
    return this.db.prepare("SELECT payload FROM claims WHERE owner_id = ? AND project_id = ? ORDER BY rowid")
      .all(ownerId, projectId).map((row) => JSON.parse(row.payload));
  }

  updateClaim(ownerId, projectId, claimId, { text, decision }) {
    this.initClaims();
    const row = this.db.prepare("SELECT payload FROM claims WHERE id = ? AND owner_id = ? AND project_id = ?")
      .get(claimId, ownerId, projectId);
    if (!row) return null;
    if (!["accept", "reject", "pending"].includes(decision)) throw new Error("Invalid review decision");
    const prior = JSON.parse(row.payload);
    if (text !== undefined && (typeof text !== "string" || !text.trim() || text.length > 2000))
      throw new Error("Invalid claim text");
    const edited = text !== undefined && text.trim() !== prior.text;
    const updated = { ...prior, text: text === undefined ? prior.text : text.trim(),
      provenance: edited ? "assumption" : prior.provenance,
      reviewed: decision === "accept", rejected: decision === "reject",
      confidenceStatus: decision === "accept" ? "reviewed" : "unverified" };
    validateClaim(updated);
    this.db.prepare("UPDATE claims SET payload = ? WHERE id = ? AND owner_id = ? AND project_id = ?")
      .run(JSON.stringify(updated), claimId, ownerId, projectId);
    return updated;
  }

  deleteClaim(ownerId, projectId, claimId) {
    this.initClaims();
    return this.db.prepare("DELETE FROM claims WHERE id = ? AND owner_id = ? AND project_id = ?")
      .run(claimId, ownerId, projectId).changes > 0;
  }

  initScenarios() {
    this.db.exec("CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, payload TEXT NOT NULL)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_scenarios_project ON scenarios(owner_id, project_id)");
  }

  putScenario(ownerId, projectId, scenario) {
    this.initScenarios();
    validateScenario(scenario);
    if (scenario.ownerId !== ownerId || scenario.projectId !== projectId ||
        !this.getProject(ownerId, projectId)) throw new Error("Project not found");
    const row = this.db.prepare("SELECT payload FROM scenarios WHERE id = ?").get(scenario.id);
    if (row) {
      if (row.payload !== JSON.stringify(scenario)) throw new Error("Conflicting scenario");
      return scenario;
    }
    this.db.prepare("INSERT INTO scenarios VALUES (?, ?, ?, ?)")
      .run(scenario.id, ownerId, projectId, JSON.stringify(scenario));
    return scenario;
  }

  getScenario(ownerId, scenarioId) {
    this.initScenarios();
    const row = this.db.prepare("SELECT payload FROM scenarios WHERE id = ? AND owner_id = ?")
      .get(scenarioId, ownerId);
    return row ? JSON.parse(row.payload) : null;
  }

  listScenarios(ownerId, projectId) {
    this.initScenarios();
    if (!this.getProject(ownerId, projectId)) return [];
    return this.db.prepare("SELECT payload FROM scenarios WHERE owner_id = ? AND project_id = ? ORDER BY rowid DESC")
      .all(ownerId, projectId).map((row) => JSON.parse(row.payload));
  }

  updateProject(ownerId, projectId, title) {
    const previous = this.getProject(ownerId, projectId);
    if (!previous) return null;
    const updated = { ...previous, title, updatedAt: new Date().toISOString() };
    validateProject(updated);
    this.db.prepare("UPDATE projects SET payload = ? WHERE id = ? AND owner_id = ?")
      .run(JSON.stringify(updated), projectId, ownerId);
    return updated;
  }

  deleteRun(ownerId, runId) {
    return this.db.prepare("DELETE FROM runs WHERE id = ? AND owner_id = ?")
      .run(runId, ownerId).changes > 0;
  }

  deleteProject(ownerId, projectId) {
    return this.db.prepare("DELETE FROM projects WHERE id = ? AND owner_id = ?")
      .run(projectId, ownerId).changes > 0;
  }
}
