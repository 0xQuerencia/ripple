# ripple!

**Little causes, big consequences.** Drop a cause onto a map of 12 connected systems and watch **Gemma 4** reason about how it could spread, one link at a time.

![Ripple, ready to play](artifacts/world-desktop.png)
![A ripple spreading, reasoned by Gemma 4](artifacts/ripple-desktop.png)

Built for MLH: **Best Use of Gemma 4** (Gemini API) and **Best Open-Source AI Project** (MIT licensed).

## How it works

1. You pick a cause (a power outage, a drought, a new invention) or type your own what-if, and drop it on a system.
2. The server asks Gemma 4 (`gemma-4-26b-a4b-it` by default) to follow the map's real links for up to three rounds, and streams the answer back line by line, so the ripple grows on screen while Gemma is still writing.
3. **Every effect is checked before you see it.** The model can only use the 26 real links in `shared/world.mjs`, one round at a time, never revisiting a system (`createChainBuilder` in `shared/engine.mjs`). It cannot invent a connection. Text and enum fields are length-bounded.
4. Anything is a *possibility*, never a prediction, and each note says how sure Gemma is. Tap a note to trace it back, hop by hop, to the cause that began it.
5. If there is no API key or Gemma is unreachable, the app falls back to a fixed offline demo engine **and says so** in the interface.

Your custom text is sent to Gemma as quoted data with instructions to ignore any commands inside it. Whatever comes back still has to pass the graph check.

## Run it

Needs Node.js 22 or later.

```sh
npm ci
cp .env.example .env     # then paste your key from https://aistudio.google.com/apikey
npm run dev              # http://localhost:5173
```

The key stays on the server (`server/`) and is never sent to the browser. Without a key everything still works in offline demo mode.

```sh
npm run build            # production files in dist/
npm start                # serve dist/ and the API together (PORT, default 8787)
npm test                 # engine, scenario, Gemma client and API tests (no network)
npm run test:browser     # Chromium interaction tests (offline demo engine, port 5179)
npm run sprites          # regenerate the pixel-art sprites from scripts/glyphs.js
```

## Project map

- `shared/world.mjs`: the 12 systems, 26 directed links and six preset causes.
- `shared/engine.mjs`: effect validation, the streaming chain builder, and the offline demo engine.
- `shared/scenario.mjs`: replayable event snapshots and ancestry tracing.
- `server/gemma.mjs`: prompt, streaming Gemini API client, line-by-line parsing.
- `server/api.mjs`: `/api/ripple` (NDJSON stream) and `/api/status`; input validation, body limit, rate limit.
- `server/index.mjs`: production server with security headers.
- `src/`: the React interface (`components/`, `hooks/useRipple.js`, `styles/`).
- `scripts/`: the sprite pipeline.

## Disclosure and credits

- **Existing work:** the world data (`shared/world.mjs`), the effect validator, the canned demo effects and the first engine tests come from the project's supplied master spec. Everything else in this repository was written for this project: the Gemma integration, the streaming server, the chain validation, the interface and its tests.
- **Models and libraries:** Gemma 4 through the Gemini API (`@google/genai` is not used; the server calls the REST API directly), [React](https://react.dev/) and [React Flow](https://reactflow.dev/) (MIT), [Vite](https://vite.dev/) (MIT).
- **Font:** [augiepixel](https://jamegam.hackclub.com/fonts/augiepixel.ttf), drawn by Augie Ruben and offered free to use for anything without credit or permission. Credit given anyway, thank you.
- **Visual inspiration:** the look (soft pixel handwriting, doodles, salmon annotations, rainbow haze) is inspired by [jame gam by Hack Club](https://jamegam.hackclub.com/). No artwork or code from that site is used; the sprites here are generated from this repository's own vector drawings. This project is not affiliated with Hack Club.
- **AI-assisted development:** this project was built with Claude Code and the [Impeccable](https://github.com/pbakaus/impeccable) design skill (Apache-2.0).

Ripple is a toy model of possibilities. It is not a forecasting tool.

## License

MIT, see [LICENSE](LICENSE).
