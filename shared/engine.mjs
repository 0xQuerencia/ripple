import { SYSTEMS, SYSTEM_BY_ID, EDGE_LIST } from "./world.mjs";

export const MAX_ROUNDS = 4;
export const PER_ROUND = 5;
export const TIMEFRAMES = ["hours", "days", "weeks", "months", "years"];
const DEMO_TIMEFRAMES = ["days", "weeks", "months", "years"];

const PER_SOURCE = {
  "power-water": [
    "Water pumps slow down",
    "Water pumping depends on electrical power; backup generators may limit disruption.",
  ],
  "power-transport": [
    "Traffic systems are disrupted",
    "Some traffic signals and electric transport systems require electricity.",
  ],
  "power-health": [
    "Hospital backup systems are tested",
    "Medical services may need backup electricity to stay operational.",
  ],
  "power-industry": [
    "Production begins to slow",
    "Factories may pause energy-intensive operations.",
  ],
  "power-communications": [
    "Network reliability drops",
    "Communication infrastructure depends on electric power.",
  ],
  "water-farming": [
    "Irrigation becomes difficult",
    "Reduced water supply can limit crop irrigation.",
  ],
  "water-health": [
    "Water-dependent care is affected",
    "Some hospital operations need reliable clean water.",
  ],
  "nature-farming": [
    "Crop pollination is at risk",
    "Farming can depend on healthy ecosystems and pollinators.",
  ],
  "transport-industry": [
    "Deliveries arrive late",
    "Some businesses rely on transport for supplies.",
  ],
  "transport-economy": [
    "Trade slows down",
    "Transport disruption can delay the movement of goods.",
  ],
  "farming-people": [
    "Food supply may tighten",
    "A reduction in harvests can affect available food.",
  ],
  "farming-economy": [
    "Crop prices may shift",
    "Harvest changes can affect supply and market prices.",
  ],
  "industry-economy": [
    "Economic output changes",
    "Changes in industrial production can influence commerce.",
  ],
  "industry-people": [
    "Employment may shift",
    "Businesses affect jobs and access to goods.",
  ],
  "economy-people": [
    "Household budgets feel pressure",
    "Changes in wages or prices can affect affordability.",
  ],
  "communications-health": [
    "Emergency coordination gets harder",
    "Some health services rely on communication networks.",
  ],
};

function clean(s, max = 160) {
  return String(s ?? "")
    .trim()
    .slice(0, max);
}

/** Enforce graph evidence, round frontier and bounded visible effects on all model output. */
export function validateEffects(
  proposals,
  { frontier, visited, max = 3 } = {},
) {
  const allow = new Set((frontier ?? []).map(String));
  const seen = new Set((visited ?? []).map(String));
  const edges = new Set(EDGE_LIST.map((e) => `${e.source}>${e.target}`));
  const output = [];
  if (!Array.isArray(proposals)) return output;
  for (const e of proposals) {
    if (!e || typeof e !== "object") continue;
    const sourceId = clean(e.sourceId, 60),
      targetId = clean(e.targetId, 60);
    if (!allow.has(sourceId) || !SYSTEM_BY_ID[targetId] || seen.has(targetId))
      continue;
    if (!edges.has(`${sourceId}>${targetId}`)) continue;
    if (output.some((x) => x.targetId === targetId)) continue;
    const link = EDGE_LIST.find(
      (x) => x.source === sourceId && x.target === targetId,
    );
    output.push({
      sourceId,
      targetId,
      title: clean(e.title, 70) || `${SYSTEM_BY_ID[targetId].name} may change`,
      explanation:
        clean(e.explanation, 250) ||
        `A possible effect via ${link.relation.toLowerCase()}.`,
      timeframe: TIMEFRAMES.includes(e.timeframe) ? e.timeframe : "weeks",
      who: clean(e.who, 80),
      certainty: ["likely", "possible", "speculative"].includes(e.certainty)
        ? e.certainty
        : "possible",
      severity: ["low", "medium", "high"].includes(e.severity)
        ? e.severity
        : "medium",
      relation: link.relation,
    });
    if (output.length >= max) break;
  }
  return output;
}

