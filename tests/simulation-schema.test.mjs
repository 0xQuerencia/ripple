import test from "node:test";
import assert from "node:assert/strict";
import {
  SCHEMA_VERSION, SchemaError, ACTION_TYPES, validateProject, validateClaim,
  validateWorldState, validateScenario, validateAction, validateEventLog, validateCheckpoint
} from "../shared/simulation/schema.mjs";
import { migrateSchema } from "../shared/simulation/migrations.mjs";

const now = "2026-11-18T10:00:00.000Z";
const meta = (id) => ({ id, ownerId: "owner-1", schemaVersion: SCHEMA_VERSION, createdAt: now });
const entity = (id) => ({
  ...meta(id), kind: "customer-segment", label: id, attributes: { customers: 100 },
  provenance: "assumption", sourceClaimIds: []
});
const state = () => ({
  ...meta("world-1"), tick: 0, entities: [entity("company"), entity("customers")],
  relationships: [{ ...meta("depends"), fromId: "customers", toId: "company",
    kind: "subscription", direction: "directed", constraints: {}, provenance: "hypothesis" }],
  variables: { price: 499 }, resources: { budget: 1000 }, activeAssumptions: []
});
const event = (id, seq, parents = []) => ({
  ...meta(id), runId: "run-1", seq, tick: 1, actorId: "company",
  type: "decision", payload: {}, parentEventIds: parents,
  sourceClaimIds: [], provenance: "simulated-event"
});
const clone = (v) => structuredClone(v);

test("project fields and future versions are rejected safely", () => {
  const project = { ...meta("p1"), title: "Pricing", domainPack: "product-decision", updatedAt: now };
  assert.equal(validateProject(project), project);
  assert.throws(() => validateProject({ ...project, schemaVersion: 2 }), SchemaError);
  assert.throws(() => validateProject({ ...project, title: "x".repeat(1000) }), SchemaError);
  assert.deepEqual(migrateSchema(project), project);
  assert.notEqual(migrateSchema(project), project);
  assert.throws(() => migrateSchema({ ...project, schemaVersion: 999 }), SchemaError);
});

test("observed claims need a source location", () => {
  const claim = { ...meta("c1"), projectId: "p1", text: "200 subscribers",
    provenance: "observed", sourceSpans: [], confidenceStatus: "unverified", reviewed: false };
  assert.throws(() => validateClaim(claim), /need a source/);
  claim.sourceSpans = [{ sourceId: "source-1", row: 2, quote: "200 subscribers" }];
  assert.equal(validateClaim(claim), claim);
  assert.throws(() => validateClaim({ ...claim, sourceSpans: [{ sourceId: "s", charEnd: 10 }] }), SchemaError);
});

test("world graph validates endpoints and budgets", () => {
  const world = state();
  assert.equal(validateWorldState(world), world);
  const missing = clone(world);
  missing.relationships[0].toId = "missing";
  assert.throws(() => validateWorldState(missing), /unknown endpoint/);
  const duplicate = clone(world);
  duplicate.entities.push(clone(duplicate.entities[0]));
  assert.throws(() => validateWorldState(duplicate), /duplicate id/);
  const overspent = clone(world);
  overspent.resources.budget = -1;
  assert.throws(() => validateWorldState(overspent), /invalid number/);
});

test("interventions only modify declared variables", () => {
  const scenario = { ...meta("s1"), projectId: "p1", question: "Raise the price?",
    baselineState: state(), interventions: [{ id: "raise", label: "Price 599", changes: { price: 599 } }],
    config: { rounds: 6, agents: 12 } };
  assert.equal(validateScenario(scenario), scenario);
  const invalid = clone(scenario);
  invalid.interventions[0].changes.unknown = 1;
  assert.throws(() => validateScenario(invalid), /unknown variable/);
  assert.throws(() => validateScenario({ ...scenario, config: { rounds: 0, agents: 12 } }), SchemaError);
});

test("actions are only from the domain vocabulary", () => {
  const action = { runId: "run-1", tick: 1, agentId: "company",
    actionType: "change_price", arguments: { price: 599 }, rationale: "Try a gradual rollout" };
  assert.ok(ACTION_TYPES.includes(action.actionType));
  assert.equal(validateAction(action), action);
  assert.throws(() => validateAction({ ...action, actionType: "send_money" }), SchemaError);
  assert.throws(() => validateAction({ ...action, arguments: { price: Infinity } }), SchemaError);
});

test("event histories reject missing, future, repeated or out-of-order parents", () => {
  const log = [event("e1", 1), event("e2", 2, ["e1"])];
  assert.equal(validateEventLog(log), log);
  assert.throws(() => validateEventLog([event("e1", 1, ["e2"]), event("e2", 2)]), /future parent/);
  assert.throws(() => validateEventLog([event("e1", 1), event("e1", 2)]), /duplicate event/);
  assert.throws(() => validateEventLog([event("e1", 2)]), /out of order/);
  assert.deepEqual(validateEventLog([event("e3", 3, ["e2"])], {
    startSeq: 3, knownParentIds: ["e1", "e2"]
  }).map((e) => e.id), ["e3"]);
});

test("checkpoint payload and state hash are validated", () => {
  const checkpoint = { ...meta("cp1"), runId: "run-1", seq: 4, tick: 2,
    serializedState: {}, stateHash: "f".repeat(64) };
  assert.equal(validateCheckpoint(checkpoint), checkpoint);
  assert.throws(() => validateCheckpoint({ ...checkpoint, stateHash: "bad" }), SchemaError);
});
