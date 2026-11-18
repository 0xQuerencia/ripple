import test from "node:test";
import assert from "node:assert/strict";
import { buildWorld } from "../server/simulation/worldBuilder.mjs";
import { productDecisionAgents } from "../server/simulation/domains/productDecision/index.mjs";
import { applyActionBatch } from "../server/simulation/apply.mjs";

const make = () => buildWorld({ project: { id: "p", ownerId: "local" },
  companyName: "X", baselinePrice: 499, marketingBudget: 100,
  segments: [{ id: "a", label: "A", customers: 20, monthlyChurn: 0.02 }] });
const propose = (agentId, actionType, args = {}) => ({
  runId: "run", tick: 1, agentId, actionType, arguments: args, rationale: "test proposal"
});

test("legal actions update the state only through the reducer", () => {
  const world = make();
  const before = JSON.stringify(world);
  const agents = productDecisionAgents(world);
  const result = applyActionBatch({ world, agents, tick: 1, runId: "run",
    proposals: [
      propose("company-agent", "change_price", { price: 599 }),
      propose("segment-a", "cancel_subscription", { count: 2 })
    ] });
  assert.equal(result.state.variables.currentPrice, 599);
  assert.equal(result.state.entities[1].attributes.customers, 18);
  assert.equal(result.state.tick, 1);
  assert.equal(result.rejected.length, 0);
  assert.equal(JSON.stringify(world), before);
});

test("permissions, budgets and double spending reject impossible actions", () => {
  const world = make(), agents = productDecisionAgents(world);
  const result = applyActionBatch({ world, agents, tick: 1, runId: "run",
    proposals: [
      propose("company-agent", "allocate_budget", { amount: 150 }),
      propose("segment-a", "change_price", { price: 1 }),
      propose("segment-a", "cancel_subscription", { count: 100 }),
      propose("segment-a", "do_nothing")
    ] });
  assert.equal(result.state.resources.marketingBudget, 100);
  assert.equal(result.state.entities[1].attributes.customers, 20);
  assert.equal(result.rejected.length, 3);
  assert.equal(result.accepted[0].actionType, "do_nothing");
});

test("sorting and state changes are deterministic independent of proposal order", () => {
  const world = make(), agents = productDecisionAgents(world);
  const proposals = [
    propose("segment-a", "do_nothing"),
    propose("company-agent", "allocate_budget", { amount: 30 })
  ];
  const a = applyActionBatch({ world, agents, proposals, tick: 1, runId: "run" });
  const b = applyActionBatch({ world, agents, proposals: proposals.reverse(),
    tick: 1, runId: "run" });
  assert.deepEqual(a, b);
});
