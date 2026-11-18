import { DurableObject } from "cloudflare:workers";
import { SqliteEventStoreCore } from "../server/storage/eventStore.mjs";
import { SqliteJobQueue } from "../server/jobs/queue.mjs";
import { createProjectApi } from "../server/projects/api.mjs";
import { createSimulationApi } from "../server/simulation/api.mjs";
import { createTickExecutor } from "../server/simulation/runner.mjs";
import { workOne } from "../server/jobs/worker.mjs";
import { DurableSqliteAdapter } from "./durableSqlite.mjs";
import { handleJsonApi } from "./nodeApi.mjs";
import { browserWorkspace, validWriteOrigin, privateRoute } from "./session.mjs";

export class RippleWorkspace extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.store = new SqliteEventStoreCore(new DurableSqliteAdapter(ctx.storage));
    this.queue = new SqliteJobQueue(this.store);
    this.projects = createProjectApi(this.store);
    this.simulation = createSimulationApi(this.store, this.queue);
    this.executeTick = createTickExecutor({
      store: this.store,
      getScenario: async (ownerId, id) => {
        const scenario = this.store.getScenario(ownerId, id);
        if (!scenario) throw new Error("Scenario not found");
        return scenario;
      }
    });
  }

  async fetch(request) {
    const path = new URL(request.url).pathname;
    const scenario = /^\/api\/projects\/[^/]+\/scenarios(?:\/|$)/.test(path);
    const simulation = scenario || path.startsWith("/api/simulation-jobs/") ||
      path.startsWith("/api/simulation-runs/");
    const result = await handleJsonApi(simulation ? this.simulation : this.projects, request);
    if (result.status === 201 && request.method === "POST" &&
        /^\/api\/projects\/[^/]+\/scenarios\/[^/]+\/runs$/.test(path)) {
      await this.ctx.storage.setAlarm(Date.now() + 200);
    }
    return result;
  }

  async alarm() {
    try {
      await workOne(this.queue, "cf-workspace", this.executeTick, {
        leaseMs: 30_000
      });
    } catch (error) {
      console.error("[ripple] simulation worker failed", error?.message);
    } finally {
      const pending = this.store.db.prepare(
        "SELECT COUNT(*) AS count FROM jobs WHERE status IN ('queued','running')"
      ).get().count;
      if (pending) await this.ctx.storage.setAlarm(Date.now() + 1_000);
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/_health") {
      return Response.json({ status: "ok", backend: "cloudflare-durable-sqlite" }, {
        headers: { "Cache-Control": "no-store" }
      });
    }
    if (!privateRoute(url.pathname)) return Response.json({ error: "Not found" }, { status: 404 });
    if (!env.RIPPLE_WORKSPACE || !env.RIPPLE_SESSION_SECRET) {
      return Response.json({ error: "Backend not configured" }, { status: 503 });
    }
    if (!validWriteOrigin(request, env.PUBLIC_ORIGIN)) {
      return Response.json({ error: "Invalid request origin" }, { status: 403 });
    }
    try {
      const workspace = await browserWorkspace(request, env.RIPPLE_SESSION_SECRET);
      const id = env.RIPPLE_WORKSPACE.idFromName("v1:" + workspace.id);
      const response = await env.RIPPLE_WORKSPACE.get(id).fetch(request);
      if (!workspace.cookie) return response;
      const headers = new Headers(response.headers);
      headers.append("Set-Cookie", workspace.cookie);
      headers.set("Cache-Control", "no-store");
      return new Response(response.body, { status: response.status, headers });
    } catch (error) {
      console.error("[ripple] backend error", error?.message);
      return Response.json({ error: "Internal error" }, {
        status: 500, headers: { "Cache-Control": "no-store" }
      });
    }
  }
};
