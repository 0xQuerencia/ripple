// Places a ripple on the map: the cause in the middle, each round on a bigger ring.
// Positions depend only on the events so far, so a node never moves when later ones arrive.

export const RING = 160;
export const MIN_GAP = 128;
const GOLDEN = 2.399963;
const SIBLING_STEP = 0.4;
const NUDGE = 0.13;
const MAX_TRIES = 40;

/** How far from the cause a round sits. Rings grow a little slower than linearly so the map stays compact. */
export const ringRadius = (round) =>
  round <= 0 ? 0 : RING * (1 + 0.85 * (round - 1));

// A fixed, repeatable wobble so chains curve and fan out instead of running along a straight spoke.
const bend = (index) => (((index * 37) % 11) - 5) * 0.09;

const away = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/** @returns {Map<string, {x: number, y: number, angle: number}>} keyed by node key */
export function layoutRipple(events) {
  const positions = new Map();
  const children = new Map();
  if (!events.length || !events[0].targetId) return positions;

  const originKey = events[0].targetId;
  positions.set(originKey, { x: 0, y: 0, angle: 0 });

  for (const [index, event] of events.slice(1).entries()) {
    const parent = positions.get(event.sourceId) ?? positions.get(originKey);
    const order = children.get(event.sourceId) ?? 0;
    children.set(event.sourceId, order + 1);

    const sibling =
      order === 0
        ? 0
        : (order % 2 ? 1 : -1) * Math.ceil(order / 2) * SIBLING_STEP;
    const preferred =
      event.sourceId === originKey
        ? -Math.PI / 2 + order * GOLDEN
        : parent.angle + sibling + bend(index);

    const taken = [...positions.values()];
    let placed = null;
    for (let attempt = 0; attempt < MAX_TRIES && !placed; attempt++) {
      const angle =
        preferred + (attempt % 2 ? 1 : -1) * Math.ceil(attempt / 2) * NUDGE;
      const radius = ringRadius(event.round) + Math.floor(attempt / 10) * 45;
      const candidate = {
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        angle,
      };
      if (taken.every((other) => away(candidate, other) >= MIN_GAP))
        placed = candidate;
    }
    // Crowded beyond repair: keep the last candidate rather than refuse to draw the node.
    positions.set(
      event.targetId,
      placed ?? {
        x: Math.cos(preferred) * ringRadius(event.round + 1),
        y: Math.sin(preferred) * ringRadius(event.round + 1),
        angle: preferred,
      },
    );
  }
  return positions;
}
