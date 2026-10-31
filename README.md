# ripple!

**Little causes, big consequences.** Drop a cause onto a map of 12 connected systems and watch **Gemma 4** reason about how it could spread, one link at a time.

![Ripple, ready to play](artifacts/world-desktop.png)
![Gemma thinking live: a timer, the round, and each effect as it is written](artifacts/thinking-desktop.png)
![The finished ripple, with the big picture of what it touched](artifacts/ripple-desktop.png)

Built for MLH: **Best Use of Gemma 4** (Gemini API) and **Best Open-Source AI Project** (MIT licensed).

## How it works

1. You ask any what-if (up to 160 characters): the big box in the middle of the empty map is focused as soon as the page loads, so you can just start typing and press Enter. Or pick a sticker, or tap an example.
2. The server asks Gemma 4 (`gemma-4-26b-a4b-it` by default) to draw the ripple. Gemma invents the map for that question: a node for the cause, then up to 28 effects over 5 rounds, each with a name, an area of life, a pixel icon, who feels it, how soon, how sure it is, how big, and which earlier nodes it follows from.
3. The answer is streamed line by line, so the map grows on screen while Gemma is still writing, with a live panel showing a timer, the current round, how many things it has found, and each effect as it appears. The first effect shows after about 3 seconds; a big ripple takes 30 to 40.
4. **Every line is validated before you see it** (`createRippleBuilder` in `shared/ripple.mjs`): an effect must follow from a node that already exists in an earlier round, no node appears twice, rounds do not skip, the ripple stays within its size limits, and every text field and choice (area, icon, timeframe, certainty, severity) is length-bounded or checked against a fixed list. This guarantees the map is well-formed and traceable. **It cannot check the facts**, so everything is shown as a possibility, the notes say Gemma can be wrong, and harmful requests are refused.
5. Tap any node to see who feels it and how soon, trace how the ripple got there, or read the "big picture" of which areas of life it reached.
6. If there is no API key or Gemma is unreachable, the server retries (and tries the larger Gemma on the last attempt), then falls back to a fixed offline demo over a small known map **and says so** in the interface.

Your text is sent to Gemma as quoted data with instructions to ignore any commands inside it.

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
npm test                 # engine, ripple validator, layout, Gemma client and API tests (no network)
npm run test:browser     # Chromium interaction tests (offline demo engine, port 5179)
npm run sprites          # regenerate the pixel-art sprites from scripts/glyphs.js
```

## Project map

- `shared/ripple.mjs`: the validator for open-ended ripples (structure and bounds), plus limits.
- `shared/world.mjs`: the known baseline: 56 systems in 12 areas, 235 links, and ten preset causes.
- `shared/engine.mjs`: the offline demo engine over the known map.
- `shared/icons.mjs`: the 178 icons Gemma may pick for nodes it invents.
- `shared/scenario.mjs`: replayable event snapshots and ancestry tracing.
- `server/gemma.mjs`: prompt, streaming Gemini API client, line-by-line parsing.
- `server/api.mjs`: `/api/ripple` (NDJSON stream) and `/api/status`; input validation, body limit, rate limit, retries.
- `server/index.mjs`: production server with security headers.
- `src/`: the React interface (`components/`, `hooks/useRipple.js`, `lib/layout.js`, `lib/stats.js`, `styles/`).
- `scripts/`: the sprite pipeline (renders 250+ pixel sprites from the Phosphor icon set).

## Disclosure and credits

- **Existing work:** the world data (`shared/world.mjs`), the effect validator, the canned demo effects and the first engine tests come from the project's supplied master spec. Everything else in this repository was written for this project: the Gemma integration, the streaming server, the chain validation, the interface and its tests.
- **Models and libraries:** Gemma 4 through the Gemini API (`@google/genai` is not used; the server calls the REST API directly), [React](https://react.dev/) and [React Flow](https://reactflow.dev/) (MIT), [Vite](https://vite.dev/) (MIT), and [Phosphor Icons](https://phosphoricons.com/) (MIT) as the source of the pixel sprites (dev dependency).
- **Font:** [augiepixel](https://jamegam.hackclub.com/fonts/augiepixel.ttf), drawn by Augie Ruben and offered free to use for anything without credit or permission. Credit given anyway, thank you.
- **Visual inspiration:** the look (soft pixel handwriting, doodles, salmon annotations, rainbow haze) is inspired by [jame gam by Hack Club](https://jamegam.hackclub.com/). No artwork or code from that site is used; the sprites here are generated from this repository's own vector drawings and the Phosphor icon set. This project is not affiliated with Hack Club.
- **AI-assisted development:** this project was built with Claude Code and the [Impeccable](https://github.com/pbakaus/impeccable) design skill (Apache-2.0).

Ripple is a toy for thinking about possibilities. Gemma can be wrong. It is not a forecasting tool.

## License

MIT, see [LICENSE](LICENSE).
