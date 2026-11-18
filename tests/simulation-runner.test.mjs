import test from "node:test";
import assert from "node:assert/strict";
import { SqliteEventStore } from "../server/storage/sqlite.mjs";
import { SqliteJobQueue } from "../server/jobs/queue.mjs";
import { workOne } from "../server/jobs/worker.mjs";
import { buildWorld } from "../server/simulation/worldBuilder.mjs";
import { createPricingScenario } from "../server/simulation/domains/productDecision/index.mjs";
import { createTickExecutor } from "../server/simulation/runner.mjs";
import { hashState } from "../server/storage/stateHash.mjs";

const at = "2026-11-18T00:00:00.000Z";
const project = { id: "p", ownerId: "local", schemaVersion: 1,
  createdAt: at, updatedAt: at, title: "Pricing", domainPack: "product-decision" };
const segments = Array.from({ length: 11 }, (_, i) => ({
  id: "segment-" + i, label: "Segment " + i,
  customers: 20 + i, monthlyChurn: 0.03
}));
const world = buildWorld({ project, baselinePrice: 499,
  companyName: "Example", segments });
const scenario = createPricingScenario({
  world, projectId: "p", question: "Should we raise the price?",
  interventions: [
    { price: 599, rolloutPercent: 100, label: "full" },
    { price: 599, rolloutPercent: 25, label: "pilot" }
  ],
  rounds: 6
});
const run = {
  schemaVersion: 1, id: "run-1", ownerId: "local", createdAt: at,
  scenarioId: scenario.id, seed: 42, modelId: "rules",
  promptVersion: "v1", engineVersion: "v1", status: "queued",
  budget: { maxCalls: 0, maxTokens: 0 }, spent: { calls: 0, tokens: 0 },
  checkpointTick: 0, startedAt: null, completedAt: null,
  interventionId: "option-0"
};

test("12 agents complete six ticks with persistent state transitions", async () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project);
    store.putRun("local", "p", run);
    const queue = new SqliteJobQueue(store);
    queue.enqueue({ id: "job", ownerId: "local", runId: "run-1", rounds: 6 });
    const execute = createTickExecutor({
      store, getScenario: async () => scenario
    });
    const result = await workOne(queue, "worker", execute);
    assert.equal(result.status, "done");
    const events = store.readEvents("local", "run-1");
    assert.ok(events.length > 30);
    assert.ok(events.some((event) => event.type === "announce_change"));
    assert.ok(events.some((event) => event.type === "respond_to_announcement"));
    const checkpoint = store.getCheckpoint("local", "run-1");
    assert.equal(checkpoint.tick, 6);
    assert.equal(checkpoint.stateHash, hashState(checkpoint.serializedState));
    assert.equal(checkpoint.serializedState.world.variables.currentPrice, 599);
    assert.equal(checkpoint.serializedState.world.variables.priceAnnounced, true);
  } finally { store.close(); }
});

test("the same tick, seed and state yield the same action types", async () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project);
    store.putRun("local", "p", run);
    const execute = createTickExecutor({
      store, getScenario: async () => scenario
    });
    const params = { tick: 1, seq: 0, checkpoint: null,
      run, job: { spentCalls: 0, spentTokens: 0 }, signal: new AbortController().signal };
    const a = await execute(params);
    const b = await execute(params);
    assert.deepEqual(a.events.map((e) => e.type), b.events.map((e) => e.type));
    assert.deepEqual(a.checkpoint.serializedState.world,
      b.checkpoint.serializedState.world);
  } finally { store.close(); }
});
