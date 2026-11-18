import { SqliteEventStore } from "../../server/storage/sqlite.mjs";
import { SqliteJobQueue } from "../../server/jobs/queue.mjs";
import { workOne } from "../../server/jobs/worker.mjs";
import { createTickExecutor } from "../../server/simulation/runner.mjs";
import { replaySimulation } from "../../server/simulation/replay.mjs";
import { pricingIndicators } from "../../server/simulation/domains/productDecision/index.mjs";
import { pricingFixtures, makeFixture } from "./fixtures.mjs";

const at = "2026-11-18T00:00:00.000Z";

function recordProject(data) {
  return {
    schemaVersion: 1, id: data.id, ownerId: data.ownerId,
    createdAt: at, updatedAt: at, title: data.label || "Evaluation case",
    domainPack: "product-decision"
  };
}

async function exercise(data, interventionId, seed) {
  const store = new SqliteEventStore();
  try {
    const scenario = data.scenario;
    store.putProject(recordProject(data));
    const run = {
      schemaVersion: 1, id: "run-" + interventionId, ownerId: data.ownerId,
      createdAt: at, scenarioId: scenario.id, seed, modelId: "rules",
      promptVersion: "product-decision-v1", engineVersion: "ripple-sim-v1",
      interventionId, status: "queued",
      budget: { maxCalls: 0, maxTokens: 0 }, spent: { calls: 0, tokens: 0 },
      checkpointTick: 0, startedAt: null, completedAt: null
    };
    store.putRun(data.ownerId, data.id, run);
    const queue = new SqliteJobQueue(store);
    queue.enqueue({
      id: "job-" + interventionId, ownerId: data.ownerId,
      runId: run.id, rounds: scenario.config.rounds
    });
    const execute = createTickExecutor({
      store, getScenario: async () => scenario
    });
    const result = await workOne(queue, "evaluator", execute);
    if (result?.status !== "done") throw new Error("Job did not finish");
    const events = store.readEvents(data.ownerId, run.id, { limit: 1000 });
    const checkpoint = store.getCheckpoint(data.ownerId, run.id);
    const replay = replaySimulation({ scenario, run, events, checkpoint });
    const reportableEvents = events.filter((event) =>
      event.type !== "tick-summary" && event.type !== "tick-actions");
    const behaviors = reportableEvents.reduce((counts, event) => {
      counts[event.type] = (counts[event.type] || 0) + 1;
      return counts;
    }, {});
    const allKnown = new Set(scenario.baselineState.activeAssumptions);
    const allGrounded = events.every((event) =>
      event.provenance === "simulated-event" &&
      event.sourceClaimIds.every((id) => allKnown.has(id)));
    return {
      ticks: checkpoint.tick,
      eventCount: events.length,
      replayVerified: replay.stateHash === checkpoint.stateHash,
      allGrounded,
      behaviors,
      stateHash: replay.stateHash,
      currentPrice: replay.state.world.variables.currentPrice,
      estimatedFixedChurnRevenue: pricingIndicators(scenario.baselineState, {
        price: replay.state.world.variables.currentPrice,
        rolloutPercent: replay.state.world.variables.rolloutPercent
      }).monthlyRevenueUnderFixedChurn
    };
  } finally {
    store.close();
  }
}

export async function runSyntheticEvaluation() {
  const checks = [];
  for (const [index, fixture] of pricingFixtures.entries()) {
    const data = { ...makeFixture(fixture, index), label: fixture.label };
    const baseline = await exercise(data, "baseline", 100 + index);
    const intervention = await exercise(data, "option-0", 100 + index);
    checks.push({
      case: fixture.label, baseline, intervention,
      interventionShowsDifference: intervention.currentPrice !== baseline.currentPrice,
      hasMoreResponseEvents: (intervention.behaviors.respond_to_announcement || 0) >
        (baseline.behaviors.respond_to_announcement || 0)
    });
  }
  return {
    kind: "synthetic-integrity-only",
    calibratedAgainstHistory: false,
    cases: checks.length,
    allReplayVerified: checks.every((item) =>
      item.baseline.replayVerified && item.intervention.replayVerified),
    allSourceIdsGrounded: checks.every((item) =>
      item.baseline.allGrounded && item.intervention.allGrounded),
    allInterventionsRecognized: checks.every((item) => item.interventionShowsDifference),
    agentResponseSensitivity: checks.filter((item) => item.hasMoreResponseEvents).length,
    results: checks
  };
}
