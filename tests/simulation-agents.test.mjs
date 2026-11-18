import test from "node:test";
import assert from "node:assert/strict";
import { buildWorld } from "../server/simulation/worldBuilder.mjs";
import { productDecisionAgents } from "../server/simulation/domains/productDecision/index.mjs";
import { observeAgent, allowedToAct, ruleProposal } from "../server/simulation/agents/index.mjs";

const world = buildWorld({ project: { id: "p", ownerId: "local" },
  companyName: "Example", baselinePrice: 499, marketingBudget: 2000,
  segments: [
    { id: "a", label: "A", customers: 30, monthlyChurn: 0.05 },
    { id: "b", label: "B", customers: 50, monthlyChurn: 0.10 }
  ] });
const agents = productDecisionAgents(world);

test("agents receive only their own segment and public information", () => {
  const events = [
    { id: "hidden", tick: 1, actorId: "company-agent", type: "private",
      payload: { visibility: "private", audience: ["company-agent"], secret: "internal" } },
    { id: "public", tick: 1, actorId: "company-agent", type: "announce_change",
      payload: { visibility: "public", announcedPrice: 599 } }
  ];
  const company = observeAgent(agents[0], world, events);
  const segment = observeAgent(agents[1], world, events);
  assert.equal(company.resources.marketingBudget, 2000);
  assert.deepEqual(segment.resources, {});
  assert.deepEqual(segment.entities.map((e) => e.id), ["company", "a"]);
  assert.deepEqual(segment.visibleEvents.map((e) => e.id), ["public"]);
  assert.equal(segment.variables.publicPrice, 499);
});

test("role permissions block hidden company actions", () => {
  assert.equal(allowedToAct(agents[1], "change_price"), false);
  assert.equal(allowedToAct(agents[0], "change_price"), true);
  assert.equal(allowedToAct({ role: "unknown" }, "do_nothing"), false);
});

test("rule decisions are bounded proposals, not world mutations", () => {
  const original = JSON.stringify(world);
  const proposal = ruleProposal({ runId: "r", tick: 1, agent: agents[0],
    observation: observeAgent(agents[0], world) });
  assert.equal(proposal.actionType, "do_nothing");
  assert.equal(JSON.stringify(world), original);
});
