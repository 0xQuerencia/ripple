import test from "node:test";
import assert from "node:assert/strict";
import { buildWorld, affectedByClaim } from "../server/simulation/worldBuilder.mjs";
import { validateWorldState } from "../shared/simulation/schema.mjs";

const project = { id: "p", ownerId: "local" };
const segment = (sourceClaimIds = []) => ({
  id: "students", label: "Students", customers: 300, monthlyChurn: 0.05, sourceClaimIds
});
const input = { project, companyName: "Acme", baselinePrice: 499,
  segments: [segment()], marketingBudget: 1000 };

test("world graph uses user-supplied state and marks assumptions", () => {
  const state = buildWorld(input);
  assert.equal(validateWorldState(state), state);
  assert.equal(state.entities.length, 2);
  assert.equal(state.entities[1].attributes.customers, 300);
  assert.equal(state.relationships[0].provenance, "assumption");
  assert.equal(state.variables.baselinePrice, 499);
});

test("world builder rejects unsupported facts and impossible inputs", () => {
  assert.throws(() => buildWorld({ ...input, baselinePrice: -1 }), /price/);
  assert.throws(() => buildWorld({ ...input, segments: [segment(), segment()] }), /Duplicate/);
  assert.throws(() => buildWorld({ ...input, segments: [
    { ...segment(), monthlyChurn: 1.5 }
  ] }), /churn/);
  assert.throws(() => buildWorld({ ...input, segments: [segment(["missing"])] }), /unreviewed/);
  assert.throws(() => buildWorld({ ...input, relationships: [
    { fromId: "students", toId: "ghost", kind: "mentions" }
  ] }), /Invalid world relationship/);
});

test("reviewed claims can be linked but conflicting claims are blocked", () => {
  const observed = (id, text) => ({ id, text, reviewed: true,
    confidenceStatus: "reviewed", rejected: false });
  const approved = observed("claim-1", "Customers: 300");
  const state = buildWorld({ ...input, claims: [approved],
    segments: [segment(["claim-1"])] });
  assert.ok(affectedByClaim(state, "claim-1").entityIds.includes("students"));
  assert.throws(() => buildWorld({ ...input,
    claims: [observed("claim-1", "Price: 499"), observed("claim-2", "Price: 599")],
    segments: [segment(["claim-1"])] }), /unreviewed/);
});
