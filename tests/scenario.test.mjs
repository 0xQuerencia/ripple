import test from "node:test";
import assert from "node:assert/strict";
import { CAUSES, EDGE_LIST } from "../shared/world.mjs";
import { createScenario, getAncestry } from "../shared/scenario.mjs";

test("every cause produces bounded, traceable effects without duplicate systems", () => {
  for (const cause of CAUSES) {
    const events = createScenario(cause, cause.target, "test");
    assert.equal(events[0].parentEventId, null);
    assert.equal(new Set(events.map((e) => e.targetId)).size, events.length);
    for (const event of events.slice(1)) {
      const parent = events.find((e) => e.id === event.parentEventId);
      assert.equal(parent.targetId, event.sourceId);
      assert.equal(parent.round + 1, event.round);
      assert.ok(
        EDGE_LIST.some(
          (e) => e.source === event.sourceId && e.target === event.targetId,
        ),
      );
      assert.ok(event.round <= 4);
      const chain = getAncestry(events, event.id);
      assert.equal(chain[0].id, events[0].id);
      assert.equal(chain.at(-1).id, event.id);
    }
  }
});
test("new experiments preserve a deterministic baseline", () => {
  const cause = CAUSES[0];
  const first = createScenario(cause, cause.target, "same");
  first[1].title = "edited";
  const second = createScenario(cause, cause.target, "same");
  assert.notEqual(second[1].title, "edited");
  assert.deepEqual(second, createScenario(cause, cause.target, "same"));
});
test("incompatible targets are rejected", () => {
  assert.throws(() => createScenario(CAUSES[0], "nature"));
  assert.throws(() => createScenario(CAUSES[0], "invented"));
});
test("ancestry handles absent events and malformed cycles", () => {
  assert.deepEqual(getAncestry([], "missing"), []);
  assert.equal(getAncestry([{ id: "a", parentEventId: "a" }], "a").length, 1);
});
