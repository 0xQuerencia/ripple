# Ripple: project instructions

Type a what-if; Gemma 4 draws a map of how it could ripple through the world. Read `README.md` for the product and `docs/NOTES.md` before touching the stream, the map or the server.

## Commands

- `npm run dev` runs the app and API together. `npm test` (no network) and `npm run test:browser` (offline demo, port 5179) must pass before you finish.
- `npm run build` must succeed. `npm run sprites` re-renders the pixel sprites. `npm run format` runs prettier.

## Implementation style

- First inspect the repository instructions, README, scripts, and nearby code. Follow the existing project architecture and naming.
- Keep modules organized by responsibility. Here: `shared/` (rules both sides use), `server/` (API and Gemma client), and `src/` grouped by area (`map/`, `ask/`, `notes/`, `run/`, `ui/`). Put new code in the area that owns the behaviour.
- Use explicit types at important boundaries. The repo is plain JavaScript, so write JSDoc typedefs in `shared/types.js` rather than adding a type system. Values are `camelCase`; components `PascalCase`.
- Keep functions focused and errors actionable. Explain non-obvious behaviour and invariants in comments (the why); do not narrate obvious code.
- Prefer a small working design with clear interfaces over a large framework or speculative abstraction.
- Use the design tokens in `src/styles/tokens.css`. Never repeat a raw colour in another stylesheet. Keep one motif (the ripple) and clear empty, loading and error states.
- Keep the README product-first: one-sentence pitch, preview near the top, concrete features, an accurate quick start, then architecture.
- Use the existing verification commands. Do not claim checks that were not run.
- Before finishing, review the diff for correctness, dead code, inaccurate docs, responsive behaviour, and reduced-motion support when animation is used.

## Rules specific to this repo

- **Gemma's output is untrusted.** Everything it says goes through `createRippleBuilder` (`shared/ripple.mjs`). It guarantees structure, not facts, so the interface must keep calling effects possibilities.
- **Never commit `.env` or a real key.** The key lives only on the server.
- **The offline demo must never pretend to be Gemma.** Keep `mode` and the on-screen notice honest.
- **Do not change the look without being asked.** Refactors must leave screenshots unchanged.
