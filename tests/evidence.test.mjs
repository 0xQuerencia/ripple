import test from "node:test";
import assert from "node:assert/strict";
import { SqliteEventStore } from "../server/storage/sqlite.mjs";
import { parseSource, makeSource } from "../server/evidence/parser.mjs";

const meta = { schemaVersion: 1, id: "p", ownerId: "local",
  createdAt: "2026-11-18T00:00:00.000Z", updatedAt: "2026-11-18T00:00:00.000Z",
  title: "Work", domainPack: "product-decision" };

test("text and markdown keep exact line spans", () => {
  const data = parseSource({ filename: "note.md", content: "# Price\r\nCurrent: 499\r\n" });
  assert.deepEqual(data.spans.map((span) => span.sourceRow), [1, 2]);
  assert.equal(data.spans[1].quote, "Current: 499");
  assert.equal(data.spans[1].charStart, 8);
});

test("CSV handles quoted delimiters and multiline fields", () => {
  const data = parseSource({ filename: "users.csv",
    content: 'name,note\r\nA,"one,two"\r\nB,"a\nb"\r\n' });
  assert.equal(data.spans.length, 3);
  assert.deepEqual(data.spans[1].cells, ["A", "one,two"]);
  assert.deepEqual(data.spans[2].cells, ["B", "a\nb"]);
});

test("malformed, oversized and mismatched files are rejected", () => {
  for (const file of [
    { filename: "../private.txt", content: "x" },
    { filename: "report.pdf", content: "x" },
    { filename: "data.csv", content: '"unclosed' },
    { filename: "data.csv", content: '"a"b' },
    { filename: "data.csv", content: "x".repeat(129 * 1024) },
    { filename: "data.md", content: "ok", mime: "application/pdf" },
  ]) assert.throws(() => parseSource(file));
});

test("sources are private, deduplicated and removed with their project", () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(meta);
    const parsed = parseSource({ filename: "metrics.csv", content: "churn\n5" });
    const one = makeSource("local", "p", "metrics.csv", parsed);
    const stored = store.putSource("local", "p", one, parsed);
    assert.equal(store.putSource("local", "p",
      makeSource("local", "p", "other.csv", parsed), parsed).id, stored.id);
    assert.equal(store.listSources("bob", "p").length, 0);
    assert.equal(store.getSource("bob", "p", stored.id), null);
    assert.equal(store.getSource("local", "p", stored.id).parsed.spans[1].quote, "5");
    assert.equal(store.deleteProject("local", "p"), true);
    assert.equal(store.getSource("local", "p", stored.id), null);
  } finally { store.close(); }
});
