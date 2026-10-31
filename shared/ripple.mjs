import { DOMAINS, SYSTEM_BY_ID } from "./world.mjs";
import { ICON_IDS } from "./icons.mjs";
import { TIMEFRAMES } from "./engine.mjs";

/** The longest question a visitor may ask, in characters. Shared by the form and the server. */
export const MAX_CAUSE_TEXT = 160;

/** The shape of an open-ended ripple. Gemma may invent anything inside these limits. */
export const RIPPLE_LIMITS = { rounds: 5, perRound: 7, nodes: 28 };

const AREAS = new Set(DOMAINS.map((d) => d.id));
const AREA_ICON = {
  energy: "lightbulb",
  environment: "leaf",
  food: "fork-knife",
  health: "heartbeat",
  transport: "car",
  tech: "cpu",
  finance: "coins",
  society: "users",
  industry: "gear",
  government: "flag",
  safety: "shield-check",
  knowledge: "book-open",
};
const CERTAINTIES = ["likely", "possible", "speculative"];
const SEVERITIES = ["low", "medium", "high"];

const clean = (s, max) =>
  String(s ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);

export const slugify = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);

/**
 * Turn whatever the model said about a node into a safe node. A key that matches a known system
 * (see world.mjs) always uses that system's name, area and picture, so the same idea looks the same
 * every time. Anything else keeps its own short name, with the area and icon checked against fixed lists.
 */
export function resolveNode(raw) {
  if (!raw || typeof raw !== "object") return null;
  const key = slugify(raw.key ?? raw.name);
  if (!key) return null;
  const known = SYSTEM_BY_ID[key];
  if (known)
    return {
      key,
      name: known.name,
      area: known.domain,
      icon: known.id,
      known: true,
    };
  const name = clean(raw.name, 40);
  if (name.length < 2) return null;
  const area = AREAS.has(raw.area) ? raw.area : "society";
  const icon = ICON_IDS.includes(raw.icon) ? raw.icon : AREA_ICON[area];
  return { key, name, area, icon, known: false };
}

/**
 * Incremental validator for an open-ended ripple, fed one streamed line at a time.
 * It cannot check the facts, but it guarantees the structure: every effect follows from a node
 * that already exists and was reached in an earlier round, no node appears twice, rounds do not
 * skip, and the whole ripple stays inside RIPPLE_LIMITS. `push` returns the accepted effect or null.
 */
export function createRippleBuilder(rawOrigin, limits = RIPPLE_LIMITS) {
  const origin = resolveNode(rawOrigin);
  if (!origin) return null;
  const nodes = new Map([[origin.key, { ...origin, round: 0 }]]);
  const perRound = new Map();
  let deepest = 0;

  return {
    origin,
    count: () => nodes.size - 1,
    push(raw) {
      if (!raw || typeof raw !== "object" || nodes.size - 1 >= limits.nodes)
        return null;
      const round = Number(raw.round);
      if (
        !Number.isInteger(round) ||
        round < 1 ||
        round > limits.rounds ||
        round > deepest + 1
      )
        return null;

      const from = slugify(raw.from ?? raw.sourceId);
      const parent = nodes.get(from);
      if (!parent || parent.round >= round) return null;

      const node = resolveNode({
        key: raw.key ?? raw.targetId,
        name: raw.name,
        area: raw.area,
        icon: raw.icon,
      });
      if (!node || nodes.has(node.key)) return null;
      if ((perRound.get(round) ?? 0) >= limits.perRound) return null;

      const alsoFrom = [
        ...new Set((Array.isArray(raw.also) ? raw.also : []).map(slugify)),
      ]
        .filter((key) => key !== from && nodes.get(key)?.round < round)
        .slice(0, 2);

      nodes.set(node.key, { ...node, round });
      perRound.set(round, (perRound.get(round) ?? 0) + 1);
      deepest = Math.max(deepest, round);
      return {
        ...node,
        round,
        sourceId: from,
        targetId: node.key,
        alsoFrom,
        title: clean(raw.title, 70) || node.name,
        explanation:
          clean(raw.explanation, 260) ||
          `A possible knock-on effect of ${parent.name}.`,
        who: clean(raw.who, 80),
        timeframe: TIMEFRAMES.includes(raw.timeframe) ? raw.timeframe : "weeks",
        certainty: CERTAINTIES.includes(raw.certainty)
          ? raw.certainty
          : "possible",
        severity: SEVERITIES.includes(raw.severity) ? raw.severity : "medium",
        relation: "",
      };
    },
  };
}
