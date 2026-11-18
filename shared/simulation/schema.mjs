export const SCHEMA_VERSION = 1;
export const PROVENANCE = Object.freeze([
  "observed", "assumption", "derived", "agent-belief", "simulated-event", "hypothesis"
]);
export const ACTION_TYPES = Object.freeze([
  "change_price", "announce_change", "contact_group", "request_information",
  "revise_plan", "allocate_budget", "adopt_product", "cancel_subscription",
  "respond_to_announcement", "do_nothing"
]);

export class SchemaError extends Error {
  constructor(path, message) {
    super(path + ": " + message);
    this.name = "SchemaError";
    this.path = path;
  }
}

const fail = (path, message) => { throw new SchemaError(path, message); };
const requireValue = (ok, path, message) => { if (!ok) fail(path, message); };
const plain = (v) => v !== null && typeof v === "object" &&
  !Array.isArray(v) && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);

function object(value, path, maxBytes = 64_000) {
  requireValue(plain(value), path, "expected an object");
  requireValue(JSON.stringify(value).length <= maxBytes, path, "object too large");
  return value;
}

function string(value, path, max = 2000) {
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
  for (const [key, entry] of Object.entries(value)) {
    id(key, path + ".key");
    requireValue(
      entry === null || typeof entry === "boolean" ||
      (typeof entry === "string" && entry.length <= 1000) ||
      (typeof entry === "number" && Number.isFinite(entry)),
      path + "." + key, "invalid value"
    );
  }
}

function base(value, path) {
  object(value, path, 250_000);
  version(value.schemaVersion, path + ".schemaVersion");
  id(value.id, path + ".id");
  id(value.ownerId, path + ".ownerId");
  timestamp(value.createdAt, path + ".createdAt");
  return value;
}

export function validateProject(value) {
  const p = base(value, "project");
  string(p.title, "project.title", 160);
  id(p.domainPack, "project.domainPack");
  timestamp(p.updatedAt, "project.updatedAt");
  return p;
}

