import { randomUUID } from "node:crypto";
import { isLocal } from "../projects/api.mjs";
import { buildWorld } from "./worldBuilder.mjs";
import { createPricingScenario, pricingIndicators } from "./domains/productDecision/index.mjs";

const OWNER = "local";
const send = (res, status, data) => {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store" });
  res.end(JSON.stringify(data));
};

async function bodyOf(req) {
  if (req.body != null) {
    const text = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(text) > 64_000) throw new Error("Request too large");
    return JSON.parse(text);
  }
  let bytes = 0;
  const chunks = [];
  for await (const chunk of req) {
    bytes += chunk.length;
    if (bytes > 64_000) throw new Error("Request too large");
    chunks.push(chunk);
  }
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!body || Array.isArray(body) || typeof body !== "object")
    throw new Error("Expected a JSON object");
  return body;
}

function indicators(scenario) {
  const world = scenario.baselineState;
  return {
    baseline: pricingIndicators(world),
    alternatives: scenario.interventions.map((option) => ({
      id: option.id, label: option.label,
      ...pricingIndicators(world, {
        price: option.changes.currentPrice,
        rolloutPercent: option.changes.rolloutPercent
      })
    }))
  };
}

function makeRun(scenario, interventionId) {
  if (interventionId !== "baseline" &&
      !scenario.interventions.some((item) => item.id === interventionId))
    throw new Error("Unknown intervention");
  const now = new Date().toISOString();
  return {
    schemaVersion: 1, id: randomUUID(), ownerId: OWNER, createdAt: now,
    scenarioId: scenario.id, interventionId,
    seed: scenario.config.seed || 1, modelId: "rules",
    promptVersion: "product-decision-v1", engineVersion: "ripple-sim-v1",
    status: "queued", budget: { maxCalls: 0, maxTokens: 0 },
    spent: { calls: 0, tokens: 0 }, checkpointTick: 0,
    startedAt: null, completedAt: null
  };
}

export function createSimulationApi(store, queue) {
  return async function simulationApi(req, res, next) {
    const url = new URL(req.url || "/", "http://localhost");
    const parts = url.pathname.split("/").filter(Boolean);
    const isScenario = parts[1] === "projects" && parts[3] === "scenarios";
    const isJob = parts[1] === "simulation-jobs";
    const isRun = parts[1] === "simulation-runs";
    if (!(isScenario || isJob || isRun)) return next?.();
    if (!isLocal(req)) return send(res, 403, { error: "Simulations are local-only." });
    try {
      if (isScenario) {
        const projectId = parts[2];
        const project = store.getProject(OWNER, projectId);
        if (!project) return send(res, 404, { error: "Project not found" });
        if (parts.length === 4) {
          if (req.method === "GET")
            return send(res, 200, { scenarios: store.listScenarios(OWNER, projectId) });
          if (req.method === "POST") {
            if (store.listScenarios(OWNER, projectId).length >= 50)
              throw new Error("Too many scenarios in this project");
            const input = await bodyOf(req);
            const world = buildWorld({
              project, claims: store.listClaims(OWNER, projectId),
              companyName: input.companyName, baselinePrice: input.baselinePrice,
              marketingBudget: input.marketingBudget ?? 0, segments: input.segments,
              relationships: input.relationships || [], assumptions: input.assumptions || []
            });
            const scenario = createPricingScenario({
              world, projectId, question: input.question,
              interventions: input.interventions, rounds: input.rounds ?? 6,
              seed: input.seed ?? 1
            });
            store.putScenario(OWNER, projectId, scenario);
            return send(res, 201, { scenario, indicators: indicators(scenario) });
          }
        }
        const scenario = store.getScenario(OWNER, parts[4]);
        if (!scenario || scenario.projectId !== projectId)
          return send(res, 404, { error: "Scenario not found" });
        if (parts.length === 5 && req.method === "GET")
          return send(res, 200, { scenario, indicators: indicators(scenario) });
        if (parts.length === 6 && parts[5] === "runs") {
          if (req.method === "GET") {
            const runs = store.listRuns(OWNER, projectId)
              .filter((run) => run.scenarioId === scenario.id)
              .map((run) => ({ ...run, job: queue.getByRun?.(OWNER, run.id) || null }));
            return send(res, 200, { runs });
          }
          if (req.method === "POST") {
            const input = await bodyOf(req);
            const interventionId = input.interventionId || "baseline";
            const history = store.listRuns(OWNER, projectId)
              .filter((run) => run.scenarioId === scenario.id);
            if (history.length >= 30) throw new Error("Too many runs in this scenario");
            const run = makeRun(scenario, interventionId);
            store.putRun(OWNER, projectId, run);
            const job = queue.enqueue({
              id: randomUUID(), ownerId: OWNER, runId: run.id,
              rounds: scenario.config.rounds
            });
            return send(res, 201, { run, job });
          }
        }
      }
      if (isJob && parts.length === 3) {
        const job = queue.get(OWNER, parts[2]);
        if (!job) return send(res, 404, { error: "Job not found" });
        if (req.method === "GET") {
          const after = Number(url.searchParams.get("after") || 0);
          const events = store.readEvents(OWNER, job.runId, { after, limit: 500 });
          const checkpoint = store.getCheckpoint(OWNER, job.runId);
          return send(res, 200, { job, events, checkpoint });
        }
        if (req.method === "PATCH") {
          const input = await bodyOf(req);
          const operation = { pause: queue.pause, resume: queue.resume, cancel: queue.cancel }[input.action];
          if (!operation) throw new Error("Unknown job action");
          operation.call(queue, OWNER, job.id);
          return send(res, 200, { job: queue.get(OWNER, job.id) });
        }
      }
      if (isRun && parts.length === 3 && req.method === "GET") {
        const run = store.getRun(OWNER, parts[2]);
        if (!run) return send(res, 404, { error: "Run not found" });
        return send(res, 200, { run, events: store.readEvents(OWNER, run.id, { limit: 1000 }),
          checkpoint: store.getCheckpoint(OWNER, run.id) });
      }
      return send(res, 405, { error: "Unsupported action" });
    } catch (error) {
      return send(res, 400, { error: error.message });
    }
  };
}
