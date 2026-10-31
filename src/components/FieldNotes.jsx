import { Sprite } from "../art/Sprite.jsx";
import { Jiggle } from "./Jiggle.jsx";
import { SYSTEM_BY_ID, EDGE_LIST } from "../../shared/world.mjs";
import { getAncestry } from "../../shared/scenario.mjs";

export const CERTAINTY_TEXT = {
  likely: "likely",
  possible: "possible",
  speculative: "a long shot",
};

function Provenance({ run }) {
  if (run.status === "idle")
    return (
      <p className="provenance">
        a model of possibilities, not a prediction of the future.
      </p>
    );
  return (
    <div className="provenance">
      <p>
        {run.mode === "gemma" ? (
          <>
            reasoned by <strong>{run.model}</strong>. every link was checked
            against the map.
          </>
        ) : (
          <>
            from the <strong>offline demo engine</strong>, not gemma. fixed
            rules over the same map.
          </>
        )}
      </p>
      {run.notice && <p>{run.notice}</p>}
    </div>
  );
}

function Connections({ systemId }) {
  const feeds = EDGE_LIST.filter((e) => e.source === systemId).map(
    (e) => SYSTEM_BY_ID[e.target].name,
  );
  const needs = EDGE_LIST.filter((e) => e.target === systemId).map(
    (e) => SYSTEM_BY_ID[e.source].name,
  );
  return (
    <p className="connections">
      <span>feeds</span> {feeds.length ? feeds.join(", ") : "nothing further"}.
      <br />
      <span>leans on</span> {needs.length ? needs.join(", ") : "nothing else"}.
    </p>
  );
}

export function FieldNotes({
  system,
  visible,
  run,
  focusedEventId,
  onInspect,
}) {
  const reached = visible.find((e, i) => i > 0 && e.targetId === system.id);
  const origin = visible[0]?.targetId === system.id;
  const focused = visible.find((e) => e.id === focusedEventId) ?? reached;
  const trail = focused ? getAncestry(visible, focused.id) : [];
  const status = origin
    ? "where it began"
    : reached
      ? "possibly affected"
      : "steady for now";

  return (
    <aside className="notes" aria-label="Field notes">
      <section className="subject">
        <div className="subject-head">
          <Sprite id={system.id} scale={2} />
          <div>
            <h2 data-testid="subject-name">
              <Jiggle>{system.name}</Jiggle>
            </h2>
            <p className="status">{status}</p>
          </div>
        </div>
        <p>{system.description}</p>
        <Connections systemId={system.id} />
      </section>

      {focused && focused.round > 0 && (
        <section className="why" aria-labelledby="why-title">
          <h3 id="why-title">why might this happen?</h3>
          <p>{focused.explanation}</p>
          <p className="meta">
            {CERTAINTY_TEXT[focused.certainty] ?? "possible"},{" "}
            {focused.severity} impact. {focused.relation}.
          </p>
          <ol
            className="trail"
            data-testid="ancestry"
            aria-label="How the ripple got here"
          >
            {trail.map((e) => (
              <li key={e.id}>{SYSTEM_BY_ID[e.targetId].name}</li>
            ))}
          </ol>
        </section>
      )}

      <section className="story" aria-labelledby="story-title">
        <h2 id="story-title">
          <Jiggle>the ripple</Jiggle>
        </h2>
        {run.summary && run.status === "done" && (
          <p className="summary">“{run.summary}”</p>
        )}
        {visible.length === 0 ? (
          <p className="empty">
            nothing has happened. yet.
            <br />
            <span>drop a cause onto the world and the story starts here.</span>
          </p>
        ) : (
          <ol className="steps" aria-live="polite">
            {visible.map((event, index) => (
              <li key={event.id}>
                <button
                  type="button"
                  data-testid="story-step"
                  className={`step ${event.id === focused?.id ? "is-focused" : ""}`}
                  onClick={() => onInspect(event)}
                >
                  <span className="step-title">{event.title}</span>
                  <span className="step-meta">
                    {index === 0 ? "it started with" : `round ${event.round},`}{" "}
                    {SYSTEM_BY_ID[event.targetId].name}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>
      <Provenance run={run} />
    </aside>
  );
}
