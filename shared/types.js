// The shapes that cross a boundary: from Gemma to the server, from the server to the browser, and
// into the interface. Plain JSDoc typedefs, so there is no build step: editors show them on hover,
// and any file can borrow one with  @param {import("../shared/types.js").RippleEffect} effect
// Keep this file in step with shared/ripple.mjs (which produces these shapes) and docs/NOTES.md.

/** @typedef {"negative" | "positive"} Tone */
/** @typedef {"likely" | "possible" | "speculative"} Certainty */
/** @typedef {"low" | "medium" | "high"} Severity */
/** @typedef {"hours" | "days" | "weeks" | "months" | "years"} Timeframe */

/**
 * One thing on the map. `key` is a short slug unique within a ripple. When `known` is true the name,
 * area and icon come from the baseline map in world.mjs, not from the model.
 * @typedef {Object} RippleNode
 * @property {string} key
 * @property {string} name        two to four words
 * @property {string} area        one of the area ids in world.mjs (DOMAINS)
 * @property {string} icon        a sprite id: a known system id, or one of shared/icons.mjs
 * @property {boolean} known
 */

/**
 * A node plus how it came about: what it follows from and how it matters. Every field has already
 * been checked and bounded by createRippleBuilder, so consumers can trust the shape (not the facts).
 * @typedef {RippleNode & {
 *   round: number,             1 = follows straight from the cause
 *   sourceId: string,          key of the node it follows from
 *   targetId: string,          its own key (same as `key`)
 *   alsoFrom: string[],        up to two more earlier nodes that also feed it
 *   title: string,             what happens, at most 70 characters
 *   explanation: string,       why it follows, at most 260 characters
 *   who: string,               who feels it, at most 80 characters
 *   timeframe: Timeframe,
 *   certainty: Certainty,
 *   severity: Severity,
 *   relation: string           only set by the offline demo engine
 * }} RippleEffect
 */

/**
 * The cause itself, as announced in the `start` event.
 * @typedef {Object} RippleOrigin
 * @property {string} targetId
 * @property {string} name
 * @property {string} area
 * @property {string} icon
 * @property {boolean} known
 * @property {string} title        what the visitor asked, in their own words
 * @property {Tone} tone
 * @property {string} description  one sentence on what happens first
 */

/**
 * The newline-delimited JSON that POST /api/ripple streams, in the order it arrives:
 * one `start`, many `effect`, at most one `summary`, then `done`. A request Gemma declines sends
 * a single `refused` and nothing else. `mode` says who drew the map, and is never faked: "demo"
 * means the offline engine, not Gemma.
 * @typedef {(
 *   | { type: "start", mode: "gemma" | "demo", model: string | null, notice?: string, origin: RippleOrigin }
 *   | { type: "effect", effect: RippleEffect }
 *   | { type: "summary", text: string }
 *   | { type: "done", partial?: boolean }
 *   | { type: "refused", message: string }
 * )} StreamEvent
 */

/**
 * What the interface keeps for each node: the effect (or the cause, at round 0) plus ids that let
 * it be traced back to where it began.
 * @typedef {RippleEffect & { id: string, parentEventId: string | null }} RippleEvent
 */

export {};
