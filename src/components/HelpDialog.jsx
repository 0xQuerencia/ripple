import { useEffect, useRef } from "react";
import { Sprite } from "../art/Sprite.jsx";

export function HelpDialog({ open, onClose }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="help"
      aria-labelledby="help-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <Sprite id="butterfly" scale={2} />
      <h2 id="help-title">one tiny change, a whole new story.</h2>
      <ol className="steps">
        <li>
          <span className="step-title">drop a cause</span>
          <span className="step-meta">
            drag a sticker onto a thing, or tap the sticker and then the thing.
          </span>
        </li>
        <li>
          <span className="step-title">watch it spread</span>
          <span className="step-meta">
            gemma 4 follows real links on the map, up to three rounds out.
          </span>
        </li>
        <li>
          <span className="step-title">trace it back</span>
          <span className="step-meta">
            tap any note to see how the ripple got there. scrub or replay to
            look closer.
          </span>
        </li>
        <li>
          <span className="step-title">compare</span>
          <span className="step-meta">
            pin one, start over, and try a different cause.
          </span>
        </li>
      </ol>
      <p className="meta">
        every effect is a possibility, checked against the map. gemma can’t
        invent a link that doesn’t exist.
      </p>
      <button type="button" className="pixel-button" onClick={onClose}>
        let’s get curious
      </button>
    </dialog>
  );
}
