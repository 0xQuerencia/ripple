export function RunControls({ job, checkpoint, currentTick, replaying,
  onReplay, onStopReplay, onScrub, onLive, onPauseJob, onResumeJob, onCancelJob }) {
  const max = checkpoint?.tick || 0;
  const tick = Number.isFinite(currentTick) ? currentTick : max;
  return (
    <section className="simulation-controls" aria-label="Simulation controls">
      <div className="history-actions">
        <span>{job.status} · round {max} of {job.rounds}</span>
        <span>{job.spentCalls} model calls · {job.spentTokens} tokens</span>
        {job.errorCode && <span>issue: {job.errorCode}</span>}
      </div>
      <div className="history-actions">
        {job.status === "running" && <button type="button" className="text-button"
          onClick={onPauseJob}>pause job</button>}
        {job.status === "paused" && <button type="button" className="text-button"
          onClick={onResumeJob}>resume job</button>}
        {["running", "queued", "paused"].includes(job.status) &&
          <button type="button" className="text-button"
            onClick={onCancelJob}>cancel job</button>}
      </div>
      <div className="history-actions">
        <button type="button" className="text-button" onClick={replaying ? onStopReplay : onReplay}
          disabled={max === 0}>{replaying ? "pause replay" : "replay"}</button>
        <input aria-label="Simulation replay round" type="range"
          min="0" max={Math.max(1, max)} value={tick}
          onChange={(event) => onScrub(Number(event.target.value))} />
        <span>{tick}/{max}</span>
        <button type="button" className="text-button" onClick={onLive}>live view</button>
      </div>
      <p>replay only changes what you see. pause job stops the actual worker at a round boundary.</p>
    </section>
  );
}
