import test from "node:test";
import assert from "node:assert/strict";
import { SqliteEventStore } from "../server/storage/sqlite.mjs";
import { SqliteJobQueue } from "../server/jobs/queue.mjs";
import { createSimulationApi } from "../server/simulation/api.mjs";
import { createTickExecutor } from "../server/simulation/runner.mjs";
import { workOne } from "../server/jobs/worker.mjs";

const at = "2026-11-18T00:00:00.000Z";
const project = { schemaVersion: 1, id: "p", ownerId: "local",
  createdAt: at, updatedAt: at, title: "Work", domainPack: "product-decision" };

async function request(api, method, path, data, ip = "127.0.0.1") {
  const chunks = data === undefined ? [] : [Buffer.from(JSON.stringify(data))];
  const req = Object.assign((async function* () { yield* chunks; })(), {
    method, url: path, socket: { remoteAddress: ip }, headers: { host: "localhost:8787" }
  });
  let status = 0, content = "";
  const res = {
    writeHead(s) { status = s; },
    end(chunk) { content += chunk || ""; }
  };
  await api(req, res, () => { throw new Error("Route was not handled"); });
  return { status, data: JSON.parse(content) };
}

test("scenario API creates a scenario, queues a job, and persists real events", async () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project);
    const queue = new SqliteJobQueue(store);
    const api = createSimulationApi(store, queue);
    const path = "/api/projects/p/scenarios";
    const created = await request(api, "POST", path, {
      companyName: "Sample", question: "Raise our subscription price?",
      baselinePrice: 499, marketingBudget: 1000,
      segments: [{ id: "s", label: "Subscribers", customers: 120,
        monthlyChurn: 0.05 }],
      interventions: [
        { label: "full", price: 599, rolloutPercent: 100 },
        { label: "pilot", price: 599, rolloutPercent: 20 }
      ],
      rounds: 4
    });
    assert.equal(created.status, 201);
    assert.equal(created.data.indicators.alternatives.length, 2);
    const scenarioId = created.data.scenario.id;
    const root = path + "/" + scenarioId;
    const launched = await request(api, "POST", root + "/runs",
      { interventionId: "option-0" });
    assert.equal(launched.status, 201);
    assert.equal(launched.data.job.status, "queued");
    const executed = await workOne(queue, "test-worker", createTickExecutor({
      store, getScenario: async (_, id) => store.getScenario("local", id)
    }));
    assert.equal(executed.status, "done");
    const result = await request(api, "GET",
      "/api/simulation-jobs/" + launched.data.job.id);
    assert.equal(result.status, 200);
    assert.equal(result.data.job.status, "done");
    assert.equal(result.data.checkpoint.tick, 4);
    assert.ok(result.data.events.some((event) => event.type === "announce_change"));
    const recent = await request(api, "GET", root + "/runs");
    assert.equal(recent.data.runs[0].job.status, "done");
  } finally { store.close(); }
});

test("simulation API rejects nonlocal users and invalid interventions", async () => {
  const store = new SqliteEventStore();
  try {
    store.putProject(project);
    const api = createSimulationApi(store, new SqliteJobQueue(store));
    assert.equal((await request(api, "GET", "/api/projects/p/scenarios", undefined,
      "203.0.113.1")).status, 403);
    assert.equal((await request(api, "POST", "/api/projects/p/scenarios",
      { question: "??", baselinePrice: -1 })).status, 400);
  } finally { store.close(); }
});
