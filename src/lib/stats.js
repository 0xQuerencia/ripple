import { DOMAIN_BY_ID } from "../../shared/world.mjs";
import { TIMEFRAMES } from "../../shared/engine.mjs";

const tally = (items, key, values) =>
  Object.fromEntries(
    values.map((v) => [v, items.filter((e) => e[key] === v).length]),
  );

/** The big picture of a ripple: how far it reached and which parts of life it touched. */
export function summarize(events) {
  const effects = events.slice(1);
  const counts = new Map();
  for (const e of effects) counts.set(e.area, (counts.get(e.area) ?? 0) + 1);
  const areas = [...counts]
    .map(([id, count]) => ({
      id,
      count,
      name: DOMAIN_BY_ID[id]?.name ?? id,
      color: DOMAIN_BY_ID[id]?.color ?? "#c4bdc2",
    }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return {
    total: effects.length,
    rounds: Math.max(0, ...effects.map((e) => e.round)),
    links: effects.reduce((n, e) => n + 1 + (e.alsoFrom?.length ?? 0), 0),
    areas,
    severity: tally(effects, "severity", ["high", "medium", "low"]),
    timeframe: tally(effects, "timeframe", TIMEFRAMES),
  };
}
