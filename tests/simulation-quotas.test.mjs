import test from "node:test";
import assert from "node:assert/strict";
import { SqliteEventStore } from "../server/storage/sqlite.mjs";
import { SqliteJobQueue } from "../server/jobs/queue.mjs";
import { createSimulationApi } from "../server/simulation/api.mjs";
import { parseSource, makeSource } from "../server/evidence/parser.mjs";
import { isLocal } from "../server/projects/api.mjs";

const now = "2026-11-18T00:00:00.000Z";
const project = { schemaVersion: 1, id: "project", ownerId: "local",
  title: "Test", domainPack: "product-decision", createdAt: now, updatedAt: now };
const run = { schemaVersion: 1, id: "run", ownerId: "local", createdAt: now,
  scenarioId: "scenario", seed: 1, modelId: "rules", promptVersion: "v1",
  engineVersion: "v1", status: "queued", budget: { maxCalls: 0, maxTokens: 0 },
  spent: { calls: 0, tokens: 0 }, checkpointTick: 0, startedAt: null, completedAt: null };

test("local API rejects nonlocal hosts, forged origins and accepts IPv6 loopback", () => {
  assert.equal(isLocal({ socket: { remoteAddress: "127.0.0.1" },
    headers: { host: "localhost:8787" } }), true);
  assert.equal(isLocal({ socket: { remoteAddress: "::1" },
    headers: { host: "[::1]:8787" } }), true);
  assert.equal(isLocal({ socket: { remoteAddress: "203.0.113.2" },
    headers: { host: "localhost:8787" } }), false);
  assert.equal(isLocal({ socket: { remoteAddress: "127.0.0.1" },
    headers: { host: "localhost:8787", origin: "https://evil.example" } }), false);
  assert.equal(isLocal({ socket: { remoteAddress: "127.0.0.1" },
    headers: { host: "invalid host" } }), false);
});

test("evidence storage is owner scoped, deduplicated, and has project quotas", () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project);
    for (let i = 0; i < 50; i++) {
      const parsed = parseSource({ filename: "source-" + i + ".txt", content: "value: " + i });
      const source = makeSource("local", "project", "source-" + i + ".txt", parsed);
      store.putSource("local", "project", source, parsed);
    }
    assert.equal(store.listSources("local", "project").length, 50);
    const parsed = parseSource({ filename: "extra.txt", content: "extra" });
    const newSource = makeSource("local", "project", "extra.txt", parsed);
    assert.throws(() => store.putSource("local", "project", newSource, parsed), /limit reached/);
    assert.equal(store.listSources("other", "project").length, 0);
    const copy = parseSource({ filename: "copy.txt", content: "value: 5" });
    const duplicate = makeSource("local", "project", "copy.txt", copy);
    assert.equal(store.putSource("local", "project", duplicate, copy).hash,
      store.listSources("local", "project")[5].hash);
  } finally { store.close(); }
});

test("job queues bound concurrent work and block excessive rounds", () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project);
    store.putRun("local", "project", run);
    const queue = new SqliteJobQueue(store);
    assert.throws(() => queue.enqueue({ id: "bad", ownerId: "local", runId: "run",
      rounds: 13 }), /Invalid job limits/);
    queue.enqueue({ id: "a", ownerId: "local", runId: "run", rounds: 4 });
    queue.enqueue({ id: "b", ownerId: "local", runId: "run", rounds: 4 });
    assert.throws(() => queue.enqueue({ id: "c", ownerId: "local", runId: "run",
      rounds: 4 }), /Only two active jobs/);
    queue.cancel("local", "a");
    assert.equal(queue.enqueue({ id: "c", ownerId: "local", runId: "run",
      rounds: 4 }).status, "queued");
  } finally { store.close(); }
});
