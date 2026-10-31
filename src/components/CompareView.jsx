import { Sprite } from "../art/Sprite.jsx";
import { SYSTEM_BY_ID } from "../../shared/world.mjs";

function Sheet({ label, run, tilt }) {
  const touched = run ? new Set(run.events.map((e) => e.targetId)).size : 0;
  return (
    <section
      className="polaroid"
      data-testid="sheet"
      style={{ "--tilt": `${tilt}deg` }}
    >
      <div className="polaroid-face">
        <h3>{label}</h3>
        {run ? (
          <>
            <p className="sheet-title">{run.events[0].title}</p>
            <p className="meta">
              {touched} things touched,{" "}
              {run.mode === "gemma" ? "by gemma" : "by the demo engine"}
            </p>
            <ul>
              {run.events.map((e) => (
                <li key={e.id}>
                  <Sprite id={e.targetId} scale={1} />
                  {SYSTEM_BY_ID[e.targetId].name}: {e.title}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="meta">
            {label === "pinned"
              ? "pin an experiment, then try a different cause."
              : "run an experiment to see it here."}
          </p>
        )}
      </div>
    </section>
  );
}

export function CompareView({ pinned, current, onPin }) {
  return (
    <div className="compare">
      <div className="compare-head">
        <h2>what changes when you change the cause?</h2>
        <button
          type="button"
          className="pixel-button"
          disabled={!current}
          onClick={onPin}
        >
          pin this one
        </button>
      </div>
      <div className="polaroids">
        <Sheet label="pinned" run={pinned} tilt={-1.6} />
        <Sheet label="current" run={current} tilt={1.4} />
      </div>
    </div>
  );
}
