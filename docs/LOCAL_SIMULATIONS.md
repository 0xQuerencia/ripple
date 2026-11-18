# Local simulation guide

The experimental decision lab is a local-only feature, not a hosted forecast service.

## Setup

Use Node.js 22 or newer. Run `npm ci`, then `npm run dev`. Open the **localhost** address Vite prints. Do not expose the development server to the internet.

Under **Projects**:
1. Create a named project.
2. Attach small TXT, Markdown or CSV files if you have relevant facts. Files must be 128 KB or less, with up to 50 distinct files and 5 MB total per project.
3. Extract candidate claims and **review** them. Source material is data, not instructions. Edited claims are user assumptions, not automatically verified facts.

Under **Simulation**:
1. Pick the project and describe your real choice.
2. Enter a current price, budget, customer-segment counts and observed historical churn rates.
3. Enter two alternatives, including how much of the base you want to roll out to.
4. Save a scenario and run a baseline and one or both interventions.
5. Inspect the timeline, pixel graph, agent observations and rejected actions.
6. Compare completed runs. Fork the last saved checkpoint to adjust an assumption.
7. Prepare a report, verify provenance labels and export Markdown or JSON.

Each simulation is bounded to **1–12 rounds and up to 19 customer segments plus the company**. The default agent behavior uses deterministic rules, not live LLM agents. Each action is validated and applied by a reducer. These simulations are still hypothetical.

## Privacy and cost

- All project/source/simulation endpoints require loopback access and a localhost Host header. They are not authenticated public APIs.
- Evidence files and claims are stored in the local SQLite file; no uploaded document is sent to an outside model in Simulation mode.
- Quick Ripple is separate. With `GEMINI_API_KEY` enabled, its question text is sent to the Gemini API; without a key it runs an offline demo.
- Rule-based simulations use **zero model calls**. The UI displays that fact instead of inventing a cost estimate.
- A single machine's local file is **not multi-tenant storage**. Do not put several unrelated people's private data in the same local installation.
- Deleting a project removes its stored sources, claims, scenarios and runs through SQLite project relationships. Export reports separately if you want to keep them.

## SQLite, backup and recovery

By default the database is `./ripple-local.sqlite`; it may have `-wal` and `-shm` companion files. Override with `RIPPLE_DB_PATH=/absolute/writable/path/ripple.sqlite`.

Before upgrading or changing storage paths, stop all running Ripple dev/server processes, then copy the database to a safe location. For an **online** backup on systems with the SQLite CLI installed, use SQLite's consistent backup command:

```sh
sqlite3 ./ripple-local.sqlite ".backup './ripple-backup.sqlite'"
```

Test that the copied database opens before relying on it. To restore a stopped local instance, make a separate copy of its existing database, replace the configured SQLite file with your verified backup, then restart Ripple.

The local event store checkpoints each committed simulation round. A new worker can recover a leased job without applying already committed events twice. Do not manually edit event tables or checkpoint hashes.

SQLite tables are currently additive and versioned. More invasive future schema changes will require explicit migrations and backup testing; `CREATE TABLE IF NOT EXISTS` is not a universal migration system.

## Docker, Vercel and hosting

The public Vercel deployment supports Quick Ripple. Its function runtime is not a 30-minute simulation worker. Docker Compose keeps the container read-only and sets `RIPPLE_DB_PATH=:memory:` for Quick Ripple, so it does **not** provide persistent project history. See [deploying Quick Ripple](DEPLOY.md).

**Do not** expose local project endpoints through a proxy, tunnel or public domain. A hosted edition will need authenticated owners, private object storage, persistent PostgreSQL, an independent worker, distributed quotas, backups and security integration tests.

## Interpreting results

- `observed`: a source-supplied statement with a reference, still subject to your review.
- `assumption`: a parameter you supplied or edited.
- `derived`: an explicit computation (the first pricing pack holds historical churn fixed).
- `agent-belief`: an internal simulated view, not a fact.
- `simulated-event`: something that happened in one particular simulated run.
- `hypothesis`: a possible connection that has not been verified.

A simulation is a decision-rehearsal tool, **not** a calibrated probability model. Use its questions and failure paths to plan a real pilot, research missing assumptions and consider alternatives.
