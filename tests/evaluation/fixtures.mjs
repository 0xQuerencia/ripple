import { buildWorld } from "../../server/simulation/worldBuilder.mjs";
import { createPricingScenario } from "../../server/simulation/domains/productDecision/index.mjs";

export const pricingFixtures = [
  { label: "small subscription change", customers: [120, 75], churn: [0.05, 0.08], from: 499, to: 599, rollout: 100 },
  { label: "staged regional rollout", customers: [1000, 150], churn: [0.03, 0.12], from: 299, to: 349, rollout: 20 },
  { label: "high-churn product", customers: [40, 300], churn: [0.3, 0.18], from: 89, to: 109, rollout: 50 },
  { label: "low-churn service", customers: [200, 100], churn: [0.01, 0.02], from: 999, to: 1099, rollout: 80 },
  { label: "small team subscription", customers: [20, 30], churn: [0.05, 0.04], from: 1999, to: 2499, rollout: 100 },
  { label: "free trial conversion discussion", customers: [200, 350], churn: [0.2, 0.15], from: 49, to: 59, rollout: 30 },
  { label: "school plan pricing", customers: [12, 8], churn: [0.01, 0.01], from: 3999, to: 4599, rollout: 70 },
  { label: "enterprise account", customers: [4, 10], churn: [0.01, 0.08], from: 25000, to: 27500, rollout: 10 },
  { label: "divergent segments", customers: [500, 15], churn: [0.02, 0.4], from: 199, to: 259, rollout: 25 },
  { label: "zero existing users in one group", customers: [0, 50], churn: [0, 0.2], from: 39, to: 55, rollout: 100 },
  { label: "high-value narrow pilot", customers: [8, 20], churn: [0.1, 0.1], from: 4999, to: 5999, rollout: 5 },
  { label: "nearly unchanged intervention", customers: [105, 115], churn: [0.06, 0.07], from: 499, to: 500, rollout: 100 }
];

export function makeFixture(input, index = 0) {
  const id = "fixture-" + index;
  const ownerId = "eval";
  const project = { id, ownerId };
  const world = buildWorld({
    project, companyName: "Test Company", baselinePrice: input.from,
    marketingBudget: 500,
    segments: input.customers.map((customers, i) => ({
      id: "group-" + i, label: "Group " + i,
      customers, monthlyChurn: input.churn[i]
    }))
  });
  const scenario = createPricingScenario({
    world, projectId: id, question: input.label + "?",
    interventions: [
      { label: "full", price: input.to, rolloutPercent: 100 },
      { label: "pilot", price: input.to, rolloutPercent: input.rollout }
    ],
    rounds: 4, seed: index + 1
  });
  return { id, ownerId, project, world, scenario };
}
