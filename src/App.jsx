import { useCallback, useEffect, useState } from "react";
import { Masthead } from "./components/Masthead.jsx";
import { CauseTray } from "./components/CauseTray.jsx";
import { WorldCanvas } from "./components/WorldCanvas.jsx";
import { Playback } from "./components/Playback.jsx";
import { FieldNotes } from "./components/FieldNotes.jsx";
import { JournalView } from "./components/JournalView.jsx";
import { CompareView } from "./components/CompareView.jsx";
import { HelpDialog } from "./components/HelpDialog.jsx";
import { LiveThinking } from "./components/LiveThinking.jsx";
import { useRipple } from "./hooks/useRipple.js";
import { fetchStatus } from "./lib/rippleClient.js";

const NOTICE_MS = 5000;
const FRAME_LABEL = {
  world: "the world",
  journal: "the journal",
  compare: "compare",
};

export default function App() {
  const [tab, setTab] = useState("world");
  const [pickedId, setPickedId] = useState(null);
  const [focusedEventId, setFocusedEventId] = useState(null);
  const [engine, setEngine] = useState(null);
  const [pinned, setPinned] = useState(null);
  const [notice, setNotice] = useState("");
  const [helpOpen, setHelpOpen] = useState(false);

  const {
    state: run,
    begin,
    reset,
    scrub,
    step,
    togglePlay,
  } = useRipple({ onProblem: setNotice });
  const visible = run.events.slice(0, run.cursor);
  const busy = run.status === "streaming";
  const originKey = run.events[0]?.targetId ?? null;
  const selectedId = pickedId ?? originKey;

  useEffect(() => {
    const controller = new AbortController();
    fetchStatus(controller.signal).then((status) =>
      setEngine(status ?? { ai: false, model: null }),
    );
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const id = setTimeout(() => setNotice(""), NOTICE_MS);
    return () => clearTimeout(id);
  }, [notice]);

  useEffect(() => {
    if (run.notice) setNotice(run.notice);
  }, [run.notice]);

  const startRun = useCallback(
    (cause) => {
      setPickedId(null);
      setFocusedEventId(null);
      setTab("world");
      begin({ cause });
    },
    [begin],
  );

  const runExample = (title) =>
    startRun({ id: null, title, description: "", tone: "negative" });

  function handleDragCause(event, cause) {
    event.dataTransfer.setData("application/x-ripple-cause", cause.id);
    event.dataTransfer.effectAllowed = "copy";
  }

  function handleInspect(event) {
    setPickedId(event.targetId);
    setFocusedEventId(event.id);
    scrub(Math.max(run.cursor, run.events.indexOf(event) + 1));
  }

  function handleReset() {
    reset();
    setPickedId(null);
    setFocusedEventId(null);
    setNotice("A fresh little world. What will you ask next?");
  }

  function handlePin() {
    setPinned(run);
    setNotice("Experiment pinned. Start over and try a different cause.");
  }

  return (
    <div className="page">
      <div className="noise" aria-hidden="true" />
      <div className="glow" aria-hidden="true">
        <div className="glow-strip" />
      </div>
      <Masthead
        tab={tab}
        onTab={setTab}
        engine={engine}
        onReset={handleReset}
        onHelp={() => setHelpOpen(true)}
      />
      <main className="stage">
        <CauseTray busy={busy} onRun={startRun} onDragCause={handleDragCause} />
        <section
          className="board"
          aria-label={tab === "world" ? "The world" : tab}
        >
          <div className={`frame ${run.status === "idle" ? "" : "is-rainbow"}`}>
            <span className="frame-label" aria-hidden="true">
              {FRAME_LABEL[tab]}
            </span>
            {tab === "world" && (
              <WorldCanvas
                visible={visible}
                selectedId={selectedId}
                focusedEventId={focusedEventId}
                idle={run.status === "idle"}
                busy={busy}
                onPickNode={(id) => {
                  setPickedId(id);
                  setFocusedEventId(null);
                }}
                onDropCause={startRun}
                onAsk={startRun}
                onRunExample={runExample}
              />
            )}
            <LiveThinking run={run} />
            {tab === "journal" && (
              <JournalView
                visible={visible}
                onOpen={(event) => {
                  handleInspect(event);
                  setTab("world");
                }}
              />
            )}
            {tab === "compare" && (
              <CompareView
                pinned={pinned}
                current={run.events.length > 1 ? run : null}
                onPin={handlePin}
              />
            )}
          </div>
          <Playback
            run={run}
            onToggle={togglePlay}
            onScrub={scrub}
            onStep={step}
          />
        </section>
        <FieldNotes
          visible={visible}
          run={run}
          selectedId={selectedId}
          focusedEventId={focusedEventId}
          onInspect={handleInspect}
        />
      </main>
      {notice && (
        <div className="toast" role="status">
          <span>{notice}</span>
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setNotice("")}
          >
            ok
          </button>
        </div>
      )}
      <HelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  );
}
