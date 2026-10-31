import { Sprite } from "../art/Sprite.jsx";
import { SYSTEM_BY_ID } from "../../shared/world.mjs";
import { CERTAINTY_TEXT } from "./FieldNotes.jsx";

export function JournalView({ visible, onOpen }) {
  if (!visible.length) {
    return (
      <div className="view-empty">
        <Sprite id="cloud" scale={3} />
        <h2>the journal is blank.</h2>
        <p>
          every ripple you start gets written down here, one consequence at a
          time.
        </p>
      </div>
    );
  }
  return (
    <ol className="journal steps">
      {visible.map((event, index) => (
        <li key={event.id}>
          <button
            type="button"
            className="journal-entry"
            onClick={() => onOpen(event)}
          >
            <Sprite id={event.targetId} scale={2} />
            <span>
              <span className="step-title">{event.title}</span>
              <span className="step-meta">
                {index === 0
                  ? "the first domino"
                  : `round ${event.round}, ${CERTAINTY_TEXT[event.certainty] ?? "possible"}`}
                , {SYSTEM_BY_ID[event.targetId].name}
              </span>
              <span className="journal-text">{event.explanation}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
