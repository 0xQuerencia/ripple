import { randomUUID } from "node:crypto";
import { validateAgent, validateScenario, validateWorldState } from "../../../../shared/simulation/schema.mjs";

export const PRODUCT_DECISION_ACTIONS = Object.freeze([
  "change_price", "announce_change", "contact_group", "request_information",
  "revise_plan", "allocate_budget", "adopt_product", "cancel_subscription",
  "respond_to_announcement", "do_nothing"
]);

function validPrice(value) {
  return Number.isFinite(value) && value > 0 && value <= 1_000_000;
}

export function createPricingScenario({ world, projectId, question, interventions,
  rounds = 6, seed = 1 }) {
  validateWorldState(world);
  if (typeof question !== "string" || !question.trim() || question.length > 1000)
    throw new Error("A specific decision question is required");
  if (!Array.isArray(interventions) || interventions.length < 2 || interventions.length > 10)
    throw new Error("Compare at least two interventions");
  const variants = interventions.map((option, index) => {
    if (!validPrice(option.price) || !Number.isFinite(option.rolloutPercent) ||
      option.rolloutPercent < 0 || option.rolloutPercent > 100)
      throw new Error("Enter a price and rollout percentage for each intervention");
    return {
      id: "option-" + index, label: String(option.label || "Option " + (index + 1)),
      changes: { currentPrice: option.price, rolloutPercent: option.rolloutPercent }
    };
  });
  const now = new Date().toISOString();
  const scenario = {
    schemaVersion: 1, id: randomUUID(), projectId,
    ownerId: world.ownerId, createdAt: now, question: question.trim(),
    baselineState: structuredClone(world), interventions: variants,
    config: { rounds, agents: world.entities.length, seed, domainPack: "product-decision" }
  };
  validateScenario(scenario);
  return scenario;
}

export function pricingIndicators(world, { price = world.variables.currentPrice,
  rolloutPercent = world.variables.rolloutPercent } = {}) {
  validateWorldState(world);
  if (!validPrice(price) || !Number.isFinite(rolloutPercent) ||
      rolloutPercent < 0 || rolloutPercent > 100)
    throw new Error("Invalid intervention");
  const baselinePrice = world.variables.baselinePrice;
  const groups = world.entities.filter((entity) => entity.kind === "customer-segment");
  const perSegment = groups.map((group) => {
    const { customers, monthlyChurn } = group.attributes;
    const afterHistoricalChurn = customers * (1 - monthlyChurn);
    const effectivePrice = baselinePrice +
      (price - baselinePrice) * (rolloutPercent / 100);
    return {
      id: group.id,
      activeSubscribersUnderFixedChurn: afterHistoricalChurn,
      monthlyRevenueUnderFixedChurn: afterHistoricalChurn * effectivePrice
    };
  });
  return {
    provenance: "derived",
    method: "fixed-historical-churn-v1",
    label: "Illustration using unchanged historical churn, not a forecast",
    monthlyRevenueUnderFixedChurn: perSegment.reduce((total, row) =>
      total + row.monthlyRevenueUnderFixedChurn, 0),
    activeSubscribersUnderFixedChurn: perSegment.reduce((total, row) =>
      total + row.activeSubscribersUnderFixedChurn, 0),
    perSegment
  };
}

export function productDecisionAgents(world, { competitorName } = {}) {
  validateWorldState(world);
  const at = new Date().toISOString();
  const agent = (id, role, goal, constraints, policy = {}) => {
    const value = { schemaVersion: 1, id, ownerId: world.ownerId,
      createdAt: at, role, goal, constraints, policy, observations: [], memoryRefs: [] };
    validateAgent(value);
    return value;
  };
  const actors = [agent("company-agent", "company",
    "Evaluate revenue and customer experience without taking real-world action",
    { budget: world.resources.marketingBudget }, { actionCadence: 1 })];
  for (const entity of world.entities) {
    if (entity.kind !== "customer-segment") continue;
    actors.push(agent("segment-" + entity.id, "customer-segment",
      "Consider perceived value, alternatives and information available to this segment",
      { segmentId: entity.id, customers: entity.attributes.customers },
      { actionCadence: 1 }));
  }
  if (competitorName) {
    if (typeof competitorName !== "string" || competitorName.length > 160)
      throw new Error("Invalid competitor label");
    actors.push(agent("competitor-agent", "competitor",
      "Assess reactions to changes in competing offers",
      { label: competitorName }, { actionCadence: 2 }));
  }
  return actors;
}
