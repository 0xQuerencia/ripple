import { useEffect, useMemo, useRef, useState } from "react";
import { ReactFlow, useNodesState } from "@xyflow/react";
import { RippleNode } from "./RippleNode.jsx";
import { LinkEdge } from "./LinkEdge.jsx";
import { AskBox } from "../ask/AskBox.jsx";
import { Jiggle } from "../ui/Jiggle.jsx";
import { layoutRipple } from "./layout.js";
import { buildEdges, buildNodes, placedEvents, traceTo } from "./graph.js";
import { EXAMPLES } from "../ask/examples.js";
import { CAUSES } from "../../shared/world.mjs";

const NODE_TYPES = { system: RippleNode };
const EDGE_TYPES = { link: LinkEdge };
const FIT = {
  padding: { top: "96px", right: "64px", bottom: "72px", left: "64px" },
  maxZoom: 1,
};
// While Gemma is working a panel sits over the top of the map, so keep the ripple below it.
const fitOptions = (busy) => ({
  ...FIT,
  padding: { ...FIT.padding, top: busy ? "215px" : FIT.padding.top },
});

/** The map is drawn from whatever the ripple has reached so far. */
export function WorldCanvas({
  visible,
  selectedId,
  focusedEventId,
  idle,
  busy,
  onPickNode,
  onDropCause,
  onAsk,
  onRunExample,
}) {
  const flow = useRef(null);
  const follow = useRef(true);
  const [dragging, setDragging] = useState(false);

  const spots = useMemo(() => layoutRipple(visible), [visible]);
  const placed = useMemo(() => placedEvents(visible, spots), [visible, spots]);
  const trail = useMemo(
    () => traceTo(visible, focusedEventId),
    [visible, focusedEventId],
  );
  const wanted = useMemo(
    () => buildNodes({ placed, spots, selectedId, trail }),
    [placed, spots, selectedId, trail],
  );

  // React Flow measures each node and needs those measurements back, or it cannot place any edge.
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  useEffect(() => {
    setNodes((current) => {
      const measured = new Map(current.map((n) => [n.id, n.measured]));
      return wanted.map((n) => ({ ...n, measured: measured.get(n.id) }));
    });
  }, [wanted, setNodes]);

  const edges = useMemo(() => buildEdges({ placed, trail }), [placed, trail]);

  // The camera follows the ripple as it grows, until the visitor takes over.
  const first = visible[0]?.id;
  useEffect(() => {
    follow.current = true;
  }, [first]);
  useEffect(() => {
    if (!follow.current || !flow.current || !wanted.length) return undefined;
    const frame = requestAnimationFrame(() =>
      flow.current?.fitView({ ...fitOptions(busy), duration: 600 }),
    );
    return () => cancelAnimationFrame(frame);
  }, [wanted.length, busy]);

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
          <p>type any what-if. the weirder the better.</p>
          <AskBox busy={busy} onAsk={onAsk} />
          <p className="try">or try one of these:</p>
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
            flow.current?.fitView({ ...fitOptions(busy), duration: 300 });
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
