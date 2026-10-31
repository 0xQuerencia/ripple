// Turns a ripple's events into the nodes and links React Flow draws. Pure functions, so the
// rules (which links exist, which note is shown, what lights up when you trace a path) are
// testable without a browser.
import { getAncestry } from "../../shared/scenario.mjs";

export const NODE_SIZE = { width: 124, height: 112 };

// Only the newest node shows its note by default; selecting or tracing reveals others, so the
// map does not drown in overlapping labels.
const TAGGED_RECENT = 1;

/** The path from the cause to one event, or nothing when no event is being traced. */
export function traceTo(events, focusedEventId) {
  return focusedEventId ? getAncestry(events, focusedEventId) : [];
}

/** Events that can be drawn: they have a node key and a place on the map. */
export function placedEvents(events, spots) {
  return events.filter((event) => event.targetId && spots.has(event.targetId));
}

/**
 * @param {{ placed: object[], spots: Map<string, {x: number, y: number}>, selectedId: string | null, trail: object[] }} input
 * @returns {object[]} React Flow nodes, centred on their spot
 */
export function buildNodes({ placed, spots, selectedId, trail }) {
  const recent = new Set(placed.slice(-TAGGED_RECENT).map((e) => e.targetId));
  const onTrail = new Set(trail.map((e) => e.targetId));
  return placed.map((event) => {
    const spot = spots.get(event.targetId);
    return {
      id: event.targetId,
      type: "system",
      position: {
        x: spot.x - NODE_SIZE.width / 2,
        y: spot.y - NODE_SIZE.height / 2,
      },
      ...NODE_SIZE,
      draggable: false,
      data: {
        event,
        isSelected: event.targetId === selectedId,
        showTag:
          recent.has(event.targetId) ||
          event.targetId === selectedId ||
          onTrail.has(event.targetId),
      },
    };
  });
}

/**
 * One solid link from the node each effect follows, plus a dashed link from every extra node that
 * also feeds it. While tracing, the traced path lights up and everything else fades.
 */
export function buildEdges({ placed, trail }) {
  const known = new Set(placed.map((e) => e.targetId));
  const onPath = new Set(trail.map((e) => `${e.sourceId}>${e.targetId}`));
  return placed.slice(1).flatMap((event) =>
    [event.sourceId, ...(event.alsoFrom ?? [])]
      .filter((source) => known.has(source))
      .map((source, index) => {
        const id = `${source}>${event.targetId}`;
        const state = !trail.length
          ? "active"
          : onPath.has(id)
            ? "path"
            : "dim";
        return {
          id,
          source,
          target: event.targetId,
          type: "link",
          data: { state, extra: index > 0 },
        };
      }),
  );
}
