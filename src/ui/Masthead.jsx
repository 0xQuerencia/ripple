const TABS = [
  ["world", "the world"],
  ["journal", "journal"],
  ["compare", "compare"],
];

function EngineNote({ engine }) {
  const live = engine?.ai;
  const label =
    engine === null ? "checking…" : live ? "gemma 4 is live" : "offline demo";
  return (
    <span
      className={`engine ${live ? "is-live" : ""}`}
      title={
        live
          ? `Model: ${engine.model}`
          : "No Gemini API key configured: effects come from the fixed demo engine"
      }
    >
      <span className="engine-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

export function Masthead({ tab, onTab, engine, onReset, onHelp }) {
  return (
    <header className="topbar">
      <EngineNote engine={engine} />
      <nav className="tabs" aria-label="Views">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-current={tab === id ? "page" : undefined}
            onClick={() => onTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="topbar-tools">
        <button type="button" className="text-button" onClick={onHelp}>
          how to play
        </button>
        <button type="button" className="text-button" onClick={onReset}>
          start over
        </button>
      </div>
    </header>
  );
}
