import test from "node:test";
import assert from "node:assert/strict";
import { buildWorld } from "../server/simulation/worldBuilder.mjs";
import { createPricingScenario } from "../server/simulation/domains/productDecision/index.mjs";
import { compareSimulationRuns, forkScenarioAtCheckpoint } from "../shared/simulation/diff.mjs";
import { hashState } from "../server/storage/stateHash.mjs";

const world = buildWorld({ project: { id: "p", ownerId: "local" },
  companyName: "Example", baselinePrice: 499,
  segments: [{ id: "group", label: "Group", customers: 100, monthlyChurn: 0.05 }] });
const scenario = createPricingScenario({ world, projectId: "p",
  question: "Raise price?", interventions: [
    { price: 599, rolloutPercent: 100, label: "all" },
    { price: 599, rolloutPercent: 25, label: "pilot" }
  ] });
const snapshot = (id, price, count) => {
  const next = structuredClone(world);
  next.variables.currentPrice = price;
  next.entities[1].attributes.customers = count;
  return {
    run: { id, scenarioId: scenario.id, ownerId: "local",
      interventionId: id === "b" ? "option-0" : "baseline" },
    checkpoint: { runId: id, tick: 4, serializedState: { world: next },
      stateHash: hashState({ world: next }) },
    events: [{ type: "announce_change", seq: 1, tick: 1 }]
  };
};

test("comparing two runs reports only actual changed values and links", () => {
  const diff = compareSimulationRuns(scenario, snapshot("a", 499, 100), snapshot("b", 599, 90));
  assert.deepEqual(diff.changedVariables.map((v) => v.key), ["currentPrice"]);
  assert.deepEqual(diff.changedEntities.map((e) => e.id), ["group"]);
  assert.deepEqual(diff.changedLinks, { added: [], removed: [] });
  assert.equal(diff.tickCounts.baseline, 4);
  assert.match(diff.limitations[0], /simulated hypotheses/);
});

test("forking at a checkpoint does not mutate the original run or scenario", () => {
  const before = JSON.stringify(scenario);
  const source = snapshot("b", 599, 90);
  const fork = forkScenarioAtCheckpoint({
    originalScenario: scenario, checkpoint: source.checkpoint,
    overrides: { currentPrice: 549 },
    label: "Try a smaller increase", id: "fork-1",
    createdAt: "2026-11-18T00:00:00.000Z"
  });
  assert.equal(fork.baselineState.variables.currentPrice, 549);
  assert.equal(fork.baselineState.entities[1].attributes.customers, 90);
  assert.equal(fork.baselineState.tick, 0);
  assert.equal(fork.forkedFrom.runId, "b");
  assert.equal(JSON.stringify(scenario), before);
  assert.equal(source.checkpoint.serializedState.world.variables.currentPrice, 599);
  assert.throws(() => forkScenarioAtCheckpoint({
    originalScenario: scenario, checkpoint: source.checkpoint,
    overrides: { hiddenBudget: 1 }, id: "fork-2", createdAt: "2026-11-18T00:00:00.000Z"
  }), /undeclared/);
});

test("different-owner runs cannot be compared", () => {
  const other = snapshot("b", 599, 90);
  other.run.ownerId = "someone-else";
  assert.throws(() => compareSimulationRuns(scenario, snapshot("a", 499, 100), other),
    /ownership mismatch/);
});
