import { validateAction, validateWorldState } from "../../shared/simulation/schema.mjs";
import { allowedToAct, observeAgent } from "./agents/index.mjs";

const bounded = (number, minimum, maximum) =>
  typeof number === "number" && Number.isFinite(number) &&
  number >= minimum && number <= maximum;
const integer = (number, min, max) =>
  Number.isInteger(number) && bounded(number, min, max);
const rolePriority = { company: 0, regulator: 1, competitor: 2, "customer-segment": 3 };

function applyOne(state, agent, action, availableAgents, priorEvents) {
  const next = structuredClone(state);
  const args = action.arguments;
  let visibility = "private", audience = [agent.id], delta = {};
  const observed = observeAgent(agent, state, priorEvents);
  const group = state.entities.find((entity) =>
    entity.id === agent.constraints.segmentId && entity.kind === "customer-segment");
  switch (action.actionType) {
    case "change_price":
      if (!bounded(args.price, 0.01, 1_000_000)) throw new Error("Price out of range");
      next.variables.currentPrice = args.price;
      next.variables.priceAnnounced = false;
      delta = { currentPrice: args.price };
      break;
    case "announce_change":
      next.variables.priceAnnounced = true;
      visibility = "public";
      delta = { announcedPrice: next.variables.currentPrice };
      break;
    case "revise_plan":
      if (!bounded(args.rolloutPercent, 0, 100)) throw new Error("Invalid rollout percentage");
      next.variables.rolloutPercent = args.rolloutPercent;
      delta = { rolloutPercent: args.rolloutPercent };
      break;
    case "allocate_budget":
      if (!bounded(args.amount, 0, next.resources.marketingBudget))
        throw new Error("Budget exceeded");
      next.resources.marketingBudget -= args.amount;
      next.resources.allocatedBudget = (next.resources.allocatedBudget || 0) + args.amount;
      delta = { budgetAllocated: args.amount };
      break;
    case "contact_group": {
      const recipient = availableAgents.get(args.targetId);
      if (!recipient || (agent.role !== "company" && recipient.role !== "company"))
        throw new Error("Recipient is unavailable");
      if (typeof args.message !== "string" || args.message.length > 400)
        throw new Error("Invalid message");
      audience = [agent.id, recipient.id];
      delta = { message: args.message, recipientId: recipient.id };
      break;
    }
    case "request_information":
      audience = [agent.id, "company-agent"];
      delta = { question: typeof args.question === "string"
        ? args.question.slice(0, 400) : "Please clarify the change" };
      break;
    case "respond_to_announcement":
      if (!observed.visibleEvents.some((event) => event.type === "announce_change"))
        throw new Error("No observed announcement to respond to");
      visibility = "public";
      delta = { response: typeof args.response === "string"
        ? args.response.slice(0, 200) : "More evidence is needed" };
      break;
    case "adopt_product":
    case "cancel_subscription":
      if (!group || !integer(args.count, 1, 100_000))
        throw new Error("Invalid customer count");
      if (action.actionType === "cancel_subscription" &&
          args.count > group.attributes.customers)
        throw new Error("Cannot cancel more subscriptions than exist");
      next.entities.find((entity) => entity.id === group.id).attributes.customers +=
        action.actionType === "adopt_product" ? args.count : -args.count;
      delta = { segmentId: group.id, customersDelta:
        action.actionType === "adopt_product" ? args.count : -args.count };
      break;
    case "do_nothing":
      break;
    default:
      throw new Error("Unknown action");
  }
  validateWorldState(next);
  return { state: next, emission: {
    actorId: agent.id, type: action.actionType,
    payload: { ...delta, visibility, audience, rationale: action.rationale }
  } };
}

export function applyActionBatch({ world, agents, proposals, tick, runId, priorEvents = [] }) {
  validateWorldState(world);
  if (!Number.isInteger(tick) || tick !== world.tick + 1)
    throw new Error("Tick must advance once");
  const byId = new Map(agents.map((agent) => [agent.id, agent]));
  if (byId.size !== agents.length) throw new Error("Duplicate agents");
  const ordered = proposals.slice().sort((left, right) => {
    const a = byId.get(left.agentId), b = byId.get(right.agentId);
    const priority = (rolePriority[a?.role] ?? 9) - (rolePriority[b?.role] ?? 9);
    return priority || String(left.agentId).localeCompare(String(right.agentId));
  });
  const seen = new Set(), accepted = [], rejected = [], emissions = [];
  let state = structuredClone(world);
  for (const action of ordered) {
    try {
      validateAction(action);
      if (action.runId !== runId || action.tick !== tick)
        throw new Error("Action does not belong to this run or tick");
      const agent = byId.get(action.agentId);
      if (!agent || !allowedToAct(agent, action.actionType))
        throw new Error("Action is not allowed for this agent");
      if (seen.has(action.agentId)) throw new Error("One action per agent per tick");
      seen.add(action.agentId);
      const result = applyOne(state, agent, action, byId, priorEvents);
      state = result.state;
      accepted.push(action);
      emissions.push(result.emission);
    } catch (error) {
      rejected.push({ agentId: String(action?.agentId ?? "unknown"),
        actionType: String(action?.actionType ?? "unknown"), reason: error.message });
      emissions.push({
        actorId: byId.has(action?.agentId) ? action.agentId : "engine",
        type: "action-rejected",
        payload: { visibility: "private", reason: error.message,
          proposedAction: String(action?.actionType ?? "unknown") }
      });
    }
  }
  state.tick = tick;
  validateWorldState(state);
  return { state, accepted, rejected, emissions };
}
