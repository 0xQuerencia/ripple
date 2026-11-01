import { Sprite } from "../ui/Sprite.jsx";
import { Jiggle } from "../ui/Jiggle.jsx";
import { DOMAIN_BY_ID } from "../../shared/world.mjs";
import { getAncestry } from "../../shared/scenario.mjs";
import { summarize } from "./stats.js";

export const CERTAINTY_TEXT = {
  likely: "likely",
  possible: "possible",
  speculative: "a long shot",
};

function Provenance({ run }) {
  if (run.status === "idle")
    return <p className="provenance">possibilities, not predictions.</p>;
  return (
    <div className="provenance">
      <p>
        {run.mode === "gemma" ? (
          <>
            drawn by <strong>{run.model}</strong>. it can be wrong.
          </>
        ) : (
          <>
            from the <strong>offline demo</strong>, not gemma.
          </>
        )}
      </p>
      {run.notice && <p>{run.notice}</p>}
    </div>
  );
}

function Links({ event, visible }) {
  const name = (key) => visible.find((e) => e.targetId === key)?.name ?? key;
  const from = [event.sourceId, ...(event.alsoFrom ?? [])]
    .filter(Boolean)
    .map(name);
  const to = visible
    .filter(
      (e) =>
        e.sourceId === event.targetId || e.alsoFrom?.includes(event.targetId),
    )
    .map((e) => e.name);
  return (
    <p className="connections">
      {from.length > 0 && (
        <>
          <span>follows from</span> {from.join(", ")}.<br />
        </>
      )}
      <span>leads to</span> {to.length ? to.join(", ") : "nothing yet"}.
    </p>
  );
}

const TOP_AREAS = 5;

function BigPicture({ visible }) {
  const s = summarize(visible);
  if (!s.total) return null;
  const peak = Math.max(...s.areas.map((a) => a.count));
  return (
    <section className="picture" aria-labelledby="picture-title">
      <h3 id="picture-title">the big picture</h3>
      <p className="picture-line">
        {s.total} things touched, {s.rounds}{" "}
        {s.rounds === 1 ? "round" : "rounds"} deep, {s.areas.length}{" "}
        {s.areas.length === 1 ? "area" : "areas"} of life.
      </p>
      <ul className="areas">
        {s.areas.slice(0, TOP_AREAS).map((area) => (
          <li key={area.id}>
            <span className="area-name">{area.name}</span>
            <span
              className="area-bar"
              style={{
                "--w": `${(area.count / peak) * 100}%`,
                "--c": area.color,
              }}
            />
            <span className="area-count">{area.count}</span>
          </li>
        ))}
      </ul>
      {s.areas.length > TOP_AREAS && (
        <p className="meta">+{s.areas.length - TOP_AREAS} more areas</p>
      )}
      <p className="meta">
        {s.severity.high} big, {s.severity.medium} medium, {s.severity.low}{" "}
        small.
      </p>
    </section>
  );
}

export function FieldNotes({
  visible,
  run,
  selectedId,
  focusedEventId,
  onInspect,
}) {
  const origin = visible[0] ?? null;
  const selected = visible.find((e) => e.targetId === selectedId) ?? origin;
  const focused =
    visible.find((e) => e.id === focusedEventId) ??
    (selected?.round > 0 ? selected : null);
  const trail = focused ? getAncestry(visible, focused.id) : [];
  const status = !selected
    ? ""
    : selected.round === 0
      ? "where it began"
      : `${CERTAINTY_TEXT[selected.certainty] ?? "possible"}, ${selected.severity} impact`;

  return (
    <aside className="notes" aria-label="Field notes">
      {selected ? (
        <section className="subject">
          <div className="subject-head">
            <Sprite id={selected.icon} scale={2} />
            <div>
              <h2 data-testid="subject-name">
                <Jiggle>{selected.name}</Jiggle>
              </h2>
              <p className="status">{status}</p>
            </div>
          </div>
          <p>{selected.explanation}</p>
          <p className="meta">
            {DOMAIN_BY_ID[selected.area]?.name}
            {selected.round > 0 &&
              `. ${selected.who ? `felt by ${selected.who}, ` : ""}${selected.timeframe}`}
          </p>
          {selected.targetId && <Links event={selected} visible={visible} />}
        </section>
      ) : (
        <section className="subject">
          <h2>
            <Jiggle>field notes</Jiggle>
          </h2>
          <p>ask a question and each thing it touches gets a note here.</p>
        </section>
      )}

      {trail.length > 1 && (
        <section className="why" aria-labelledby="why-title">
          <h3 id="why-title">how did it get here?</h3>
          <ol
            className="trail"
            data-testid="ancestry"
            aria-label="How the ripple got here"
          >
            {trail.map((e) => (
              <li key={e.id}>{e.name}</li>
            ))}
          </ol>
        </section>
      )}

      <BigPicture visible={visible} />

      <section className="story" aria-labelledby="story-title">
        <h2 id="story-title">
          <Jiggle>the ripple</Jiggle>
        </h2>
        {run.summary && run.status === "done" && (
          <p className="summary">“{run.summary}”</p>
        )}
        {visible.length === 0 ? (
          <p className="empty">nothing has happened. yet.</p>
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
                  <span className="step-meta" hidden={event.id !== focused?.id}>
                    {index === 0 ? "it started with" : `round ${event.round},`}{" "}
                    {event.name}
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
