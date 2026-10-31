# ripple! 🦋

**Little causes, big consequences.** A playful, scrapbook-style world for exploring how one small change can travel through connected systems.

![Ripple world](artifacts/world-desktop.png)

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm run dev
```

Open the address Vite prints. It chooses the next free port if 5173 is occupied. In this workspace the preview runs at **http://127.0.0.1:5174**.

```sh
npm run build        # production files in dist/
npm run preview      # serve the production build
npm test             # deterministic engine and scenario tests
npm run test:browser  # Chromium interaction tests
```

For a fresh browser test setup, run `npx playwright install chromium` first.

## Play

1. Click a cause sticker, then its matching system, or drag the sticker directly onto the system.
2. Watch possible consequences unfold through up to three rounds. Pause, step forward, or rewind with the playback bar.
3. Click any system for field notes. Click a consequence to see its exact ancestry and highlight that path in the world.
4. Read the same sequence in **timeline**. In **compare**, pin one experiment, reset, and run another to compare their effects.
5. For a custom what-if, select a system, type a cause, choose a disruption or a good thing, and try it.

The world supports dragging, panning, zooming, and fit-to-screen. System buttons work with the keyboard, the layout adapts to smaller screens, and reduced-motion mode reveals scenario effects immediately.

## What is implemented

- The canonical 12 systems, 26 directed connections, and six cause stickers.
- Compatible cause targets, validated deterministic effects, and unique parent event IDs.
- Replayable scenario snapshots with pause, step, rewind, and reset.
- Node details, causal path highlighting, timeline, and session-scoped experiment comparison.
- Locally hosted handwritten and body fonts, pastel stickers, paper details, and botanical accents.

**DEMO · no AI:** All effects are fixed examples from the supplied starter engine. Custom text labels an experiment; the app does not interpret its meaning. Positive scenarios follow the same graph with conditional benefit text. This is a simplified model of possibilities, not a real-world prediction tool.

Pinned experiments last for the current page session. They do not persist through a reload. Comparison shows two independently generated experiments from the same seeded world; it does not implement mid-scenario interventions.

Live Gemma integration, new AI-proposed edges, numerical resource simulation, and Graphify indexing are future work. Graphify is developer tooling; React Flow renders the player-facing graph.

## Project map

- `shared/world.mjs` — systems, directed dependencies, and cause inventory.
- `shared/engine.mjs` — bounded effect validation and deterministic demonstration rules.
- `shared/scenario.mjs` — immutable event batches and parent-event ancestry.
- `src/App.jsx` — game state, world canvas, notebook, timeline, and comparison.
- `src/Art.jsx` — consistent Phosphor illustration vocabulary.
- `src/styles.css` — paper palette, type, layout, interaction, and responsive rules.
- `tests/` — engine, scenario, and browser coverage.
- `artifacts/` — captured desktop, mobile, and active-scenario screenshots.

Development scenario starts log a small diagnostic through `console.debug`; no user text or API credentials are logged.

## Credits and provenance

The initial world data, effect validator, canned effects, and five engine tests were restored from the code appendix in the user-supplied **RIPPLE_MASTER_SPEC_GRAPHIFY.md**. The supplied **Ripple! Whimsical Cause-and-Effect World** image guided the art direction. The interactive interface, scenario ancestry, playback, comparison, and additional tests were built in this repository. The reference image is not embedded as the interface.

Libraries and assets: [React](https://react.dev/) (MIT), [React Flow](https://reactflow.dev/) (MIT), [Phosphor Icons](https://phosphoricons.com/) (MIT), [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand) and [Nunito Sans](https://fonts.google.com/specimen/Nunito+Sans) (SIL Open Font License, self-hosted through Fontsource). Dependency distributions retain their license notices.

## More previews

[Active ripple and causal trace](artifacts/ripple-desktop.png) · [Mobile layout](artifacts/world-mobile.png)
