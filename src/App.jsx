import { useCallback, useEffect, useState } from "react";
import { Masthead } from "./components/Masthead.jsx";
import { CauseTray } from "./components/CauseTray.jsx";
import { WorldCanvas } from "./components/WorldCanvas.jsx";
import { Playback } from "./components/Playback.jsx";
import { FieldNotes } from "./components/FieldNotes.jsx";
import { JournalView } from "./components/JournalView.jsx";
import { CompareView } from "./components/CompareView.jsx";
import { HelpDialog } from "./components/HelpDialog.jsx";
import { useRipple } from "./hooks/useRipple.js";
import { fetchStatus } from "./lib/rippleClient.js";
import { SYSTEM_BY_ID } from "../shared/world.mjs";

const NOTICE_MS = 5000;

export default function App() {
  const [tab, setTab] = useState("world");
  const [selectedId, setSelectedId] = useState("power");
  const [armed, setArmed] = useState(null);
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
    (cause, targetId) => {
      setSelectedId(targetId);
      setArmed(null);
      setFocusedEventId(null);
      setTab("world");
      begin({ cause, targetId });
    },
    [begin],
  );

  /** A preset cause only makes sense where it begins; custom what-ifs may start anywhere. */
  function tryPlace(cause, targetId) {
    setSelectedId(targetId);
    if (cause.target && cause.target !== targetId) {
      setNotice(
        `Try dropping ${cause.title} onto ${SYSTEM_BY_ID[cause.target].name}.`,
      );
      return;
    }
    startRun(cause, targetId);
  }

  function handlePickSystem(id) {
    setFocusedEventId(null);
    if (armed) tryPlace(armed, id);
    else setSelectedId(id);
  }

  function handleArm(cause) {
    setArmed(cause);
    if (cause) setNotice(`Now tap the system where “${cause.title}” begins.`);
  }

  function handleDragCause(event, cause) {
    event.dataTransfer.setData("application/x-ripple-cause", cause.id);
    event.dataTransfer.effectAllowed = "copy";
    setArmed(null);
  }

  function handleInspect(event) {
    setSelectedId(event.targetId);
    setFocusedEventId(event.id);
    scrub(Math.max(run.cursor, run.events.indexOf(event) + 1));
  }

  function handleReset() {
    reset();
    setArmed(null);
    setFocusedEventId(null);
    setNotice("A fresh little world. What will you try next?");
  }

  function handlePin() {
    setPinned(run);
    setNotice("Experiment pinned. Reset and try a different cause.");
  }

  const system = SYSTEM_BY_ID[selectedId];
  const showWorld = tab === "world";

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
        <CauseTray
          armedId={armed?.id ?? null}
          selectedSystem={system}
          busy={busy}
          onArm={handleArm}
          onDragCause={handleDragCause}
          onCustom={(cause) => startRun(cause, selectedId)}
        />
        <section className="board" aria-label={showWorld ? "The world" : tab}>
          <div className={`frame ${run.status === "idle" ? "" : "is-rainbow"}`}>
            <span className="frame-label" aria-hidden="true">
              {
                {
                  world: "the world",
                  journal: "the journal",
                  compare: "compare",
                }[tab]
              }
            </span>
            {showWorld && (
              <WorldCanvas
                visible={visible}
                selectedId={selectedId}
                focusedEventId={focusedEventId}
                armed={armed}
                idle={run.status === "idle"}
                onPickSystem={handlePickSystem}
                onDropCause={tryPlace}
                onNotice={setNotice}
              />
            )}
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
          system={system}
          visible={visible}
          run={run}
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
