import { useEffect, useRef } from "react";
import { Sprite } from "./Sprite.jsx";

const STEPS = [
  [
    "ask anything",
    "type any what-if, tap a sticker, or drag one onto the map.",
  ],
  [
    "watch it spread",
    "gemma 4 draws a brand new map: every thing the cause touches gets a picture, and the ink shows what follows from what.",
  ],
  [
    "dig in",
    "tap any node to see who feels it, how soon, and how sure gemma is. the big picture adds it all up.",
  ],
  ["compare", "pin one, start over, and ask something different."],
];

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
        {STEPS.map(([title, text]) => (
          <li key={title}>
            <span className="step-title">{title}</span>
            <span className="step-meta">{text}</span>
          </li>
        ))}
      </ol>
      <p className="meta">
        every effect is a possibility, not a prediction. gemma can be wrong, so
        treat this as a thinking toy, not a forecast.
      </p>
      <button type="button" className="pixel-button" onClick={onClose}>
        let’s get curious
      </button>
    </dialog>
  );
}
