import { buildDemoChain } from "./engine.mjs";
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
  for (const effect of buildDemoChain({ targetId: target, tone: cause.tone })) {
    const parent = events.find((event) => event.targetId === effect.sourceId);
    events.push({
      ...effect,
      id: `${runId}-${effect.round}-${events.length}`,
      parentEventId: parent.id,
    });
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
