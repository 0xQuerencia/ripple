import { observeAgent } from "./agents/index.mjs";

const key = (runId, agentId) => runId + ":" + agentId;

export class AgentMemory {
  constructor(snapshot = {}) {
    this.rows = new Map(Object.entries(snapshot));
  }
  recent(runId, agentId) {
    return structuredClone(this.rows.get(key(runId, agentId)) || []);
  }
  rememberObserved(runId, agent, world, events) {
    const visible = observeAgent(agent, world, events).visibleEvents;
    const current = this.recent(runId, agent.id);
    const seen = new Set(current.map((event) => event.id));
    for (const event of visible) {
      if (seen.has(event.id)) continue;
      current.push({ id: event.id, tick: event.tick, type: event.type,
        text: JSON.stringify(event.payload || {}).slice(0, 300) });
      seen.add(event.id);
    }
    const bounded = current.slice(-20);
    this.rows.set(key(runId, agent.id), bounded);
    return bounded;
  }
  snapshot() {
    return Object.fromEntries([...this.rows].map(([name, items]) =>
      [name, items.slice(-20)]));
  }
}

function score(seed, tick, id) {
  let x = (seed ^ Math.imul(tick, 2654435761)) >>> 0;
  for (let i = 0; i < id.length; i++)
    x = Math.imul(x ^ id.charCodeAt(i), 16777619) >>> 0;
  return x;
}

export function scheduleAgents({ agents, tick, seed, maxAgents = 20, changedIds = [] }) {
  if (!Number.isInteger(tick) || tick < 1 || !Number.isInteger(seed) || seed < 0 ||
      !Number.isInteger(maxAgents) || maxAgents < 1 || maxAgents > 100)
    throw new Error("Invalid schedule");
  const changed = new Set(changedIds);
  return agents.filter((agent) => {
    const cadence = agent.policy.actionCadence ?? 1;
    if (!Number.isInteger(cadence) || cadence < 1) throw new Error("Invalid cadence");
    return changed.has(agent.id) || (tick - 1) % cadence === 0;
  }).sort((a, b) => {
    const importance = Number(changed.has(b.id)) - Number(changed.has(a.id));
    return importance || score(seed, tick, a.id) - score(seed, tick, b.id) ||
      a.id.localeCompare(b.id);
  }).slice(0, maxAgents);
}
