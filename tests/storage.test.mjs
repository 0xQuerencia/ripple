import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SqliteEventStore } from "../server/storage/sqlite.mjs";
import { hashState } from "../server/storage/stateHash.mjs";

const now = "2026-11-18T11:00:00.000Z";
const meta = (id) => ({ schemaVersion: 1, ownerId: "alice", id, createdAt: now });
const project = () => ({ ...meta("project-1"), title: "Pricing decision",
  domainPack: "product-decision", updatedAt: now });
const run = () => ({ ...meta("run-1"), scenarioId: "scenario-1", seed: 7,
  modelId: "rule-based", promptVersion: "v1", engineVersion: "v1",
  status: "queued", budget: { maxCalls: 0, maxTokens: 0 }, spent: { calls: 0, tokens: 0 },
  checkpointTick: 0, startedAt: null, completedAt: null });
const event = (id, seq, delta = 1, parents = []) => ({
  ...meta(id), runId: "run-1", seq, tick: seq, actorId: "company",
  type: "adjustment", payload: { delta }, parentEventIds: parents,
  sourceClaimIds: [], provenance: "simulated-event"
});
const checkpoint = (seq, state) => ({ ...meta("cp-" + seq), runId: "run-1",
  seq, tick: seq, serializedState: state, stateHash: hashState(state) });
const reducer = (state, e) => ({ total: state.total + e.payload.delta });

test("events and checkpoints survive a process restart", async () => {
  const dir = await mkdtemp(join(tmpdir(), "ripple-events-"));
  const file = join(dir, "data.sqlite");
  try {
    let store = new SqliteEventStore(file);
    store.putProject(project());
    store.putRun("alice", "project-1", run());
    store.appendEvents("alice", "run-1", [event("a", 1, 3)], checkpoint(1, { total: 3 }));
    store.close();
    store = new SqliteEventStore(file);
    assert.equal(store.readEvents("alice", "run-1")[0].id, "a");
    assert.equal(store.getCheckpoint("alice", "run-1").stateHash, hashState({ total: 3 }));
    assert.deepEqual(store.replay("alice", "run-1", { total: 0 }, reducer).state, { total: 3 });
    store.close();
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("append is idempotent and rejects gaps or invalid causal parents", () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project());
    store.putRun("alice", "project-1", run());
    const first = event("a", 1, 2);
    store.appendEvents("alice", "run-1", [first], checkpoint(1, { total: 2 }));
    store.appendEvents("alice", "run-1", [first], checkpoint(1, { total: 2 }));
    assert.equal(store.readEvents("alice", "run-1").length, 1);
    assert.throws(() => store.appendEvents("alice", "run-1", [event("b", 3, 1)]), /sequence gap/);
    assert.throws(() => store.appendEvents("alice", "run-1", [event("b", 2, 1, ["missing"])]), /Unknown event parent/);
    assert.throws(() => store.appendEvents("alice", "run-1", [event("a", 1, 100)]), /Conflicting event/);
    const badCheckpoint = { ...checkpoint(2, { total: 999 }), stateHash: "0".repeat(64) };
    assert.throws(() => store.appendEvents("alice", "run-1", [event("b", 2, 1)], badCheckpoint),
      /Checkpoint hash mismatch/);
    assert.equal(store.readEvents("alice", "run-1").length, 1);
  } finally {
    store.close();
  }
});

test("owners cannot read or mutate other users' runs", () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project());
    store.putRun("alice", "project-1", run());
    assert.equal(store.getProject("bob", "project-1"), null);
    assert.equal(store.getRun("bob", "run-1"), null);
    assert.throws(() => store.readEvents("bob", "run-1"), /not found/);
    assert.throws(() => store.appendEvents("bob", "run-1", [event("a", 1)]), /not found/);
    assert.equal(store.deleteProject("bob", "project-1"), false);
    assert.equal(store.deleteProject("alice", "project-1"), true);
    assert.equal(store.getRun("alice", "run-1"), null);
  } finally {
    store.close();
  }
});

test("replay detects a stored checkpoint that doesn't match the reducer", () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project());
    store.putRun("alice", "project-1", run());
    store.appendEvents("alice", "run-1", [event("a", 1, 2)], checkpoint(1, { total: 2 }));
    assert.throws(() => store.replay("alice", "run-1", { total: 0 }, (state) => state), /Replay hash mismatch/);
  } finally {
    store.close();
  }
});
