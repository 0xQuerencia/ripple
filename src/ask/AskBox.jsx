import { useState } from "react";
import { MAX_CAUSE_TEXT } from "../../shared/ripple.mjs";
import { ToneToggle } from "./ToneToggle.jsx";

/** The big "type anything" box in the middle of the empty map. Enter sends; Shift+Enter adds a line. */
export function AskBox({ busy, onAsk }) {
  const [text, setText] = useState("");
  const [tone, setTone] = useState("negative");

  function submit(event) {
    event?.preventDefault();
    const title = text.trim();
    if (!title || busy) return;
    onAsk({ id: null, title, description: "", tone });
    setText("");
  }

  return (
    <form className="ask" onSubmit={submit}>
      <label className="sr-only" htmlFor="ask-text">
        Ask anything
      </label>
      <textarea
        id="ask-text"
        autoFocus
        rows={2}
        maxLength={MAX_CAUSE_TEXT}
        value={text}
        disabled={busy}
        placeholder="what if… (press enter)"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) submit(event);
        }}
      />
      <div className="ask-row">
        <ToneToggle name="ask-tone" value={tone} onChange={setTone} />
        <button
          type="submit"
          className="pixel-button"
          disabled={!text.trim() || busy}
        >
          see what happens
        </button>
      </div>
    </form>
  );
}
