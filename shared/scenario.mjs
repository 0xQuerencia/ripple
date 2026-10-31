import { demoEffects } from "./engine.mjs";
import { SYSTEM_BY_ID } from "./world.mjs";

/** Build an immutable, replayable scenario from the same world baseline. */
export function createScenario(cause, target, runId = crypto.randomUUID()) {
  if (!SYSTEM_BY_ID[target] || (cause.target && cause.target !== target)) {
    throw new Error("This cause needs a compatible world system.");
  }
  const events = [
    {
      id: `${runId}-0`,
      parentEventId: null,
      targetId: target,
      sourceId: null,
      title: cause.title,
      explanation: cause.description,
      round: 0,
    },
  ];
  let frontier = [target];
  const visited = [target];
  for (let round = 1; round <= 3; round++) {
    const effects = demoEffects({ frontier, visited, tone: cause.tone });
    if (!effects.length) break;
    const batch = effects.map((effect, i) => ({
      ...effect,
      id: `${runId}-${round}-${i}`,
      parentEventId: events.find((event) => event.targetId === effect.sourceId)
        .id,
      round,
    }));
    events.push(...batch);
    frontier = batch.map((event) => event.targetId);
    visited.push(...frontier);
  }
  return events;
}

export function getAncestry(events, id) {
  const chain = [];
  const seen = new Set();
  let current = events.find((event) => event.id === id);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.unshift(current);
    current = events.find((event) => event.id === current.parentEventId);
  }
  return chain;
}
