import { useEffect, useState } from "react";
import { Sprite } from "../art/Sprite.jsx";
import { RIPPLE_LIMITS } from "../../shared/ripple.mjs";

const TICK_MS = 500;
const TICKER_LINES = 2;

/** Seconds since `since`, refreshed while `active`. */
function useElapsed(since, active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [active]);
  return Math.max(0, Math.floor((now - since) / 1000));
}

/** What Gemma is doing right now, shown while a ripple is being written. */
export function LiveThinking({ run }) {
  const active = run.status === "streaming";
  const seconds = useElapsed(run.startedAt, active);
  if (!active) return null;

  const [origin, ...effects] = run.events;
  const placed = Boolean(origin?.targetId);
  const round = Math.max(1, ...effects.map((e) => e.round));
  const who = run.mode === "demo" ? "spreading" : "gemma is thinking";
  const recent = effects.slice(-TICKER_LINES);

  return (
    <div className="live" role="status" aria-live="polite">
      <div className="live-head">
        <Sprite id="i-brain" scale={1} className="live-brain" />
        <span className="live-title">
          {who}… <b>{seconds}s</b>
        </span>
      </div>
      <p className="live-line">
        {placed ? (
          <>
            it begins at <q>{origin.name}</q>
          </>
        ) : (
          <>
            reading <q>{origin?.title}</q>
          </>
        )}
      </p>
      {placed && (
        <p className="live-line live-progress">
          round {round} of {RIPPLE_LIMITS.rounds}, {effects.length}{" "}
          {effects.length === 1 ? "thing" : "things"} found so far
        </p>
      )}
      <ol className="live-ticker" aria-hidden="true">
        {recent.map((effect, index) => (
          <li
            key={effect.id}
            className={index === recent.length - 1 ? "is-newest" : ""}
          >
            <b>r{effect.round}</b> {effect.name}: {effect.title}
          </li>
        ))}
      </ol>
    </div>
  );
}
