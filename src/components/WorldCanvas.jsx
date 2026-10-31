import { useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, useNodesState } from "@xyflow/react";
import { SystemNode } from "./SystemNode.jsx";
import { LinkEdge } from "./LinkEdge.jsx";
import { Jiggle } from "./Jiggle.jsx";
import { layoutRipple } from "../lib/layout.js";
import { EXAMPLES } from "../lib/examples.js";
import { CAUSES } from "../../shared/world.mjs";
import { getAncestry } from "../../shared/scenario.mjs";

const NODE_TYPES = { system: SystemNode };
const EDGE_TYPES = { link: LinkEdge };
const NODE = { width: 124, height: 112 };
const FIT = {
  padding: { top: "96px", right: "64px", bottom: "72px", left: "64px" },
  maxZoom: 1,
};
const RECENT = 1;

/** The map is drawn from whatever the ripple has reached so far. */
export function WorldCanvas({
  visible,
  selectedId,
  focusedEventId,
  idle,
  thinking,
  prompt,
  onPickNode,
  onDropCause,
  onRunExample,
}) {
  const flow = useRef(null);
  const follow = useRef(true);
  const [dragging, setDragging] = useState(false);

  const spots = useMemo(() => layoutRipple(visible), [visible]);
  const placed = useMemo(
    () => visible.filter((e) => e.targetId && spots.has(e.targetId)),
    [visible, spots],
  );
  const trail = useMemo(
    () => (focusedEventId ? getAncestry(visible, focusedEventId) : []),
    [visible, focusedEventId],
  );

  const wanted = useMemo(() => {
    const recent = new Set(placed.slice(-RECENT).map((e) => e.targetId));
    const onTrail = new Set(trail.map((e) => e.targetId));
    return placed.map((event) => {
      const spot = spots.get(event.targetId);
      return {
        id: event.targetId,
        type: "system",
        position: { x: spot.x - NODE.width / 2, y: spot.y - NODE.height / 2 },
        ...NODE,
        draggable: false,
        data: {
          event,
          isSelected: event.targetId === selectedId,
          showTag:
            recent.has(event.targetId) ||
            event.targetId === selectedId ||
            onTrail.has(event.targetId),
        },
      };
    });
  }, [placed, spots, selectedId, trail]);

  // React Flow measures each node and needs those measurements back, or it cannot place any edge.
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  useEffect(() => {
    setNodes((current) => {
      const measured = new Map(current.map((n) => [n.id, n.measured]));
      return wanted.map((n) => ({ ...n, measured: measured.get(n.id) }));
    });
  }, [wanted, setNodes]);

  const edges = useMemo(() => {
    const keys = new Set(placed.map((e) => e.targetId));
    const onPath = new Set(trail.map((e) => `${e.sourceId}>${e.targetId}`));
    return placed.slice(1).flatMap((event) =>
      [event.sourceId, ...(event.alsoFrom ?? [])]
        .filter((source) => keys.has(source))
        .map((source, i) => ({
          id: `${source}>${event.targetId}`,
          source,
          target: event.targetId,
          type: "link",
          data: {
            state: trail.length
              ? onPath.has(`${source}>${event.targetId}`)
                ? "path"
                : "dim"
              : "active",
            extra: i > 0,
          },
        })),
    );
  }, [placed, trail]);

  // The camera follows the ripple as it grows, until the visitor takes over.
  const first = visible[0]?.id;
  useEffect(() => {
    follow.current = true;
  }, [first]);
  useEffect(() => {
    if (!follow.current || !flow.current || !wanted.length) return undefined;
    const frame = requestAnimationFrame(() =>
      flow.current?.fitView({ ...FIT, duration: 600 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [wanted.length]);

  function handleDrop(event) {
    event.preventDefault();
    setDragging(false);
    const cause = CAUSES.find(
      (c) => c.id === event.dataTransfer.getData("application/x-ripple-cause"),
    );
    if (cause) onDropCause(cause);
  }

  return (
    <div
      className={`canvas ${idle ? "is-idle" : ""} ${dragging ? "is-drop-ready" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {idle && (
        <div className="invite">
          <h1>
            <Jiggle>ask me anything.</Jiggle>
          </h1>
          <p>
            type any what-if on the left, pick a sticker, or try one of these:
          </p>
          <ul className="examples">
            {EXAMPLES.map((example) => (
              <li key={example}>
                <button type="button" onClick={() => onRunExample(example)}>
                  {example}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {thinking && (
        <p className="thinking" role="status">
          gemma is thinking about <q>{prompt}</q>…
        </p>
      )}
      {dragging && (
        <p className="note drop-note" aria-hidden="true">
          drop it anywhere to start!
        </p>
      )}
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={edges}
        nodeTypes={NODE_TYPES}
        edgeTypes={EDGE_TYPES}
        onInit={(instance) => {
          flow.current = instance;
        }}
        minZoom={0.15}
        maxZoom={1.6}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        deleteKeyCode={null}
        onMoveStart={(event) => {
          if (event) follow.current = false;
        }}
        onNodeClick={(_, node) => onPickNode(node.id)}
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
          aria-label="Fit the ripple to the screen"
          onClick={() => {
            follow.current = true;
            flow.current?.fitView({ ...FIT, duration: 300 });
          }}
        >
          fit
        </button>
      </div>
      {!idle && (
        <ul className="legend" aria-label="Map key">
          <li>
            <i className="key-line is-lit" />
            follows from
          </li>
          <li>
            <i className="key-line is-extra" />
            also feeds
          </li>
          <li>
            <i className="key-ring" />
            big impact
          </li>
        </ul>
      )}
    </div>
  );
}
