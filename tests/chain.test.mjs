import test from "node:test";
import assert from "node:assert/strict";
import {
  assembleChain,
  buildDemoChain,
  MAX_ROUNDS,
  PER_ROUND,
} from "../shared/engine.mjs";
import { EDGE_LIST } from "../shared/world.mjs";

const edgeKey = (e) => `${e.sourceId}>${e.targetId}`;
const realEdges = new Set(EDGE_LIST.map((e) => `${e.source}>${e.target}`));

test("assembleChain walks rounds outward and keeps only real links", () => {
  const raw = [
    { round: 1, sourceId: "power", targetId: "water", title: "Pumps slow" },
    {
      round: 1,
      sourceId: "power",
      targetId: "people",
      title: "Forged shortcut",
    },
    {
      round: 2,
      sourceId: "water",
      targetId: "farming",
      title: "Irrigation falters",
    },
    {
      round: 3,
      sourceId: "farming",
      targetId: "people",
      title: "Food tightens",
    },
  ];
  const chain = assembleChain(raw, { targetId: "power" });
  assert.deepEqual(
    chain.map((e) => [e.round, e.targetId]),
    [
      [1, "water"],
      [2, "farming"],
      [3, "people"],
    ],
  );
  assert.ok(chain.every((e) => realEdges.has(edgeKey(e))));
});

test("assembleChain rejects a round-2 effect whose source was not reached in round 1", () => {
  const chain = assembleChain(
    [
      { round: 1, sourceId: "power", targetId: "water" },
      { round: 2, sourceId: "nature", targetId: "farming" },
    ],
    { targetId: "power" },
  );
  assert.deepEqual(
    chain.map((e) => e.targetId),
    ["water"],
  );
});

test("assembleChain never revisits the origin or an earlier target", () => {
  const chain = assembleChain(
    [
      { round: 1, sourceId: "water", targetId: "farming" },
      { round: 2, sourceId: "farming", targetId: "water" },
    ],
    { targetId: "water" },
  );
  assert.deepEqual(
    chain.map((e) => e.targetId),
    ["farming"],
  );
});

test("assembleChain tolerates junk input", () => {
  assert.deepEqual(assembleChain(null, { targetId: "power" }), []);
  assert.deepEqual(
    assembleChain([null, 4, "x", { round: "one" }], { targetId: "power" }),
    [],
  );
});

test("assembleChain caps rounds and effects per round", () => {
  const raw = [];
  for (let r = 1; r <= MAX_ROUNDS + 2; r++) {
    raw.push({ round: r, sourceId: "power", targetId: "water" });
  }
  const direct = EDGE_LIST.filter((e) => e.source === "power").map(
    (e) => e.target,
  );
  raw.push(
    ...direct.map((t) => ({ round: 1, sourceId: "power", targetId: t })),
  );
  const chain = assembleChain(raw, { targetId: "power" });
  assert.ok(chain.filter((e) => e.round === 1).length <= PER_ROUND);
  assert.equal(chain.filter((e) => e.round === 1).length, PER_ROUND);
  assert.ok(chain.every((e) => e.round <= MAX_ROUNDS));
});

test("buildDemoChain produces a connected multi-round chain from any system", () => {
  for (const id of [
    "power",
    "water",
    "nature",
    "transport",
    "industry",
    "communications",
  ]) {
    const chain = buildDemoChain({ targetId: id, tone: "negative" });
    assert.ok(chain.length >= 2, `${id} chain too short`);
    assert.ok(chain.every((e) => realEdges.has(edgeKey(e))));
    assert.equal(new Set(chain.map((e) => e.targetId)).size, chain.length);
    assert.ok(!chain.some((e) => e.targetId === id));
  }
});

test("createChainBuilder accepts effects incrementally and refuses to skip a round", async () => {
  const { createChainBuilder } = await import("../shared/engine.mjs");
  const b = createChainBuilder({ targetId: "power" });
  assert.equal(
    b.push({ round: 2, sourceId: "power", targetId: "water" }),
    null,
  );
  assert.equal(
    b.push({ round: 1, sourceId: "power", targetId: "water", title: "a" })
      .targetId,
    "water",
  );
  assert.equal(
    b.push({ round: 3, sourceId: "water", targetId: "farming" }),
    null,
  );
  assert.equal(
    b.push({ round: 2, sourceId: "water", targetId: "farming", title: "b" })
      .round,
    2,
  );
  assert.equal(
    b.push({ round: 1, sourceId: "power", targetId: "health" }),
    null,
    "cannot go back a round",
  );
});
