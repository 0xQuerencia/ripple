import test from "node:test";
import assert from "node:assert/strict";
import { SqliteEventStore } from "../server/storage/sqlite.mjs";
import { createProjectApi } from "../server/projects/api.mjs";

function request(api, method, path, data, options = {}) {
  const body = data === undefined ? [] : [Buffer.from(JSON.stringify(data))];
  const req = Object.assign((async function* () { yield* body; })(), {
    method, url: path, socket: { remoteAddress: options.ip ?? "127.0.0.1" },
    headers: { host: options.host ?? "localhost:8787", origin: options.origin },
  });
  let status = 0, text = "";
  const res = {
    writeHead(code) { status = code; },
    end(chunk) { text += chunk ?? ""; },
  };
  return api(req, res, () => { throw new Error("Wrong route"); })
    .then(() => ({ status, body: JSON.parse(text) }));
}

test("local projects persist runs and allow exact event reopening", async () => {
  const store = new SqliteEventStore();
  try {
    const api = createProjectApi(store);
    const created = await request(api, "POST", "/api/projects", { title: "My decisions" });
    assert.equal(created.status, 201);
    const id = created.body.project.id;
    const run = await request(api, "POST", "/api/projects/" + id + "/runs", {
      mode: "demo", events: [
        { id: "old-0", title: "New price", targetId: "pricing", round: 0 },
        { id: "old-1", title: "Customers react", sourceId: "pricing",
          parentEventId: "old-0", targetId: "customer", round: 1 }
      ]
    });
    assert.equal(run.status, 201);
    const saved = await request(api, "GET", "/api/saved-runs/" + run.body.run.id);
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.events.map((item) => item.id), ["old-0", "old-1"]);
    assert.equal(store.readEvents("local", run.body.run.id)[1].parentEventIds.length, 1);
    const renamed = await request(api, "PATCH", "/api/projects/" + id,
      { title: "New name" });
    assert.equal(renamed.body.project.title, "New name");
    const copy = await request(api, "POST", "/api/projects/" + id + "/clone");
    assert.equal(copy.status, 201);
    assert.notEqual(copy.body.project.id, id);
    assert.equal((await request(api, "DELETE", "/api/projects/" + id)).body.deleted, true);
    assert.equal((await request(api, "GET", "/api/saved-runs/" + run.body.run.id)).status, 404);
  } finally { store.close(); }
});

test("project API only accepts local requests", async () => {
  const store = new SqliteEventStore();
  try {
    const api = createProjectApi(store);
    assert.equal((await request(api, "GET", "/api/projects", undefined,
      { ip: "203.0.113.8" })).status, 403);
    assert.equal((await request(api, "GET", "/api/projects", undefined,
      { host: "ripple.example" })).status, 403);
    assert.equal((await request(api, "GET", "/api/projects", undefined,
      { origin: "https://attacker.example" })).status, 403);
  } finally { store.close(); }
});

test("Quick Ripple history cannot display or delete simulation runs", async () => {
  const store = new SqliteEventStore();
  try {
    const api = createProjectApi(store);
    const created = await request(api, "POST", "/api/projects",
      { title: "Experiment separation" });
    const projectId = created.body.project.id;
    const at = new Date().toISOString();
    const simulatedRun = {
      schemaVersion: 1, ownerId: "local", id: "sim-only", createdAt: at,
      scenarioId: "scenario-1", seed: 1, modelId: "rules",
      promptVersion: "v1", engineVersion: "v1", status: "queued",
      budget: { maxCalls: 0, maxTokens: 0 }, spent: { calls: 0, tokens: 0 },
      checkpointTick: 0, startedAt: null, completedAt: null
    };
    store.putRun("local", projectId, simulatedRun);
    const list = await request(api, "GET", "/api/projects/" + projectId + "/runs");
    assert.equal(list.status, 200);
    assert.deepEqual(list.body.runs, []);
    assert.equal((await request(api, "GET", "/api/saved-runs/sim-only")).status, 404);
    assert.equal((await request(api, "DELETE", "/api/saved-runs/sim-only")).status, 404);
    assert.ok(store.getRun("local", "sim-only"));
  } finally { store.close(); }
});