/** Offline demonstration for UI development. Fixed heuristics, NOT Gemma reasoning. */
export function demoEffects({
  frontier = [],
  visited = [],
  tone = "negative",
  max = 3,
}) {
  const edges = EDGE_LIST.filter(
    (e) => frontier.includes(e.source) && !visited.includes(e.target),
  );
  return validateEffects(
    edges.slice(0, max).map((edge) => {
      const canned = PER_SOURCE[`${edge.source}-${edge.target}`];
      const target = SYSTEM_BY_ID[edge.target];
      return {
        sourceId: edge.source,
        targetId: edge.target,
        title:
          tone === "positive"
            ? `${target.name} may benefit`
            : (canned?.[0] ?? `${target.name} is affected`),
        explanation:
          tone === "positive"
            ? `A change upstream could improve ${target.name}; the size of the effect is uncertain. ${edge.relation}.`
            : (canned?.[1] ??
              `A possible consequence: ${edge.relation.toLowerCase()}.`),
        severity: "medium",
        certainty: "possible",
      };
    }),
    { frontier, visited, max },
  );
}

/**
 * Incremental validator for a ripple. Effects arrive one at a time (streamed from Gemma), in round order.
 * Round N may only grow from systems reached in round N-1, so what comes out is always a connected,
 * graph-legal chain no matter what the model proposed. `push` returns the accepted effect, or null.
 */
export function createChainBuilder({
  targetId,
  maxRounds = MAX_ROUNDS,
  perRound = PER_ROUND,
}) {
  const visited = [targetId];
  let frontier = [targetId];
  let reached = [];
  let round = 1;
  let accepted = 0;
  return {
    push(raw) {
      if (!raw || typeof raw !== "object" || !SYSTEM_BY_ID[targetId])
        return null;
      const r = Number(raw.round);
      if (!Number.isInteger(r) || r < round || r > maxRounds) return null;
      if (r > round) {
        if (r !== round + 1 || !reached.length) return null;
        round = r;
        frontier = reached;
        reached = [];
        accepted = 0;
      }
      if (accepted >= perRound) return null;
      const [effect] = validateEffects([raw], { frontier, visited, max: 1 });
      if (!effect) return null;
      visited.push(effect.targetId);
      reached.push(effect.targetId);
      accepted += 1;
      return { ...effect, round };
    },
  };
}

/** Validate a complete list of proposed effects in one go. */
export function assembleChain(
  raw,
  { targetId, maxRounds = MAX_ROUNDS, perRound = PER_ROUND } = {},
) {
  if (!Array.isArray(raw)) return [];
  const builder = createChainBuilder({ targetId, maxRounds, perRound });
  return raw
    .filter((e) => e && typeof e === "object")
    .sort((a, b) => (Number(a.round) || 99) - (Number(b.round) || 99))
    .map((e) => builder.push(e))
    .filter(Boolean);
}

/** The offline ripple: fixed heuristics over the same graph. Never claims to be Gemma. */
export function buildDemoChain({ targetId, tone = "negative" }) {
  const raw = [];
  let frontier = [targetId];
  const visited = [targetId];
  for (let round = 1; round <= MAX_ROUNDS; round++) {
    const batch = demoEffects({ frontier, visited, tone, max: PER_ROUND - 1 });
    if (!batch.length) break;
    raw.push(
      ...batch.map((e) => ({
        ...e,
        round,
        timeframe: DEMO_TIMEFRAMES[round - 1],
      })),
    );
    frontier = batch.map((e) => e.targetId);
    visited.push(...frontier);
  }
  return assembleChain(raw, { targetId });
}

const WORD = /[a-z0-9]+/g;

/**
 * Best-guess starting system for free text, by matching its words to system names and aliases.
 * Only used when Gemma is unavailable; Gemma normally chooses where a what-if begins.
 */
export function guessOrigin(text) {
  const words = new Set(
    String(text ?? "")
      .toLowerCase()
      .match(WORD) ?? [],
  );
  let best = SYSTEM_BY_ID.people;
  let bestScore = 0;
  for (const system of SYSTEMS) {
    const keys =
      `${system.id} ${system.name} ${system.aliases}`
        .toLowerCase()
        .match(WORD) ?? [];
    const score = keys.filter((key) => key.length > 2 && words.has(key)).length;
    if (score > bestScore) {
      best = system;
      bestScore = score;
    }
  }
  return best.id;
}
