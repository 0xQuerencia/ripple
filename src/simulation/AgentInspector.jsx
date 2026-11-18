export function AgentInspector({ event, checkpoint, runId }) {
  const actorId = event?.actorId || event?.who;
  if (!actorId) return null;
  const state = checkpoint?.serializedState;
  const entityId = actorId.startsWith("segment-") ? actorId.slice(8) : actorId;
  const entity = state?.world?.entities?.find((item) => item.id === entityId);
  const memory = state?.memory?.[runId + ":" + actorId] || [];
  return (
    <section className="simulation-inspector" aria-label="Agent inspector">
      <h3>{event.type?.replaceAll("_", " ") || event.name}</h3>
      <p>{event.payload?.rationale || event.explanation || "A simulated action"}</p>
      <small>{actorId} · {event.provenance || "simulated-event"}</small>
      {entity && <>
        <p>role: {entity.kind} · {entity.label}</p>
        <p>inputs: {Object.entries(entity.attributes)
          .map(([key, value]) => key + ": " + value).join(", ")}</p>
        <p>{entity.provenance} · {entity.sourceClaimIds.length} source claim links</p>
      </>}
      {memory.length > 0 && <>
        <h3>what this agent remembers</h3>
        <ol>{memory.slice(-5).map((item) =>
          <li key={item.id}><small>r{item.tick} · {item.type}</small></li>)}</ol>
      </>}
      <p>agent observations and actions exist only inside this simulation.</p>
    </section>
  );
}
