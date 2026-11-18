import { validateEventLog, validateScenario, validateRun } from "../../shared/simulation/schema.mjs";
import { hashState } from "../storage/stateHash.mjs";
import { applyActionBatch } from "./apply.mjs";
import { AgentMemory } from "./memory.mjs";
import { productDecisionAgents } from "./domains/productDecision/index.mjs";

function initialWorld(scenario, run) {
  const world = structuredClone(scenario.baselineState);
  const option = scenario.interventions.find((item) => item.id === run.interventionId);
  if (run.interventionId && run.interventionId !== "baseline" && !option)
    throw new Error("Unknown intervention");
  for (const [key, value] of Object.entries(option?.changes || {})) {
    if (!Object.hasOwn(world.variables, key))
      throw new Error("Invalid intervention variable");
    world.variables[key] = value;
  }
  return world;
}

export function replaySimulation({ scenario, run, events, checkpoint }) {
  validateRun(run);
  validateScenario(scenario);
  if (run.ownerId !== scenario.ownerId || run.scenarioId !== scenario.id)
    throw new Error("Mismatched scenario and run");
  validateEventLog(events);
  let world = initialWorld(scenario, run);
  const memory = new AgentMemory();
  let lastSeq = 0;
  const ticks = [...new Set(events.map((event) => event.tick))].filter((tick) => tick > 0)
    .sort((a, b) => a - b);
  for (const tick of ticks) {
    if (tick !== world.tick + 1)
      throw new Error("Simulation tick gap");
    const batch = events.filter((event) => event.tick === tick);
    const audit = batch.filter((event) => event.type === "tick-actions");
    if (audit.length !== 1 || !Array.isArray(audit[0].payload.acceptedActions))
      throw new Error("Missing accepted action audit");
    const agents = productDecisionAgents(world, {
      competitorName: scenario.competitorName
    });
    const result = applyActionBatch({
      world, agents, proposals: audit[0].payload.acceptedActions,
      tick, runId: run.id, priorEvents: events.filter((event) => event.tick < tick)
    });
    if (result.rejected.length)
      throw new Error("Stored action is no longer valid");
    world = result.state;
    const history = events.filter((event) => event.tick <= tick);
    for (const agent of agents)
      memory.rememberObserved(run.id, agent, world, history);
    lastSeq = batch.at(-1).seq;
  }
  const state = { world, memory: memory.snapshot() };
  const stateHash = hashState(state);
  if (checkpoint) {
    if (checkpoint.runId !== run.id || checkpoint.tick !== world.tick ||
        checkpoint.seq !== lastSeq || checkpoint.stateHash !== stateHash)
      throw new Error("Saved checkpoint fails replay integrity");
  }
  return { state, stateHash, tick: world.tick, seq: lastSeq };
}
