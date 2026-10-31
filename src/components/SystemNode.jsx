import { Handle, Position } from "@xyflow/react";
import { Sprite } from "../art/Sprite.jsx";

const CENTER = {
  top: "50%",
  left: "50%",
  width: 1,
  height: 1,
  minWidth: 0,
  minHeight: 0,
  border: 0,
  opacity: 0,
  transform: "none",
};
const CERTAINTY_LABEL = {
  likely: "likely",
  possible: "possible",
  speculative: "a long shot",
};

/** One system on the map: a pixel doodle with its name, a ring when the ripple reaches it, and a note. */
export function SystemNode({ data }) {
  const { system, status, effect, isSelected, isDropTarget, isArmedTarget } =
    data;
  const state =
    status === "source"
      ? "is-source"
      : status === "affected"
        ? `is-affected sev-${effect.severity}`
        : "";
  return (
    <div
      className={`system-node ${state} ${isSelected ? "is-selected" : ""} ${isDropTarget ? "is-drop" : ""} ${isArmedTarget ? "is-hint" : ""}`}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={CENTER}
        isConnectable={false}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        style={CENTER}
        isConnectable={false}
      />
      <span className="node-ring" aria-hidden="true" />
      <button
        type="button"
        className="node-face"
        aria-pressed={isSelected}
        aria-label={`Inspect ${system.name}`}
        aria-describedby={`about-${system.id}`}
      >
        <Sprite id={system.id} scale={2} />
        <span className="node-name">{system.name}</span>
        {status === "affected" && effect.severity === "high" && (
          <span className="node-flag" aria-hidden="true">
            !
          </span>
        )}
      </button>
      <span id={`about-${system.id}`} className="sr-only">
        {system.description}
        {status === "affected" ? ` Possibly affected: ${effect.title}.` : ""}
      </span>
      {status === "source" && (
        <span className="node-tag tag-source">it started here</span>
      )}
      {status === "affected" && (
        <span className="node-tag">
          {effect.title}
          <span className="tag-certainty">
            {CERTAINTY_LABEL[effect.certainty] ?? effect.certainty}
          </span>
        </span>
      )}
    </div>
  );
}
