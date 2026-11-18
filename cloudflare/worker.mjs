// workers/index.mjs
import { DurableObject } from "cloudflare:workers";

// shared/simulation/schema.mjs
var SCHEMA_VERSION = 1;
var PROVENANCE = Object.freeze([
  "observed",
  "assumption",
  "derived",
  "agent-belief",
  "simulated-event",
  "hypothesis"
]);
var ACTION_TYPES = Object.freeze([
  "change_price",
  "announce_change",
  "contact_group",
  "request_information",
  "revise_plan",
  "allocate_budget",
  "adopt_product",
  "cancel_subscription",
  "respond_to_announcement",
  "do_nothing"
]);
var SchemaError = class extends Error {
  constructor(path, message) {
    super(path + ": " + message);
    this.name = "SchemaError";
    this.path = path;
  }
};
var fail = (path, message) => {
  throw new SchemaError(path, message);
};
var requireValue = (ok, path, message) => {
  if (!ok) fail(path, message);
};
var plain = (v) => v !== null && typeof v === "object" && !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
function object(value, path, maxBytes = 64e3) {
  requireValue(plain(value), path, "expected an object");
  requireValue(JSON.stringify(value).length <= maxBytes, path, "object too large");
  return value;
}
function string(value, path, max = 2e3) {
  requireValue(typeof value === "string" && value.trim().length > 0 && value.length <= max, path, "invalid text");
  return value;
}
function id(value, path) {
  string(value, path, 80);
  requireValue(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value), path, "invalid id");
  return value;
}
function version(value, path) {
  requireValue(value === SCHEMA_VERSION, path, "unsupported schema version");
}
function timestamp(value, path) {
  string(value, path, 40);
  requireValue(Number.isFinite(Date.parse(value)), path, "invalid timestamp");
}
function number(value, path, min = 0, max = Number.MAX_SAFE_INTEGER) {
  requireValue(Number.isFinite(value) && value >= min && value <= max, path, "invalid number");
}
function integer(value, path, min = 0, max = Number.MAX_SAFE_INTEGER) {
  number(value, path, min, max);
  requireValue(Number.isInteger(value), path, "expected integer");
}
function list(value, path, validate, max = 200) {
  requireValue(Array.isArray(value) && value.length <= max, path, "invalid list");
  value.forEach((entry, index) => validate(entry, path + "[" + index + "]"));
  return value;
}
function choice(value, path, allowed) {
  requireValue(allowed.includes(value), path, "unsupported value");
}
function ids(value, path, max = 200) {
  return list(value, path, id, max);
}
function unique(values, path) {
  requireValue(new Set(values).size === values.length, path, "duplicate id");
}
function record(value, path, max = 64) {
  object(value, path);
  requireValue(Object.keys(value).length <= max, path, "too many keys");
  for (const [key2, entry] of Object.entries(value)) {
    id(key2, path + ".key");
    requireValue(
      entry === null || typeof entry === "boolean" || typeof entry === "string" && entry.length <= 1e3 || typeof entry === "number" && Number.isFinite(entry),
      path + "." + key2,
      "invalid value"
    );
  }
}
function base(value, path) {
  object(value, path, 25e4);
  version(value.schemaVersion, path + ".schemaVersion");
  id(value.id, path + ".id");
  id(value.ownerId, path + ".ownerId");
  timestamp(value.createdAt, path + ".createdAt");
  return value;
}
function validateProject(value) {
  const p = base(value, "project");
  string(p.title, "project.title", 160);
  id(p.domainPack, "project.domainPack");
  timestamp(p.updatedAt, "project.updatedAt");
  return p;
}
function validateSource(value) {
  const s = base(value, "source");
  id(s.projectId, "source.projectId");
  string(s.filename, "source.filename", 255);
  choice(s.kind, "source.kind", ["txt", "md", "csv", "pdf"]);
  requireValue(/^[a-f0-9]{64}$/.test(s.hash), "source.hash", "invalid SHA-256");
  integer(s.bytes, "source.bytes", 0, 5 * 1024 * 1024);
  choice(s.status, "source.status", ["uploaded", "parsed", "rejected", "deleted"]);
  choice(s.privacy, "source.privacy", ["private"]);
  return s;
}
function validateSourceSpan(value) {
  const s = object(value, "sourceSpan");
  id(s.sourceId, "sourceSpan.sourceId");
  if (s.page !== void 0) integer(s.page, "sourceSpan.page", 1);
  if (s.row !== void 0) integer(s.row, "sourceSpan.row", 1);
  if (s.charStart !== void 0) integer(s.charStart, "sourceSpan.charStart");
  if (s.charEnd !== void 0) {
    integer(s.charEnd, "sourceSpan.charEnd");
    requireValue(s.charStart !== void 0 && s.charEnd >= s.charStart, "sourceSpan.charEnd", "invalid span");
  }
  if (s.quote !== void 0) string(s.quote, "sourceSpan.quote", 1e3);
  requireValue(
    s.page !== void 0 || s.row !== void 0 || s.charStart !== void 0,
    "sourceSpan",
    "missing location"
  );
  return s;
}
function validateClaim(value) {
  const c = base(value, "claim");
  id(c.projectId, "claim.projectId");
  string(c.text, "claim.text", 2e3);
  choice(c.provenance, "claim.provenance", PROVENANCE);
  list(c.sourceSpans, "claim.sourceSpans", validateSourceSpan, 30);
  if (c.provenance === "observed") requireValue(c.sourceSpans.length > 0, "claim.sourceSpans", "observed claims need a source");
  choice(c.confidenceStatus, "claim.confidenceStatus", ["unverified", "reviewed", "conflicted"]);
  requireValue(typeof c.reviewed === "boolean", "claim.reviewed", "expected boolean");
  return c;
}
function validateEntity(value) {
  const e = base(value, "entity");
  string(e.kind, "entity.kind", 80);
  string(e.label, "entity.label", 160);
  record(e.attributes, "entity.attributes");
  choice(e.provenance, "entity.provenance", PROVENANCE);
  ids(e.sourceClaimIds, "entity.sourceClaimIds");
  unique(e.sourceClaimIds, "entity.sourceClaimIds");
  return e;
}
function validateRelationship(value) {
  const r = base(value, "relationship");
  id(r.fromId, "relationship.fromId");
  id(r.toId, "relationship.toId");
  requireValue(r.fromId !== r.toId, "relationship", "self-link");
  string(r.kind, "relationship.kind", 80);
  choice(r.direction, "relationship.direction", ["directed", "undirected"]);
  record(r.constraints, "relationship.constraints");
  choice(r.provenance, "relationship.provenance", PROVENANCE);
  return r;
}
function validateWorldState(value) {
  const w = base(value, "worldState");
  integer(w.tick, "worldState.tick", 0, 1e6);
  list(w.entities, "worldState.entities", validateEntity, 1e3);
  list(w.relationships, "worldState.relationships", validateRelationship, 4e3);
  unique(w.entities.map((e) => e.id), "worldState.entities");
  unique(w.relationships.map((r) => r.id), "worldState.relationships");
  const known = new Set(w.entities.map((e) => e.id));
  for (const r of w.relationships) {
    requireValue(known.has(r.fromId) && known.has(r.toId), "worldState.relationships", "unknown endpoint");
  }
  record(w.variables, "worldState.variables");
  record(w.resources, "worldState.resources");
  for (const [key2, value2] of Object.entries(w.resources)) number(value2, "worldState.resources." + key2);
  ids(w.activeAssumptions, "worldState.activeAssumptions");
  unique(w.activeAssumptions, "worldState.activeAssumptions");
  return w;
}
function validateAgent(value) {
  const a = base(value, "agent");
  string(a.role, "agent.role", 120);
  string(a.goal, "agent.goal", 1e3);
  record(a.constraints, "agent.constraints");
  record(a.policy, "agent.policy");
  ids(a.observations, "agent.observations", 1e3);
  ids(a.memoryRefs, "agent.memoryRefs", 1e3);
  return a;
}
function validateScenario(value) {
  const s = base(value, "scenario");
  id(s.projectId, "scenario.projectId");
  string(s.question, "scenario.question", 1e3);
  validateWorldState(s.baselineState);
  requireValue(s.baselineState.ownerId === s.ownerId, "scenario.baselineState", "owner mismatch");
  list(s.interventions, "scenario.interventions", (intervention, path) => {
    object(intervention, path);
    id(intervention.id, path + ".id");
    string(intervention.label, path + ".label", 160);
    record(intervention.changes, path + ".changes");
    requireValue(Object.keys(intervention.changes).length > 0, path, "empty changes");
    for (const key2 of Object.keys(intervention.changes))
      requireValue(Object.hasOwn(s.baselineState.variables, key2), path, "unknown variable");
  }, 10);
  unique(s.interventions.map((entry) => entry.id), "scenario.interventions");
  const config = object(s.config, "scenario.config");
  integer(config.rounds, "scenario.config.rounds", 1, 100);
  integer(config.agents, "scenario.config.agents", 1, 100);
  return s;
}
function validateRun(value) {
  const r = base(value, "run");
  id(r.scenarioId, "run.scenarioId");
  integer(r.seed, "run.seed");
  string(r.modelId, "run.modelId", 160);
  string(r.promptVersion, "run.promptVersion", 80);
  string(r.engineVersion, "run.engineVersion", 80);
  choice(r.status, "run.status", ["queued", "running", "paused", "cancelled", "failed", "done"]);
  object(r.budget, "run.budget");
  integer(r.budget.maxCalls, "run.budget.maxCalls", 0, 1e3);
  integer(r.budget.maxTokens, "run.budget.maxTokens", 0, 1e7);
  object(r.spent, "run.spent");
  integer(r.spent.calls, "run.spent.calls", 0);
  integer(r.spent.tokens, "run.spent.tokens", 0);
  integer(r.checkpointTick, "run.checkpointTick", 0);
  if (r.startedAt !== null) timestamp(r.startedAt, "run.startedAt");
  if (r.completedAt !== null) timestamp(r.completedAt, "run.completedAt");
  return r;
}
function validateAction(value) {
  const a = object(value, "action");
  id(a.runId, "action.runId");
  integer(a.tick, "action.tick", 0, 1e6);
  id(a.agentId, "action.agentId");
  choice(a.actionType, "action.actionType", ACTION_TYPES);
  record(a.arguments, "action.arguments", 32);
  string(a.rationale, "action.rationale", 1e3);
  return a;
}
function validateEvent(value) {
  const e = base(value, "event");
  id(e.runId, "event.runId");
  integer(e.seq, "event.seq", 1);
  integer(e.tick, "event.tick", 0);
  id(e.actorId, "event.actorId");
  string(e.type, "event.type", 80);
  object(e.payload, "event.payload");
  ids(e.parentEventIds, "event.parentEventIds");
  unique(e.parentEventIds, "event.parentEventIds");
  ids(e.sourceClaimIds, "event.sourceClaimIds");
  choice(e.provenance, "event.provenance", PROVENANCE);
  return e;
}
function validateCheckpoint(value) {
  const c = base(value, "checkpoint");
  id(c.runId, "checkpoint.runId");
  integer(c.seq, "checkpoint.seq");
  integer(c.tick, "checkpoint.tick");
  object(c.serializedState, "checkpoint.serializedState", 2e6);
  requireValue(/^[a-f0-9]{64}$/.test(c.stateHash), "checkpoint.stateHash", "invalid state hash");
  return c;
}
function validateReport(value) {
  const r = base(value, "report");
  id(r.runId, "report.runId");
  string(r.question, "report.question", 1e3);
  object(r.inputs, "report.inputs");
  list(r.evidence, "report.evidence", (e, p) => {
    object(e, p);
    choice(e.provenance, p + ".provenance", PROVENANCE);
    string(e.text, p + ".text", 2e3);
  });
  list(r.findings, "report.findings", (f, p) => {
    object(f, p);
    string(f.text, p + ".text", 2e3);
    choice(f.provenance, p + ".provenance", PROVENANCE);
  });
  list(r.limitations, "report.limitations", string);
  list(r.comparisons, "report.comparisons", (c, p) => object(c, p));
  string(r.methodVersion, "report.methodVersion", 80);
  timestamp(r.generatedAt, "report.generatedAt");
  return r;
}
var VALIDATORS = Object.freeze({
  project: validateProject,
  source: validateSource,
  sourceSpan: validateSourceSpan,
  claim: validateClaim,
  entity: validateEntity,
  relationship: validateRelationship,
  worldState: validateWorldState,
  agent: validateAgent,
  scenario: validateScenario,
  run: validateRun,
  action: validateAction,
  event: validateEvent,
  checkpoint: validateCheckpoint,
  report: validateReport
});

