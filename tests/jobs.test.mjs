import test from "node:test";
import assert from "node:assert/strict";
import { SqliteEventStore } from "../server/storage/sqlite.mjs";
import { hashState } from "../server/storage/stateHash.mjs";
import { SqliteJobQueue } from "../server/jobs/queue.mjs";
import { workOne } from "../server/jobs/worker.mjs";

const now = "2026-11-18T12:00:00.000Z";
const meta = (id) => ({ schemaVersion: 1, id, ownerId: "alice", createdAt: now });
const project = { ...meta("project"), title: "Pricing", domainPack: "product-decision", updatedAt: now };
const run = { ...meta("run"), scenarioId: "scenario", seed: 1, modelId: "rules",
  promptVersion: "v1", engineVersion: "v1", status: "queued",
  budget: { maxCalls: 0, maxTokens: 0 }, spent: { calls: 0, tokens: 0 },
  checkpointTick: 0, startedAt: null, completedAt: null };
function setup() {
  const store = new SqliteEventStore();
  store.putProject(project);
  store.putRun("alice", "project", run);
  return { store, queue: new SqliteJobQueue(store) };
}

test("a lease expires and another worker recovers the same job", () => {
  const { store, queue } = setup();
  try {
    queue.enqueue({ id: "job", ownerId: "alice", runId: "run", rounds: 3, now: 0 });
    assert.equal(queue.claim("worker-a", { now: 100, leaseMs: 100 }).attempts, 1);
    assert.equal(queue.claim("worker-b", { now: 150, leaseMs: 100 }), null);
    assert.equal(queue.claim("worker-b", { now: 201, leaseMs: 100 }).attempts, 2);
    assert.equal(queue.heartbeat("alice", "job", "worker-a", { now: 202, leaseMs: 100 }), false);
    assert.equal(queue.heartbeat("alice", "job", "worker-b", { now: 202, leaseMs: 100 }), true);
  } finally { store.close(); }
});

test("pause applies at a tick boundary, resume and cancel remain owner scoped", () => {
  const { store, queue } = setup();
  try {
    queue.enqueue({ id: "job", ownerId: "alice", runId: "run", rounds: 5, now: 0 });
    queue.claim("worker", { now: 10, leaseMs: 1000 });
    assert.equal(queue.pause("bob", "job"), false);
    assert.equal(queue.pause("alice", "job"), true);
    assert.equal(queue.get("alice", "job").status, "running");
    queue.progress("alice", "job", "worker", { seq: 1, now: 11 });
    assert.equal(queue.get("alice", "job").status, "paused");
    assert.equal(queue.resume("alice", "job"), true);
    assert.equal(queue.cancel("alice", "job"), true);
    assert.equal(queue.claim("worker-2", { now: 20 }), null);
  } finally { store.close(); }
});

test("worker resumes from a stored checkpoint without replaying a committed tick", async () => {
  const { store, queue } = setup();
  try {
    queue.enqueue({ id: "job", ownerId: "alice", runId: "run", rounds: 3, now: 0 });
    queue.claim("crashed-worker", { now: 10, leaseMs: 10 });
    const first = { ...meta("event-1"), runId: "run", seq: 1, tick: 1,
      actorId: "company", type: "transition", payload: { delta: 1 },
      parentEventIds: [], sourceClaimIds: [], provenance: "simulated-event" };
    store.appendEvents("alice", "run", [first], {
      ...meta("cp-1"), runId: "run", seq: 1, tick: 1,
      serializedState: { total: 1 }, stateHash: hashState({ total: 1 })
    });
    const ticks = [];
    const outcome = await workOne(queue, "replacement", async ({ tick, seq }) => {
      ticks.push(tick);
      const event = { ...meta("event-" + tick), runId: "run", seq: seq + 1, tick,
        actorId: "company", type: "transition", payload: { delta: 1 },
        parentEventIds: ["event-" + (tick - 1)], sourceClaimIds: [],
        provenance: "simulated-event" };
      const state = { total: tick };
      return { events: [event], checkpoint: {
        ...meta("cp-" + tick), runId: "run", seq: seq + 1, tick,
        serializedState: state, stateHash: hashState(state)
      }, usage: { calls: 0, tokens: 0 } };
    }, { now: () => 1000, leaseMs: 500 });
    assert.deepEqual(ticks, [2, 3]);
    assert.equal(outcome.status, "done");
    assert.equal(store.readEvents("alice", "run").length, 3);
    assert.equal(queue.get("alice", "job").status, "done");
  } finally { store.close(); }
});
