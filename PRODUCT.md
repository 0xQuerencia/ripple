# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: hackathon judges and demo viewers (MLH, Best Open-Source AI Project and Best Use of Gemma 4) who see Ripple for the first time, live, for about two minutes. They need to understand what it is, and want to be delighted, within the first ten seconds. Secondary (inferred, unconfirmed): curious students and general visitors who open the public repository afterwards.

## Product Purpose
Ripple is an interactive cause-and-effect explorer. A visitor asks any what-if (a preset, or anything they can type) and Gemma 4, through the Gemini API, draws a map of how it could ripple outward: what it touches, who feels it, how soon, and how sure the model is. Success: a judge asks something we never planned for, such as "the moon disappears", and watches a believable web of consequences grow on screen, then reads and traces any part of it.

## Positioning
A chat answer is a wall of text; Ripple is a map. Every question gets a brand new graph, with a picture for each node, links showing what follows from what, and a "big picture" of which areas of life it reached. Because the map is built by the model for each question rather than picked from a fixed list, it can answer anything. Because the structure is enforced in code (connected, no repeats, bounded), the map is always readable and traceable even when the model's content is imperfect.

## Operating Context
Shown live on a laptop or projector at a hackathon booth or on a call, usually in a bright room. One session is a handful of drops. Open source (public GitHub repository with an open-source license is a competition requirement). Existing AI models and libraries are allowed as dependencies; any previous work must be disclosed.

## Capabilities and Constraints
- Stack in place: React 19, Vite, @xyflow/react, Node server.
- AI: Gemma 4 via the Gemini API (`gemma-4-26b-a4b-it` by default, with `gemma-4-31b-it` as a fallback attempt). The API key stays on the server only (`GEMINI_API_KEY`, never in the client bundle or the repository). Gemma streams one JSON line per node and the interface draws each as it arrives.
- Gemma invents the nodes, links, areas and icons for each ripple, within fixed limits (5 rounds, 7 per round, 28 nodes). `shared/ripple.mjs` enforces the structure and bounds every field. The server cannot verify facts, so every effect is presented as a possibility and the interface says Gemma can be wrong.
- A known baseline of 56 systems and 235 links (`shared/world.mjs`) gives preset causes a consistent look and powers the offline demo fallback, which says it is not Gemma.
- Harmful requests are refused by Gemma and shown as a friendly message.
- Custom what-if text is limited to 80 characters. Requests are rate limited and the request body is capped.

## Brand Commitments
Name: "ripple!" with the tagline "little causes, big consequences." The user redirected the look to the soft pixel-handwriting style of jamegam.hackclub.com (near-white page, pixel handwriting font, chunky pixel doodles with dark outlines, salmon handwritten annotations, rainbow haze, grain). Inspired by, not copied from, that site; no artwork or code is reused, and the project is not affiliated with Hack Club. The earlier "elevated scrapbook" direction is superseded.

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
