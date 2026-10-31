import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError, streamRipple } from "../lib/rippleClient.js";
import { guessOrigin } from "../../shared/engine.mjs";

const REVEAL_GAP_MS = 750;
const REPLAY_GAP_MS = 850;
const prefersReducedMotion = () =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const IDLE = {
  runId: null,
  status: "idle",
  mode: null,
  model: null,
  notice: "",
  summary: "",
  events: [],
  cursor: 0,
  live: true,
  replaying: false,
  startedAt: 0,
};

/** Link each effect to the earlier event that created the node it follows from. */
function withParent(events, effect, id) {
  const parent = [...events]
    .reverse()
    .find((e) => e.targetId === effect.sourceId);
  return { ...effect, id, parentEventId: parent?.id ?? events[0]?.id ?? null };
}

function reducer(state, action) {
  switch (action.type) {
    case "begin": {
      const { runId, cause, now } = action;
      // The cause is on the board straight away; Gemma says where it belongs a moment later.
      const first = {
        id: `${runId}-0`,
        parentEventId: null,
        sourceId: null,
        targetId: cause.target ?? null,
        round: 0,
        name: cause.title,
        area: "society",
        icon: "sparkle",
        known: false,
        title: cause.title,
        explanation: cause.description ?? "",
        who: "",
        alsoFrom: [],
      };
      return {
        ...IDLE,
        runId,
        startedAt: now,
        status: "streaming",
        events: [first],
        cursor: 1,
      };
    }
    case "start": {
      const [first, ...rest] = state.events;
      const { origin } = action;
      const placed = {
        ...first,
        targetId: origin.targetId,
        name: origin.name,
        area: origin.area,
        icon: origin.icon,
        known: origin.known,
        explanation: origin.description || first.explanation,
      };
      return {
        ...state,
        mode: action.mode,
        model: action.model ?? null,
        notice: action.notice ?? "",
        events: [placed, ...rest],
      };
    }
    case "effect": {
      const event = withParent(
        state.events,
        action.effect,
        `${state.runId}-${state.events.length}`,
      );
      const events = [...state.events, event];
      return {
        ...state,
        events,
        cursor: state.live ? events.length : state.cursor,
      };
    }
    case "summary":
      return { ...state, summary: action.text };
    case "done":
      return { ...state, status: "done" };
    case "fail":
      return { ...state, status: state.events.length > 1 ? "done" : "idle" };
    case "scrub":
      return { ...state, cursor: action.cursor, live: false, replaying: false };
    case "replay":
      return {
        ...state,
        cursor: state.cursor >= state.events.length ? 1 : state.cursor,
        live: false,
        replaying: true,
      };
    case "pause":
      return { ...state, replaying: false, live: false };
    case "tick": {
      const cursor = Math.min(state.cursor + 1, state.events.length);
      return { ...state, cursor, replaying: cursor < state.events.length };
    }
    case "reset":
      return IDLE;
    default:
      return state;
  }
}

/**
 * One ripple at a time. `begin` streams a run from the server; events are released one by one so the
 * ripple visibly grows, even when the offline demo returns everything at once.
 */
export function useRipple({ onProblem }) {
  const [state, dispatch] = useReducer(reducer, IDLE);
  const abort = useRef(null);
  const queue = useRef([]);
  const timer = useRef(null);

  const clearRun = useCallback(() => {
    abort.current?.abort();
    clearTimeout(timer.current);
    timer.current = null;
    queue.current = [];
  }, []);

  const drain = useCallback(() => {
    if (timer.current) return;
    const next = queue.current.shift();
    if (!next) return;
    dispatch(next);
    timer.current = setTimeout(
      () => {
        timer.current = null;
        drain();
      },
      next.type === "effect" && !prefersReducedMotion() ? REVEAL_GAP_MS : 0,
    );
  }, []);

  const begin = useCallback(
    async ({ cause }) => {
      clearRun();
      const controller = new AbortController();
      abort.current = controller;
      const runId = crypto.randomUUID();
      dispatch({ type: "begin", runId, cause, now: Date.now() });

      const api = cause.id
        ? { causeId: cause.id }
        : { text: cause.title, tone: cause.tone };
      const local = {
        targetId: cause.target ?? guessOrigin(cause.title),
        text: cause.title,
        description: cause.description,
        tone: cause.tone,
      };
      try {
        await streamRipple(
          { api, local },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (event.type === "refused") {
                clearRun();
                dispatch({ type: "reset" });
                onProblem(event.message);
                return;
              }
              queue.current.push(event);
              drain();
            },
          },
        );
      } catch (error) {
        if (controller.signal.aborted) return;
        dispatch({ type: "fail" });
        onProblem(
          error instanceof ApiError
            ? error.message
            : "Something went wrong. Try again.",
        );
      }
    },
    [clearRun, drain, onProblem],
  );

  useEffect(() => {
    if (!state.replaying) return undefined;
    const id = setTimeout(
      () => dispatch({ type: "tick" }),
      prefersReducedMotion() ? 0 : REPLAY_GAP_MS,
    );
    return () => clearTimeout(id);
  }, [state.replaying, state.cursor]);

  useEffect(() => clearRun, [clearRun]);

  const reset = useCallback(() => {
    clearRun();
    dispatch({ type: "reset" });
  }, [clearRun]);
  const scrub = useCallback(
    (cursor) => dispatch({ type: "scrub", cursor }),
    [],
  );
  const step = useCallback(() => dispatch({ type: "tick" }), []);
  const togglePlay = useCallback(
    () =>
      dispatch({
        type:
          state.replaying || state.status === "streaming" ? "pause" : "replay",
      }),
    [state.replaying, state.status],
  );

  return { state, begin, reset, scrub, step, togglePlay };
}
