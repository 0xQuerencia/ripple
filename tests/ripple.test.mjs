import test from "node:test";
import assert from "node:assert/strict";
import {
  createRippleBuilder,
  resolveNode,
  slugify,
  RIPPLE_LIMITS,
} from "../shared/ripple.mjs";
import { ICON_IDS } from "../shared/icons.mjs";

const origin = {
  key: "moon-gone",
  name: "The moon vanishes",
  area: "environment",
  icon: "moon",
};
const effect = (over) => ({
  round: 1,
  from: "moon-gone",
  key: "tides",
  name: "Tidal chaos",
  area: "environment",
  icon: "waves",
  title: "Tides go wild",
  ...over,
});

test("slugify makes safe short keys", () => {
  assert.equal(slugify("  Cat Cafés!! "), "cat-caf-s");
  assert.equal(slugify("x".repeat(100)).length, 40);
  assert.equal(slugify(undefined), "");
});

test("a key that matches a known system always uses that system's own look", () => {
  const node = resolveNode({
    key: "banks",
    name: "Totally different",
    area: "food",
    icon: "cat",
  });
  assert.deepEqual(node, {
    key: "banks",
    name: "banks & credit",
    area: "finance",
    icon: "banks",
    known: true,
  });
});

test("an invented node keeps its name but area and icon are checked against fixed lists", () => {
  const node = resolveNode({
    key: "cat-cafes",
    name: "Cat cafes",
    area: "nonsense",
    icon: "../../etc/passwd",
  });
  assert.equal(node.name, "Cat cafes");
  assert.equal(node.area, "society");
  assert.ok(ICON_IDS.includes(node.icon));
  assert.equal(node.known, false);
  assert.equal(resolveNode({ key: "x", name: "" }), null);
  assert.equal(resolveNode(null), null);
});

test("the origin must be a usable node", () => {
  assert.equal(createRippleBuilder({ key: "", name: "" }), null);
  assert.equal(createRippleBuilder(origin).origin.name, "The moon vanishes");
});

test("effects must follow from a node that already exists", () => {
  const b = createRippleBuilder(origin);
  assert.equal(b.push(effect({ from: "ghost" })), null);
  const ok = b.push(effect());
  assert.equal(ok.sourceId, "moon-gone");
  assert.equal(ok.targetId, "tides");
  assert.equal(
    b.push(
      effect({ round: 2, from: "tides", key: "ports", name: "Port gridlock" }),
    ).round,
    2,
  );
});

test("no node appears twice, and an effect cannot point back at an earlier round's node", () => {
  const b = createRippleBuilder(origin);
  b.push(effect());
  assert.equal(
    b.push(effect({ key: "tides", round: 2, from: "tides" })),
    null,
    "same key twice",
  );
  assert.equal(
    b.push(
      effect({ key: "moon-gone", name: "Again", round: 2, from: "tides" }),
    ),
    null,
    "revisiting the origin",
  );
  assert.equal(
    b.push(effect({ round: 1, from: "tides", key: "x", name: "Xx" })),
    null,
    "a parent must come from an earlier round",
  );
});

test("rounds cannot be skipped or run backwards", () => {
  const b = createRippleBuilder(origin);
  assert.equal(b.push(effect({ round: 3 })), null);
  b.push(effect());
  b.push(effect({ round: 2, from: "tides", key: "a", name: "Aa" }));
  assert.equal(
    b.push(effect({ round: 4, from: "a", key: "b", name: "Bb" })),
    null,
  );
  assert.equal(b.push(effect({ round: 0, key: "c", name: "Cc" })), null);
  assert.equal(b.push(effect({ round: 1.5, key: "d", name: "Dd" })), null);
});

test("extra links only point at earlier nodes and never the parent", () => {
  const b = createRippleBuilder(origin);
  b.push(effect());
  const e = b.push(
    effect({
      round: 2,
      from: "tides",
      key: "ports",
      name: "Ports",
      also: ["moon-gone", "tides", "ghost", "moon-gone", "ports"],
    }),
  );
  assert.deepEqual(e.alsoFrom, ["moon-gone"]);
});

test("the ripple stays inside its size limits", () => {
  const b = createRippleBuilder(origin);
  for (let i = 0; i < RIPPLE_LIMITS.perRound + 3; i++)
    b.push(effect({ key: `n${i}`, name: `Node ${i}` }));
  assert.equal(b.count(), RIPPLE_LIMITS.perRound);
  let n = 0;
  const big = createRippleBuilder(origin);
  for (let round = 1; round <= RIPPLE_LIMITS.rounds; round++) {
    for (let i = 0; i < RIPPLE_LIMITS.perRound; i++) {
      const from = round === 1 ? "moon-gone" : `r${round - 1}x0`;
      big.push({
        round,
        from,
        key: `r${round}x${i}`,
        name: `Round ${round} node ${i}`,
      }) && n++;
    }
  }
  assert.equal(big.count(), RIPPLE_LIMITS.nodes);
  assert.equal(n, RIPPLE_LIMITS.nodes);
  assert.equal(
    big.push({ round: 5, from: "r4x0", key: "extra", name: "One more" }),
    null,
  );
});

test("every string and enum from the model is bounded", () => {
  const b = createRippleBuilder(origin);
  const e = b.push(
    effect({
      title: "t".repeat(500),
      explanation: "e".repeat(900),
      who: "w".repeat(500),
      timeframe: "centuries",
      certainty: "definitely",
      severity: "extreme",
      name: "n".repeat(300),
    }),
  );
  assert.equal(e.title.length, 70);
  assert.equal(e.explanation.length, 260);
  assert.equal(e.who.length, 80);
  assert.equal(e.name.length, 40);
  assert.equal(e.timeframe, "weeks");
  assert.equal(e.certainty, "possible");
  assert.equal(e.severity, "medium");
});

test("markup in model text is data, not instructions or HTML", () => {
  const b = createRippleBuilder(origin);
  const e = b.push(
    effect({
      title: "<img src=x onerror=alert(1)>",
      name: "<script>x</script>",
    }),
  );
  assert.ok(typeof e.title === "string" && typeof e.name === "string");
});
