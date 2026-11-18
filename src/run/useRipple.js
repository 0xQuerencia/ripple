import { useCallback, useEffect, useReducer, useRef } from "react";
import { ApiError, streamRipple } from "./rippleClient.js";
import { guessOrigin } from "../../shared/engine.mjs";

const REVEAL_GAP_MS = 750;
const REPLAY_GAP_MS = 850;
const prefersReducedMotion = () =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

const IDLE = {
  runId: null,
  status: "idle",
  jobStatus: "idle",
  presentationStatus: "paused",
  partial: false,
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
        jobStatus: "streaming",
        presentationStatus: "playing",
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
    case "job-finished":
      return { ...state, jobStatus: "done" };
    case "done":
      return {
        ...state,
        status: "done",
        jobStatus: action.cancelled ? "cancelled" : "done",
        partial: state.partial || Boolean(action.partial),
        presentationStatus: "paused",
        replaying: false,
      };
    case "fail":
      return {
        ...state,
        status: state.events.length > 1 ? "done" : "idle",
        jobStatus: "failed",
        presentationStatus: "paused",
        partial: state.events.length > 1,
      };
    case "scrub":
      return {
        ...state,
        cursor: Math.max(0, Math.min(action.cursor, state.events.length)),
        live: false,
        replaying: false,
        presentationStatus: "paused",
      };
    case "replay":
      return {
        ...state,
        cursor: state.cursor >= state.events.length ? 1 : state.cursor,
        live: false,
        replaying: true,
        presentationStatus: "replaying",
      };
    case "pause":
      return { ...state, replaying: false, live: false, presentationStatus: "paused" };
    case "resume":
      return { ...state, replaying: false, live: true, presentationStatus: "playing" };
    case "step":
      return {
        ...state,
        cursor: Math.min(state.cursor + 1, state.events.length),
        live: false,
        replaying: false,
        presentationStatus: "paused",
      };
    case "tick": {
      const cursor = Math.min(state.cursor + 1, state.events.length);
      return {
        ...state,
        cursor,
        replaying: cursor < state.events.length,
        presentationStatus: cursor < state.events.length ? "replaying" : "paused",
      };
    }
    case "restore":
      return {
        ...IDLE,
        ...action.run,
        status: "done",
        jobStatus: "done",
        presentationStatus: "paused",
        cursor: action.run.events.length,
        live: false,
      };
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
  const activeRun = useRef(null);
  const paused = useRef(false);
  const queue = useRef([]);
  const timer = useRef(null);

  const clearTimer = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const clearRun = useCallback(() => {
    activeRun.current = null;
    abort.current?.abort();
    abort.current = null;
    clearTimer();
    paused.current = false;
    queue.current = [];
  }, [clearTimer]);

  const drain = useCallback(function drainQueued() {
    if (paused.current || timer.current !== null) return;
    const next = queue.current.shift();
    if (!next) return;
    dispatch(next);
    timer.current = setTimeout(() => {
      timer.current = null;
      drainQueued();
    }, next.type === "effect" && !prefersReducedMotion() ? REVEAL_GAP_MS : 0);
  }, []);

  const begin = useCallback(
    async ({ cause }) => {
      clearRun();
      const controller = new AbortController();
      const runId = crypto.randomUUID();
      abort.current = controller;
      activeRun.current = runId;
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
      let started = false;
      let receivedDone = false;
      let refused = false;
      const enqueue = (event) => {
        queue.current.push(event);
        drain();
      };
      try {
        await streamRipple(
          { api, local },
          {
            signal: controller.signal,
            onEvent: (event) => {
              if (activeRun.current !== runId || controller.signal.aborted || receivedDone) return;
              if (event.type === "refused") {
                refused = true;
                clearRun();
                dispatch({ type: "reset" });
                onProblem(event.message);
                return;
              }
              if (event.type === "start") started = true;
              if (event.type === "done") receivedDone = true;
              enqueue(event);
            },
          },
        );
        if (activeRun.current !== runId || refused) return;
        dispatch({ type: "job-finished" });
        // Missing terminal markers are incomplete answers, never silent success.
        if (started && !receivedDone) enqueue({ type: "done", partial: true });
        if (!started) {
          clearRun();
          dispatch({ type: "fail" });
          onProblem("The answer stopped before it started. Try again.");
        }
      } catch (error) {
        if (controller.signal.aborted || activeRun.current !== runId) return;
        dispatch({ type: "job-finished" });
        if (started) {
          enqueue({ type: "done", partial: true });
          onProblem("The answer was interrupted. You can still inspect what arrived.");
        } else {
          clearRun();
          dispatch({ type: "fail" });
          onProblem(
            error instanceof ApiError
              ? error.message
              : "Something went wrong. Try again.",
          );
        }
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

  const stop = useCallback(() => {
    if (state.status !== "streaming") return;
    clearRun();
    dispatch({ type: "done", partial: true, cancelled: true });
  }, [clearRun, state.status]);

  const scrub = useCallback((cursor) => {
    paused.current = true;
    clearTimer();
    dispatch({ type: "scrub", cursor });
  }, [clearTimer]);

  const step = useCallback(() => {
    paused.current = true;
    clearTimer();
    dispatch({ type: "step" });
  }, [clearTimer]);

  const togglePlay = useCallback(() => {
    if (state.replaying || state.presentationStatus === "playing") {
      paused.current = true;
      clearTimer();
      dispatch({ type: "pause" });
    } else if (state.status === "streaming" || queue.current.length > 0) {
      paused.current = false;
      dispatch({ type: "resume" });
      // Continue processing captured effects; never restart the network request.
      drain();
    } else {
      dispatch({ type: "replay" });
    }
  }, [clearTimer, drain, state.presentationStatus, state.replaying, state.status]);

  const restore = useCallback((run) => {
    clearRun();
    dispatch({ type: "restore", run });
  }, [clearRun]);

  return { state, begin, reset, stop, restore, scrub, step, togglePlay };
}
