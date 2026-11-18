const MAX_VISIBLE = 96;

const ICONS = {
  change_price: "i-coins",
  announce_change: "i-megaphone",
  contact_group: "i-chat-circle",
  request_information: "i-lightbulb",
  revise_plan: "i-compass",
  allocate_budget: "i-wallet",
  adopt_product: "i-shopping-cart",
  cancel_subscription: "i-prohibit",
  respond_to_announcement: "i-chat-circle",
  "action-rejected": "i-warning",
  "tick-summary": "i-hourglass"
};

function root(runId, question) {
  return {
    id: "start-" + runId, parentEventId: null, sourceId: null,
    targetId: "start-" + runId, round: 0,
    name: "the decision", area: "society", icon: "i-compass",
    known: false, title: question || "scenario rehearsal",
    explanation: question || "A decision is explored under stated assumptions",
    certainty: "possible", severity: "low", timeframe: "start",
    who: "", alsoFrom: [], provenance: "assumption"
  };
}

export function eventGraph(events, question = "A decision", runId = "simulation") {
  const first = root(runId, question);
  const graph = [first], byId = new Map();
  for (const event of events.slice(0, MAX_VISIBLE)) {
    const parent = event.parentEventIds.map((id) => byId.get(id)).find(Boolean) || first;
    const targetId = "sim-" + runId + "-" + event.seq;
    const name = event.type.replaceAll("_", " ").replaceAll("-", " ");
    const item = {
      id: event.id, parentEventId: parent.id, sourceId: parent.targetId,
      targetId, round: Math.max(1, event.tick),
      name, area: "society", icon: ICONS[event.type] || "sparkle",
      known: false, title: name, explanation:
        event.payload.rationale || event.payload.reason || "Simulated state transition",
      who: event.actorId, timeframe: "round " + event.tick,
      certainty: "possible", severity: event.type === "action-rejected" ? "medium" : "low",
      alsoFrom: [], provenance: event.provenance
    };
    byId.set(event.id, item);
    graph.push(item);
  }
  return graph;
}

export function worldGraph(world, question = "Stakeholder world") {
  if (!world?.entities?.length) return [];
  const company = world.entities.find((entity) => entity.id === "company") || world.entities[0];
  const first = {
    ...root(world.id, question), id: "entity-" + company.id,
    targetId: "entity-" + company.id, name: company.label, icon: "i-storefront"
  };
  const graph = [first], byId = new Map([[company.id, first]]);
  for (const entity of world.entities) {
    if (entity.id === company.id) continue;
    const incoming = world.relationships.find((rel) =>
      rel.toId === entity.id && byId.has(rel.fromId));
    const parent = byId.get(incoming?.fromId) || first;
    const item = {
      id: "entity-" + entity.id, parentEventId: parent.id,
      sourceId: parent.targetId, targetId: "entity-" + entity.id,
      name: entity.label, round: 1, area: "society",
      icon: entity.kind === "customer-segment" ? "i-users" : "i-storefront",
      known: false, title: entity.kind.replaceAll("-", " "),
      explanation: "Inputs supplied for this world, not independently verified",
      who: "", timeframe: "input", certainty: "possible",
      severity: "low", alsoFrom: [], provenance: entity.provenance
    };
    byId.set(entity.id, item);
    graph.push(item);
  }
  return graph;
}
