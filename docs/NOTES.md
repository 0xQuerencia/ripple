# Project notes

Why things are the way they are, and the traps that cost time. Read this before changing the stream, the map or the server.

## The map is generated, not fixed

An early version drew every question on one fixed map of 12, then 56, systems. It looked tidy and failed the first time someone asked something we had not planned for ("the moon disappears"). So Gemma now invents the nodes and links for each question.

The cost: code can no longer check the facts against a list. What it can still guarantee is **structure** (`shared/ripple.mjs`): every effect follows from a node that exists in an earlier round, no node repeats, rounds do not skip, extra links point only at earlier nodes, size limits hold, and every string and enum is bounded. The interface says Gemma can be wrong. Do not rewrite that copy into something more confident.

The 56-system baseline in `shared/world.mjs` still earns its place. A key that matches a known system always gets that system's own name, area and picture, so presets look consistent, and the offline demo engine runs on it.

## The stream

`POST /api/ripple` returns newline-delimited JSON (`StreamEvent`, see `shared/types.js`). Gemma is asked for **JSON Lines**, one object per line, not one big JSON document. That is what lets the first effect appear after about 3 seconds instead of after the whole 30 to 40.

- **`start` is held back until the first valid effect.** If Gemma fails before producing anything, the server can still fall back to the demo with a clean `start`. Sending `start` early would make that impossible.
- **Retries only happen before anything has been shown.** After the first effect, a failure ends the ripple with `{ type: "done", partial: true }` rather than starting over underneath the visitor.
- **Retry policy.** 500s, 429s, dropped connections and empty answers are retried (3 attempts, the last on the *other* Gemma model). 400, 401, 403 and 404 are not: they mean a bad key or model name, and retrying only hides it.
- **A refusal is a refusal.** If Gemma declines, the server streams `refused` and does not fall back to the demo.

## Gemma 4 quirks

- Responses contain "thought" parts (`thought: true`). Only the other parts are the answer (`extractText`).
- `thinkingLevel: "minimal"` keeps latency acceptable. Raising it makes the first effect much slower.
- Server-sent events arrive in arbitrary chunks, and a chunk boundary can fall between `\r` and `\n`. Normalise the **whole buffer**, not each chunk, or the last events silently vanish (there is a test for this).
- The model almost never reuses the known-system ids, so do not count on the baseline map for much beyond presets.

## React Flow gotchas

- With controlled `nodes`, React Flow must be given its own measurements back (`useNodesState` + merging `measured`). Without that it cannot find any handle and **draws no edges, with no warning**.
- Handles sit at the centre of each node so a link runs from centre to centre. Nodes are not draggable and not focusable; the inner button is the keyboard target.
- Edge ids contain `>` (`source>target`). That is fine for React Flow but remember it when building selectors.

## Layout

`src/map/layout.js` places a node using only the events before it, so **a node never moves when later ones arrive**. The sideways "bend" is a fixed function of the event's position, not `Math.random()`, for the same reason. The camera follows the ripple until the visitor pans or zooms, and refits when the ripple finishes.

## Running it for real

- **Rate limits and proxies.** Behind a reverse proxy every connection comes from the proxy. `TRUSTED_PROXY_HOPS` says how many proxies to trust, and the visitor is the `X-Forwarded-For` entry that many places from the **right**. Anything further left is written by the client and is never used. Get the number wrong and either everyone shares one limit (too low) or anyone can dodge the limit by faking the header (too high).
- **One hourly budget across all visitors** (`GLOBAL_LIMIT_PER_HOUR`). Past it, questions get the offline demo with a notice, so a public URL cannot spend the whole Gemini quota.
- **Reverse proxies buffer by default**, which turns the live stream into one lump at the end. The server sends `X-Accel-Buffering: no`; Caddy needs `flush_interval -1` and nginx needs `proxy_buffering off`.
- **A ripple can take up to two minutes**, so proxy read timeouts of 60 seconds will cut it off.

## Motion and accessibility

Every animation stops under `prefers-reduced-motion`, and reduced motion also reveals effects instantly instead of one every 750 ms. Everything is reachable by keyboard: the ask box is focused on load, Enter sends, Shift+Enter adds a line, and each node is a real button.

## Sprites and assets

About 250 pixel sprites are rendered from vector drawings and the Phosphor icon set by `scripts/make-sprites.mjs`. Vite is told **not to inline** them (`assetsInlineLimit: 0`); inlining 250 images as data URIs doubled the JavaScript bundle. The wordmark font, augiepixel, is free to use for anything.

## Known limits

- A ripple takes 30 to 40 seconds.
- Big ripples have small nodes at the default zoom. The notes column lists everything in full.
- The offline demo only knows the baseline map, so it cannot answer open questions meaningfully. It says so on screen.
- Questions are capped at 160 characters.
