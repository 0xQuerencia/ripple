import { validateScenario } from "./schema.mjs";

const PRICE_KEYS = ["baselinePrice", "currentPrice", "rolloutPercent"];

function finite(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function comparableCheckpoint(checkpoint) {
  return checkpoint?.serializedState?.world || null;
}

export function compareSimulationRuns(scenario, first, second) {
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
  const changedVariables = Object.keys({ ...a.variables, ...b.variables })
    .filter((key) => a.variables[key] !== b.variables[key])
    .map((key) => ({ key, baseline: a.variables[key] ?? null, alternative: b.variables[key] ?? null }));
  const changedResources = Object.keys({ ...a.resources, ...b.resources })
    .filter((key) => a.resources[key] !== b.resources[key])
    .map((key) => ({ key, baseline: a.resources[key] ?? null, alternative: b.resources[key] ?? null }));
  const findEntity = (world, id) => world.entities.find((entity) => entity.id === id);
  const changedEntities = [...new Set([...a.entities, ...b.entities].map((entity) => entity.id))]
    .filter((id) => JSON.stringify(findEntity(a, id) || null) !== JSON.stringify(findEntity(b, id) || null))
    .map((id) => ({
      id,
      baseline: findEntity(a, id)?.attributes ?? null,
      alternative: findEntity(b, id)?.attributes ?? null
    }));
  const idsA = new Set(a.relationships.map((relation) => relation.id));
  const idsB = new Set(b.relationships.map((relation) => relation.id));
  const changedLinks = {
    added: [...idsB].filter((id) => !idsA.has(id)),
    removed: [...idsA].filter((id) => !idsB.has(id))
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
    inputDifferences: scenario.interventions.find((option) =>
      option.id === second.run.interventionId)?.changes || {},
    changedVariables, changedResources, changedEntities, changedLinks,
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

export function forkScenarioAtCheckpoint({
  originalScenario, checkpoint, overrides, label, id, createdAt
}) {
  validateScenario(originalScenario);
  const world = comparableCheckpoint(checkpoint);
  if (!world || world.ownerId !== originalScenario.ownerId)
    throw new Error("Checkpoint world is unavailable or belongs to another owner");
  if (!overrides || Array.isArray(overrides) || typeof overrides !== "object" ||
      Object.keys(overrides).length < 1 || Object.keys(overrides).length > 8)
    throw new Error("Select at least one variable to change");
  const changedWorld = structuredClone(world);
  for (const [key, value] of Object.entries(overrides)) {
    if (!Object.hasOwn(changedWorld.variables, key))
      throw new Error("Cannot change an undeclared variable");
    if (!PRICE_KEYS.includes(key) || !finite(value))
      throw new Error("Variable change is not supported");
    if (key !== "rolloutPercent" && value <= 0)
      throw new Error("Price must be positive");
    if (key === "rolloutPercent" && (value < 0 || value > 100))
      throw new Error("Rollout must be between 0 and 100");
    changedWorld.variables[key] = value;
  }
  changedWorld.tick = 0;
  changedWorld.id = "world-" + id;
  changedWorld.createdAt = createdAt;
  const scenario = {
    ...structuredClone(originalScenario),
    id, createdAt, question: String(label || originalScenario.question).slice(0, 1000),
    baselineState: changedWorld,
    interventions: originalScenario.interventions.map((choice) => ({
      ...choice,
      changes: { ...choice.changes }
    })),
    forkedFrom: { runId: checkpoint.runId, tick: checkpoint.tick,
      stateHash: checkpoint.stateHash }
  };
  validateScenario(scenario);
  return scenario;
}
