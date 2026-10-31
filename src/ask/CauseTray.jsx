import { useState } from "react";
import { Sprite } from "../ui/Sprite.jsx";
import { Jiggle } from "../ui/Jiggle.jsx";
import { ToneToggle } from "./ToneToggle.jsx";
import { CAUSES } from "../../shared/world.mjs";
import { MAX_CAUSE_TEXT } from "../../shared/ripple.mjs";

export function CauseTray({ busy, onRun, onDragCause }) {
  const [text, setText] = useState("");
  const [tone, setTone] = useState("negative");

  function handleSubmit(event) {
    event.preventDefault();
    const title = text.trim();
    if (!title || busy) return;
    onRun({ id: null, title, description: "", tone });
    setText("");
  }

  return (
    <aside className="left" aria-label="Causes">
      <div className="brand">
        <Sprite id="crowd" scale={2} />
        <h1 className="title">
          <Jiggle>ripple!</Jiggle>
        </h1>
        <p className="by" aria-hidden="true">
          powered by gemma 4
        </p>
        <p className="lede">little causes, big consequences.</p>
      </div>

      <form className="whatif" onSubmit={handleSubmit}>
        <h2>
          <Jiggle>what if…</Jiggle>
        </h2>
        <label className="sr-only" htmlFor="whatif-text">
          Your own cause
        </label>
        <textarea
          id="whatif-text"
          rows={2}
          maxLength={MAX_CAUSE_TEXT}
          value={text}
          disabled={busy}
          placeholder="anything. the moon disappears. cats learn to talk…"
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) handleSubmit(event);
          }}
        />
        <div className="whatif-row">
          <ToneToggle name="tone" value={tone} onChange={setTone} />
          <button
            type="submit"
            className="pixel-button"
            disabled={!text.trim() || busy}
          >
            see what happens
          </button>
        </div>
        <p className="hint">gemma draws a new map for every question.</p>
      </form>

      <section className="picker">
        <h2>
          <Jiggle>or pick a cause</Jiggle>
        </h2>
        <ol className="causes">
          {CAUSES.map((cause) => (
            <li key={cause.id}>
              <button
                type="button"
                draggable
                disabled={busy}
                data-testid={`cause-${cause.id}`}
                className="cause"
                onClick={() => onRun(cause)}
                onDragStart={(event) => onDragCause(event, cause)}
              >
                <Sprite id={cause.id} scale={1} />
                <span className="cause-text">
                  <span className="cause-name">{cause.title}</span>
                  <span className="cause-meta">
                    {cause.tone === "positive" ? "good news" : "disruption"}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}
