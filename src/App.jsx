import { useState, useMemo, useEffect, useRef } from "react";
import {
  ReactFlow,
  Handle,
  Position,
  MarkerType,
  useNodesState,
} from "@xyflow/react";
import {
  ArrowRight,
  ArrowCounterClockwise,
  Plus,
  Minus,
  CornersOut,
  Play,
  Pause,
  Question,
  X,
  BookmarkSimple,
  GitBranch,
  MouseSimple,
} from "@phosphor-icons/react";
import { SYSTEMS, SYSTEM_BY_ID, EDGE_LIST, CAUSES } from "../shared/world.mjs";
import { createScenario, getAncestry } from "../shared/scenario.mjs";
import { Art, Garden } from "./Art";
const positions = {
  climate: [25, 15],
  power: [285, 0],
  communications: [555, 10],
  nature: [0, 205],
  water: [270, 185],
  transport: [560, 210],
  farming: [15, 410],
  industry: [535, 415],
  health: [285, 395],
  economy: [755, 400],
  education: [745, 175],
  people: [760, -10],
};
function SystemNode({ data }) {
  return (
    <button
      type="button"
      aria-label={`Inspect ${data.name}`}
      onClick={(e) => {
        e.stopPropagation();
        data.onActivate();
      }}
      className={`system-node tint-${data.tint} ${data.status} ${data.chosen ? "chosen" : ""} ${data.ready ? "drop-ready" : ""}`}
    >
      <Handle type="target" position={Position.Top} />
      <span className="node-pin" />
      <Art id={data.id} size={53} />
      <span className="node-title">{data.name}</span>
      <span className="node-status">
        {data.status === "source"
          ? "the first domino"
          : data.status === "affected"
            ? "possibly affected"
            : "all is well"}
      </span>
      {data.status === "affected" && <span className="affected-mark">!</span>}
      <Handle type="source" position={Position.Bottom} />
    </button>
  );
}
const nodeTypes = { system: SystemNode };
export default function App() {
  const [nodes, , onNodesChange] = useNodesState(
    SYSTEMS.map((s) => ({
      id: s.id,
      type: "system",
      position: { x: positions[s.id][0], y: positions[s.id][1] },
      data: s,
    })),
  );
  const [selected, setSelected] = useState("power"),
    [cause, setCause] = useState(null),
    [custom, setCustom] = useState(""),
    [tone, setTone] = useState("negative");
  const [events, setEvents] = useState([]),
    [cursor, setCursor] = useState(0),
    [playing, setPlaying] = useState(false),
    [tab, setTab] = useState("world"),
    [help, setHelp] = useState(false),
    [notice, setNotice] = useState(""),
    [saved, setSaved] = useState(null),
    [focusedEvent, setFocusedEvent] = useState(null);
  const flow = useRef(null),
    visible = events.slice(0, cursor),
    system = SYSTEM_BY_ID[selected],
    source = visible[0]?.targetId,
    affected = new Set(visible.slice(1).map((e) => e.targetId));
  const ancestry = focusedEvent ? getAncestry(visible, focusedEvent) : [];
  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => {
      if (cursor >= events.length) setPlaying(false);
      else setCursor((c) => c + 1);
    }, 850);
    return () => clearTimeout(timer);
  }, [playing, cursor, events.length]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const displayNodes = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      status:
        n.id === source ? "source" : affected.has(n.id) ? "affected" : "stable",
      chosen: n.id === selected,
      ready: cause?.target === n.id,
      onActivate: () => choose(n.id),
    },
  }));
  const edges = useMemo(
    () =>
      EDGE_LIST.map((e, i) => {
        const active = visible.some(
            (v) => v.sourceId === e.source && v.targetId === e.target,
          ),
          path = ancestry.some(
            (v) => v.sourceId === e.source && v.targetId === e.target,
          ),
          near = e.source === selected || e.target === selected,
          color = path
            ? "#b86b55"
            : active
              ? "#d79267"
              : ["#9caa86", "#84aab5", "#b3a1c5"][i % 3];
        return {
          ...e,
          type: "default",
          animated: active && playing,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color,
            width: 15,
            height: 15,
          },
          style: {
            stroke: color,
            strokeWidth: path ? 2.6 : active ? 2 : 1.3,
            strokeDasharray: active ? "0" : "6 6",
            opacity: focusedEvent
              ? path
                ? 1
                : 0.12
              : active
                ? 1
                : near
                  ? 0.8
                  : 0.32,
          },
        };
      }),
    [visible, selected, playing, focusedEvent],
  );
  function reset() {
    setEvents([]);
    setCursor(0);
    setPlaying(false);
    setCause(null);
    setFocusedEvent(null);
    setNotice("A fresh little world. What will you try next?");
  }
  function run(c, target) {
    if (!c) return;
    if (c.target && c.target !== target) {
      setNotice(`Try dropping ${c.title} onto ${SYSTEM_BY_ID[c.target].name}.`);
      return;
    }
    const all = createScenario(c, target);
    setEvents(all);
    setCursor(1);
    setPlaying(
      all.length > 1 &&
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    );
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      setCursor(all.length);
    setCause(null);
    setSelected(target);
    setFocusedEvent(null);
    setTab("world");
    console.debug("[ripple] demo started", {
      cause: c.id,
      target,
      events: all.length,
    });
  }
  function choose(id) {
    setSelected(id);
    setFocusedEvent(null);
    if (cause) run(cause, id);
  }
  function customRun(e) {
    e.preventDefault();
    if (!custom.trim()) return;
    run(
      {
        id: "custom",
        title: custom.trim().slice(0, 80),
        description:
          "A custom what-if. This demo follows fixed connections; it does not interpret your text.",
        tone,
      },
      selected,
    );
  }
  function inspect(e) {
    setSelected(e.targetId);
    setFocusedEvent(e.id);
    setPlaying(false);
  }
  const selectedEvent = [...visible]
    .reverse()
    .find((e) => e.targetId === selected);
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab("world");
          }}
        >
          ripple<span>!</span>
          <Art id="butterfly" size={38} />
        </a>
        <nav aria-label="Main navigation">
          {["world", "timeline", "compare"].map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={tab === t ? "active" : ""}
            >
              {t === "world" ? "the world" : t}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <span className="demo-badge">
            <span /> DEMO · no AI
          </span>
          <button
            className="icon-button help-button"
            aria-label="How to play"
            onClick={() => setHelp(true)}
          >
            <Question size={22} />
          </button>
          <button className="reset-button" onClick={reset}>
            <ArrowCounterClockwise size={17} />
            reset world
          </button>
        </div>
      </header>
      <section className="intro">
        <div className="intro-copy">
          <div className="eyebrow">A LITTLE PLAYGROUND FOR BIG WHAT-IFS</div>
          <h1>
            little causes, <span>big consequences.</span>
          </h1>
          <p>Pull one thread. See how a whole little world is connected.</p>
        </div>
        <div className="intro-doodle">
          <Art id="butterfly" size={45} />
          <span>
            it all starts with
            <br />
            one tiny change.
          </span>
          <span className="doodle-arrow">⤵</span>
        </div>
        <Art id="sun" size={77} className="intro-sun" />
      </section>
      <main className="workspace">
        <aside className="cause-panel">
          <div className="panel-title">
            <h2>a little nudge</h2>
            <span>01</span>
          </div>
          <p className="hand panel-description">
            Pick a cause. Drop it on the world.
            <br />
            Then follow the ripples.
          </p>
          <div className="cause-list">
            {CAUSES.map((c, i) => (
              <button
                draggable
                key={c.id}
                onDragStart={(e) => {
                  e.dataTransfer.setData("application/ripple-cause", c.id);
                  setCause(c);
                }}
                onClick={() => {
                  setCause(cause?.id === c.id ? null : c);
                  setNotice(
                    `Now choose ${SYSTEM_BY_ID[c.target].name} in the world.`,
                  );
                }}
                className={`cause-sticker cause-${i} ${cause?.id === c.id ? "selected" : ""}`}
                aria-pressed={cause?.id === c.id}
              >
                <Art id={c.id} size={29} />
                <span>{c.title}</span>
                <span className="drag-grip">⠿</span>
              </button>
            ))}
          </div>
          <div className="custom-block">
            <span className="tiny-star">✧</span>
            <h2>or, what if…</h2>
            <form onSubmit={customRun}>
              <label className="sr-only" htmlFor="custom-cause">
                Your own cause
              </label>
              <textarea
                id="custom-cause"
                placeholder="something unexpected happened?"
                maxLength={80}
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
              <div className="tone-switch">
                <button
                  type="button"
                  className={tone === "negative" ? "active" : ""}
                  onClick={() => setTone("negative")}
                >
                  a disruption
                </button>
                <button
                  type="button"
                  className={tone === "positive" ? "active" : ""}
                  onClick={() => setTone("positive")}
                >
                  a good thing
                </button>
              </div>
              <button className="try-button" disabled={!custom.trim()}>
                try it on {system.name}
                <ArrowRight size={17} />
              </button>
            </form>
            <small>Custom causes use fixed demo effects.</small>
          </div>
          <div className="sidebar-note">
            <Art id="butterfly" size={31} />
            <p>
              There are no wrong questions.
              <br />
              Just interesting connections.
            </p>
          </div>
          <Garden />
        </aside>
        <section className="world-panel">
          <div className="world-heading">
            <div>
              <h2>
                {tab === "world"
                  ? "our little world"
                  : tab === "timeline"
                    ? "the ripple journal"
                    : "two little possibilities"}
              </h2>
              <span>
                {tab === "world"
                  ? "12 systems. a thousand possible stories."
                  : tab === "timeline"
                    ? "Every consequence has a beginning."
                    : "Save one experiment. Then try another."}
              </span>
            </div>
            <span className="world-state">
              <span className={events.length ? "warm" : ""} />
              {events.length
                ? `${visible.length - 1} ripples so far`
                : "a quiet day on earth"}
            </span>
          </div>
          {tab === "world" ? (
            <div className={`canvas ${cause ? "choosing" : ""}`}>
              <div className="canvas-top-note">
                {cause
                  ? `where does “${cause.title}” begin?`
                  : "everything is connected. even the small things."}
                <Art id="sparkle" size={17} />
              </div>
              <ReactFlow
                nodes={displayNodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onInit={(instance) => (flow.current = instance)}
                fitView
                fitViewOptions={{ padding: 0.18 }}
                minZoom={0.3}
                maxZoom={1.7}
                nodesConnectable={false}
                nodesDraggable
                elementsSelectable
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "copy";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const c = CAUSES.find(
                      (c) =>
                        c.id ===
                        e.dataTransfer.getData("application/ripple-cause"),
                    ),
                    el = e.target.closest("[data-id]");
                  if (c && el && SYSTEM_BY_ID[el.dataset.id])
                    run(c, el.dataset.id);
                  else if (c)
                    setNotice(
                      `Drop your sticker directly onto ${SYSTEM_BY_ID[c.target].name}.`,
                    );
                }}
                onEdgeClick={(_, e) => {
                  setSelected(e.target);
                  setNotice(e.relation);
                }}
                deleteKeyCode={null}
                onPaneClick={() => {
                  setFocusedEvent(null);
                  setCause(null);
                }}
              >
                <div className="canvas-cloud">
                  <Art id="cloud" size={43} />
                </div>
              </ReactFlow>
              <div className="canvas-note">
                <span>psst…</span>
                <br />
                click a system
                <br />
                to get curious <span>↗</span>
              </div>
              <Garden className="canvas-garden" />
              <div className="canvas-controls">
                <button
                  aria-label="Zoom in"
                  onClick={() => flow.current?.zoomIn()}
                >
                  <Plus size={17} />
                </button>
                <button
                  aria-label="Zoom out"
                  onClick={() => flow.current?.zoomOut()}
                >
                  <Minus size={17} />
                </button>
                <button
                  aria-label="Fit world to screen"
                  onClick={() =>
                    flow.current?.fitView({ padding: 0.18, duration: 300 })
                  }
                >
                  <CornersOut size={17} />
                </button>
              </div>
            </div>
          ) : tab === "timeline" ? (
            <div className="journal-view">
              {!visible.length ? (
                <EmptyStory />
              ) : (
                visible.map((e, i) => (
                  <button
                    key={e.id}
                    className="journal-row"
                    onClick={() => {
                      inspect(e);
                      setTab("world");
                    }}
                  >
                    <span className="journal-index">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Art id={e.targetId} size={37} />
                    <div>
                      <small>
                        {e.round === 0
                          ? "THE FIRST DOMINO"
                          : `ROUND ${e.round} · POSSIBLE EFFECT`}
                      </small>
                      <h3>{e.title}</h3>
                      <p>{e.explanation}</p>
                    </div>
                    <ArrowRight size={19} />
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="compare-view">
              <div className="compare-intro">
                <GitBranch size={36} weight="duotone" />
                <h3>What changes when you change a cause?</h3>
                <p>Pin this experiment, reset the world, and try a new one.</p>
                <button
                  className="paper-button"
                  disabled={!events.length}
                  onClick={() => {
                    setSaved({ events: [...events], title: events[0].title });
                    setNotice(
                      "Experiment pinned. Reset and try a different cause.",
                    );
                  }}
                >
                  <BookmarkSimple size={17} />
                  pin current experiment
                </button>
              </div>
              <div className="comparison">
                {[
                  {
                    name: "pinned experiment",
                    data: saved?.events,
                    title: saved?.title,
                  },
                  {
                    name: "current experiment",
                    data: events,
                    title: events[0]?.title,
                  },
                ].map((v, i) => (
                  <div className="comparison-sheet" key={i}>
                    <small>{v.name}</small>
                    <h3>{v.title || "A blank page, for now."}</h3>
                    <p>
                      {v.data
                        ? `${new Set(v.data.map((e) => e.targetId)).size} systems touched`
                        : "Your next what-if belongs here."}
                    </p>
                    {v.data?.map((e) => (
                      <div className="comparison-event" key={e.id}>
                        <Art id={e.targetId} size={23} />
                        <span>{e.title}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="canvas-footer">
            <span>
              <i className="legend-line" />
              possible connection
            </span>
            <span>
              <i className="legend-line active" />a ripple in motion
            </span>
            <span className="canvas-hint">
              <MouseSimple size={14} />
              drag to explore · scroll to zoom
            </span>
          </div>
          <div className="playback">
            <button
              aria-label={playing ? "Pause playback" : "Play playback"}
              disabled={!events.length}
              onClick={() => {
                if (cursor === events.length) setCursor(1);
                setPlaying(!playing);
              }}
            >
              {playing ? (
                <Pause size={19} weight="fill" />
              ) : (
                <Play size={19} weight="fill" />
              )}
            </button>
            <input
              aria-label="Rewind timeline"
              type="range"
              min="0"
              max={events.length || 1}
              value={cursor}
              disabled={!events.length}
              onChange={(e) => {
                setPlaying(false);
                setCursor(Number(e.target.value));
                setFocusedEvent(null);
              }}
            />
            <span className="hand">
              {events.length
                ? `${cursor} / ${events.length}`
                : "the story is yours to start"}
            </span>
            <button
              className="step-button"
              disabled={!events.length || cursor >= events.length}
              onClick={() => {
                setPlaying(false);
                setCursor((c) => Math.min(c + 1, events.length));
              }}
            >
              step <ArrowRight size={15} />
            </button>
          </div>
        </section>
        <aside className="notebook-panel">
          <div className="panel-title">
            <h2>the field notes</h2>
            <Art id="sparkle" size={22} />
          </div>
          <p className="hand panel-description">
            A closer look at the little things.
          </p>
          <div className={`inspector tint-${system.tint}`}>
            <div className="tape" />
            <div className="inspector-heading">
              <Art id={selected} size={45} />
              <div>
                <small>{system.category}</small>
                <h3>{system.name}</h3>
              </div>
            </div>
            <p>{system.description}</p>
            <div className="inspector-bottom">
              <span>
                <span
                  className={
                    affected.has(selected) ? "status-dot warm" : "status-dot"
                  }
                />
                {source === selected
                  ? "where it began"
                  : affected.has(selected)
                    ? "possibly affected"
                    : "steady & connected"}
              </span>
              <span>
                {
                  EDGE_LIST.filter(
                    (e) => e.source === selected || e.target === selected,
                  ).length
                }{" "}
                links
              </span>
            </div>
          </div>
          {selectedEvent && (
            <div className="why-note">
              <h3>why did this happen?</h3>
              <p>{selectedEvent.explanation}</p>
              <div className="ancestry">
                {getAncestry(visible, selectedEvent.id).map((e, i) => (
                  <span key={e.id}>
                    {i > 0 && " → "}
                    {SYSTEM_BY_ID[e.targetId].name}
                  </span>
                ))}
              </div>
            </div>
          )}
          <div className="story-heading">
            <h2>the ripple effect</h2>
            <span>
              {visible.length ? `${visible.length} notes` : "your story"}
            </span>
          </div>
          <div className="story-feed" aria-live="polite">
            {visible.length ? (
              visible.map((e, i) => (
                <button
                  key={e.id}
                  className={`story-card ${i === 0 ? "origin" : ""} ${focusedEvent === e.id ? "focused" : ""}`}
                  onClick={() => inspect(e)}
                >
                  <span className="story-number">
                    {i === 0 ? "✦" : String(i).padStart(2, "0")}
                  </span>
                  <div>
                    <small>
                      {e.round === 0
                        ? "IT STARTED WITH…"
                        : `ROUND ${e.round} · POSSIBLE`}
                    </small>
                    <h3>{e.title}</h3>
                    <span className="story-target">
                      <Art id={e.targetId} size={16} />
                      {SYSTEM_BY_ID[e.targetId].name}
                      <ArrowRight size={12} />
                    </span>
                  </div>
                </button>
              ))
            ) : (
              <EmptyStory />
            )}
          </div>
          <div className="notebook-bottom">
            <span className="hand">
              a model of possibilities,
              <br />
              not a prediction of the future.
            </span>
            <Art id="flower" size={34} />
          </div>
        </aside>
      </main>
      <footer className="app-footer">
        <span>
          made for curious minds <span className="heart">♡</span>
        </span>
        <span>tiny experiments. unexpected connections.</span>
        <button onClick={() => setHelp(true)}>
          how to play <ArrowRight size={13} />
        </button>
      </footer>
      {notice && (
        <div className="toast" role="status">
          <Art id="butterfly" size={24} />
          {notice}
          <button aria-label="Dismiss message" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="help-title"
            className="help-dialog"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setHelp(false);
            }}
          >
            <button
              className="close-dialog"
              autoFocus
              aria-label="Close how to play"
              onClick={() => setHelp(false)}
            >
              <X size={22} />
            </button>
            <Art id="butterfly" size={54} />
            <h2 id="help-title">one tiny change. a whole new story.</h2>
            <ol>
              <li>
                Pick a cause sticker, then click its matching system. You can
                drag and drop it, too.
              </li>
              <li>
                Watch possible effects travel through three rounds of
                connections.
              </li>
              <li>
                Click a note to trace its exact chain. Pause, step, or rewind to
                investigate.
              </li>
              <li>Pin an experiment in Compare, then reset and try another.</li>
            </ol>
            <p>
              This is a simplified world. All effects are fixed demo examples;
              custom text is a label, not AI reasoning.
            </p>
            <button className="try-button" onClick={() => setHelp(false)}>
              let’s get curious <ArrowRight size={18} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function EmptyStory() {
  return (
    <div className="empty-story">
      <div className="empty-illustration">
        <Art id="cloud" size={72} />
        <Art id="butterfly" size={37} />
      </div>
      <h3>
        nothing has happened.
        <br />
        <span>yet.</span>
      </h3>
      <p>
        Drop a little cause into the world.
        <br />
        Something interesting might follow.
      </p>
      <span className="empty-squiggle">⤶</span>
    </div>
  );
}
