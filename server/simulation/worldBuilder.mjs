import { validateWorldState } from "../../shared/simulation/schema.mjs";
import { flagConflicts } from "../evidence/claims.mjs";

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,79}$/;
const validAmount = (number) => Number.isFinite(number) && number >= 0;

function approvedClaimIds(claims) {
  return new Set(flagConflicts(claims).filter((claim) =>
    claim.reviewed && !claim.rejected && claim.confidenceStatus === "reviewed")
    .map((claim) => claim.id));
}

export function buildWorld({ project, claims = [], companyName, segments = [],
  baselinePrice, marketingBudget = 0, relationships = [], assumptions = [], companySourceClaimIds = [] }) {
  if (!project?.id || !project.ownerId) throw new Error("Project is required");
  if (typeof companyName !== "string" || !companyName.trim() || companyName.length > 160)
    throw new Error("Name the company or product");
  if (!validAmount(baselinePrice) || baselinePrice <= 0 || !validAmount(marketingBudget))
    throw new Error("Enter a positive current price and a nonnegative budget");
  if (!Array.isArray(segments) || segments.length < 1 || segments.length > 100)
    throw new Error("Enter at least one customer segment");

  const reviewed = approvedClaimIds(claims);
  const requiredClaims = (ids = []) => {
    if (!Array.isArray(ids) || ids.some((id) => !reviewed.has(id)))
      throw new Error("World references an unreviewed or conflicting claim");
    return ids;
  };
  const at = new Date().toISOString();
  const base = (id) => ({
    schemaVersion: 1, ownerId: project.ownerId, id, createdAt: at
  });
  const company = {
    ...base("company"), kind: "company", label: companyName.trim(),
    attributes: { baselinePrice }, provenance: "assumption",
    sourceClaimIds: requiredClaims(companySourceClaimIds)
  };
  const entities = [company];
  const edges = [];
  const ids = new Set(["company"]);
  for (const segment of segments) {
    if (!idPattern.test(segment.id || "") || ids.has(segment.id))
      throw new Error("Duplicate or invalid customer segment ID");
    if (typeof segment.label !== "string" || !segment.label.trim() ||
        segment.label.length > 160 || !Number.isInteger(segment.customers) ||
        segment.customers < 0 || !Number.isFinite(segment.monthlyChurn) ||
        segment.monthlyChurn < 0 || segment.monthlyChurn > 1)
      throw new Error("Each segment needs a label, customer count and churn fraction");
    ids.add(segment.id);
    entities.push({
      ...base(segment.id), kind: "customer-segment", label: segment.label.trim(),
      attributes: { customers: segment.customers, monthlyChurn: segment.monthlyChurn },
      sourceClaimIds: requiredClaims(segment.sourceClaimIds),
      provenance: "assumption"
    });
    edges.push({
      ...base("serves-" + segment.id), fromId: "company", toId: segment.id,
      kind: "serves", direction: "directed", constraints: {},
      provenance: "assumption"
    });
  }
  for (let i = 0; i < relationships.length; i++) {
    const relation = relationships[i];
    if (!ids.has(relation.fromId) || !ids.has(relation.toId) ||
        relation.fromId === relation.toId || !idPattern.test(relation.kind || ""))
      throw new Error("Invalid world relationship");
    requiredClaims(relation.sourceClaimIds);
    edges.push({
      ...base("link-" + i), fromId: relation.fromId, toId: relation.toId,
      kind: relation.kind, direction: "directed", constraints: {},
      sourceClaimIds: relation.sourceClaimIds || [],
      provenance: "hypothesis"
    });
  }
  requiredClaims(assumptions);
  const state = {
    ...base("world-" + project.id), tick: 0, entities, relationships: edges,
    variables: { baselinePrice, currentPrice: baselinePrice, rolloutPercent: 100 },
    resources: { marketingBudget }, activeAssumptions: assumptions
  };
  validateWorldState(state);
  return state;
}

export function affectedByClaim(world, claimId) {
  const affected = new Set(world.entities.filter((entity) =>
    entity.sourceClaimIds.includes(claimId)).map((entity) => entity.id));
  const relationships = world.relationships.filter((relation) =>
    relation.sourceClaimIds?.includes(claimId) ||
    affected.has(relation.fromId) || affected.has(relation.toId));
  for (const relation of relationships) {
    affected.add(relation.fromId);
    affected.add(relation.toId);
  }
  return { entityIds: [...affected], relationshipIds: relationships.map((r) => r.id) };
}
