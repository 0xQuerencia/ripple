import test from "node:test";
import assert from "node:assert/strict";
import { buildWorld } from "../server/simulation/worldBuilder.mjs";
import { createPricingScenario } from "../server/simulation/domains/productDecision/index.mjs";
import { makeRunReport, formatReportMarkdown } from "../server/simulation/reports.mjs";
import { hashState } from "../server/storage/stateHash.mjs";

const project = { id: "p", ownerId: "local" };
const world = buildWorld({ project, companyName: "Sample", baselinePrice: 499,
  segments: [{ id: "users", label: "Users", customers: 100, monthlyChurn: 0.05 }] });
const scenario = createPricingScenario({ world, projectId: "p", question: "Raise the price?",
  interventions: [
    { label: "all", price: 599, rolloutPercent: 100 },
    { label: "pilot", price: 599, rolloutPercent: 25 }
  ] });
const at = "2026-11-18T00:00:00.000Z";
const run = { schemaVersion: 1, ownerId: "local", id: "run-1", createdAt: at,
  scenarioId: scenario.id, seed: 1, modelId: "rules", promptVersion: "v1",
  engineVersion: "v1", status: "done", budget: { maxCalls: 0, maxTokens: 0 },
  spent: { calls: 0, tokens: 0 }, checkpointTick: 2,
  startedAt: at, completedAt: at };
const checkpoint = {
  runId: "run-1", tick: 2, serializedState: { world },
  stateHash: hashState({ world })
};
const events = [{ type: "announce_change", sourceClaimIds: [], tick: 1 },
  { type: "respond_to_announcement", sourceClaimIds: [], tick: 2 }];

test("reports contain only derived calculations and labeled simulated findings", () => {
  const report = makeRunReport({ run, scenario, checkpoint, events });
  assert.equal(report.findings[0].provenance, "derived");
  assert.equal(report.findings[1].provenance, "simulated-event");
  assert.equal(report.comparisons.length, 3);
  assert.equal(report.inputs.stateHash, checkpoint.stateHash);
  const md = formatReportMarkdown(report);
  assert.match(md, /not a calibrated real-world prediction/);
  assert.match(md, /state hash/i);
  assert.match(md, /fixed churn/i);
});

test("report refuses unreviewed, nonexistent, or cross-owner citations", () => {
  const linked = structuredClone(scenario);
  linked.baselineState.entities[1].sourceClaimIds = ["source-claim"];
  const claim = { id: "source-claim", reviewed: true, rejected: false,
    text: "Monthly churn is 5%", provenance: "observed",
    sourceSpans: [{ sourceId: "s1", row: 2, quote: "5%" }] };
  const source = { id: "s1", filename: "metrics.csv" };
  const output = makeRunReport({ run, scenario: linked, checkpoint, events,
    claims: [claim], sources: [source] });
  assert.equal(output.evidence[0].sourceRefs[0], "metrics.csv row 2");
  assert.throws(() => makeRunReport({
    run, scenario: linked, checkpoint, events, claims: [{ ...claim, reviewed: false }],
    sources: [source]
  }), /unreviewed/);
  assert.throws(() => makeRunReport({
    run, scenario: linked, checkpoint, events, claims: [claim], sources: []
  }), /unavailable source/);
  assert.throws(() => makeRunReport({
    run: { ...run, ownerId: "other" }, scenario, checkpoint, events
  }), /belong together/);
});
