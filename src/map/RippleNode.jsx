import { Handle, Position } from "@xyflow/react";
import { Sprite } from "../ui/Sprite.jsx";
import { DOMAIN_BY_ID } from "../../shared/world.mjs";

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

/** One thing the ripple touched: a pixel picture, its name, a ring when it matters, and a note. */
export function RippleNode({ data }) {
  const { event, isSelected, showTag } = data;
  const isOrigin = event.round === 0;
  const state = isOrigin ? "is-source" : `is-affected sev-${event.severity}`;
  const color = DOMAIN_BY_ID[event.area]?.color ?? "#c4bdc2";
  return (
    <div
      className={`system-node ${state} ${isSelected ? "is-selected" : ""}`}
      style={{ "--area": color }}
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
        aria-label={`Inspect ${event.name}`}
        aria-describedby={`about-${event.id}`}
      >
        <Sprite id={event.icon} scale={2} />
        <span className="node-name">{event.name}</span>
        {!isOrigin && event.severity === "high" && (
          <span className="node-flag" aria-hidden="true">
            !
          </span>
        )}
      </button>
      <span id={`about-${event.id}`} className="sr-only">
        {event.title}. {event.explanation}
      </span>
      {showTag && !isOrigin && (
        <span className={`node-tag ${isOrigin ? "tag-source" : ""}`}>
          {isOrigin ? "it started here" : event.title}
          {!isOrigin && (
            <span className="tag-certainty">
              {CERTAINTY_LABEL[event.certainty] ?? event.certainty},{" "}
              {event.timeframe}
            </span>
          )}
        </span>
      )}
    </div>
  );
}
