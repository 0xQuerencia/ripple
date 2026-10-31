import { useMemo, useRef, useState } from "react";
import { ReactFlow, useNodesState } from "@xyflow/react";
import { SystemNode } from "./SystemNode.jsx";
import { LinkEdge } from "./LinkEdge.jsx";
import { Sprite } from "../art/Sprite.jsx";
import {
  SYSTEMS,
  SYSTEM_BY_ID,
  EDGE_LIST,
  CAUSES,
} from "../../shared/world.mjs";
import { getAncestry } from "../../shared/scenario.mjs";

const NODE_TYPES = { system: SystemNode };
const EDGE_TYPES = { link: LinkEdge };
const FIT = {
  padding: { top: "112px", right: "48px", bottom: "96px", left: "48px" },
};
const initialNodes = () =>
  SYSTEMS.map((s) => ({
    id: s.id,
    type: "system",
    position: { x: s.x, y: s.y },
    width: 132,
    height: 124,
    data: {},
  }));

function linkState(edge, { visible, trail, selectedId, hasFocus }) {
  const hit = visible.some(
    (e) => e.sourceId === edge.source && e.targetId === edge.target,
  );
  if (
    trail.some((e) => e.sourceId === edge.source && e.targetId === edge.target)
  )
    return "path";
  if (hasFocus) return "dim";
  if (hit) return "active";
  return edge.source === selectedId || edge.target === selectedId
    ? "near"
    : "quiet";
}

export function WorldCanvas({
  visible,
  selectedId,
  focusedEventId,
  armed,
  idle,
  onPickSystem,
  onDropCause,
  onNotice,
}) {
  const [nodes, , onNodesChange] = useNodesState(initialNodes());
  const [dropId, setDropId] = useState(null);
  const flow = useRef(null);

  const trail = useMemo(
    () => (focusedEventId ? getAncestry(visible, focusedEventId) : []),
    [visible, focusedEventId],
  );
  const sourceId = visible[0]?.targetId;
  const effectByTarget = useMemo(
    () => new Map(visible.slice(1).map((e) => [e.targetId, e])),
    [visible],
  );

  const shownNodes = nodes.map((node) => {
    const effect = effectByTarget.get(node.id);
    return {
      ...node,
      data: {
        system: SYSTEM_BY_ID[node.id],
        status: node.id === sourceId ? "source" : effect ? "affected" : "quiet",
        effect,
        isSelected: node.id === selectedId,
        isDropTarget: node.id === dropId,
        isArmedTarget: armed?.target === node.id,
      },
    };
  });

  const edges = useMemo(
    () =>
      EDGE_LIST.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        type: "link",
        data: {
          state: linkState(edge, {
            visible,
            trail,
            selectedId,
            hasFocus: trail.length > 0,
          }),
        },
      })),
    [visible, trail, selectedId],
  );

  function nodeIdAt(event) {
    return event.target.closest?.(".react-flow__node")?.dataset.id ?? null;
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const id = nodeIdAt(event);
    if (id !== dropId) setDropId(id);
  }

  function handleDrop(event) {
    event.preventDefault();
    setDropId(null);
    const cause = CAUSES.find(
      (c) => c.id === event.dataTransfer.getData("application/x-ripple-cause"),
    );
    const id = nodeIdAt(event);
    if (!cause) return;
    if (id) onDropCause(cause, id);
    else onNotice("Drop the sticker right onto a system.");
  }

  return (
    <div
      className={`canvas ${armed ? "is-armed" : ""} ${idle ? "is-idle" : ""}`}
      onDragOver={handleDragOver}
      onDragLeave={() => setDropId(null)}
      onDrop={handleDrop}
    >
      {idle && (
        <p className="note invite" aria-hidden="true">
          <Sprite id="arrow-curl" scale={1} className="flip" />
          everything is connected. even the small things.
        </p>
      )}
      {armed && (
        <p className="note armed-note" role="status">
          now tap the thing where “{armed.title}” begins!
        </p>
      )}
      <ReactFlow
        nodes={shownNodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onNodesChange={onNodesChange}
        onInit={(instance) => {
          flow.current = instance;
        }}
        fitView
        fitViewOptions={FIT}
        minZoom={0.35}
        maxZoom={1.6}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        onNodeClick={(_, node) => onPickSystem(node.id)}
      />
      <div className="zoom" role="group" aria-label="Zoom">
        <button
          type="button"
          aria-label="Zoom in"
          onClick={() => flow.current?.zoomIn({ duration: 200 })}
        >
          +
        </button>
        <button
          type="button"
          aria-label="Zoom out"
          onClick={() => flow.current?.zoomOut({ duration: 200 })}
        >
          –
        </button>
        <button
          type="button"
          aria-label="Fit the world to the screen"
          onClick={() => flow.current?.fitView({ ...FIT, duration: 300 })}
        >
          fit
        </button>
      </div>
      {!idle && (
        <ul className="legend" aria-label="Map key">
          <li>
            <i className="key-line" />
            possible link
          </li>
          <li>
            <i className="key-line is-lit" />a ripple in motion
          </li>
          <li>
            <i className="key-ring" />
            reached
          </li>
        </ul>
      )}
    </div>
  );
}
