# Hosted Ripple

The public interface stays on Vercel at [ripple.querencia.art](https://ripple.querencia.art). The original pixel-art interface and Quick Ripple API are unchanged.

The experiment's project history, evidence, scenarios, simulation jobs and reports are routed to the [Cloudflare backend](./CLOUDFLARE.md) at `ripple-api.querencia.art`. The backend uses a signed browser workspace cookie and isolated SQLite-backed Durable Objects.

**Important:** This is an experimental browser workspace, **not an account**. Clearing the browser cookie removes access to previous projects. Simulations remain hypotheses and need real-world calibration; saved data isn't backed up to a second provider.

When deploying the Vercel frontend, keep all five API rewrites in `vercel.json` and check the Cloudflare backend health and session persistence before promoting the deployment.
