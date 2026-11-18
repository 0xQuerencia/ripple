import test from "node:test";
import assert from "node:assert/strict";
import { buildWorld } from "../server/simulation/worldBuilder.mjs";
import { createPricingScenario, pricingIndicators, productDecisionAgents } from "../server/simulation/domains/productDecision/index.mjs";

const world = buildWorld({
  project: { id: "demo", ownerId: "local" }, companyName: "Example", baselinePrice: 499,
  segments: [{ id: "s", label: "Subscribers", customers: 100, monthlyChurn: 0.05 }]
});

test("pricing indicators use fixed churn and show exact intervention difference", () => {
  const baseline = pricingIndicators(world);
  const abrupt = pricingIndicators(world, { price: 599, rolloutPercent: 100 });
  const staged = pricingIndicators(world, { price: 599, rolloutPercent: 50 });
  assert.equal(baseline.monthlyRevenueUnderFixedChurn, 95 * 499);
  assert.equal(abrupt.monthlyRevenueUnderFixedChurn, 95 * 599);
  assert.equal(staged.monthlyRevenueUnderFixedChurn, 95 * 549);
  assert.match(staged.label, /not a forecast/);
});

test("two alternatives and a baseline retain an immutable starting world", () => {
  const scenario = createPricingScenario({
    world, projectId: "demo", question: "What if price rises?",
    interventions: [
      { price: 599, rolloutPercent: 100, label: "full" },
      { price: 599, rolloutPercent: 25, label: "pilot" }
    ]
  });
  assert.equal(scenario.interventions.length, 2);
  assert.equal(scenario.baselineState.variables.currentPrice, 499);
  assert.equal(scenario.config.domainPack, "product-decision");
  assert.equal(productDecisionAgents(world).length, 2);
  assert.throws(() => createPricingScenario({
    world, projectId: "demo", question: "?", interventions: [{ price: 599, rolloutPercent: 200 }]
  }));
});
