import test from "node:test";
import assert from "node:assert/strict";
import { layoutRipple, MIN_GAP, ringRadius } from "../src/lib/layout.js";
import { summarize } from "../src/lib/stats.js";

const origin = { targetId: "o", sourceId: null, round: 0 };
const ripple = () => {
  const events = [origin];
  let id = 0;
  const add = (round, sourceId) =>
    events.push({
      targetId: `n${++id}`,
      sourceId,
      round,
      area: "tech",
      severity: "low",
      timeframe: "days",
      alsoFrom: [],
    });
  for (let i = 0; i < 6; i++) add(1, "o");
  for (let i = 0; i < 6; i++) add(2, `n${1 + (i % 3)}`);
  for (let i = 0; i < 6; i++) add(3, `n${7 + (i % 4)}`);
  for (let i = 0; i < 5; i++) add(4, `n${13 + (i % 3)}`);
  for (let i = 0; i < 4; i++) add(5, `n${19 + (i % 3)}`);
  return events;
};

test("the cause sits in the middle and each round sits on a bigger ring", () => {
  const events = ripple();
  const spots = layoutRipple(events);
  assert.deepEqual(spots.get("o"), { x: 0, y: 0, angle: 0 });
  const distance = (key) => Math.hypot(spots.get(key).x, spots.get(key).y);
  for (const e of events.slice(1))
    assert.ok(
      distance(e.targetId) >= ringRadius(e.round) - 1,
      `${e.targetId} too close to the middle`,
    );
  assert.ok(distance("n1") < distance("n7"));
});

test("no two nodes overlap, even in a full-size ripple", () => {
  const spots = [...layoutRipple(ripple()).values()];
  for (let i = 0; i < spots.length; i++)
    for (let j = i + 1; j < spots.length; j++)
      assert.ok(
        Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y) >=
          MIN_GAP * 0.99,
      );
});

test("a node never moves when later nodes arrive", () => {
  const events = ripple();
  const early = layoutRipple(events.slice(0, 9));
  const late = layoutRipple(events);
  for (const [key, spot] of early) assert.deepEqual(late.get(key), spot);
});

test("layout is deterministic and tolerates an empty or unplaced ripple", () => {
  assert.deepEqual([...layoutRipple(ripple())], [...layoutRipple(ripple())]);
  assert.equal(layoutRipple([]).size, 0);
  assert.equal(layoutRipple([{ targetId: null }]).size, 0);
});

test("an effect whose parent is unknown still gets a place", () => {
  const spots = layoutRipple([
    origin,
    { targetId: "x", sourceId: "ghost", round: 1 },
  ]);
  assert.ok(spots.has("x"));
});

test("summarize reports reach, areas, severity and timing", () => {
  const events = [
    origin,
    {
      targetId: "a",
      round: 1,
      area: "tech",
      severity: "high",
      timeframe: "days",
      alsoFrom: [],
    },
    {
      targetId: "b",
      round: 2,
      area: "tech",
      severity: "low",
      timeframe: "years",
      alsoFrom: ["a"],
    },
    {
      targetId: "c",
      round: 2,
      area: "health",
      severity: "low",
      timeframe: "days",
      alsoFrom: [],
    },
  ];
  const s = summarize(events);
  assert.equal(s.total, 3);
  assert.equal(s.rounds, 2);
  assert.equal(s.links, 4);
  assert.deepEqual(
    s.areas.map((a) => [a.id, a.count]),
    [
      ["tech", 2],
      ["health", 1],
    ],
  );
  assert.equal(s.severity.high, 1);
  assert.equal(s.severity.low, 2);
  assert.equal(s.timeframe.days, 2);
  assert.equal(summarize([origin]).total, 0);
});
