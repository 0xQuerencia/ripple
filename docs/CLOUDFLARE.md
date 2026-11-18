# Cloudflare backend (no SSH server)

Ripple's current Vite site stays on Vercel. Projects, evidence, pricing scenarios, runs, checkpoints and reports run on a **Cloudflare Worker with one SQLite-backed Durable Object per browser workspace**.

The Worker is implemented in [workers/index.mjs](../workers/index.mjs). It shares the local event store, job queue and simulation engine. The Durable Object's alarm resumes queued simulation jobs. Quick Ripple's `/api/status` and `/api/ripple` stay on the existing Vercel API; only the project/simulation paths are proxied to Cloudflare.

## Persistence and privacy

- A random workspace ID is signed using the `RIPPLE_SESSION_SECRET` secret. The browser receives a `Secure`, `HttpOnly`, `SameSite=Lax` cookie. A modified or missing cookie gets a **new, empty workspace**.
- Each workspace gets its **own Durable Object SQLite database**. One user's projects are never stored in another user's database.
- Mutation APIs check `Origin` and `Content-Type: application/json`; cross-site requests fail.
- No account login, email identity or cross-device synchronization yet. **Clearing browser cookies loses access to the old workspace.** Durable Object data still exists, but it is not recoverable by the browser without its signed cookie. Never use this pilot for irreplaceable data.
- Each project is limited to 50 evidence files/5 MB, and each workspace has a two-active-job cap, plus scenario/run limits from the local engine.

## Cloudflare setup

1. Create the Worker `ripple-api` with `workers/index.mjs` as the main ES module and its relative imports, `nodejs_compat` enabled, and a migration `new_sqlite_classes: ["RippleWorkspace"]`.
2. Bind Durable Object namespace `RIPPLE_WORKSPACE` to class `RippleWorkspace`.
3. Add secret `RIPPLE_SESSION_SECRET` with at least 32 unpredictable characters. **Never commit or print it.** 
4. Set plain-text variable `PUBLIC_ORIGIN=https://ripple.querencia.art`.
5. Attach the Worker to `ripple-api.querencia.art` as a custom domain. Do not move the existing public `ripple.querencia.art` CNAME.
6. Before changing Vercel routes, check `https://ripple-api.querencia.art/_health` and verify the project API returns a signed session cookie and persistent state.
7. Add only the project/simulation API rewrites in `vercel.json` and redeploy the Vite frontend from `main`. Read-only Quick Ripple routes stay on Vercel.

The Worker can also be tested at a workers.dev subdomain before custom routing. Worker source is intentionally separate from the public static interface to avoid changing the original pixel design.

## Validation

```sh
npm ci
npm test
npm run build
npm run evaluate
node --check workers/index.mjs
```

In addition to unit and browser tests, production validation must check signed cookie reuse, anonymous workspace isolation, state after a fresh Durable Object instance and browser reload, complete queued simulation runs with reports, rejecting cross-origin writes, and 429/413 abuse limits as appropriate.

## Limits

This is a free-plan-oriented pilot, not a verified forecasting engine or a production SaaS. Worker and Durable Object quotas apply. Keep API tokens and data private; add real accounts, recovery, abuse controls, job monitoring, historical calibration and billing safeguards before broad public adoption.
