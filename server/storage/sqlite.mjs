import { DatabaseSync } from "node:sqlite";
import { validateProject, validateRun, validateEvent, validateCheckpoint } from "../../shared/simulation/schema.mjs";
import { hashState } from "./stateHash.mjs";

const TABLES = [
  "PRAGMA foreign_keys = ON",
  "CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, payload TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, payload TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_runs_owner_project ON runs(owner_id, project_id)",
  "CREATE TABLE IF NOT EXISTS events (run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, seq INTEGER NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, seq), UNIQUE(run_id, event_id))",
  "CREATE TABLE IF NOT EXISTS checkpoints (run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, seq INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, seq))"
].join(";\n") + ";";

export class SqliteEventStore {
  constructor(filename = ":memory:") {
    this.db = new DatabaseSync(filename);
    this.db.exec(TABLES);
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
    this.db.exec("BEGIN IMMEDIATE");
    try {
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
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
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
