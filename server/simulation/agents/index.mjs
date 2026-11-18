import { validateAgent, validateWorldState } from "../../../shared/simulation/schema.mjs";

export const ALLOWED_BY_ROLE = Object.freeze({
  company: ["change_price", "announce_change", "contact_group", "request_information",
    "revise_plan", "allocate_budget", "do_nothing"],
  "customer-segment": ["request_information", "respond_to_announcement",
    "adopt_product", "cancel_subscription", "do_nothing"],
  competitor: ["respond_to_announcement", "contact_group", "do_nothing"],
  regulator: ["request_information", "respond_to_announcement", "do_nothing"]
});

export function allowedToAct(agent, actionType) {
  return Boolean(ALLOWED_BY_ROLE[agent.role]?.includes(actionType));
}

function visibleTo(agent, event) {
  const visibility = event.payload?.visibility;
  return visibility === "public" || visibility === "all" ||
    event.actorId === agent.id ||
    (Array.isArray(event.payload?.audience) && event.payload.audience.includes(agent.id));
}

export function observeAgent(agent, world, events = []) {
  validateAgent(agent);
  validateWorldState(world);
  const ownSegment = agent.role === "customer-segment"
    ? world.entities.find((entity) => entity.id === agent.constraints.segmentId)
    : null;
  if (agent.role === "customer-segment" && !ownSegment)
    throw new Error("Agent references an unknown segment");
  const knownPrice = world.variables.priceAnnounced
    ? world.variables.currentPrice : world.variables.baselinePrice;
  const variables = agent.role === "company"
    ? { ...world.variables }
    : { publicPrice: knownPrice, priceAnnounced: Boolean(world.variables.priceAnnounced) };
  const resources = agent.role === "company" ? { ...world.resources } : {};
  const entities = agent.role === "company"
    ? structuredClone(world.entities)
    : [world.entities.find((entity) => entity.id === "company"), ownSegment]
      .filter(Boolean).map((entity) => structuredClone(entity));
  const visibleEvents = events.filter((event) => visibleTo(agent, event))
    .slice(-30).map((event) => ({
      id: event.id, type: event.type, tick: event.tick, actorId: event.actorId,
      payload: structuredClone(event.payload)
    }));
  return {
    agentId: agent.id, tick: world.tick,
    variables, resources, entities, visibleEvents,
    memoryRefs: agent.memoryRefs.slice(-20)
  };
}

export function ruleProposal({ runId, tick, agent, observation }) {
  const isCompany = agent.role === "company";
  const change = observation.variables.currentPrice !== undefined &&
    observation.variables.currentPrice !== observation.variables.baselinePrice;
  const publicAnnouncement = observation.visibleEvents.some((event) =>
    event.type === "announce_change");
  let actionType = "do_nothing";
  let rationale = "No supported action is justified by the current observation";
  if (isCompany && change && !observation.variables.priceAnnounced) {
    actionType = "announce_change";
    rationale = "Communicate the proposed price change";
  } else if (agent.role === "customer-segment" && publicAnnouncement) {
    actionType = "respond_to_announcement";
    rationale = "Explore a response to the publicly announced change";
  }
  return {
    runId, tick, agentId: agent.id, actionType, arguments: {},
    rationale
  };
}
