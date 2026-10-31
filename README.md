# ripple!

Type any "what if" and Gemma 4 draws a map of how it could spread through the world.

**Try it: [ripple.querencia.art](https://ripple.querencia.art)**

![Typing a question into the big box](artifacts/world-desktop.png)
![Gemma thinking, with a timer and each effect as it's written](artifacts/thinking-desktop.png)
![The finished map](artifacts/ripple-desktop.png)

Made for the MLH Hack Day, for the Best Use of Gemma 4 and Best Open-Source AI Project challenges.

I wanted an answer to "what would happen if..." that isn't a wall of text. So you type a question, and instead of a paragraph you get a map: your question in the middle, and rings of knock-on effects spreading out from it. Every effect says who feels it, how soon, and how sure the model is. Click one and you can trace the path back to where it started.

It began with a fixed map of 12 systems (power, water, transport and so on). That fell over the first time I typed something it wasn't built for, like "hackers die". Now Gemma draws a new map for every question, and the code only checks that the map is well-formed.

## Run it yourself

You need Node 22 or newer. A free [Gemini API key](https://aistudio.google.com/apikey) gets you the real thing.

```sh
npm ci
cp .env.example .env   # put your key in GEMINI_API_KEY
npm run dev            # open the address Vite prints
```

No key? It still runs, but with a small fixed map that's much dumber, and the screen says so.

## How it works

The browser asks a small Node server, and the server asks Gemma 4 for one JSON line per node. Those get streamed straight back, so the map grows while Gemma is still writing. The first effect shows up after about 3 seconds, and a full ripple takes around 40.

Every line is checked before it reaches the screen (`shared/ripple.mjs`). An effect has to follow from a node that already exists, nothing can repeat, text gets trimmed, and the whole thing is capped at 28 nodes over 5 rounds. That keeps the map tidy and traceable. What it can't do is tell you whether Gemma is right, so treat everything as a maybe.

Gemini returns the odd 500, so the server retries, switches to the bigger Gemma on the last try, and only then falls back to the demo.

If you want the details, the stream format is in `shared/types.js` and the reasons behind the odd decisions are in [`docs/NOTES.md`](docs/NOTES.md).

## Working on it

```sh
npm test               # unit tests, no network needed
npm run test:browser   # Chromium tests, run against the demo mode
npm run build
```

`shared/` is logic used by both the server and the browser, `server/` is the API and the Gemma client, and `src/` is the interface (split into `map`, `ask`, `notes`, `run` and `ui`).

## Deploying

There's no database. I run it on Vercel: import the repo, add `GEMINI_API_KEY`, point a CNAME at it. There's also a Dockerfile if you'd rather host it yourself. Both are in [`docs/DEPLOY.md`](docs/DEPLOY.md).

## Credits

The 12-system starter map, the first validator and the canned demo effects came from the project spec I was given. Everything else was built for this.

It uses React, React Flow and Vite. The pixel sprites are rendered from [Phosphor Icons](https://phosphoricons.com/) (MIT). The font is [augiepixel](https://jamegam.hackclub.com/fonts/augiepixel.ttf) by Augie Ruben, which is free to use, so thanks. The look is inspired by [jame gam](https://jamegam.hackclub.com/) from Hack Club. I didn't use any of its art or code, and I'm not affiliated with them.

I used AI coding tools (Claude Code) while building this.

## License

MIT
