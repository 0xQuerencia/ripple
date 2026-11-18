import { hashState } from "../storage/stateHash.mjs";
import { validateScenario } from "../../shared/simulation/schema.mjs";
import { productDecisionAgents } from "./domains/productDecision/index.mjs";
import { observeAgent, ruleProposal } from "./agents/index.mjs";
import { scheduleAgents, AgentMemory } from "./memory.mjs";
import { applyActionBatch } from "./apply.mjs";

function beginning(scenario, run) {
  const world = structuredClone(scenario.baselineState);
  const interventionId = run.interventionId || "baseline";
  if (interventionId !== "baseline") {
    const option = scenario.interventions.find((item) => item.id === interventionId);
    if (!option) throw new Error("Unknown intervention");
    for (const [key, value] of Object.entries(option.changes))
      world.variables[key] = value;
  }
  return world;
}

export function createTickExecutor({ store, getScenario, proposer = ruleProposal,
  maxAgents = 20 }) {
  return async function executeTick({ tick, seq, checkpoint, signal, run, job }) {
    if (signal?.aborted) throw new Error("Simulation interrupted");
    const scenario = await getScenario(run.ownerId, run.scenarioId);
    validateScenario(scenario);
    if (scenario.ownerId !== run.ownerId || run.scenarioId !== scenario.id)
      throw new Error("Scenario ownership mismatch");
    const saved = checkpoint?.serializedState;
    const world = saved?.world ? structuredClone(saved.world) : beginning(scenario, run);
    const memory = new AgentMemory(saved?.memory || {});
    const agents = productDecisionAgents(world, { competitorName: scenario.competitorName });
    const prior = store.readEvents(run.ownerId, run.id, {
      after: Math.max(0, seq - 500), limit: 500
    });
    const eligible = scheduleAgents({ agents, tick, seed: run.seed, maxAgents });
    const proposals = [];
    const usage = { calls: 0, tokens: 0 };
    for (const agent of eligible) {
      if (signal?.aborted) throw new Error("Simulation interrupted");
      const observation = observeAgent(agent, world, prior);
      const output = await proposer({
        runId: run.id, tick, agent, observation,
        recentMemory: memory.recent(run.id, agent.id), signal
      });
      const action = output?.proposal ?? output;
      if (action) proposals.push(action);
      const counted = output?.usage || {};
      usage.calls += counted.calls || 0;
      usage.tokens += counted.tokens || 0;
      if (run.budget.maxCalls > 0 && job.spentCalls + usage.calls >= run.budget.maxCalls)
        break;
      if (run.budget.maxTokens > 0 && job.spentTokens + usage.tokens >= run.budget.maxTokens)
        break;
    }
    const result = applyActionBatch({
      world, agents, proposals, tick, runId: run.id, priorEvents: prior
    });
    const emissions = [
      ...result.emissions,
      {
        actorId: "engine", type: "tick-actions",
        payload: { visibility: "private", audience: ["engine"],
          acceptedActions: result.accepted, rejectedActions: result.rejected }
      },
      {
        actorId: "engine", type: "tick-summary",
        payload: { accepted: result.accepted.length, rejected: result.rejected.length,
          visibility: "public" }
      }
    ];
    let nextSeq = seq;
    const at = new Date().toISOString();
    const events = emissions.map((emission) => {
      const id = run.id + "-e" + ++nextSeq;
      const actorHistory = prior.slice().reverse().find((event) =>
        event.actorId === emission.actorId && event.tick < tick);
      return {
        schemaVersion: 1, id, ownerId: run.ownerId, createdAt: at,
        runId: run.id, seq: nextSeq, tick, actorId: emission.actorId,
        type: emission.type, payload: emission.payload,
        parentEventIds: actorHistory ? [actorHistory.id] : [],
        sourceClaimIds: [], provenance: "simulated-event"
      };
    });
    const allEvents = [...prior, ...events];
    for (const agent of agents)
      memory.rememberObserved(run.id, agent, result.state, allEvents);
    const serializedState = { world: result.state, memory: memory.snapshot() };
    const nextCheckpoint = {
      schemaVersion: 1, id: run.id + "-cp-" + tick,
      ownerId: run.ownerId, createdAt: at, runId: run.id,
      seq: nextSeq, tick, serializedState, stateHash: hashState(serializedState)
    };
    return { events, checkpoint: nextCheckpoint, usage };
  };
}
