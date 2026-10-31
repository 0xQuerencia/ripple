function statusText(run) {
  if (run.status === "idle") return "the story is yours to start.";
  if (run.status === "streaming")
    return run.mode === "demo" ? "spreading…" : "gemma is following the links…";
  return `${run.events.length - 1} possible effect${run.events.length === 2 ? "" : "s"}`;
}

export function Playback({ run, onToggle, onScrub, onStep }) {
  const hasRun = run.events.length > 0;
  const playing = run.replaying || run.status === "streaming";
  return (
    <div className="playback">
      <button
        type="button"
        className="pixel-button"
        disabled={!hasRun}
        onClick={onToggle}
      >
        {playing ? "pause" : "replay"}
      </button>
      <input
        type="range"
        min={0}
        max={Math.max(run.events.length, 1)}
        value={run.cursor}
        disabled={!hasRun}
        aria-label="Scrub through the ripple"
        onChange={(event) => onScrub(Number(event.target.value))}
      />
      <span className="playback-status" role="status">
        {statusText(run)}
      </span>
      <button
        type="button"
        className="text-button"
        disabled={!hasRun || run.cursor >= run.events.length}
        onClick={onStep}
      >
        step
      </button>
    </div>
  );
}