// server/storage/stateHash.mjs
import { createHash } from "node:crypto";
function hashState(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

// server/storage/eventStore.mjs
var TABLES = [
  "PRAGMA foreign_keys = ON",
  "CREATE TABLE IF NOT EXISTS projects (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, payload TEXT NOT NULL)",
  "CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, payload TEXT NOT NULL)",
  "CREATE INDEX IF NOT EXISTS idx_runs_owner_project ON runs(owner_id, project_id)",
  "CREATE TABLE IF NOT EXISTS events (run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, seq INTEGER NOT NULL, event_id TEXT NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, seq), UNIQUE(run_id, event_id))",
  "CREATE TABLE IF NOT EXISTS checkpoints (run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, seq INTEGER NOT NULL, payload TEXT NOT NULL, PRIMARY KEY(run_id, seq))"
].join(";\n") + ";";
var SqliteEventStoreCore = class {
  constructor(db, { native = false } = {}) {
    this.db = db;
    if (native) {
      this.db.exec("PRAGMA journal_mode=WAL");
      this.db.exec("PRAGMA busy_timeout=5000");
    }
    this.db.exec(native ? TABLES : TABLES.replace("PRAGMA foreign_keys = ON;", ""));
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
    return this.db.prepare("SELECT payload FROM projects WHERE owner_id = ? ORDER BY id").all(ownerId).map((row) => JSON.parse(row.payload));
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
    return this.db.prepare("SELECT payload FROM runs WHERE owner_id = ? AND project_id = ? ORDER BY id").all(ownerId, projectId).map((row) => JSON.parse(row.payload));
  }
  appendEvents(ownerId, runId, events, checkpoint = null) {
    if (!Array.isArray(events) || events.length > 1e3) throw new Error("Invalid event batch");
    if (!this.getRun(ownerId, runId)) throw new Error("Run not found");
    return this.transaction(() => {
      const stored = this.db.prepare("SELECT seq, event_id, payload FROM events WHERE run_id = ? ORDER BY seq").all(runId);
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
        const existing = this.db.prepare("SELECT payload FROM checkpoints WHERE run_id = ? AND seq = ?").get(runId, checkpoint.seq);
        if (existing && existing.payload !== payload) throw new Error("Conflicting checkpoint");
        if (!existing)
          this.db.prepare("INSERT INTO checkpoints(run_id, seq, payload) VALUES (?, ?, ?)").run(runId, checkpoint.seq, payload);
      }
    });
  }
  readEvents(ownerId, runId, { after = 0, limit = 500 } = {}) {
    if (!this.getRun(ownerId, runId)) throw new Error("Run not found");
    if (!Number.isInteger(after) || after < 0 || !Number.isInteger(limit) || limit < 1 || limit > 1e3)
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
    for (; ; ) {
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
    if (parsed?.hash !== source.hash || parsed?.bytes !== source.bytes || parsed?.kind !== source.kind || typeof parsed.text !== "string")
      throw new Error("Source metadata does not match parsed content");
    if (source.ownerId !== ownerId || source.projectId !== projectId || !this.getProject(ownerId, projectId))
      throw new Error("Project not found");
    const duplicate = this.db.prepare("SELECT metadata FROM sources WHERE owner_id = ? AND project_id = ?").all(ownerId, projectId).find((row) => JSON.parse(row.metadata).hash === source.hash);
    if (duplicate) return JSON.parse(duplicate.metadata);
    const existingFiles = this.listSources(ownerId, projectId);
    if (existingFiles.length >= 50 || existingFiles.reduce((total, file) => total + file.bytes, 0) + source.bytes > 5 * 1024 * 1024)
      throw new Error("Project evidence storage limit reached");
    this.db.prepare("INSERT INTO sources VALUES (?, ?, ?, ?, ?)").run(source.id, ownerId, projectId, JSON.stringify(source), JSON.stringify(parsed));
    return source;
  }
  listSources(ownerId, projectId) {
    this.initSources();
    if (!this.getProject(ownerId, projectId)) return [];
    return this.db.prepare("SELECT metadata FROM sources WHERE owner_id = ? AND project_id = ? ORDER BY rowid").all(ownerId, projectId).map((row) => JSON.parse(row.metadata));
  }
  getSource(ownerId, projectId, sourceId) {
    this.initSources();
    const row = this.db.prepare("SELECT metadata, parsed FROM sources WHERE id = ? AND owner_id = ? AND project_id = ?").get(sourceId, ownerId, projectId);
    return row ? { source: JSON.parse(row.metadata), parsed: JSON.parse(row.parsed) } : null;
  }
  deleteSource(ownerId, projectId, sourceId) {
    this.initSources();
    const record2 = this.getSource(ownerId, projectId, sourceId);
    if (!record2) return false;
    this.initClaims();
    return this.transaction(() => {
      for (const claim of this.listClaims(ownerId, projectId)) {
        if (claim.sourceSpans.some((span) => span.sourceId === sourceId))
          this.deleteClaim(ownerId, projectId, claim.id);
      }
      const removed = this.db.prepare("DELETE FROM sources WHERE id = ? AND owner_id = ? AND project_id = ?").run(sourceId, ownerId, projectId).changes > 0;
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
    if (existing.length + claims.length > 1e3)
      throw new Error("Too many claims in this project");
    const spans = new Set(existing.map((claim) => {
      const span = claim.sourceSpans[0];
      return span?.sourceId + ":" + (span?.row ?? span?.charStart);
    }));
    const insert = this.db.prepare("INSERT INTO claims VALUES (?, ?, ?, ?)");
    this.transaction(() => {
      for (const claim of claims) {
        validateClaim(claim);
        if (claim.ownerId !== ownerId || claim.projectId !== projectId)
          throw new Error("Claim ownership mismatch");
        for (const span2 of claim.sourceSpans) {
          if (!this.getSource(ownerId, projectId, span2.sourceId))
            throw new Error("Source not found");
        }
        const span = claim.sourceSpans[0];
        const key2 = span?.sourceId + ":" + (span?.row ?? span?.charStart);
        if (spans.has(key2)) continue;
        insert.run(claim.id, ownerId, projectId, JSON.stringify(claim));
        spans.add(key2);
      }
    });
    return this.listClaims(ownerId, projectId);
  }
  listClaims(ownerId, projectId) {
    this.initClaims();
    if (!this.getProject(ownerId, projectId)) return [];
    return this.db.prepare("SELECT payload FROM claims WHERE owner_id = ? AND project_id = ? ORDER BY rowid").all(ownerId, projectId).map((row) => JSON.parse(row.payload));
  }
  updateClaim(ownerId, projectId, claimId, { text, decision }) {
    this.initClaims();
    const row = this.db.prepare("SELECT payload FROM claims WHERE id = ? AND owner_id = ? AND project_id = ?").get(claimId, ownerId, projectId);
    if (!row) return null;
    if (!["accept", "reject", "pending"].includes(decision)) throw new Error("Invalid review decision");
    const prior = JSON.parse(row.payload);
    if (text !== void 0 && (typeof text !== "string" || !text.trim() || text.length > 2e3))
      throw new Error("Invalid claim text");
    const edited = text !== void 0 && text.trim() !== prior.text;
    const updated = {
      ...prior,
      text: text === void 0 ? prior.text : text.trim(),
      provenance: edited ? "assumption" : prior.provenance,
      reviewed: decision === "accept",
      rejected: decision === "reject",
      confidenceStatus: decision === "accept" ? "reviewed" : "unverified"
    };
    validateClaim(updated);
    this.db.prepare("UPDATE claims SET payload = ? WHERE id = ? AND owner_id = ? AND project_id = ?").run(JSON.stringify(updated), claimId, ownerId, projectId);
    return updated;
  }
  deleteClaim(ownerId, projectId, claimId) {
    this.initClaims();
    return this.db.prepare("DELETE FROM claims WHERE id = ? AND owner_id = ? AND project_id = ?").run(claimId, ownerId, projectId).changes > 0;
  }
  initScenarios() {
    this.db.exec("CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE, payload TEXT NOT NULL)");
    this.db.exec("CREATE INDEX IF NOT EXISTS idx_scenarios_project ON scenarios(owner_id, project_id)");
  }
  putScenario(ownerId, projectId, scenario) {
    this.initScenarios();
    validateScenario(scenario);
    if (scenario.ownerId !== ownerId || scenario.projectId !== projectId || !this.getProject(ownerId, projectId)) throw new Error("Project not found");
    const row = this.db.prepare("SELECT payload FROM scenarios WHERE id = ?").get(scenario.id);
    if (row) {
      if (row.payload !== JSON.stringify(scenario)) throw new Error("Conflicting scenario");
      return scenario;
    }
    this.db.prepare("INSERT INTO scenarios VALUES (?, ?, ?, ?)").run(scenario.id, ownerId, projectId, JSON.stringify(scenario));
    return scenario;
  }
  getScenario(ownerId, scenarioId) {
    this.initScenarios();
    const row = this.db.prepare("SELECT payload FROM scenarios WHERE id = ? AND owner_id = ?").get(scenarioId, ownerId);
    return row ? JSON.parse(row.payload) : null;
  }
  listScenarios(ownerId, projectId) {
    this.initScenarios();
    if (!this.getProject(ownerId, projectId)) return [];
    return this.db.prepare("SELECT payload FROM scenarios WHERE owner_id = ? AND project_id = ? ORDER BY rowid DESC").all(ownerId, projectId).map((row) => JSON.parse(row.payload));
  }
  updateProject(ownerId, projectId, title) {
    const previous = this.getProject(ownerId, projectId);
    if (!previous) return null;
    const updated = { ...previous, title, updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
    validateProject(updated);
    this.db.prepare("UPDATE projects SET payload = ? WHERE id = ? AND owner_id = ?").run(JSON.stringify(updated), projectId, ownerId);
    return updated;
  }
  deleteRun(ownerId, runId) {
    return this.db.prepare("DELETE FROM runs WHERE id = ? AND owner_id = ?").run(runId, ownerId).changes > 0;
  }
  deleteProject(ownerId, projectId) {
    return this.db.prepare("DELETE FROM projects WHERE id = ? AND owner_id = ?").run(projectId, ownerId).changes > 0;
  }
};

// server/jobs/queue.mjs
var SQL = [
  "CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE, status TEXT NOT NULL, lease_owner TEXT, lease_until INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3, pause_requested INTEGER NOT NULL DEFAULT 0, checkpoint_seq INTEGER NOT NULL DEFAULT 0, spent_calls INTEGER NOT NULL DEFAULT 0, spent_tokens INTEGER NOT NULL DEFAULT 0, rounds INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, error_code TEXT)",
  "CREATE INDEX IF NOT EXISTS idx_jobs_claim ON jobs(status, lease_until, created_at)"
].join(";\n") + ";";
var boundedInteger = (value, low, high) => Number.isInteger(value) && value >= low && value <= high;
var toJob = (row) => row ? {
  id: row.id,
  ownerId: row.owner_id,
  runId: row.run_id,
  status: row.status,
  leaseOwner: row.lease_owner,
  leaseUntil: row.lease_until,
  attempts: row.attempts,
  maxAttempts: row.max_attempts,
  pauseRequested: Boolean(row.pause_requested),
  checkpointSeq: row.checkpoint_seq,
  spentCalls: row.spent_calls,
  spentTokens: row.spent_tokens,
  rounds: row.rounds,
  errorCode: row.error_code
} : null;
var SqliteJobQueue = class {
  constructor(store) {
    this.store = store;
    this.db = store.db;
    this.db.exec(SQL);
  }
  enqueue({ id: id2, ownerId, runId, rounds, maxAttempts = 3, now = Date.now() }) {
    if (typeof id2 !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/.test(id2))
      throw new Error("Invalid job ID");
    if (!boundedInteger(rounds, 1, 12) || !boundedInteger(maxAttempts, 1, 10))
      throw new Error("Invalid job limits");
    if (!this.store.getRun(ownerId, runId)) throw new Error("Run not found");
    const prior = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(id2);
    const active = this.db.prepare("SELECT COUNT(*) AS count FROM jobs WHERE owner_id = ? AND status IN ('queued','running')").get(ownerId).count;
    if (!prior && active >= 2) throw new Error("Only two active jobs per owner");
    if (prior) {
      if (prior.owner_id !== ownerId || prior.run_id !== runId || prior.rounds !== rounds)
        throw new Error("Conflicting job");
      return toJob(prior);
    }
    this.db.prepare(
      "INSERT INTO jobs(id,owner_id,run_id,status,rounds,max_attempts,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)"
    ).run(id2, ownerId, runId, "queued", rounds, maxAttempts, now, now);
    return this.get(ownerId, id2);
  }
  get(ownerId, id2) {
    return toJob(this.db.prepare("SELECT * FROM jobs WHERE id = ? AND owner_id = ?").get(id2, ownerId));
  }
  getByRun(ownerId, runId) {
    return toJob(this.db.prepare("SELECT * FROM jobs WHERE owner_id = ? AND run_id = ? ORDER BY created_at DESC LIMIT 1").get(ownerId, runId));
  }
  claim(workerId, { now = Date.now(), leaseMs = 3e4 } = {}) {
    if (!workerId || !boundedInteger(leaseMs, 1, 6e5)) throw new Error("Invalid lease");
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
  heartbeat(ownerId, id2, workerId, { now = Date.now(), leaseMs = 3e4 } = {}) {
    return this.db.prepare(
      "UPDATE jobs SET lease_until=?, updated_at=? WHERE id=? AND owner_id=? AND lease_owner=? AND status='running' AND lease_until > ?"
    ).run(now + leaseMs, now, id2, ownerId, workerId, now).changes === 1;
  }
  pause(ownerId, id2) {
    const job = this.get(ownerId, id2);
    if (!job || !["queued", "running"].includes(job.status)) return false;
    if (job.status === "queued") {
      this.db.prepare("UPDATE jobs SET status='paused' WHERE id=? AND owner_id=?").run(id2, ownerId);
    } else {
      this.db.prepare("UPDATE jobs SET pause_requested=1 WHERE id=? AND owner_id=?").run(id2, ownerId);
    }
    return true;
  }
  resume(ownerId, id2) {
    return this.db.prepare(
      "UPDATE jobs SET status='queued', pause_requested=0, lease_owner=NULL, lease_until=0 WHERE id=? AND owner_id=? AND status='paused'"
    ).run(id2, ownerId).changes === 1;
  }
  cancel(ownerId, id2) {
    return this.db.prepare(
      "UPDATE jobs SET status='cancelled', lease_owner=NULL, lease_until=0 WHERE id=? AND owner_id=? AND status IN ('queued','running','paused')"
    ).run(id2, ownerId).changes === 1;
  }
  progress(ownerId, id2, workerId, { seq, calls = 0, tokens = 0, now = Date.now() }) {
    const job = this.get(ownerId, id2);
    if (!job || job.status !== "running" || job.leaseOwner !== workerId || job.leaseUntil <= now)
      throw new Error("Job lease lost");
    if (!boundedInteger(seq, job.checkpointSeq, Number.MAX_SAFE_INTEGER) || !boundedInteger(calls, 0, 1e3) || !boundedInteger(tokens, 0, 1e7))
      throw new Error("Invalid progress");
    const status = job.pauseRequested ? "paused" : "running";
    this.db.prepare(
      "UPDATE jobs SET checkpoint_seq=?, spent_calls=spent_calls+?, spent_tokens=spent_tokens+?, status=?, lease_owner=CASE WHEN ?='paused' THEN NULL ELSE lease_owner END, updated_at=? WHERE id=?"
    ).run(seq, calls, tokens, status, status, now, id2);
    return this.get(ownerId, id2);
  }
  complete(ownerId, id2, workerId) {
    return this.db.prepare(
      "UPDATE jobs SET status='done', lease_owner=NULL, lease_until=0 WHERE id=? AND owner_id=? AND lease_owner=? AND status='running' AND pause_requested=0"
    ).run(id2, ownerId, workerId).changes === 1;
  }
  fail(ownerId, id2, workerId, code = "worker_error") {
    if (!/^[a-z_]{1,40}$/.test(code)) code = "worker_error";
    return this.db.prepare(
      "UPDATE jobs SET status='failed', error_code=?, lease_owner=NULL WHERE id=? AND owner_id=? AND lease_owner=? AND status='running'"
    ).run(code, id2, ownerId, workerId).changes === 1;
  }
};

// server/evidence/claims.mjs
import { randomUUID } from "node:crypto";
function proposeClaims(source, parsed) {
  const rows = parsed.spans || [];
  const headers = parsed.kind === "csv" ? rows[0]?.cells || [] : null;
  return rows.slice(headers ? 1 : 0).filter((span) => span.quote.trim()).slice(0, 200).map((span) => {
    const text = headers ? span.cells.map((value, index) => String(headers[index] || "column " + (index + 1)) + ": " + value).join(", ") : span.quote.replace(/^\s*[-*#]+\s*/, "").trim();
    if (!text) return null;
    const location = headers ? { row: span.row } : {
      charStart: span.charStart,
      charEnd: span.charEnd
    };
    return {
      schemaVersion: 1,
      id: randomUUID(),
      ownerId: source.ownerId,
      projectId: source.projectId,
      createdAt: (/* @__PURE__ */ new Date()).toISOString(),
      text: text.slice(0, 2e3),
      provenance: "observed",
      sourceSpans: [{ sourceId: source.id, ...location, quote: span.quote.slice(0, 1e3) }],
      confidenceStatus: "unverified",
      reviewed: false,
      rejected: false
    };
  }).filter(Boolean);
}
function flagConflicts(claims) {
  const map = /* @__PURE__ */ new Map();
  for (const claim of claims) {
    if (claim.rejected) continue;
    const match = /^([^,:]{2,50}):\s*([^,]{1,300})$/.exec(claim.text.trim());
    if (!match) continue;
    const key2 = match[1].trim().toLowerCase();
    const value = match[2].trim().toLowerCase();
    if (!map.has(key2)) map.set(key2, /* @__PURE__ */ new Set());
    map.get(key2).add(value);
  }
  return claims.map((claim) => {
    const match = /^([^,:]{2,50}):\s*([^,]{1,300})$/.exec(claim.text.trim());
    const conflict = match && map.get(match[1].trim().toLowerCase())?.size > 1;
    return conflict && !claim.rejected ? { ...claim, confidenceStatus: "conflicted" } : claim;
  });
}

// server/evidence/parser.mjs
import { createHash as createHash2, randomUUID as randomUUID2 } from "node:crypto";
import { extname } from "node:path";
var SUPPORTED = { ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv" };
var MAX_BYTES = 128 * 1024;
var MAX_LINES = 2e3;
var MAX_COLUMNS = 64;
function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false, afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
        afterQuote = true;
      } else cell += c;
      continue;
    }
    if (c === '"' && !afterQuote && cell === "") {
      quoted = true;
      continue;
    }
    if (c === "," || c === "\n") {
      row.push(cell);
      if (row.length > MAX_COLUMNS) throw new Error("CSV has too many columns");
      cell = "";
      afterQuote = false;
      if (c === "\n") {
        if (rows.length >= MAX_LINES) throw new Error("Too many rows");
        rows.push(row);
        row = [];
      }
      continue;
    }
    if (afterQuote || c === '"') throw new Error("Invalid CSV quotes");
    cell += c;
    if (cell.length > 4096) throw new Error("CSV cell is too long");
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (cell || row.length) {
    row.push(cell);
    if (row.length > MAX_COLUMNS || rows.length >= MAX_LINES) throw new Error("CSV too large");
    rows.push(row);
  }
  return rows;
}
function parseSource({ filename, content, mime }) {
  if (typeof filename !== "string" || !/^[^/\\\x00-\x1f]{1,255}$/.test(filename))
    throw new Error("Invalid filename");
  if (typeof content !== "string" || content.includes("\0") || /[\x01-\x08\x0b\x0c\x0e-\x1f]/.test(content))
    throw new Error("Invalid text content");
  const ext = extname(filename).toLowerCase();
  if (!SUPPORTED[ext]) throw new Error("Only TXT, Markdown and CSV are supported");
  if (mime && mime !== SUPPORTED[ext] && !(ext === ".md" && mime === "text/plain"))
    throw new Error("File type does not match its extension");
  const bytes = Buffer.byteLength(content, "utf8");
  if (!bytes || bytes > MAX_BYTES) throw new Error("File must be between 1 byte and 128 KB");
  if (Buffer.from(content, "utf8").toString("utf8") !== content)
    throw new Error("Invalid UTF-8 characters");
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let spans;
  if (ext === ".csv") {
    const rows = parseCsv(normalized);
    spans = rows.map((cells, index) => ({
      sourceRow: index + 1,
      row: index + 1,
      cells,
      quote: cells.join(" | ").slice(0, 1e3)
    }));
  } else {
    const lines = normalized.split("\n");
    if (lines.length > MAX_LINES) throw new Error("Too many lines");
    let start = 0;
    spans = lines.map((line, index) => {
      const span = {
        sourceRow: index + 1,
        charStart: start,
        charEnd: start + line.length,
        quote: line.slice(0, 1e3)
      };
      start += line.length + 1;
      return span;
    }).filter((span) => span.quote.trim());
  }
  if (spans.length > MAX_LINES) throw new Error("Too many source spans");
  return {
    kind: ext.slice(1),
    bytes,
    hash: createHash2("sha256").update(Buffer.from(content, "utf8")).digest("hex"),
    text: normalized,
    spans
  };
}
function makeSource(ownerId, projectId, filename, parsed) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    schemaVersion: 1,
    id: randomUUID2(),
    ownerId,
    projectId,
    filename,
    kind: parsed.kind,
    hash: parsed.hash,
    bytes: parsed.bytes,
    status: "parsed",
    privacy: "private",
    createdAt: now
  };
}

// server/projects/api.mjs
import { randomUUID as randomUUID3 } from "node:crypto";
var OWNER = "local";
var json = (res, code, value) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
};
function isLocal(req) {
  if (req.ripplePrivateAccessVerified === true) return true;
  const address = req.socket?.remoteAddress ?? "";
  let host, expectedOrigin;
  try {
    const hostUrl = new URL("http://" + String(req.headers?.host || ""));
    host = hostUrl.hostname.replace(/^\[|\]$/g, "");
    expectedOrigin = hostUrl.host;
  } catch {
    return false;
  }
  const origin = req.headers?.origin;
  const remote = address === "::1" || address === "127.0.0.1" || address.startsWith("::ffff:127.");
  try {
    return remote && ["localhost", "127.0.0.1", "::1"].includes(host) && (!origin || new URL(origin).host === expectedOrigin);
  } catch {
    return false;
  }
}
async function readBody(req) {
  const chunks = [];
  let length = 0;
  if (req.body != null) {
    const text = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(text) > 128e3) throw new Error("Request too large");
    return JSON.parse(text);
  }
  for await (const part of req) {
    length += part.length;
    if (length > 128e3) throw new Error("Request too large");
    chunks.push(part);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
var titleOf = (value) => {
  if (typeof value !== "string" || !value.trim() || value.length > 160)
    throw new Error("Give this project a title (up to 160 characters)");
  return value.trim();
};
function saveQuickRun(store, projectId, data) {
  if (!data || !Array.isArray(data.events) || data.events.length < 1 || data.events.length > 100)
    throw new Error("Invalid run events");
  if (!data.events[0]?.id || !data.events[0]?.title)
    throw new Error("Missing run origin");
  const id2 = randomUUID3();
  const at = (/* @__PURE__ */ new Date()).toISOString();
  const run = {
    schemaVersion: 1,
    id: id2,
    ownerId: OWNER,
    createdAt: at,
    scenarioId: "quick-ripple",
    seed: 0,
    modelId: String(data.model || "offline-demo").slice(0, 160),
    promptVersion: "quick-v1",
    engineVersion: "quick-v1",
    status: "done",
    budget: { maxCalls: 0, maxTokens: 0 },
    spent: { calls: 0, tokens: 0 },
    checkpointTick: 0,
    startedAt: at,
    completedAt: at,
    title: String(data.events[0].title).slice(0, 160),
    mode: data.mode === "gemma" ? "gemma" : "demo",
    summary: typeof data.summary === "string" ? data.summary.slice(0, 500) : ""
  };
  const references = new Map(data.events.map((item, i) => [item.id, id2 + "-e" + i]));
  const events = data.events.map((item, i) => ({
    schemaVersion: 1,
    id: id2 + "-e" + i,
    ownerId: OWNER,
    createdAt: at,
    runId: id2,
    seq: i + 1,
    tick: Math.max(0, Number(item.round) || 0),
    actorId: "ripple",
    type: i === 0 ? "quick-origin" : "quick-effect",
    payload: { quickEvent: item },
    parentEventIds: references.has(item.parentEventId) ? [references.get(item.parentEventId)] : [],
    sourceClaimIds: [],
    provenance: "hypothesis"
  }));
  store.putRun(OWNER, projectId, run);
  store.appendEvents(OWNER, id2, events);
  return run;
}
function createProjectApi(store) {
  return async function projects(req, res, next) {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (!pathname.startsWith("/api/projects") && !pathname.startsWith("/api/saved-runs"))
      return next?.();
    if (!isLocal(req)) return json(res, 403, { error: "Project history is local-only." });
    const parts = pathname.split("/").filter(Boolean);
    try {
      if (parts.length === 2 && parts[1] === "projects") {
        if (req.method === "GET") return json(res, 200, { projects: store.listProjects(OWNER) });
        if (req.method === "POST") {
          const input = await readBody(req);
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const project = {
            schemaVersion: 1,
            id: randomUUID3(),
            ownerId: OWNER,
            createdAt: now,
            updatedAt: now,
            domainPack: "product-decision",
            title: titleOf(input.title)
          };
          store.putProject(project);
          return json(res, 201, { project });
        }
      }
      const projectId = parts[2];
      if (parts[1] === "projects" && projectId) {
        const project = store.getProject(OWNER, projectId);
        if (!project) return json(res, 404, { error: "Project not found" });
        if (parts.length === 3) {
          if (req.method === "PATCH") {
            const input = await readBody(req);
            return json(res, 200, { project: store.updateProject(OWNER, projectId, titleOf(input.title)) });
          }
          if (req.method === "DELETE") return json(res, 200, { deleted: store.deleteProject(OWNER, projectId) });
        }
        if (parts.length === 4 && parts[3] === "runs") {
          if (req.method === "GET") return json(res, 200, { runs: store.listRuns(OWNER, projectId).filter((run) => run.scenarioId === "quick-ripple") });
          if (req.method === "POST") return json(res, 201, { run: saveQuickRun(store, projectId, await readBody(req)) });
        }
        if (parts.length === 4 && parts[3] === "claims" && req.method === "GET")
          return json(res, 200, { claims: flagConflicts(store.listClaims(OWNER, projectId)) });
        if (parts.length === 5 && parts[3] === "claims") {
          if (req.method === "PATCH") {
            const input = await readBody(req);
            const claim = store.updateClaim(OWNER, projectId, parts[4], input);
            return claim ? json(res, 200, { claim }) : json(res, 404, { error: "Claim not found" });
          }
          if (req.method === "DELETE")
            return json(res, 200, { deleted: store.deleteClaim(OWNER, projectId, parts[4]) });
        }
        if (parts.length === 6 && parts[3] === "sources" && parts[5] === "extract" && req.method === "POST") {
          const record2 = store.getSource(OWNER, projectId, parts[4]);
          if (!record2) return json(res, 404, { error: "Source not found" });
          const claims = store.putClaims(
            OWNER,
            projectId,
            proposeClaims(record2.source, record2.parsed)
          );
          return json(res, 200, { claims: flagConflicts(claims) });
        }
        if (parts.length === 4 && parts[3] === "sources") {
          if (req.method === "GET") return json(res, 200, { sources: store.listSources(OWNER, projectId) });
          if (req.method === "POST") {
            const input = await readBody(req);
            const parsed = parseSource(input);
            const source = makeSource(OWNER, projectId, input.filename, parsed);
            return json(res, 201, { source: store.putSource(OWNER, projectId, source, parsed) });
          }
        }
        if (parts.length === 5 && parts[3] === "sources") {
          const sourceId = parts[4];
          if (req.method === "GET") {
            const record2 = store.getSource(OWNER, projectId, sourceId);
            return record2 ? json(res, 200, record2) : json(res, 404, { error: "Source not found" });
          }
          if (req.method === "DELETE")
            return json(res, 200, { deleted: store.deleteSource(OWNER, projectId, sourceId) });
        }
        if (parts.length === 4 && parts[3] === "clone" && req.method === "POST") {
          const copy = {
            ...project,
            id: randomUUID3(),
            title: project.title + " copy",
            createdAt: (/* @__PURE__ */ new Date()).toISOString(),
            updatedAt: (/* @__PURE__ */ new Date()).toISOString()
          };
          store.putProject(copy);
          return json(res, 201, { project: copy });
        }
      }
      if (parts.length === 3 && parts[1] === "saved-runs" && req.method === "GET") {
        const run = store.getRun(OWNER, parts[2]);
        if (!run || run.scenarioId !== "quick-ripple") return json(res, 404, { error: "Quick run not found" });
        return json(res, 200, {
          run,
          events: store.readEvents(OWNER, run.id, { limit: 100 }).map((event) => event.payload.quickEvent)
        });
      }
      if (parts.length === 3 && parts[1] === "saved-runs" && req.method === "DELETE") {
        const run = store.getRun(OWNER, parts[2]);
        if (!run || run.scenarioId !== "quick-ripple") return json(res, 404, { error: "Quick run not found" });
        return json(res, 200, { deleted: store.deleteRun(OWNER, parts[2]) });
      }
      return json(res, 405, { error: "Unsupported action" });
    } catch (error) {
      return json(res, 400, { error: error.message === "Unexpected end of JSON input" ? "Expected a JSON body" : error.message });
    }
  };
}

// server/simulation/reports.mjs
import { randomUUID as randomUUID5 } from "node:crypto";

// server/simulation/domains/productDecision/index.mjs
import { randomUUID as randomUUID4 } from "node:crypto";
var PRODUCT_DECISION_ACTIONS = Object.freeze([
  "change_price",
  "announce_change",
  "contact_group",
  "request_information",
  "revise_plan",
  "allocate_budget",
  "adopt_product",
  "cancel_subscription",
  "respond_to_announcement",
  "do_nothing"
]);
function validPrice(value) {
  return Number.isFinite(value) && value > 0 && value <= 1e6;
}
function createPricingScenario({
  world,
  projectId,
  question,
  interventions,
  rounds = 6,
  seed = 1
}) {
  validateWorldState(world);
  if (typeof question !== "string" || !question.trim() || question.length > 1e3)
    throw new Error("A specific decision question is required");
  if (!Array.isArray(interventions) || interventions.length < 2 || interventions.length > 10)
    throw new Error("Compare at least two interventions");
  const variants = interventions.map((option, index) => {
    if (!validPrice(option.price) || !Number.isFinite(option.rolloutPercent) || option.rolloutPercent < 0 || option.rolloutPercent > 100)
      throw new Error("Enter a price and rollout percentage for each intervention");
    return {
      id: "option-" + index,
      label: String(option.label || "Option " + (index + 1)),
      changes: { currentPrice: option.price, rolloutPercent: option.rolloutPercent }
    };
  });
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const scenario = {
    schemaVersion: 1,
    id: randomUUID4(),
    projectId,
    ownerId: world.ownerId,
    createdAt: now,
    question: question.trim(),
    baselineState: structuredClone(world),
    interventions: variants,
    config: { rounds, agents: world.entities.length, seed, domainPack: "product-decision" }
  };
  validateScenario(scenario);
  return scenario;
}
function pricingIndicators(world, {
  price = world.variables.currentPrice,
  rolloutPercent = world.variables.rolloutPercent
} = {}) {
  validateWorldState(world);
  if (!validPrice(price) || !Number.isFinite(rolloutPercent) || rolloutPercent < 0 || rolloutPercent > 100)
    throw new Error("Invalid intervention");
  const baselinePrice = world.variables.baselinePrice;
  const groups = world.entities.filter((entity) => entity.kind === "customer-segment");
  const perSegment = groups.map((group) => {
    const { customers, monthlyChurn } = group.attributes;
    const afterHistoricalChurn = customers * (1 - monthlyChurn);
    const effectivePrice = baselinePrice + (price - baselinePrice) * (rolloutPercent / 100);
    return {
      id: group.id,
      activeSubscribersUnderFixedChurn: afterHistoricalChurn,
      monthlyRevenueUnderFixedChurn: afterHistoricalChurn * effectivePrice
    };
  });
  return {
    provenance: "derived",
    method: "fixed-historical-churn-v1",
    label: "Illustration using unchanged historical churn, not a forecast",
    monthlyRevenueUnderFixedChurn: perSegment.reduce((total, row) => total + row.monthlyRevenueUnderFixedChurn, 0),
    activeSubscribersUnderFixedChurn: perSegment.reduce((total, row) => total + row.activeSubscribersUnderFixedChurn, 0),
    perSegment
  };
}
function productDecisionAgents(world, { competitorName } = {}) {
  validateWorldState(world);
  const at = (/* @__PURE__ */ new Date()).toISOString();
  const agent = (id2, role, goal, constraints, policy = {}) => {
    const value = {
      schemaVersion: 1,
      id: id2,
      ownerId: world.ownerId,
      createdAt: at,
      role,
      goal,
      constraints,
      policy,
      observations: [],
      memoryRefs: []
    };
    validateAgent(value);
    return value;
  };
  const actors = [agent(
    "company-agent",
    "company",
    "Evaluate revenue and customer experience without taking real-world action",
    { budget: world.resources.marketingBudget },
    { actionCadence: 1 }
  )];
  for (const entity of world.entities) {
    if (entity.kind !== "customer-segment") continue;
    actors.push(agent(
      "segment-" + entity.id,
      "customer-segment",
      "Consider perceived value, alternatives and information available to this segment",
      { segmentId: entity.id, customers: entity.attributes.customers },
      { actionCadence: 1 }
    ));
  }
  if (competitorName) {
    if (typeof competitorName !== "string" || competitorName.length > 160)
      throw new Error("Invalid competitor label");
    actors.push(agent(
      "competitor-agent",
      "competitor",
      "Assess reactions to changes in competing offers",
      { label: competitorName },
      { actionCadence: 2 }
    ));
  }
  return actors;
}

// server/simulation/reports.mjs
function sourceRef(span, sources) {
  const source = sources.find((file) => file.id === span.sourceId);
  if (!source) throw new Error("A claim references an unavailable source");
  return source.filename + (span.row ? " row " + span.row : span.page ? " page " + span.page : " characters " + span.charStart + "\u2013" + span.charEnd);
}
function makeRunReport({
  run,
  scenario,
  events,
  checkpoint,
  claims = [],
  sources = [],
  generatedAt = (/* @__PURE__ */ new Date()).toISOString()
}) {
  validateRun(run);
  validateScenario(scenario);
  if (run.ownerId !== scenario.ownerId || run.scenarioId !== scenario.id)
    throw new Error("Scenario and run do not belong together");
  if (!checkpoint || checkpoint.runId !== run.id || !checkpoint.serializedState?.world)
    throw new Error("Report requires a saved checkpoint");
  if (!Array.isArray(events)) throw new Error("Event list is required");
  const referenced = new Set(scenario.baselineState.activeAssumptions);
  for (const entity of scenario.baselineState.entities) {
    for (const id2 of entity.sourceClaimIds) referenced.add(id2);
  }
  for (const event of events) for (const id2 of event.sourceClaimIds)
    referenced.add(id2);
  const evidence = [...referenced].map((id2) => {
    const claim = claims.find((item) => item.id === id2);
    if (!claim || !claim.reviewed || claim.rejected)
      throw new Error("Report cannot cite a missing or unreviewed claim");
    return {
      id: claim.id,
      text: claim.text,
      provenance: claim.provenance,
      sourceRefs: claim.sourceSpans.map((span) => sourceRef(span, sources)),
      sourceSpans: claim.sourceSpans
    };
  });
  for (const entity of scenario.baselineState.entities) {
    if (entity.provenance === "assumption") {
      evidence.push({
        text: entity.label + ": " + Object.entries(entity.attributes).map(([key2, value]) => key2 + " = " + value).join(", "),
        provenance: "assumption",
        sourceRefs: []
      });
    }
  }
  const observed = events.filter((event) => event.type !== "tick-summary");
  const counts = Object.entries(observed.reduce((summary, event) => {
    summary[event.type] = (summary[event.type] || 0) + 1;
    return summary;
  }, {})).sort((a, b) => b[1] - a[1]);
  const state = checkpoint.serializedState.world;
  const indicators2 = pricingIndicators(scenario.baselineState, {
    price: state.variables.currentPrice,
    rolloutPercent: state.variables.rolloutPercent
  });
  const findings = [{
    provenance: "derived",
    text: "Illustrative monthly revenue under unchanged historical churn: " + indicators2.monthlyRevenueUnderFixedChurn.toFixed(2) + " (calculation only, not predicted revenue)"
  }, ...counts.slice(0, 20).map(([type, count]) => ({
    provenance: "simulated-event",
    text: count + " " + type.replaceAll("_", " ") + " events occurred inside this run"
  }))];
  const alternatives = [
    {
      id: "baseline",
      label: "Baseline",
      amount: pricingIndicators(scenario.baselineState).monthlyRevenueUnderFixedChurn
    },
    ...scenario.interventions.map((option) => ({
      id: option.id,
      label: option.label,
      amount: pricingIndicators(scenario.baselineState, {
        price: option.changes.currentPrice,
        rolloutPercent: option.changes.rolloutPercent
      }).monthlyRevenueUnderFixedChurn
    }))
  ];
  const report = {
    schemaVersion: 1,
    id: randomUUID5(),
    ownerId: run.ownerId,
    createdAt: generatedAt,
    runId: run.id,
    question: scenario.question,
    inputs: {
      scenarioId: scenario.id,
      domainPack: "product-decision",
      interventionId: run.interventionId || "baseline",
      baselineVariables: scenario.baselineState.variables,
      finalVariables: state.variables,
      agentModel: run.modelId,
      seed: run.seed,
      ticks: checkpoint.tick,
      stateHash: checkpoint.stateHash
    },
    evidence,
    findings,
    limitations: [
      "This is an experimental scenario rehearsal, not a calibrated real-world prediction.",
      "Synthetic agents are not representative samples of actual customers.",
      "Historical churn was held fixed for the illustrative revenue calculation.",
      "No causal effect or real-world probability can be inferred from agent event counts.",
      "Missing data, private signals and model assumptions can change the outcomes."
    ],
    comparisons: alternatives.map((entry) => ({
      label: entry.label,
      interventionId: entry.id,
      illustrativeMonthlyRevenue: entry.amount,
      provenance: "derived",
      method: "fixed-historical-churn-v1"
    })),
    methodVersion: "product-decision-rules-v1",
    generatedAt
  };
  validateReport(report);
  return report;
}
function formatReportMarkdown(report) {
  validateReport(report);
  const escapeMarkdown = (value) => String(value).replace(/[<>&]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[character]).replace(/[\r\n]+/g, " ");
  const lines = [
    "# Ripple decision rehearsal",
    "",
    "**Question:** " + escapeMarkdown(report.question),
    "**Run ID:** `" + report.runId + "`",
    "**Method:** " + report.methodVersion,
    "**State hash:** `" + report.inputs.stateHash + "`",
    "",
    "## Inputs and assumptions",
    "",
    ...report.evidence.map((item) => "- [" + item.provenance + "] " + escapeMarkdown(item.text) + (item.sourceRefs?.length ? " \u2014 " + item.sourceRefs.map(escapeMarkdown).join("; ") : "")),
    "",
    "## Illustrative alternatives",
    "",
    ...report.comparisons.map((item) => "- " + escapeMarkdown(item.label) + ": " + Number(item.illustrativeMonthlyRevenue).toFixed(2) + " / month (calculated under fixed churn)"),
    "",
    "## Events and observations",
    "",
    ...report.findings.map((item) => "- [" + item.provenance + "] " + escapeMarkdown(item.text)),
    "",
    "## Limits and next questions",
    "",
    ...report.limitations.map((item) => "- " + escapeMarkdown(item)),
    "- Which assumptions could be tested in a staged, real-world experiment?",
    "- What evidence would change this decision?",
    "",
    "_Nothing in this report should be interpreted as a verified forecast._"
  ];
  return lines.join("\n") + "\n";
}

// shared/simulation/diff.mjs
var PRICE_KEYS = ["baselinePrice", "currentPrice", "rolloutPercent"];
function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function comparableCheckpoint(checkpoint) {
  return checkpoint?.serializedState?.world || null;
}
function compareSimulationRuns(scenario, first, second) {
  validateScenario(scenario);
  for (const snapshot of [first, second]) {
    if (!snapshot?.run || snapshot.run.scenarioId !== scenario.id)
      throw new Error("Runs must belong to the same scenario");
    if (snapshot.run.ownerId !== scenario.ownerId)
      throw new Error("Run ownership mismatch");
  }
  const a = comparableCheckpoint(first.checkpoint);
  const b = comparableCheckpoint(second.checkpoint);
  if (!a || !b) throw new Error("Both runs need a checkpoint");
  const changedVariables = Object.keys({ ...a.variables, ...b.variables }).filter((key2) => a.variables[key2] !== b.variables[key2]).map((key2) => ({ key: key2, baseline: a.variables[key2] ?? null, alternative: b.variables[key2] ?? null }));
  const changedResources = Object.keys({ ...a.resources, ...b.resources }).filter((key2) => a.resources[key2] !== b.resources[key2]).map((key2) => ({ key: key2, baseline: a.resources[key2] ?? null, alternative: b.resources[key2] ?? null }));
  const findEntity = (world, id2) => world.entities.find((entity) => entity.id === id2);
  const changedEntities = [...new Set([...a.entities, ...b.entities].map((entity) => entity.id))].filter((id2) => JSON.stringify(findEntity(a, id2) || null) !== JSON.stringify(findEntity(b, id2) || null)).map((id2) => ({
    id: id2,
    baseline: findEntity(a, id2)?.attributes ?? null,
    alternative: findEntity(b, id2)?.attributes ?? null
  }));
  const idsA = new Set(a.relationships.map((relation) => relation.id));
  const idsB = new Set(b.relationships.map((relation) => relation.id));
  const changedLinks = {
    added: [...idsB].filter((id2) => !idsA.has(id2)),
    removed: [...idsA].filter((id2) => !idsB.has(id2))
  };
  const countEvents = (events) => events.reduce((totals, event) => {
    totals[event.type] = (totals[event.type] || 0) + 1;
    return totals;
  }, {});
  return {
    schemaVersion: 1,
    scenarioId: scenario.id,
    baselineRunId: first.run.id,
    alternativeRunId: second.run.id,
    tickCounts: { baseline: a.tick, alternative: b.tick },
    inputDifferences: scenario.interventions.find((option) => option.id === second.run.interventionId)?.changes || {},
    changedVariables,
    changedResources,
    changedEntities,
    changedLinks,
    eventCounts: {
      baseline: countEvents(first.events || []),
      alternative: countEvents(second.events || [])
    },
    limitations: [
      "Agent responses are simulated hypotheses, not observed customer behavior.",
      "A single seeded run does not establish a real-world probability.",
      "Input assumptions and real-world uncertainty may dominate these differences."
    ]
  };
}
function forkScenarioAtCheckpoint({
  originalScenario,
  checkpoint,
  overrides,
  label,
  id: id2,
  createdAt
}) {
  validateScenario(originalScenario);
  const world = comparableCheckpoint(checkpoint);
  if (!world || world.ownerId !== originalScenario.ownerId)
    throw new Error("Checkpoint world is unavailable or belongs to another owner");
  if (!overrides || Array.isArray(overrides) || typeof overrides !== "object" || Object.keys(overrides).length < 1 || Object.keys(overrides).length > 8)
    throw new Error("Select at least one variable to change");
  const changedWorld = structuredClone(world);
  for (const [key2, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(changedWorld.variables, key2))
      throw new Error("Cannot change an undeclared variable");
    if (!PRICE_KEYS.includes(key2) || !finite(value))
      throw new Error("Variable change is not supported");
    if (key2 !== "rolloutPercent" && value <= 0)
      throw new Error("Price must be positive");
    if (key2 === "rolloutPercent" && (value < 0 || value > 100))
      throw new Error("Rollout must be between 0 and 100");
    changedWorld.variables[key2] = value;
  }
  changedWorld.tick = 0;
  changedWorld.id = "world-" + id2;
  changedWorld.createdAt = createdAt;
  const scenario = {
    ...structuredClone(originalScenario),
    id: id2,
    createdAt,
    question: String(label || originalScenario.question).slice(0, 1e3),
    baselineState: changedWorld,
    interventions: originalScenario.interventions.map((choice2) => ({
      ...choice2,
      changes: { ...choice2.changes }
    })),
    forkedFrom: {
      runId: checkpoint.runId,
      tick: checkpoint.tick,
      stateHash: checkpoint.stateHash
    }
  };
  validateScenario(scenario);
  return scenario;
}

// server/simulation/api.mjs
import { randomUUID as randomUUID6 } from "node:crypto";

// server/simulation/worldBuilder.mjs
var idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
var validAmount = (number2) => Number.isFinite(number2) && number2 >= 0;
function approvedClaimIds(claims) {
  return new Set(flagConflicts(claims).filter((claim) => claim.reviewed && !claim.rejected && claim.confidenceStatus === "reviewed").map((claim) => claim.id));
}
function buildWorld({
  project,
  claims = [],
  companyName,
  segments = [],
  baselinePrice,
  marketingBudget = 0,
  relationships = [],
  assumptions = [],
  companySourceClaimIds = []
}) {
  if (!project?.id || !project.ownerId) throw new Error("Project is required");
  if (typeof companyName !== "string" || !companyName.trim() || companyName.length > 160)
    throw new Error("Name the company or product");
  if (!validAmount(baselinePrice) || baselinePrice <= 0 || !validAmount(marketingBudget))
    throw new Error("Enter a positive current price and a nonnegative budget");
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 100)
    throw new Error("Enter at least one customer segment");
  const reviewed = approvedClaimIds(claims);
  const requiredClaims = (ids3 = []) => {
    if (!Array.isArray(ids3) || ids3.some((id2) => !reviewed.has(id2)))
      throw new Error("World references an unreviewed or conflicting claim");
    return ids3;
  };
  const at = (/* @__PURE__ */ new Date()).toISOString();
  const base2 = (id2) => ({
    schemaVersion: 1,
    ownerId: project.ownerId,
    id: id2,
    createdAt: at
  });
  const company = {
    ...base2("company"),
    kind: "company",
    label: companyName.trim(),
    attributes: { baselinePrice },
    provenance: "assumption",
    sourceClaimIds: requiredClaims(companySourceClaimIds)
  };
  const entities = [company];
  const edges = [];
  const ids2 = /* @__PURE__ */ new Set(["company"]);
  for (const segment of segments) {
    if (!idPattern.test(segment.id || "") || ids2.has(segment.id))
      throw new Error("Duplicate or invalid customer segment ID");
    if (typeof segment.label !== "string" || !segment.label.trim() || segment.label.length > 160 || !Number.isInteger(segment.customers) || segment.customers < 0 || !Number.isFinite(segment.monthlyChurn) || segment.monthlyChurn < 0 || segment.monthlyChurn > 1)
      throw new Error("Each segment needs a label, customer count and churn fraction");
    ids2.add(segment.id);
    entities.push({
      ...base2(segment.id),
      kind: "customer-segment",
      label: segment.label.trim(),
      attributes: { customers: segment.customers, monthlyChurn: segment.monthlyChurn },
      sourceClaimIds: requiredClaims(segment.sourceClaimIds),
      provenance: "assumption"
    });
    edges.push({
      ...base2("serves-" + segment.id),
      fromId: "company",
      toId: segment.id,
      kind: "serves",
      direction: "directed",
      constraints: {},
      provenance: "assumption"
    });
  }
  for (let i = 0; i < relationships.length; i++) {
    const relation = relationships[i];
    if (!ids2.has(relation.fromId) || !ids2.has(relation.toId) || relation.fromId === relation.toId || !idPattern.test(relation.kind || ""))
      throw new Error("Invalid world relationship");
    requiredClaims(relation.sourceClaimIds);
    edges.push({
      ...base2("link-" + i),
      fromId: relation.fromId,
      toId: relation.toId,
      kind: relation.kind,
      direction: "directed",
      constraints: {},
      sourceClaimIds: relation.sourceClaimIds || [],
      provenance: "hypothesis"
    });
  }
  requiredClaims(assumptions);
  const state = {
    ...base2("world-" + project.id),
    tick: 0,
    entities,
    relationships: edges,
    variables: { baselinePrice, currentPrice: baselinePrice, rolloutPercent: 100 },
    resources: { marketingBudget },
    activeAssumptions: assumptions
  };
  validateWorldState(state);
  return state;
}

// server/simulation/api.mjs
var OWNER2 = "local";
var send = (res, status, data) => {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
};
async function bodyOf(req) {
  if (req.body != null) {
    const text = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(text) > 64e3) throw new Error("Request too large");
    return JSON.parse(text);
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 64e3) throw new Error("Request too large");
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || Array.isArray(body) || typeof body !== "object")
    throw new Error("Expected a JSON object");
  return body;
}
function indicators(scenario) {
  const world = scenario.baselineState;
  return {
    baseline: pricingIndicators(world),
    alternatives: scenario.interventions.map((option) => ({
      id: option.id,
      label: option.label,
      ...pricingIndicators(world, {
        price: option.changes.currentPrice,
        rolloutPercent: option.changes.rolloutPercent
      })
    }))
  };
}
function makeRun(scenario, interventionId) {
  if (interventionId !== "baseline" && !scenario.interventions.some((item) => item.id === interventionId))
    throw new Error("Unknown intervention");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    schemaVersion: 1,
    id: randomUUID6(),
    ownerId: OWNER2,
    createdAt: now,
    scenarioId: scenario.id,
    interventionId,
    seed: scenario.config.seed || 1,
    modelId: "rules",
    promptVersion: "product-decision-v1",
    engineVersion: "ripple-sim-v1",
    status: "queued",
    budget: { maxCalls: 0, maxTokens: 0 },
    spent: { calls: 0, tokens: 0 },
    checkpointTick: 0,
    startedAt: null,
    completedAt: null
  };
}
function createSimulationApi(store, queue) {
  return async function simulationApi(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    const isScenario = parts[1] === "projects" && parts[3] === "scenarios";
    const isJob = parts[1] === "simulation-jobs";
    const isRun = parts[1] === "simulation-runs";
    if (!(isScenario || isJob || isRun)) return next?.();
    if (!isLocal(req)) return send(res, 403, { error: "Simulations are local-only." });
    try {
      if (isScenario) {
        const projectId = parts[2];
        const project = store.getProject(OWNER2, projectId);
        if (!project) return send(res, 404, { error: "Project not found" });
        if (parts.length === 4) {
          if (req.method === "GET")
            return send(res, 200, { scenarios: store.listScenarios(OWNER2, projectId) });
          if (req.method === "POST") {
            if (store.listScenarios(OWNER2, projectId).length >= 50)
              throw new Error("Too many scenarios in this project");
            const input = await bodyOf(req);
            if (!Array.isArray(input.segments) || input.segments.length > 19 || input.segments.length < 1)
              throw new Error("Use 1\u201319 customer segments");
            const rounds = input.rounds ?? 6;
            if (!Number.isInteger(rounds) || rounds < 1 || rounds > 12)
              throw new Error("Use 1\u201312 simulation rounds");
            const world = buildWorld({
              project,
              claims: store.listClaims(OWNER2, projectId),
              companyName: input.companyName,
              baselinePrice: input.baselinePrice,
              companySourceClaimIds: input.companySourceClaimIds || [],
              marketingBudget: input.marketingBudget ?? 0,
              segments: input.segments,
              relationships: input.relationships || [],
              assumptions: input.assumptions || []
            });
            const scenario2 = createPricingScenario({
              world,
              projectId,
              question: input.question,
              interventions: input.interventions,
              rounds,
              seed: input.seed ?? 1
            });
            store.putScenario(OWNER2, projectId, scenario2);
            return send(res, 201, { scenario: scenario2, indicators: indicators(scenario2) });
          }
        }
        const scenario = store.getScenario(OWNER2, parts[4]);
        if (!scenario || scenario.projectId !== projectId)
          return send(res, 404, { error: "Scenario not found" });
        if (parts.length === 5 && req.method === "GET")
          return send(res, 200, { scenario, indicators: indicators(scenario) });
        if (parts.length === 6 && parts[5] === "runs") {
          if (req.method === "GET") {
            const runs = store.listRuns(OWNER2, projectId).filter((run) => run.scenarioId === scenario.id).map((run) => ({ ...run, job: queue.getByRun?.(OWNER2, run.id) || null }));
            return send(res, 200, { runs });
          }
          if (req.method === "POST") {
            const input = await bodyOf(req);
            const interventionId = input.interventionId || "baseline";
            const history = store.listRuns(OWNER2, projectId).filter((run2) => run2.scenarioId === scenario.id);
            if (history.length >= 30) throw new Error("Too many runs in this scenario");
            const run = makeRun(scenario, interventionId);
            store.putRun(OWNER2, projectId, run);
            const job = queue.enqueue({
              id: randomUUID6(),
              ownerId: OWNER2,
              runId: run.id,
              rounds: scenario.config.rounds
            });
            return send(res, 201, { run, job });
          }
        }
      }
      if (isJob && parts.length === 3) {
        const job = queue.get(OWNER2, parts[2]);
        if (!job) return send(res, 404, { error: "Job not found" });
        if (req.method === "GET") {
          const after = Number(url.searchParams.get("after") || 0);
          const events = store.readEvents(OWNER2, job.runId, { after, limit: 500 });
          const checkpoint = store.getCheckpoint(OWNER2, job.runId);
          return send(res, 200, { job, events, checkpoint });
        }
        if (req.method === "PATCH") {
          const input = await bodyOf(req);
          const operation = { pause: queue.pause, resume: queue.resume, cancel: queue.cancel }[input.action];
          if (!operation) throw new Error("Unknown job action");
          operation.call(queue, OWNER2, job.id);
          return send(res, 200, { job: queue.get(OWNER2, job.id) });
        }
      }
      if (isRun && parts.length === 4 && parts[3] === "report" && req.method === "GET") {
        const run = store.getRun(OWNER2, parts[2]);
        if (!run) return send(res, 404, { error: "Run not found" });
        const scenario = store.getScenario(OWNER2, run.scenarioId);
        const checkpoint = store.getCheckpoint(OWNER2, run.id);
        if (!scenario || !checkpoint)
          return send(res, 404, { error: "Report is not available until a checkpoint is saved" });
        const report = makeRunReport({
          run,
          scenario,
          checkpoint,
          events: store.readEvents(OWNER2, run.id, { limit: 1e3 }),
          claims: store.listClaims(OWNER2, scenario.projectId),
          sources: store.listSources(OWNER2, scenario.projectId)
        });
        return send(res, 200, { report, markdown: formatReportMarkdown(report) });
      }
      if (isRun && parts.length === 3 && parts[2] === "compare" && req.method === "POST") {
        const input = await bodyOf(req);
        const a = store.getRun(OWNER2, input.baselineRunId);
        const b = store.getRun(OWNER2, input.alternativeRunId);
        if (!a || !b || a.scenarioId !== b.scenarioId)
          return send(res, 404, { error: "Run pair not found" });
        const scenario = store.getScenario(OWNER2, a.scenarioId);
        if (!scenario) return send(res, 404, { error: "Scenario not found" });
        const read = (run) => ({
          run,
          checkpoint: store.getCheckpoint(OWNER2, run.id),
          events: store.readEvents(OWNER2, run.id, { limit: 1e3 })
        });
        return send(res, 200, { comparison: compareSimulationRuns(scenario, read(a), read(b)) });
      }
      if (isRun && parts.length === 4 && parts[3] === "fork" && req.method === "POST") {
        const run = store.getRun(OWNER2, parts[2]);
        if (!run) return send(res, 404, { error: "Run not found" });
        const source = store.getCheckpoint(OWNER2, run.id);
        const original = store.getScenario(OWNER2, run.scenarioId);
        if (!source || !original)
          return send(res, 404, { error: "Checkpoint unavailable" });
        const input = await bodyOf(req);
        const id2 = randomUUID6();
        const createdAt = (/* @__PURE__ */ new Date()).toISOString();
        const fork = forkScenarioAtCheckpoint({
          originalScenario: original,
          checkpoint: source,
          overrides: input.changes,
          label: input.label,
          id: id2,
          createdAt
        });
        if (store.listScenarios(OWNER2, original.projectId).length >= 50)
          throw new Error("Too many scenarios in this project");
        store.putScenario(OWNER2, original.projectId, fork);
        return send(res, 201, { scenario: fork, from: {
          runId: run.id,
          tick: source.tick
        } });
      }
      if (isRun && parts.length === 3 && req.method === "GET") {
        const run = store.getRun(OWNER2, parts[2]);
        if (!run) return send(res, 404, { error: "Run not found" });
        return send(res, 200, {
          run,
          events: store.readEvents(OWNER2, run.id, { limit: 1e3 }),
          checkpoint: store.getCheckpoint(OWNER2, run.id)
        });
      }
      return send(res, 405, { error: "Unsupported action" });
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
  };
}

// server/simulation/agents/index.mjs
var ALLOWED_BY_ROLE = Object.freeze({
  company: [
    "change_price",
    "announce_change",
    "contact_group",
    "request_information",
    "revise_plan",
    "allocate_budget",
    "do_nothing"
  ],
  "customer-segment": [
    "request_information",
    "respond_to_announcement",
    "adopt_product",
    "cancel_subscription",
    "do_nothing"
  ],
  competitor: ["respond_to_announcement", "contact_group", "do_nothing"],
  regulator: ["request_information", "respond_to_announcement", "do_nothing"]
});
function allowedToAct(agent, actionType) {
  return Boolean(ALLOWED_BY_ROLE[agent.role]?.includes(actionType));
}
function visibleTo(agent, event) {
  const visibility = event.payload?.visibility;
  return visibility === "public" || visibility === "all" || event.actorId === agent.id || Array.isArray(event.payload?.audience) && event.payload.audience.includes(agent.id);
}
function observeAgent(agent, world, events = []) {
  validateAgent(agent);
  validateWorldState(world);
  const ownSegment = agent.role === "customer-segment" ? world.entities.find((entity) => entity.id === agent.constraints.segmentId) : null;
  if (agent.role === "customer-segment" && !ownSegment)
    throw new Error("Agent references an unknown segment");
  const knownPrice = world.variables.priceAnnounced ? world.variables.currentPrice : world.variables.baselinePrice;
  const variables = agent.role === "company" ? { ...world.variables } : { publicPrice: knownPrice, priceAnnounced: Boolean(world.variables.priceAnnounced) };
  const resources = agent.role === "company" ? { ...world.resources } : {};
  const entities = agent.role === "company" ? structuredClone(world.entities) : [world.entities.find((entity) => entity.id === "company"), ownSegment].filter(Boolean).map((entity) => structuredClone(entity));
  const visibleEvents = events.filter((event) => visibleTo(agent, event)).slice(-30).map((event) => ({
    id: event.id,
    type: event.type,
    tick: event.tick,
    actorId: event.actorId,
    payload: structuredClone(event.payload)
  }));
  return {
    agentId: agent.id,
    tick: world.tick,
    variables,
    resources,
    entities,
    visibleEvents,
    memoryRefs: agent.memoryRefs.slice(-20)
  };
}
function ruleProposal({ runId, tick, agent, observation }) {
  const isCompany = agent.role === "company";
  const change = observation.variables.currentPrice !== void 0 && observation.variables.currentPrice !== observation.variables.baselinePrice;
  const publicAnnouncement = observation.visibleEvents.some((event) => event.type === "announce_change");
  let actionType = "do_nothing";
  let rationale = "No supported action is justified by the current observation";
  if (isCompany && change && !observation.variables.priceAnnounced) {
    actionType = "announce_change";
    rationale = "Communicate the proposed price change";
  } else if (agent.role === "customer-segment" && publicAnnouncement) {
    actionType = "respond_to_announcement";
    rationale = "Explore a response to the publicly announced change";
  }
  return {
    runId,
    tick,
    agentId: agent.id,
    actionType,
    arguments: {},
    rationale
  };
}

// server/simulation/memory.mjs
var key = (runId, agentId) => runId + ":" + agentId;
var AgentMemory = class {
  constructor(snapshot = {}) {
    this.rows = new Map(Object.entries(snapshot));
  }
  recent(runId, agentId) {
    return structuredClone(this.rows.get(key(runId, agentId)) || []);
  }
  rememberObserved(runId, agent, world, events) {
    const visible = observeAgent(agent, world, events).visibleEvents;
    const current = this.recent(runId, agent.id);
    const seen = new Set(current.map((event) => event.id));
    for (const event of visible) {
      if (seen.has(event.id)) continue;
      current.push({
        id: event.id,
        tick: event.tick,
        type: event.type,
        text: JSON.stringify(event.payload || {}).slice(0, 300)
      });
      seen.add(event.id);
    }
    const bounded2 = current.slice(-20);
    this.rows.set(key(runId, agent.id), bounded2);
    return bounded2;
  }
  snapshot() {
    return Object.fromEntries([...this.rows].map(([name, items]) => [name, items.slice(-20)]));
  }
};
function score(seed, tick, id2) {
  let x = (seed ^ Math.imul(tick, 2654435761)) >>> 0;
  for (let i = 0; i < id2.length; i++)
    x = Math.imul(x ^ id2.charCodeAt(i), 16777619) >>> 0;
  return x;
}
function scheduleAgents({ agents, tick, seed, maxAgents = 20, changedIds = [] }) {
  if (!Number.isInteger(tick) || tick < 1 || !Number.isInteger(seed) || seed < 0 || !Number.isInteger(maxAgents) || maxAgents < 1 || maxAgents > 100)
    throw new Error("Invalid schedule");
  const changed = new Set(changedIds);
  return agents.filter((agent) => {
    const cadence = agent.policy.actionCadence ?? 1;
    if (!Number.isInteger(cadence) || cadence < 1) throw new Error("Invalid cadence");
    return changed.has(agent.id) || (tick - 1) % cadence === 0;
  }).sort((a, b) => {
    const importance = Number(changed.has(b.id)) - Number(changed.has(a.id));
    return importance || score(seed, tick, a.id) - score(seed, tick, b.id) || a.id.localeCompare(b.id);
  }).slice(0, maxAgents);
}

// server/simulation/apply.mjs
var bounded = (number2, minimum, maximum) => typeof number2 === "number" && Number.isFinite(number2) && number2 >= minimum && number2 <= maximum;
var integer2 = (number2, min, max) => Number.isInteger(number2) && bounded(number2, min, max);
var rolePriority = { company: 0, regulator: 1, competitor: 2, "customer-segment": 3 };
function applyOne(state, agent, action, availableAgents, priorEvents) {
  const next = structuredClone(state);
  const args = action.arguments;
  let visibility = "private", audience = [agent.id], delta = {};
  const observed = observeAgent(agent, state, priorEvents);
  const group = state.entities.find((entity) => entity.id === agent.constraints.segmentId && entity.kind === "customer-segment");
  switch (action.actionType) {
    case "change_price":
      if (!bounded(args.price, 0.01, 1e6)) throw new Error("Price out of range");
      next.variables.currentPrice = args.price;
      next.variables.priceAnnounced = false;
      delta = { currentPrice: args.price };
      break;
    case "announce_change":
      next.variables.priceAnnounced = true;
      visibility = "public";
      delta = { announcedPrice: next.variables.currentPrice };
      break;
    case "revise_plan":
      if (!bounded(args.rolloutPercent, 0, 100)) throw new Error("Invalid rollout percentage");
      next.variables.rolloutPercent = args.rolloutPercent;
      delta = { rolloutPercent: args.rolloutPercent };
      break;
    case "allocate_budget":
      if (!bounded(args.amount, 0, next.resources.marketingBudget))
        throw new Error("Budget exceeded");
      next.resources.marketingBudget -= args.amount;
      next.resources.allocatedBudget = (next.resources.allocatedBudget || 0) + args.amount;
      delta = { budgetAllocated: args.amount };
      break;
    case "contact_group": {
      const recipient = availableAgents.get(args.targetId);
      if (!recipient || agent.role !== "company" && recipient.role !== "company")
        throw new Error("Recipient is unavailable");
      if (typeof args.message !== "string" || args.message.length > 400)
        throw new Error("Invalid message");
      audience = [agent.id, recipient.id];
      delta = { message: args.message, recipientId: recipient.id };
      break;
    }
    case "request_information":
      audience = [agent.id, "company-agent"];
      delta = { question: typeof args.question === "string" ? args.question.slice(0, 400) : "Please clarify the change" };
      break;
    case "respond_to_announcement":
      if (!observed.visibleEvents.some((event) => event.type === "announce_change"))
        throw new Error("No observed announcement to respond to");
      visibility = "public";
      delta = { response: typeof args.response === "string" ? args.response.slice(0, 200) : "More evidence is needed" };
      break;
    case "adopt_product":
    case "cancel_subscription":
      if (!group || !integer2(args.count, 1, 1e5))
        throw new Error("Invalid customer count");
      if (action.actionType === "cancel_subscription" && args.count > group.attributes.customers)
        throw new Error("Cannot cancel more subscriptions than exist");
      next.entities.find((entity) => entity.id === group.id).attributes.customers += action.actionType === "adopt_product" ? args.count : -args.count;
      delta = { segmentId: group.id, customersDelta: action.actionType === "adopt_product" ? args.count : -args.count };
      break;
    case "do_nothing":
      break;
    default:
      throw new Error("Unknown action");
  }
  validateWorldState(next);
  return { state: next, emission: {
    actorId: agent.id,
    type: action.actionType,
    payload: { ...delta, visibility, audience, rationale: action.rationale }
  } };
}
function applyActionBatch({ world, agents, proposals, tick, runId, priorEvents = [] }) {
  validateWorldState(world);
  if (!Number.isInteger(tick) || tick !== world.tick + 1)
    throw new Error("Tick must advance once");
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  if (byId.size !== agents.length) throw new Error("Duplicate agents");
  const ordered = proposals.slice().sort((left, right) => {
    const a = byId.get(left.agentId), b = byId.get(right.agentId);
    const priority = (rolePriority[a?.role] ?? 9) - (rolePriority[b?.role] ?? 9);
    return priority || String(left.agentId).localeCompare(String(right.agentId));
  });
  const seen = /* @__PURE__ */ new Set(), accepted = [], rejected = [], emissions = [];
  let state = structuredClone(world);
  for (const action of ordered) {
    try {
      validateAction(action);
      if (action.runId !== runId || action.tick !== tick)
        throw new Error("Action does not belong to this run or tick");
      const agent = byId.get(action.agentId);
      if (!agent || !allowedToAct(agent, action.actionType))
        throw new Error("Action is not allowed for this agent");
      if (seen.has(action.agentId)) throw new Error("One action per agent per tick");
      seen.add(action.agentId);
      const result = applyOne(state, agent, action, byId, priorEvents);
      state = result.state;
      accepted.push(action);
      emissions.push(result.emission);
    } catch (error) {
      rejected.push({
        agentId: String(action?.agentId ?? "unknown"),
        actionType: String(action?.actionType ?? "unknown"),
        reason: error.message
      });
      emissions.push({
        actorId: byId.has(action?.agentId) ? action.agentId : "engine",
        type: "action-rejected",
        payload: {
          visibility: "private",
          reason: error.message,
          proposedAction: String(action?.actionType ?? "unknown")
        }
      });
    }
  }
  state.tick = tick;
  validateWorldState(state);
  return { state, accepted, rejected, emissions };
}

// server/simulation/runner.mjs
function beginning(scenario, run) {
  const world = structuredClone(scenario.baselineState);
  const interventionId = run.interventionId || "baseline";
  if (interventionId !== "baseline") {
    const option = scenario.interventions.find((item) => item.id === interventionId);
    if (!option) throw new Error("Unknown intervention");
    for (const [key2, value] of Object.entries(option.changes))
      world.variables[key2] = value;
  }
  return world;
}
function createTickExecutor({
  store,
  getScenario,
  proposer = ruleProposal,
  maxAgents = 20
}) {
  return async function executeTick({ tick, seq, checkpoint, signal, run, job }) {
    if (signal?.aborted) throw new Error("Simulation interrupted");
    const scenario = await getScenario(run.ownerId, run.scenarioId);
    validateScenario(scenario);
    if (scenario.ownerId !== run.ownerId || run.scenarioId !== scenario.id)
      throw new Error("Scenario ownership mismatch");
    const saved = checkpoint?.serializedState;
    const world = saved?.world ? structuredClone(saved.world) : beginning(scenario, run);
    const memory = new AgentMemory(saved?.memory || {});
    const agents = productDecisionAgents(world, { competitorName: scenario.competitorName });
    const prior = store.readEvents(run.ownerId, run.id, {
      after: Math.max(0, seq - 500),
      limit: 500
    });
    const eligible = scheduleAgents({ agents, tick, seed: run.seed, maxAgents });
    const proposals = [];
    const usage = { calls: 0, tokens: 0 };
    for (const agent of eligible) {
      if (signal?.aborted) throw new Error("Simulation interrupted");
      const observation = observeAgent(agent, world, prior);
      const output = await proposer({
        runId: run.id,
        tick,
        agent,
        observation,
        recentMemory: memory.recent(run.id, agent.id),
        signal
      });
      const action = output?.proposal ?? output;
      if (action) proposals.push(action);
      const counted = output?.usage || {};
      usage.calls += counted.calls || 0;
      usage.tokens += counted.tokens || 0;
      if (run.budget.maxCalls > 0 && job.spentCalls + usage.calls >= run.budget.maxCalls)
        break;
      if (run.budget.maxTokens > 0 && job.spentTokens + usage.tokens >= run.budget.maxTokens)
        break;
    }
    const result = applyActionBatch({
      world,
      agents,
      proposals,
      tick,
      runId: run.id,
      priorEvents: prior
    });
    const emissions = [
      ...result.emissions,
      {
        actorId: "engine",
        type: "tick-actions",
        payload: {
          visibility: "private",
          audience: ["engine"],
          acceptedActions: result.accepted,
          rejectedActions: result.rejected
        }
      },
      {
        actorId: "engine",
        type: "tick-summary",
        payload: {
          accepted: result.accepted.length,
          rejected: result.rejected.length,
          visibility: "public"
        }
      }
    ];
    let nextSeq = seq;
    const at = (/* @__PURE__ */ new Date()).toISOString();
    const events = emissions.map((emission) => {
      const id2 = run.id + "-e" + ++nextSeq;
      const actorHistory = prior.slice().reverse().find((event) => event.actorId === emission.actorId && event.tick < tick);
      return {
        schemaVersion: 1,
        id: id2,
        ownerId: run.ownerId,
        createdAt: at,
        runId: run.id,
        seq: nextSeq,
        tick,
        actorId: emission.actorId,
        type: emission.type,
        payload: emission.payload,
        parentEventIds: actorHistory ? [actorHistory.id] : [],
        sourceClaimIds: [],
        provenance: "simulated-event"
      };
    });
    const allEvents = [...prior, ...events];
    for (const agent of agents)
      memory.rememberObserved(run.id, agent, result.state, allEvents);
    const serializedState = { world: result.state, memory: memory.snapshot() };
    const nextCheckpoint = {
      schemaVersion: 1,
      id: run.id + "-cp-" + tick,
      ownerId: run.ownerId,
      createdAt: at,
      runId: run.id,
      seq: nextSeq,
      tick,
      serializedState,
      stateHash: hashState(serializedState)
    };
    return { events, checkpoint: nextCheckpoint, usage };
  };
}

// server/jobs/worker.mjs
async function workOne(queue, workerId, executeTick, {
  now = () => Date.now(),
  leaseMs = 3e4,
  signal: externalSignal
} = {}) {
  const job = queue.claim(workerId, { now: now(), leaseMs });
  if (!job) return null;
  const { ownerId, runId, id: id2 } = job;
  const store = queue.store;
  const run = store.getRun(ownerId, runId);
  let checkpoint = store.getCheckpoint(ownerId, runId);
  let tick = checkpoint?.tick ?? 0;
  let seq = checkpoint?.seq ?? 0;
  let calls = job.spentCalls;
  let tokens = job.spentTokens;
  try {
    while (tick < job.rounds) {
      const current = queue.get(ownerId, id2);
      if (!current || current.status !== "running" || current.leaseOwner !== workerId)
        return { status: current?.status ?? "lost", tick };
      if (externalSignal?.aborted) return { status: "interrupted", tick };
      if (run.budget.maxCalls > 0 && calls >= run.budget.maxCalls) {
        queue.fail(ownerId, id2, workerId, "budget_exhausted");
        return { status: "failed", tick };
      }
      const controller = new AbortController();
      const signal = externalSignal ? AbortSignal.any([externalSignal, controller.signal]) : controller.signal;
      const guard = setInterval(() => {
        const latest = queue.get(ownerId, id2);
        if (!latest || latest.status !== "running" || latest.leaseOwner !== workerId)
          controller.abort();
        else if (!queue.heartbeat(ownerId, id2, workerId, { now: now(), leaseMs }))
          controller.abort();
      }, Math.max(100, Math.floor(leaseMs / 3)));
      let result;
      try {
        result = await executeTick({ tick: tick + 1, seq, checkpoint, signal, run, job });
      } finally {
        clearInterval(guard);
      }
      const beforeCommit = queue.get(ownerId, id2);
      if (signal.aborted || !beforeCommit || beforeCommit.status !== "running" || beforeCommit.leaseOwner !== workerId || !queue.heartbeat(ownerId, id2, workerId, { now: now(), leaseMs }))
        return { status: beforeCommit?.status ?? "interrupted", tick };
      if (!result || !Array.isArray(result.events) || !result.checkpoint || result.checkpoint.tick !== tick + 1)
        throw new Error("Invalid tick result");
      store.appendEvents(ownerId, runId, result.events, result.checkpoint);
      checkpoint = result.checkpoint;
      tick = checkpoint.tick;
      seq = checkpoint.seq;
      const usage = result.usage ?? {};
      const stepCalls = usage.calls ?? 0;
      const stepTokens = usage.tokens ?? 0;
      const progress = queue.progress(ownerId, id2, workerId, {
        seq,
        calls: stepCalls,
        tokens: stepTokens,
        now: now()
      });
      calls += stepCalls;
      tokens += stepTokens;
      if (progress.status === "paused") return { status: "paused", tick };
      if (run.budget.maxTokens > 0 && tokens > run.budget.maxTokens || run.budget.maxCalls > 0 && calls > run.budget.maxCalls) {
        queue.fail(ownerId, id2, workerId, "budget_exhausted");
        return { status: "failed", tick };
      }
    }
    queue.complete(ownerId, id2, workerId);
    return { status: "done", tick };
  } catch (error) {
    const current = queue.get(ownerId, id2);
    if (current?.status === "running" && current.leaseOwner === workerId)
      queue.fail(ownerId, id2, workerId);
    throw error;
  }
}

// workers/durableSqlite.mjs
var DurableSqliteAdapter = class {
  constructor(storage) {
    if (!storage?.sql || typeof storage.transactionSync !== "function")
      throw new Error("SQLite-backed Durable Object storage is required");
    this.storage = storage;
    this.sql = storage.sql;
  }
  exec(statement) {
    return this.sql.exec(statement);
  }
  prepare(statement) {
    const sql = this.sql;
    return {
      get(...bindings) {
        return sql.exec(statement, ...bindings).toArray()[0];
      },
      all(...bindings) {
        return sql.exec(statement, ...bindings).toArray();
      },
      run(...bindings) {
        sql.exec(statement, ...bindings);
        const row = sql.exec("SELECT changes() AS count").toArray()[0];
        return { changes: row?.count || 0 };
      }
    };
  }
  transactionSync(callback) {
    return this.storage.transactionSync(callback);
  }
  close() {
  }
};

// workers/nodeApi.mjs
function lowerCaseHeaders(headers) {
  return Object.fromEntries(Array.from(headers, ([key2, value]) => [key2.toLowerCase(), value]));
}
async function handleJsonApi(handler, request) {
  const url = new URL(request.url);
  const body = ["POST", "PATCH", "PUT"].includes(request.method) ? await request.text() : void 0;
  if (body != null && new TextEncoder().encode(body).byteLength > 128e3)
    return Response.json({ error: "Request too large" }, { status: 413 });
  const req = {
    url: url.pathname + url.search,
    method: request.method,
    body,
    headers: { ...lowerCaseHeaders(request.headers), host: url.host },
    ripplePrivateAccessVerified: true
  };
  let status = 200;
  const headers = new Headers();
  let chunks = [];
  let finished = false;
  const res = {
    get headersSent() {
      return finished;
    },
    get writableEnded() {
      return finished;
    },
    setHeader(name, value) {
      headers.set(name, value);
    },
    writeHead(code, nextHeaders = {}) {
      status = code;
      for (const [name, value] of Object.entries(nextHeaders))
        headers.set(name, value);
      return this;
    },
    write(chunk = "") {
      chunks.push(String(chunk));
      return true;
    },
    end(chunk = "") {
      if (chunk) chunks.push(String(chunk));
      finished = true;
      return this;
    },
    on() {
      return this;
    }
  };
  try {
    await handler(req, res, () => {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    });
    if (!finished) return Response.json({ error: "Response incomplete" }, { status: 500 });
    headers.set("Cache-Control", "no-store");
    return new Response(chunks.join(""), { status, headers });
  } catch {
    return Response.json({ error: "Internal error" }, {
      status: 500,
      headers: { "Cache-Control": "no-store" }
    });
  }
}

// workers/session.mjs
var COOKIE = "ripple_sid";
var DAY = 86400;
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function base64url(bytes) {
  let result = "";
  for (const byte of bytes) result += String.fromCharCode(byte);
  return btoa(result).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function fromBase64url(input) {
  const decoded = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}
async function keyFor(secret) {
  if (typeof secret !== "string" || secret.length < 32)
    throw new Error("RIPPLE_SESSION_SECRET is not configured");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
    name: "HMAC",
    hash: "SHA-256"
  }, false, ["sign", "verify"]);
}
async function signed(session, key2) {
  const signature = await crypto.subtle.sign(
    "HMAC",
    key2,
    new TextEncoder().encode("ripple-v1:" + session)
  );
  return session + "." + base64url(new Uint8Array(signature));
}
function cookieFrom(request) {
  const header = request.headers.get("Cookie") || "";
  return header.split(";").map((part) => part.trim()).find((part) => part.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) || "";
}
async function browserWorkspace(request, secret) {
  const key2 = await keyFor(secret);
  const token = cookieFrom(request);
  const dot = token.indexOf(".");
  const candidate = dot < 0 ? "" : token.slice(0, dot);
  const signature = dot < 0 ? "" : token.slice(dot + 1);
  if (UUID.test(candidate) && /^[A-Za-z0-9_-]{40,60}$/.test(signature)) {
    try {
      const valid = await crypto.subtle.verify(
        "HMAC",
        key2,
        fromBase64url(signature),
        new TextEncoder().encode("ripple-v1:" + candidate)
      );
      if (valid) return { id: candidate, cookie: null };
    } catch {
    }
  }
  const id2 = crypto.randomUUID();
  const value = await signed(id2, key2);
  return {
    id: id2,
    cookie: `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${365 * DAY}`
  };
}
function validWriteOrigin(request, publicOrigin) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    const allowed = [new URL(request.url).origin, publicOrigin].filter(Boolean).map((value) => new URL(value).origin);
    return allowed.includes(new URL(origin).origin) && (request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json");
  } catch {
    return false;
  }
}
function privateRoute(pathname) {
  return /^\/api\/(?:projects(?:\/|$)|saved-runs(?:\/|$)|simulation-(?:jobs|runs)(?:\/|$))/.test(pathname);
}