export function validateSource(value) {
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

export function validateSourceSpan(value) {
  const s = object(value, "sourceSpan");
  id(s.sourceId, "sourceSpan.sourceId");
  if (s.page !== undefined) integer(s.page, "sourceSpan.page", 1);
  if (s.row !== undefined) integer(s.row, "sourceSpan.row", 1);
  if (s.charStart !== undefined) integer(s.charStart, "sourceSpan.charStart");
  if (s.charEnd !== undefined) {
    integer(s.charEnd, "sourceSpan.charEnd");
    requireValue(s.charStart !== undefined && s.charEnd >= s.charStart, "sourceSpan.charEnd", "invalid span");
  }
  if (s.quote !== undefined) string(s.quote, "sourceSpan.quote", 1000);
  requireValue(
    s.page !== undefined || s.row !== undefined || s.charStart !== undefined,
    "sourceSpan", "missing location"
  );
  return s;
}

export function validateClaim(value) {
  const c = base(value, "claim");
  id(c.projectId, "claim.projectId");
  string(c.text, "claim.text", 2000);
  choice(c.provenance, "claim.provenance", PROVENANCE);
  list(c.sourceSpans, "claim.sourceSpans", validateSourceSpan, 30);
  if (c.provenance === "observed") requireValue(c.sourceSpans.length > 0, "claim.sourceSpans", "observed claims need a source");
  choice(c.confidenceStatus, "claim.confidenceStatus", ["unverified", "reviewed", "conflicted"]);
  requireValue(typeof c.reviewed === "boolean", "claim.reviewed", "expected boolean");
  return c;
}

export function validateEntity(value) {
  const e = base(value, "entity");
  string(e.kind, "entity.kind", 80);
  string(e.label, "entity.label", 160);
  record(e.attributes, "entity.attributes");
  choice(e.provenance, "entity.provenance", PROVENANCE);
  ids(e.sourceClaimIds, "entity.sourceClaimIds");
  unique(e.sourceClaimIds, "entity.sourceClaimIds");
  return e;
}

export function validateRelationship(value) {
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

export function validateWorldState(value) {
  const w = base(value, "worldState");
  integer(w.tick, "worldState.tick", 0, 1_000_000);
  list(w.entities, "worldState.entities", validateEntity, 1000);
  list(w.relationships, "worldState.relationships", validateRelationship, 4000);
  unique(w.entities.map((e) => e.id), "worldState.entities");
  unique(w.relationships.map((r) => r.id), "worldState.relationships");
  const known = new Set(w.entities.map((e) => e.id));
  for (const r of w.relationships) {
    requireValue(known.has(r.fromId) && known.has(r.toId), "worldState.relationships", "unknown endpoint");
  }
  record(w.variables, "worldState.variables");
  record(w.resources, "worldState.resources");
  for (const [key, value] of Object.entries(w.resources)) number(value, "worldState.resources." + key);
  ids(w.activeAssumptions, "worldState.activeAssumptions");
  unique(w.activeAssumptions, "worldState.activeAssumptions");
  return w;
}

export function validateAgent(value) {
  const a = base(value, "agent");
  string(a.role, "agent.role", 120);
  string(a.goal, "agent.goal", 1000);
  record(a.constraints, "agent.constraints");
  record(a.policy, "agent.policy");
  ids(a.observations, "agent.observations", 1000);
  ids(a.memoryRefs, "agent.memoryRefs", 1000);
  return a;
}

export function validateScenario(value) {
  const s = base(value, "scenario");
  id(s.projectId, "scenario.projectId");
  string(s.question, "scenario.question", 1000);
  validateWorldState(s.baselineState);
  requireValue(s.baselineState.ownerId === s.ownerId, "scenario.baselineState", "owner mismatch");
  list(s.interventions, "scenario.interventions", (intervention, path) => {
    object(intervention, path);
    id(intervention.id, path + ".id");
    string(intervention.label, path + ".label", 160);
    record(intervention.changes, path + ".changes");
    requireValue(Object.keys(intervention.changes).length > 0, path, "empty changes");
    for (const key of Object.keys(intervention.changes))
      requireValue(Object.hasOwn(s.baselineState.variables, key), path, "unknown variable");
  }, 10);
  unique(s.interventions.map((entry) => entry.id), "scenario.interventions");
  const config = object(s.config, "scenario.config");
  integer(config.rounds, "scenario.config.rounds", 1, 100);
  integer(config.agents, "scenario.config.agents", 1, 100);
  return s;
}

export function validateRun(value) {
  const r = base(value, "run");
  id(r.scenarioId, "run.scenarioId");
  integer(r.seed, "run.seed");
  string(r.modelId, "run.modelId", 160);
  string(r.promptVersion, "run.promptVersion", 80);
  string(r.engineVersion, "run.engineVersion", 80);
  choice(r.status, "run.status", ["queued", "running", "paused", "cancelled", "failed", "done"]);
  object(r.budget, "run.budget");
  integer(r.budget.maxCalls, "run.budget.maxCalls", 0, 1000);
  integer(r.budget.maxTokens, "run.budget.maxTokens", 0, 10_000_000);
  object(r.spent, "run.spent");
  integer(r.spent.calls, "run.spent.calls", 0);
  integer(r.spent.tokens, "run.spent.tokens", 0);
  integer(r.checkpointTick, "run.checkpointTick", 0);
  if (r.startedAt !== null) timestamp(r.startedAt, "run.startedAt");
  if (r.completedAt !== null) timestamp(r.completedAt, "run.completedAt");
  return r;
}

export function validateAction(value) {
  const a = object(value, "action");
  id(a.runId, "action.runId");
  integer(a.tick, "action.tick", 0, 1_000_000);
  id(a.agentId, "action.agentId");
  choice(a.actionType, "action.actionType", ACTION_TYPES);
  record(a.arguments, "action.arguments", 32);
  string(a.rationale, "action.rationale", 1000);
  return a;
}

export function validateEvent(value) {
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

export function validateEventLog(events, { startSeq = 1, knownParentIds = [] } = {}) {
  const known = new Set(knownParentIds);
  let runId = null;
  let ownerId = null;
  list(events, "events", validateEvent, 100_000);
  for (const [index, event] of events.entries()) {
    requireValue(event.seq === startSeq + index, "events[" + index + "].seq", "out of order");
    if (runId !== null) {
      requireValue(event.runId === runId && event.ownerId === ownerId, "events[" + index + "]", "mixed run");
    }
    runId = event.runId;
    ownerId = event.ownerId;
    for (const parent of event.parentEventIds)
      requireValue(known.has(parent), "events[" + index + "].parentEventIds", "unknown or future parent");
    requireValue(!known.has(event.id), "events[" + index + "].id", "duplicate event");
    known.add(event.id);
  }
  return events;
}

export function validateCheckpoint(value) {
  const c = base(value, "checkpoint");
  id(c.runId, "checkpoint.runId");
  integer(c.seq, "checkpoint.seq");
  integer(c.tick, "checkpoint.tick");
  object(c.serializedState, "checkpoint.serializedState", 2_000_000);
  requireValue(/^[a-f0-9]{64}$/.test(c.stateHash), "checkpoint.stateHash", "invalid state hash");
  return c;
}

export function validateReport(value) {
  const r = base(value, "report");
  id(r.runId, "report.runId");
  string(r.question, "report.question", 1000);
  object(r.inputs, "report.inputs");
  list(r.evidence, "report.evidence", (e, p) => {
    object(e, p);
    choice(e.provenance, p + ".provenance", PROVENANCE);
    string(e.text, p + ".text", 2000);
  });
  list(r.findings, "report.findings", (f, p) => {
    object(f, p);
    string(f.text, p + ".text", 2000);
    choice(f.provenance, p + ".provenance", PROVENANCE);
  });
  list(r.limitations, "report.limitations", string);
  list(r.comparisons, "report.comparisons", (c, p) => object(c, p));
  string(r.methodVersion, "report.methodVersion", 80);
  timestamp(r.generatedAt, "report.generatedAt");
  return r;
}

export const VALIDATORS = Object.freeze({
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
  report: validateReport,
});

export function validate(kind, value) {
  const validator = VALIDATORS[kind];
  requireValue(typeof validator === "function", "kind", "unknown schema");
  return validator(value);
}
