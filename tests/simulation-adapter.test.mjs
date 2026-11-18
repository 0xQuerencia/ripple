import test from "node:test";
import assert from "node:assert/strict";
import { eventGraph, worldGraph } from "../src/map/simulationAdapter.js";
import { layoutRipple, MIN_GAP } from "../src/map/layout.js";

test("event graph keeps causal parent links and labels simulated actions", () => {
  const graph = eventGraph([
    { id: "e1", seq: 1, tick: 1, type: "announce_change", actorId: "company",
      provenance: "simulated-event", parentEventIds: [],
      payload: { rationale: "testing", visibility: "public" } },
    { id: "e2", seq: 2, tick: 2, type: "respond_to_announcement", actorId: "segment",
      provenance: "simulated-event", parentEventIds: ["e1"], payload: {} }
  ], "A pricing decision", "run-1");
  assert.equal(graph.length, 3);
  assert.equal(graph[2].parentEventId, graph[1].id);
  assert.equal(graph[2].sourceId, graph[1].targetId);
  assert.equal(graph[1].provenance, "simulated-event");
  assert.equal(layoutRipple(graph).size, 3);
});

test("the world view uses only supplied entities and relationships", () => {
  const graph = worldGraph({ id: "world-1",
    entities: [
      { id: "company", label: "Example", kind: "company", provenance: "assumption" },
      { id: "students", label: "Students", kind: "customer-segment", provenance: "assumption" }
    ],
    relationships: [{ fromId: "company", toId: "students" }]
  });
  assert.deepEqual(graph.map((node) => node.name), ["Example", "Students"]);
  assert.equal(graph[1].sourceId, graph[0].targetId);
});

test("large simulated timelines are bounded on the pixel canvas", () => {
  const events = Array.from({ length: 200 }, (_, i) => ({
    id: "e-" + i, seq: i + 1, tick: Math.floor(i / 10) + 1,
    type: "do_nothing", actorId: "agent-1", provenance: "simulated-event",
    parentEventIds: [], payload: {}
  }));
  assert.equal(eventGraph(events, "Large experiment", "r").length, 97);
});
