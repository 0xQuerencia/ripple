import { randomUUID } from "node:crypto";
import { validateReport, validateScenario, validateRun } from "../../shared/simulation/schema.mjs";
import { pricingIndicators } from "./domains/productDecision/index.mjs";

const FINISHED = new Set(["done", "paused", "failed", "cancelled"]);

function sourceRef(span, sources) {
  const source = sources.find((file) => file.id === span.sourceId);
  if (!source) throw new Error("A claim references an unavailable source");
  return source.filename + (span.row ? " row " + span.row :
    span.page ? " page " + span.page : " characters " + span.charStart + "–" + span.charEnd);
}

export function makeRunReport({
  run, scenario, events, checkpoint, claims = [], sources = [],
  generatedAt = new Date().toISOString()
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
    for (const id of entity.sourceClaimIds) referenced.add(id);
  }
  for (const event of events) for (const id of event.sourceClaimIds)
    referenced.add(id);
  const evidence = [...referenced].map((id) => {
    const claim = claims.find((item) => item.id === id);
    if (!claim || !claim.reviewed || claim.rejected)
      throw new Error("Report cannot cite a missing or unreviewed claim");
    return {
      id: claim.id, text: claim.text, provenance: claim.provenance,
      sourceRefs: claim.sourceSpans.map((span) => sourceRef(span, sources)),
      sourceSpans: claim.sourceSpans
    };
  });
  for (const entity of scenario.baselineState.entities) {
    if (entity.provenance === "assumption") {
      evidence.push({
        text: entity.label + ": " + Object.entries(entity.attributes)
          .map(([key, value]) => key + " = " + value).join(", "),
        provenance: "assumption", sourceRefs: []
      });
    }
  }
  const observed = events.filter((event) => event.type !== "tick-summary");
  const counts = Object.entries(observed.reduce((summary, event) => {
    summary[event.type] = (summary[event.type] || 0) + 1;
    return summary;
  }, {})).sort((a, b) => b[1] - a[1]);
  const state = checkpoint.serializedState.world;
  const indicators = pricingIndicators(scenario.baselineState, {
    price: state.variables.currentPrice,
    rolloutPercent: state.variables.rolloutPercent
  });
  const findings = [{
    provenance: "derived",
    text: "Illustrative monthly revenue under unchanged historical churn: " +
      indicators.monthlyRevenueUnderFixedChurn.toFixed(2) +
      " (calculation only, not predicted revenue)"
  }, ...counts.slice(0, 20).map(([type, count]) => ({
    provenance: "simulated-event",
    text: count + " " + type.replaceAll("_", " ") +
      " events occurred inside this run"
  }))];
  const alternatives = [
    { id: "baseline", label: "Baseline",
      amount: pricingIndicators(scenario.baselineState).monthlyRevenueUnderFixedChurn },
    ...scenario.interventions.map((option) => ({
      id: option.id, label: option.label,
      amount: pricingIndicators(scenario.baselineState, {
        price: option.changes.currentPrice,
        rolloutPercent: option.changes.rolloutPercent
      }).monthlyRevenueUnderFixedChurn
    }))
  ];
  const report = {
    schemaVersion: 1, id: randomUUID(), ownerId: run.ownerId,
    createdAt: generatedAt, runId: run.id, question: scenario.question,
    inputs: {
      scenarioId: scenario.id, domainPack: "product-decision",
      interventionId: run.interventionId || "baseline",
      baselineVariables: scenario.baselineState.variables,
      finalVariables: state.variables,
      agentModel: run.modelId, seed: run.seed,
      ticks: checkpoint.tick, stateHash: checkpoint.stateHash
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
      label: entry.label, interventionId: entry.id,
      illustrativeMonthlyRevenue: entry.amount, provenance: "derived",
      method: "fixed-historical-churn-v1"
    })),
    methodVersion: "product-decision-rules-v1",
    generatedAt
  };
  validateReport(report);
  return report;
}

export function formatReportMarkdown(report) {
  validateReport(report);
  const escapeMarkdown = (value) => String(value)
    .replace(/[<>&]/g, (character) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[character])
    .replace(/[\r\n]+/g, " ");
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
    ...report.evidence.map((item) =>
      "- [" + item.provenance + "] " + escapeMarkdown(item.text) +
      (item.sourceRefs?.length ? " — " + item.sourceRefs.map(escapeMarkdown).join("; ") : "")),
    "",
    "## Illustrative alternatives",
    "",
    ...report.comparisons.map((item) =>
      "- " + escapeMarkdown(item.label) + ": " +
      Number(item.illustrativeMonthlyRevenue).toFixed(2) +
      " / month (calculated under fixed churn)"),
    "",
    "## Events and observations",
    "",
    ...report.findings.map((item) =>
      "- [" + item.provenance + "] " + escapeMarkdown(item.text)),
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
