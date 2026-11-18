import { proposeClaims, flagConflicts } from "../evidence/claims.mjs";
import { parseSource, makeSource } from "../evidence/parser.mjs";
import { randomUUID } from "node:crypto";

const OWNER = "local";
const json = (res, code, value) => {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(value));
};

export function isLocal(req) {
  const address = req.socket?.remoteAddress ?? "";
  const host = String(req.headers?.host ?? "").split(":")[0].replace(/^\[|\]$/g, "");
  const origin = req.headers?.origin;
  const remote = address === "::1" || address === "127.0.0.1" || address.startsWith("::ffff:127.");
  try {
    return remote && ["localhost", "127.0.0.1", "::1"].includes(host) &&
      (!origin || new URL(origin).host === req.headers.host);
  } catch {
    return false;
  }
}

async function readBody(req) {
  const chunks = [];
  let length = 0;
  if (req.body != null) {
    const text = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    if (Buffer.byteLength(text) > 128_000) throw new Error("Request too large");
    return JSON.parse(text);
  }
  for await (const part of req) {
    length += part.length;
    if (length > 128_000) throw new Error("Request too large");
    chunks.push(part);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const titleOf = (value) => {
  if (typeof value !== "string" || !value.trim() || value.length > 160)
    throw new Error("Give this project a title (up to 160 characters)");
  return value.trim();
};

function saveQuickRun(store, projectId, data) {
  if (!data || !Array.isArray(data.events) || data.events.length < 1 || data.events.length > 100)
    throw new Error("Invalid run events");
  if (!data.events[0]?.id || !data.events[0]?.title)
    throw new Error("Missing run origin");
  const id = randomUUID();
  const at = new Date().toISOString();
  const run = {
    schemaVersion: 1, id, ownerId: OWNER, createdAt: at,
    scenarioId: "quick-ripple", seed: 0,
    modelId: String(data.model || "offline-demo").slice(0, 160),
    promptVersion: "quick-v1", engineVersion: "quick-v1", status: "done",
    budget: { maxCalls: 0, maxTokens: 0 }, spent: { calls: 0, tokens: 0 },
    checkpointTick: 0, startedAt: at, completedAt: at,
    title: String(data.events[0].title).slice(0, 160),
    mode: data.mode === "gemma" ? "gemma" : "demo",
    summary: typeof data.summary === "string" ? data.summary.slice(0, 500) : ""
  };
  const references = new Map(data.events.map((item, i) => [item.id, id + "-e" + i]));
  const events = data.events.map((item, i) => ({
    schemaVersion: 1, id: id + "-e" + i, ownerId: OWNER, createdAt: at,
    runId: id, seq: i + 1, tick: Math.max(0, Number(item.round) || 0),
    actorId: "ripple", type: i === 0 ? "quick-origin" : "quick-effect",
    payload: { quickEvent: item },
    parentEventIds: references.has(item.parentEventId) ? [references.get(item.parentEventId)] : [],
    sourceClaimIds: [], provenance: "hypothesis"
  }));
  store.putRun(OWNER, projectId, run);
  store.appendEvents(OWNER, id, events);
  return run;
}

export function createProjectApi(store) {
  return async function projects(req, res, next) {
    const pathname = new URL(req.url || "/", "http://localhost").pathname;
    if (!pathname.startsWith("/api/projects") && !pathname.startsWith("/api/saved-runs"))
      return next?.();
    if (!isLocal(req)) return json(res, 403, { error: "Project history is local-only." });
    const parts = pathname.split("/").filter(Boolean);
    try {
      if (parts.length === 2 && parts[1] === "projects") {
        if (req.method === "GET") return json(res, 200, { projects: store.listProjects(OWNER) });
        if (req.method === "POST") {
          const input = await readBody(req);
          const now = new Date().toISOString();
          const project = { schemaVersion: 1, id: randomUUID(), ownerId: OWNER,
            createdAt: now, updatedAt: now, domainPack: "product-decision", title: titleOf(input.title) };
          store.putProject(project);
          return json(res, 201, { project });
        }
      }
      const projectId = parts[2];
      if (parts[1] === "projects" && projectId) {
        const project = store.getProject(OWNER, projectId);
        if (!project) return json(res, 404, { error: "Project not found" });
        if (parts.length === 3) {
          if (req.method === "PATCH") {
            const input = await readBody(req);
            return json(res, 200, { project: store.updateProject(OWNER, projectId, titleOf(input.title)) });
          }
          if (req.method === "DELETE") return json(res, 200, { deleted: store.deleteProject(OWNER, projectId) });
        }
        if (parts.length === 4 && parts[3] === "runs") {
          if (req.method === "GET") return json(res, 200, { runs: store.listRuns(OWNER, projectId) });
          if (req.method === "POST") return json(res, 201, { run: saveQuickRun(store, projectId, await readBody(req)) });
        }
        if (parts.length === 4 && parts[3] === "claims" && req.method === "GET")
          return json(res, 200, { claims: flagConflicts(store.listClaims(OWNER, projectId)) });
        if (parts.length === 5 && parts[3] === "claims") {
          if (req.method === "PATCH") {
            const input = await readBody(req);
            const claim = store.updateClaim(OWNER, projectId, parts[4], input);
            return claim ? json(res, 200, { claim })
              : json(res, 404, { error: "Claim not found" });
          }
          if (req.method === "DELETE")
            return json(res, 200, { deleted: store.deleteClaim(OWNER, projectId, parts[4]) });
        }
        if (parts.length === 6 && parts[3] === "sources" &&
            parts[5] === "extract" && req.method === "POST") {
          const record = store.getSource(OWNER, projectId, parts[4]);
          if (!record) return json(res, 404, { error: "Source not found" });
          const claims = store.putClaims(OWNER, projectId,
            proposeClaims(record.source, record.parsed));
          return json(res, 200, { claims: flagConflicts(claims) });
        }
        if (parts.length === 4 && parts[3] === "sources") {
          if (req.method === "GET") return json(res, 200, { sources: store.listSources(OWNER, projectId) });
          if (req.method === "POST") {
            const input = await readBody(req);
            const parsed = parseSource(input);
            const source = makeSource(OWNER, projectId, input.filename, parsed);
            return json(res, 201, { source: store.putSource(OWNER, projectId, source, parsed) });
          }
        }
        if (parts.length === 5 && parts[3] === "sources") {
          const sourceId = parts[4];
          if (req.method === "GET") {
            const record = store.getSource(OWNER, projectId, sourceId);
            return record ? json(res, 200, record) : json(res, 404, { error: "Source not found" });
          }
          if (req.method === "DELETE")
            return json(res, 200, { deleted: store.deleteSource(OWNER, projectId, sourceId) });
        }
        if (parts.length === 4 && parts[3] === "clone" && req.method === "POST") {
          const copy = { ...project, id: randomUUID(), title: project.title + " copy",
            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
          store.putProject(copy);
          return json(res, 201, { project: copy });
        }
      }
      if (parts.length === 3 && parts[1] === "saved-runs" && req.method === "GET") {
        const run = store.getRun(OWNER, parts[2]);
        if (!run) return json(res, 404, { error: "Run not found" });
        return json(res, 200, { run,
          events: store.readEvents(OWNER, run.id, { limit: 100 })
            .map((event) => event.payload.quickEvent) });
      }
      if (parts.length === 3 && parts[1] === "saved-runs" && req.method === "DELETE")
        return json(res, 200, { deleted: store.deleteRun(OWNER, parts[2]) });
      return json(res, 405, { error: "Unsupported action" });
    } catch (error) {
      return json(res, 400, { error: error.message === "Unexpected end of JSON input"
        ? "Expected a JSON body" : error.message });
    }
  };
}
