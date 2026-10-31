# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: hackathon judges and demo viewers (MLH, Best Open-Source AI Project and Best Use of Gemma 4) who see Ripple for the first time, live, for about two minutes. They need to understand what it is, and want to be delighted, within the first ten seconds. Secondary (inferred, unconfirmed): curious students and general visitors who open the public repository afterwards.

## Product Purpose
Ripple is an interactive cause-and-effect playground. The user drops a small cause (a power outage, a drought, a new invention, or free text) onto a map of 12 connected real-world systems, and Gemma 4 (through the Gemini API) reasons about how the effect could spread through the connections, round by round. Success: a judge sees a ripple travel across the map, reads Gemma's plain-language reasoning for each hop, and can trace any consequence back to its origin.

## Positioning
The consequences are not free-form chatbot text. Every effect Gemma proposes is checked against a fixed graph of 12 systems and 26 links, so it can only follow a real connection, never skip one, and is always labelled a possibility, not a prediction. The result is an explorable, auditable model of a world rather than an answer in a chat box.

## Operating Context
Shown live on a laptop or projector at a hackathon booth or on a call, usually in a bright room. One session is a handful of drops. Open source (public GitHub repository with an open-source license is a competition requirement). Existing AI models and libraries are allowed as dependencies; any previous work must be disclosed.

## Capabilities and Constraints
- Stack in place: React 19, Vite, @xyflow/react, Node server.
- World and graph live in `shared/world.mjs` (12 systems, 26 directed links, 6 preset causes). The engine and validator live in `shared/engine.mjs`. These are canonical.
- AI: Gemma 4 via the Gemini API (`gemma-4-26b-a4b-it` by default, `gemma-4-31b-it` selectable). The API key stays on the server only (`GEMINI_API_KEY`, never in the client bundle or the repository).
- Gemma's output is untrusted: it is validated against the graph, bounded in length, and falls back to the deterministic demo engine if the API fails. The UI must always show honestly whether an effect came from Gemma or from the offline demo.
- Effects are possibilities with a stated certainty and severity, never predictions of real events.
- Custom what-if text is limited to 80 characters.

## Brand Commitments
Name: "ripple!" with the tagline "little causes, big consequences." Hand-made scrapbook spirit from the user's mockup (butterfly mark, hand-lettered notes, doodled systems). The user confirmed the direction "elevated scrapbook": keep the idea, build it with real craft. Confirmed visual references: the mockup at `~/Downloads/Ripple! Whimsical Cause-and-Effect World.png`, used as the starting point, not as a layout to copy.

## Evidence on Hand
No users, metrics or testimonials exist; none may be invented. The only real content is the world and graph in `shared/world.mjs`, the engine and tests, and live Gemma output.

## Product Principles
1. Show the mechanism at once: the first viewport is the working world, not a landing page.
2. Honest uncertainty: every consequence is labelled as possible, and the AI versus demo origin is always visible.
3. Traceable: any effect can be followed back, hop by hop, to the cause that began it.
4. Handmade, not decorated: the scrapbook character serves reading the graph and never gets in its way.
5. Works on stage: robust offline fallback, no dead states, fast to the first ripple.

## Accessibility & Inclusion
Inferred (unconfirmed): WCAG AA contrast, full keyboard path for dropping a cause (click-to-place as an alternative to drag), `prefers-reduced-motion` respected, no meaning carried by colour alone.