// workers/index.mjs
var RippleWorkspace = class extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new SqliteEventStoreCore(new DurableSqliteAdapter(ctx.storage));
    this.queue = new SqliteJobQueue(this.store);
    this.projects = createProjectApi(this.store);
    this.simulation = createSimulationApi(this.store, this.queue);
    this.executeTick = createTickExecutor({
      store: this.store,
      getScenario: async (ownerId, id2) => {
        const scenario = this.store.getScenario(ownerId, id2);
        if (!scenario) throw new Error("Scenario not found");
        return scenario;
      }
    });
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    const scenario = /^\/api\/projects\/[^/]+\/scenarios(?:\/|$)/.test(path);
    const simulation = scenario || path.startsWith("/api/simulation-jobs/") || path.startsWith("/api/simulation-runs/");
    const result = await handleJsonApi(simulation ? this.simulation : this.projects, request);
    if (result.status === 201 && request.method === "POST" && /^\/api\/projects\/[^/]+\/scenarios\/[^/]+\/runs$/.test(path)) {
      await this.ctx.storage.setAlarm(Date.now() + 200);
    }
    return result;
  }
  async alarm() {
    try {
      await workOne(this.queue, "cf-workspace", this.executeTick, {
        leaseMs: 3e4
      });
    } catch (error) {
      console.error("[ripple] simulation worker failed", error?.message);
    } finally {
      const pending = this.store.db.prepare(
        "SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued','running')"
      ).get().count;
      if (pending) await this.ctx.storage.setAlarm(Date.now() + 1e3);
    }
  }
};
var index_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/_health") {
      return Response.json({ status: "ok", backend: "cloudflare-durable-sqlite" }, {
        headers: { "Cache-Control": "no-store" }
      });
    }
    if (!privateRoute(url.pathname)) return Response.json({ error: "Not found" }, { status: 404 });
    if (!env.RIPPLE_WORKSPACE || !env.RIPPLE_SESSION_SECRET) {
      return Response.json({ error: "Backend not configured" }, { status: 503 });
    }
    if (!validWriteOrigin(request, env.PUBLIC_ORIGIN)) {
      return Response.json({ error: "Invalid request origin" }, { status: 403 });
    }
    try {
      const workspace = await browserWorkspace(request, env.RIPPLE_SESSION_SECRET);
      const id2 = env.RIPPLE_WORKSPACE.idFromName("v1:" + workspace.id);
      const response = await env.RIPPLE_WORKSPACE.get(id2).fetch(request);
      if (!workspace.cookie) return response;
      const headers = new Headers(response.headers);
      headers.append("Set-Cookie", workspace.cookie);
      headers.set("Cache-Control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      console.error("[ripple] backend error", error?.message);
      return Response.json({ error: "Internal error" }, {
        status: 500,
        headers: { "Cache-Control": "no-store" }
      });
    }
  }
};
export {
  RippleWorkspace,
  index_default as default
};
