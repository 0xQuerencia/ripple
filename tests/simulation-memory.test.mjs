import test from "node:test";
import assert from "node:assert/strict";
import { buildWorld } from "../server/simulation/worldBuilder.mjs";
import { productDecisionAgents } from "../server/simulation/domains/productDecision/index.mjs";
import { AgentMemory, scheduleAgents } from "../server/simulation/memory.mjs";

const world = buildWorld({ project: { id: "p", ownerId: "local" },
  companyName: "Example", baselinePrice: 499,
  segments: [{ id: "a", label: "A", customers: 20, monthlyChurn: 0.05 }] });
const agents = productDecisionAgents(world);

test("scheduler gives reproducible ordering and prioritizes changed agents", () => {
  const opts = { agents, tick: 1, seed: 77 };
  assert.deepEqual(scheduleAgents(opts), scheduleAgents(opts));
  const changed = scheduleAgents({ agents, tick: 2, seed: 77,
    changedIds: ["segment-a"], maxAgents: 1 });
  assert.equal(changed[0].id, "segment-a");
});

test("agent memory isolates private events and different runs", () => {
  const memory = new AgentMemory();
  const events = [
    { id: "secret", tick: 1, actorId: "company-agent", type: "private",
      payload: { visibility: "private", audience: ["company-agent"] } },
    { id: "news", tick: 1, actorId: "company-agent", type: "announce_change",
      payload: { visibility: "public", price: 599 } }
  ];
  memory.rememberObserved("run-1", agents[1], world, events);
  assert.deepEqual(memory.recent("run-1", agents[1].id).map((e) => e.id), ["news"]);
  assert.deepEqual(memory.recent("run-2", agents[1].id), []);
});

test("stored memory remains bounded and restores from a checkpoint", () => {
  const memory = new AgentMemory();
  const events = Array.from({ length: 60 }, (_, i) => ({
    id: "event-" + i, tick: i + 1, actorId: "company-agent",
    type: "announce_change", payload: { visibility: "public", text: "x".repeat(500) }
  }));
  memory.rememberObserved("run-1", agents[1], world, events);
  const restored = new AgentMemory(memory.snapshot());
  assert.ok(restored.recent("run-1", agents[1].id).length <= 20);
  assert.ok(restored.recent("run-1", agents[1].id).every((item) => item.text.length <= 300));
});
