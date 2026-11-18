import test from "node:test";
import assert from "node:assert/strict";
import { SqliteEventStore } from "../server/storage/sqlite.mjs";
import { parseSource, makeSource } from "../server/evidence/parser.mjs";
import { proposeClaims, flagConflicts } from "../server/evidence/claims.mjs";

const now = "2026-11-18T00:00:00.000Z";
const project = { schemaVersion: 1, id: "project", ownerId: "local",
  title: "Pricing", domainPack: "product-decision",
  createdAt: now, updatedAt: now };

test("source claims carry exact provenance and require review", () => {
  const parsed = parseSource({ filename: "metrics.txt",
    content: "Price: 499\nChurn: 5%\n" });
  const source = makeSource("local", "project", "metrics.txt", parsed);
  const claims = proposeClaims(source, parsed);
  assert.equal(claims.length, 2);
  assert.equal(claims[0].reviewed, false);
  assert.equal(claims[0].provenance, "observed");
  assert.deepEqual(claims[0].sourceSpans[0], {
    sourceId: source.id, charStart: 0, charEnd: 10, quote: "Price: 499"
  });
});

test("conflicting claims are flagged without inventing a winner", () => {
  const parsed = parseSource({ filename: "d.txt", content: "Price: 499\nPrice: 599" });
  const source = makeSource("local", "project", "d.txt", parsed);
  const flagged = flagConflicts(proposeClaims(source, parsed));
  assert.deepEqual(flagged.map((c) => c.confidenceStatus), ["conflicted", "conflicted"]);
  assert.equal(flagged.some((c) => c.reviewed), false);
});

test("accepted edits become assumptions; deletions are owner scoped", () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project);
    const parsed = parseSource({ filename: "d.txt", content: "Churn: 5%" });
    const source = store.putSource("local", "project",
      makeSource("local", "project", "d.txt", parsed), parsed);
    const candidates = proposeClaims(source, parsed);
    const claims = store.putClaims("local", "project", candidates);
    assert.equal(store.putClaims("local", "project", candidates).length, 1);
    assert.equal(store.updateClaim("bob", "project", claims[0].id,
      { decision: "accept" }), null);
    const updated = store.updateClaim("local", "project", claims[0].id,
      { decision: "accept", text: "Churn: probably 6%" });
    assert.equal(updated.provenance, "assumption");
    assert.equal(updated.reviewed, true);
    const rejected = store.updateClaim("local", "project", claims[0].id,
      { decision: "reject" });
    assert.equal(rejected.rejected, true);
    assert.equal(rejected.reviewed, false);
  } finally { store.close(); }
});
