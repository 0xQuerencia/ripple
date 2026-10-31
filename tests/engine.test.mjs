import test from "node:test";
import assert from "node:assert/strict";
import {
  demoEffects,
  validateEffects,
  guessOrigin,
} from "../shared/engine.mjs";
import { SYSTEMS, EDGE_LIST } from "../shared/world.mjs";

test("the world is big, and every link joins two known systems", () => {
  assert.ok(SYSTEMS.length >= 50);
  assert.ok(EDGE_LIST.length >= 150);
  const ids = new Set(SYSTEMS.map((s) => s.id));
  assert.equal(ids.size, SYSTEMS.length);
  assert.equal(new Set(EDGE_LIST.map((e) => e.id)).size, EDGE_LIST.length);
  for (const e of EDGE_LIST) {
    assert.ok(ids.has(e.source) && ids.has(e.target) && e.source !== e.target);
  }
  for (const s of SYSTEMS) {
    assert.ok(
      EDGE_LIST.some((e) => e.source === s.id),
      `${s.id} leads nowhere`,
    );
  }
});

test("free text maps to a sensible starting system", () => {
  assert.equal(guessOrigin("hackers die"), "cybercrime");
  assert.equal(guessOrigin("all the bees disappear"), "nature");
  assert.equal(guessOrigin("a huge internet outage"), "communications");
  assert.equal(guessOrigin("zzz qqq"), "people");
  assert.equal(guessOrigin(undefined), "people");
});

test("effects carry bounded timeframe and who-feels-it fields", () => {
  const [effect] = validateEffects(
    [
      {
        sourceId: "power",
        targetId: "water",
        timeframe: "centuries",
        who: "x".repeat(300),
      },
    ],
    { frontier: ["power"], visited: ["power"] },
  );
  assert.equal(effect.timeframe, "weeks");
  assert.equal(effect.who.length, 80);
});

test("blackout demo has plausible direct downstream effects", () => {
  const effects = demoEffects({ frontier: ["power"], visited: ["power"] });
  assert.equal(effects.length, 3);
  assert.ok(effects.every((e) => e.sourceId === "power"));
});

test("Gemma cannot forge unconnected edges", () => {
  const effects = validateEffects(
    [
      { sourceId: "power", targetId: "people", title: "Impossible shortcut" },
      {
        sourceId: "power",
        targetId: "water",
        title: "Water pumps may fail",
        explanation: "Electricity is needed.",
      },
    ],
    { frontier: ["power"], visited: ["power"] },
  );
  assert.deepEqual(
    effects.map((e) => e.targetId),
    ["water"],
  );
});

test("Gemma cannot re-affect visited targets or use unrelated frontier", () => {
  const effects = validateEffects(
    [
      { sourceId: "power", targetId: "water" },
      { sourceId: "nature", targetId: "farming" },
    ],
    { frontier: ["power"], visited: ["power", "water"] },
  );
  assert.deepEqual(effects, []);
});

test("Gemma output is bounded and sanitized", () => {
  const effects = validateEffects(
    [
      {
        sourceId: "power",
        targetId: "water",
        title: "a".repeat(400),
        explanation: "b".repeat(600),
        certainty: "absolutely",
        severity: "extreme",
      },
      { sourceId: "power", targetId: "water", title: "Duplicate" },
      { sourceId: "power", targetId: "transport" },
    ],
    { frontier: ["power"], visited: ["power"], max: 2 },
  );
  assert.equal(effects.length, 2);
  assert.equal(effects[0].title.length, 70);
  assert.equal(effects[0].explanation.length, 250);
  assert.equal(effects[0].certainty, "possible");
  assert.equal(effects[0].severity, "medium");
});
