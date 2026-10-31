import test from "node:test";
import assert from "node:assert/strict";
import {
  buildEdges,
  buildNodes,
  placedEvents,
  traceTo,
  NODE_SIZE,
} from "../src/map/graph.js";

const events = [
  {
    id: "e0",
    targetId: "cause",
    sourceId: null,
    round: 0,
    parentEventId: null,
  },
  {
    id: "e1",
    targetId: "a",
    sourceId: "cause",
    round: 1,
    parentEventId: "e0",
    alsoFrom: [],
  },
  {
    id: "e2",
    targetId: "b",
    sourceId: "cause",
    round: 1,
    parentEventId: "e0",
    alsoFrom: [],
  },
  {
    id: "e3",
    targetId: "c",
    sourceId: "a",
    round: 2,
    parentEventId: "e1",
    alsoFrom: ["b", "ghost"],
  },
];
const spots = new Map([
  ["cause", { x: 0, y: 0 }],
  ["a", { x: 100, y: 0 }],
  ["b", { x: 0, y: 100 }],
  ["c", { x: 200, y: 50 }],
]);

test("only events with a key and a place are drawn", () => {
  const withGaps = [
    ...events,
    { id: "e4", targetId: null },
    { id: "e5", targetId: "nowhere" },
  ];
  assert.deepEqual(
    placedEvents(withGaps, spots).map((e) => e.id),
    ["e0", "e1", "e2", "e3"],
  );
});

test("nodes are centred on their spot and cannot be dragged", () => {
  const nodes = buildNodes({
    placed: events,
    spots,
    selectedId: null,
    trail: [],
  });
  const cause = nodes.find((n) => n.id === "cause");
  assert.deepEqual(cause.position, {
    x: -NODE_SIZE.width / 2,
    y: -NODE_SIZE.height / 2,
  });
  assert.ok(nodes.every((n) => n.draggable === false));
});

test("by default only the newest node shows its note; selecting or tracing shows more", () => {
  const tagged = (selectedId, trail) =>
    buildNodes({ placed: events, spots, selectedId, trail })
      .filter((n) => n.data.showTag)
      .map((n) => n.id);
  assert.deepEqual(tagged(null, []), ["c"]);
  assert.deepEqual(tagged("a", []), ["a", "c"]);
  assert.deepEqual(tagged(null, traceTo(events, "e3")), ["cause", "a", "c"]);
});

test("each effect links back to the node it follows from, with extra links dashed", () => {
  const edges = buildEdges({ placed: events, trail: [] });
  assert.deepEqual(
    edges.map((e) => e.id),
    ["cause>a", "cause>b", "a>c", "b>c"],
  );
  assert.equal(edges.find((e) => e.id === "a>c").data.extra, false);
  assert.equal(edges.find((e) => e.id === "b>c").data.extra, true);
  assert.ok(edges.every((e) => e.data.state === "active"));
});

test("a link to a node that is not on the map is dropped, not drawn to nowhere", () => {
  assert.ok(
    !buildEdges({ placed: events, trail: [] }).some(
      (e) => e.source === "ghost",
    ),
  );
});

test("tracing lights up the path and fades everything else", () => {
  const trail = traceTo(events, "e3");
  const states = Object.fromEntries(
    buildEdges({ placed: events, trail }).map((e) => [e.id, e.data.state]),
  );
  assert.deepEqual(states, {
    "cause>a": "path",
    "cause>b": "dim",
    "a>c": "path",
    "b>c": "dim",
  });
});

test("tracing nothing, or an unknown event, traces nothing", () => {
  assert.deepEqual(traceTo(events, null), []);
  assert.deepEqual(traceTo(events, "missing"), []);
});
