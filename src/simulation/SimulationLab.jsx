import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { WorldCanvas } from "../map/WorldCanvas.jsx";
import { RunControls } from "./RunControls.jsx";
import { AgentInspector } from "./AgentInspector.jsx";
import { eventGraph, worldGraph } from "../map/simulationAdapter.js";

async function api(path, method = "GET", payload) {
  const response = await fetch(path, {
    method, headers: { "Content-Type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

const format = (amount) => Number(amount).toLocaleString(undefined, {
  maximumFractionDigits: 2
});

export function SimulationLab() {
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");
  const [scenarios, setScenarios] = useState([]);
  const [scenarioId, setScenarioId] = useState("");
  const [scenario, setScenario] = useState(null);
  const [indicators, setIndicators] = useState(null);
  const [history, setHistory] = useState([]);
  const [compareBaseline, setCompareBaseline] = useState("");
  const [compareAlternative, setCompareAlternative] = useState("");
  const [comparison, setComparison] = useState(null);
  const [company, setCompany] = useState("");
  const [question, setQuestion] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [budget, setBudget] = useState("0");
  const [segments, setSegments] = useState([
    { id: "group-1", label: "", customers: "", churn: "" }
  ]);
  const [options, setOptions] = useState([
    { label: "full rollout", price: "", rolloutPercent: "100" },
    { label: "small rollout", price: "", rolloutPercent: "25" }
  ]);
  const [rounds, setRounds] = useState("6");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [jobId, setJobId] = useState("");
  const [job, setJob] = useState(null);
  const [events, setEvents] = useState([]);
  const [checkpoint, setCheckpoint] = useState(null);
  const [graphLayer, setGraphLayer] = useState("events");
  const [displayTick, setDisplayTick] = useState(Infinity);
  const [replaying, setReplaying] = useState(false);
  const [jobRevision, setJobRevision] = useState(0);
  const [selectedNode, setSelectedNode] = useState(null);
  const cursor = useRef(0);

  useEffect(() => {
    api("/api/projects").then((result) => {
      setProjects(result.projects);
      setProjectId((current) => current || result.projects[0]?.id || "");
    }).catch(() => setNotice("Simulations need the local Ripple server."));
  }, []);

  const loadScenarios = useCallback(async () => {
    if (!projectId) { setScenarios([]); return; }
    const data = await api("/api/projects/" + projectId + "/scenarios");
    setScenarios(data.scenarios);
    setScenarioId((current) => data.scenarios.some((item) => item.id === current)
      ? current : data.scenarios[0]?.id || "");
  }, [projectId]);

  useEffect(() => {
    setScenarioId("");
    loadScenarios().catch((error) => setNotice(error.message));
  }, [loadScenarios]);

  useEffect(() => {
    if (!scenarioId || !projectId) {
      setScenario(null);
      setIndicators(null);
      setHistory([]);
      setComparison(null);
      return;
    }
    let live = true;
    const path = "/api/projects/" + projectId + "/scenarios/" + scenarioId;
    Promise.all([api(path), api(path + "/runs")]).then(([data, runs]) => {
      if (!live) return;
      setScenario(data.scenario);
      setIndicators(data.indicators);
      setHistory(runs.runs);
    }).catch((error) => { if (live) setNotice(error.message); });
    return () => { live = false; };
  }, [projectId, scenarioId, job?.status]);

  useEffect(() => {
    if (!jobId) return;
    let live = true;
    let timer;
    async function poll() {
      try {
        const data = await api("/api/simulation-jobs/" + jobId + "?after=" + cursor.current);
        if (!live) return;
        setJob(data.job);
        setCheckpoint(data.checkpoint);
        if (data.events.length) {
          cursor.current = data.events.at(-1).seq;
          setEvents((current) => [...current, ...data.events]);
        }
        if (["done", "failed", "cancelled"].includes(data.job.status)) return;
        timer = setTimeout(poll, 900);
      } catch (error) {
        if (live) setNotice(error.message);
      }
    }
    poll();
    return () => { live = false; clearTimeout(timer); };
  }, [jobId, jobRevision]);

  async function runTask(action) {
    setBusy(true);
    setNotice("");
    try { await action(); }
    catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  function changeSegment(index, key, value) {
    setSegments((all) => all.map((item, i) => i === index ? { ...item, [key]: value } : item));
  }

  function changeOption(index, key, value) {
    setOptions((all) => all.map((item, i) => i === index ? { ...item, [key]: value } : item));
  }

  async function create(event) {
    event.preventDefault();
    await runTask(async () => {
      if (segments.some((item) => !item.label.trim() || item.customers === "" || item.churn === "") ||
          options.some((item) => item.price === "" || item.rolloutPercent === ""))
        throw new Error("Fill in your segment and pricing inputs.");
      const payload = {
        companyName: company.trim(), question: question.trim(),
        baselinePrice: Number(basePrice), marketingBudget: Number(budget),
        segments: segments.map((s) => ({
          id: s.id, label: s.label.trim(),
          customers: Number(s.customers),
          monthlyChurn: Number(s.churn) / 100
        })),
        interventions: options.map((o) => ({
          label: o.label, price: Number(o.price),
          rolloutPercent: Number(o.rolloutPercent)
        })),
        rounds: Number(rounds)
      };
      const saved = await api("/api/projects/" + projectId + "/scenarios", "POST", payload);
      await loadScenarios();
      setScenarioId(saved.scenario.id);
      setScenario(saved.scenario);
      setIndicators(saved.indicators);
      setNotice("scenario saved. compare it with the baseline.");
    });
  }

  function openJob(id) {
    cursor.current = 0;
    setEvents([]);
    setCheckpoint(null);
    setSelectedNode(null);
    setJob(null);
    setDisplayTick(Infinity);
    setReplaying(false);
    setJobId(id);
    setJobRevision((number) => number + 1);
  }

  async function start(interventionId) {
    await runTask(async () => {
      const path = "/api/projects/" + projectId + "/scenarios/" + scenarioId + "/runs";
      const data = await api(path, "POST", { interventionId });
      openJob(data.job.id);
      setNotice("your simulation is running locally.");
    });
  }

  async function compareRuns() {
    await runTask(async () => {
      const result = await api("/api/simulation-runs/compare", "POST", {
        baselineRunId: compareBaseline, alternativeRunId: compareAlternative
      });
      setComparison(result.comparison);
    });
  }

  async function forkCurrentRun() {
    if (!job?.runId || !checkpoint) return;
    const entered = window.prompt("new price to try", String(
      checkpoint.serializedState.world.variables.currentPrice
    ));
    if (entered === null) return;
    const price = Number(entered);
    if (!Number.isFinite(price) || price <= 0) {
      setNotice("Enter a positive price.");
      return;
    }
    const label = window.prompt("name this experiment", "a smaller change");
    if (label === null || !label.trim()) return;
    await runTask(async () => {
      const response = await api("/api/simulation-runs/" + job.runId + "/fork", "POST", {
        changes: { currentPrice: price }, label
      });
      await loadScenarios();
      setScenarioId(response.scenario.id);
      setComparison(null);
      setNotice("forked at round " + response.from.tick + ". the original run is untouched.");
    });
  }

  async function changeJob(action) {
    await runTask(async () => {
      const response = await api("/api/simulation-jobs/" + jobId, "PATCH", { action });
      setJob(response.job);
    });
  }

  const maxTick = checkpoint?.tick || 0;
  useEffect(() => {
    if (!replaying) return undefined;
    if (displayTick >= maxTick) {
      setReplaying(false);
      return undefined;
    }
    const timer = setTimeout(() => setDisplayTick((tick) => tick + 1), 750);
    return () => clearTimeout(timer);
  }, [replaying, displayTick, maxTick]);

  const shownEvents = Number.isFinite(displayTick)
    ? events.filter((event) => event.tick <= displayTick)
    : events;
  const graph = useMemo(() =>
    graphLayer === "world"
      ? worldGraph(checkpoint?.serializedState?.world, scenario?.question)
      : eventGraph(shownEvents, scenario?.question, job?.runId || "simulation"),
    [graphLayer, checkpoint, shownEvents, scenario?.question, job?.runId]
  );
  const inspected = graph.find((item) => item.targetId === selectedNode);

  return (
    <section className="simulation-lab" aria-label="Simulation lab">
      <h2>what if you tried it first?</h2>
      <p>decision rehearsal, not a prediction. quick ripple is still available in the world.</p>
      <label>your project
        <select aria-label="Simulation project" value={projectId}
          onChange={(event) => setProjectId(event.target.value)}>
          {!projects.length && <option value="">create a project first</option>}
          {projects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>)}
        </select>
      </label>
      {projectId && (
        <>
          <form className="simulation-form" onSubmit={create}>
            <h3>set up a decision</h3>
            <label>what are you deciding?
              <textarea aria-label="Decision question" required maxLength={1000}
                placeholder="What might change if we raise the subscription price?"
                value={question} onChange={(event) => setQuestion(event.target.value)} />
            </label>
            <div className="simulation-fields">
              <label>company or product
                <input required maxLength={160} value={company}
                  onChange={(event) => setCompany(event.target.value)} />
              </label>
              <label>current price
                <input required type="number" min="0.01" step="any" value={basePrice}
                  onChange={(event) => setBasePrice(event.target.value)} />
              </label>
              <label>available budget
                <input required type="number" min="0" step="any" value={budget}
                  onChange={(event) => setBudget(event.target.value)} />
              </label>
              <label>simulation rounds (1–12)
                <input required type="number" min="1" max="12" value={rounds}
                  onChange={(event) => setRounds(event.target.value)} />
              </label>
            </div>
            <h3>customer segments</h3>
            {segments.map((segment, i) => (
              <div className="simulation-fields" key={segment.id}>
                <label>segment
                  <input required value={segment.label}
                    onChange={(event) => changeSegment(i, "label", event.target.value)} />
                </label>
                <label>customers
                  <input required type="number" min="0" step="1" value={segment.customers}
                    onChange={(event) => changeSegment(i, "customers", event.target.value)} />
                </label>
                <label>historical monthly churn %
                  <input required type="number" min="0" max="100" step="any" value={segment.churn}
                    onChange={(event) => changeSegment(i, "churn", event.target.value)} />
                </label>
                {segments.length > 1 && <button className="text-button" type="button"
                  onClick={() => setSegments((all) => all.filter((_, n) => n !== i))}>remove</button>}
              </div>
            ))}
            <button type="button" className="text-button" disabled={segments.length >= 19}
              onClick={() => setSegments((all) => [...all,
                { id: "group-" + Date.now(), label: "", customers: "", churn: "" }])}>
              + add segment
            </button>
            <h3>compare two alternatives</h3>
            {options.map((option, i) => (
              <div className="simulation-fields" key={i}>
                <label>choice
                  <input required value={option.label}
                    onChange={(event) => changeOption(i, "label", event.target.value)} />
                </label>
                <label>new price
                  <input required type="number" min="0.01" step="any" value={option.price}
                    onChange={(event) => changeOption(i, "price", event.target.value)} />
                </label>
                <label>rollout %
                  <input required type="number" min="0" max="100" step="any" value={option.rolloutPercent}
                    onChange={(event) => changeOption(i, "rolloutPercent", event.target.value)} />
                </label>
              </div>
            ))}
            <p>rule-based agents · up to 20 actors · 1–12 rounds · no external model calls or charges</p>
            <button type="submit" className="pixel-button" disabled={busy}>save scenario</button>
          </form>
          <label>saved scenarios
            <select aria-label="Saved scenarios" value={scenarioId}
              onChange={(event) => setScenarioId(event.target.value)}>
              {!scenarios.length && <option value="">no scenarios yet</option>}
              {scenarios.map((item) =>
                <option key={item.id} value={item.id}>{item.question}</option>)}
            </select>
          </label>
          {scenario && indicators && (
            <div className="simulation-results">
              <h3>{scenario.question}</h3>
              <p>illustration with unchanged historical churn; real demand may differ.</p>
              <div className="simulation-option">
                <strong>baseline</strong>
                <span>{format(indicators.baseline.monthlyRevenueUnderFixedChurn)} / month</span>
                <button type="button" className="text-button" disabled={busy}
                  onClick={() => start("baseline")}>run baseline</button>
              </div>
              {indicators.alternatives.map((option) => (
                <div className="simulation-option" key={option.id}>
                  <strong>{option.label}</strong>
                  <span>{format(option.monthlyRevenueUnderFixedChurn)} / month</span>
                  <button type="button" className="text-button" disabled={busy}
                    onClick={() => start(option.id)}>run alternative</button>
                </div>
              ))}
              <details className="simulation-assumptions">
                <summary>assumptions and source links</summary>
                <p>these numbers came from the setup, not from generated agents.</p>
                <ul>
                  {scenario.baselineState.entities.map((entity) => (
                    <li key={entity.id}>
                      {entity.label} · {entity.provenance} ·
                      {Object.entries(entity.attributes).map(([key, value]) =>
                        " " + key + ": " + value).join(", ")}
                    </li>
                  ))}
                </ul>
              </details>
              <h3>compare two completed runs</h3>
              <div className="simulation-fields">
                <label>baseline experiment
                  <select aria-label="Compare baseline" value={compareBaseline}
                    onChange={(event) => setCompareBaseline(event.target.value)}>
                    <option value="">pick a run</option>
                    {history.filter((item) => item.job?.status === "done").map((item) =>
                      <option key={item.id} value={item.id}>
                        {item.interventionId} · {item.id.slice(0, 8)}
                      </option>)}
                  </select>
                </label>
                <label>alternative experiment
                  <select aria-label="Compare alternative" value={compareAlternative}
                    onChange={(event) => setCompareAlternative(event.target.value)}>
                    <option value="">pick a run</option>
                    {history.filter((item) => item.job?.status === "done").map((item) =>
                      <option key={item.id} value={item.id}>
                        {item.interventionId} · {item.id.slice(0, 8)}
                      </option>)}
                  </select>
                </label>
                <button type="button" className="text-button"
                  disabled={busy || !compareBaseline || !compareAlternative ||
                    compareBaseline === compareAlternative}
                  onClick={compareRuns}>compare runs</button>
              </div>
              {comparison && (
                <section className="simulation-diff" aria-label="Run comparison">
                  <h3>what changed?</h3>
                  <p>recorded state differences. not a probability estimate.</p>
                  {comparison.changedVariables.length === 0 &&
                    comparison.changedEntities.length === 0 &&
                    <p>no measured state differences in these runs.</p>}
                  {comparison.changedVariables.map((item) =>
                    <p key={item.key}>{item.key}: {String(item.baseline)} to {String(item.alternative)}</p>)}
                  {comparison.changedEntities.map((item) =>
                    <p key={item.id}>{item.id}: {JSON.stringify(item.baseline)} to {JSON.stringify(item.alternative)}</p>)}
                  {comparison.changedResources.map((item) =>
                    <p key={item.key}>{item.key}: {String(item.baseline)} to {String(item.alternative)}</p>)}
                  <p>rounds: {comparison.tickCounts.baseline} vs {comparison.tickCounts.alternative}</p>
                  {comparison.limitations.map((line) => <small key={line}>{line}</small>)}
                </section>
              )}
              <h3>saved experiments</h3>
              {history.map((item) => (
                <div className="simulation-option" key={item.id}>
                  <span>{item.interventionId} · {item.job?.status || item.status}</span>
                  {item.job && <button type="button" className="text-button"
                    onClick={() => openJob(item.job.id)}>open run</button>}
                </div>
              ))}
            </div>
          )}
          {job && (
            <div className="simulation-results">
              <h3>rounds in motion</h3>
              <p data-testid="simulation-job-status">{job.status} · {events.length} events</p>
              {checkpoint && job.status === "done" && (
                <button type="button" className="text-button" disabled={busy}
                  onClick={forkCurrentRun}>fork from this checkpoint</button>
              )}
              <RunControls
                job={job} checkpoint={checkpoint} currentTick={displayTick}
                replaying={replaying}
                onReplay={() => { setDisplayTick(0); setReplaying(true); }}
                onStopReplay={() => setReplaying(false)}
                onScrub={(tick) => { setDisplayTick(tick); setReplaying(false); }}
                onLive={() => { setDisplayTick(Infinity); setReplaying(false); }}
                onPauseJob={() => changeJob("pause")}
                onResumeJob={() => changeJob("resume")}
                onCancelJob={() => changeJob("cancel")}
              />
              <div className="history-actions">
                <button type="button" className="text-button"
                  aria-pressed={graphLayer === "events"}
                  onClick={() => { setGraphLayer("events"); setSelectedNode(null); }}>event graph</button>
                <button type="button" className="text-button"
                  aria-pressed={graphLayer === "world"}
                  onClick={() => { setGraphLayer("world"); setSelectedNode(null); }}>stakeholders</button>
              </div>
              {graph.length > 0 && (
                <div className="simulation-graph">
                  <WorldCanvas
                    visible={graph}
                    selectedId={selectedNode || graph[0].targetId}
                    focusedEventId={inspected?.id || null}
                    idle={false}
                    busy={job.status === "running"}
                    onPickNode={setSelectedNode}
                    onDropCause={() => setNotice("Use Quick Ripple from the world tab.")}
                    onAsk={() => {}}
                    onRunExample={() => {}}
                  />
                </div>
              )}
              {inspected && (
                <AgentInspector
                  event={events.find((item) => item.id === inspected.id) || inspected}
                  checkpoint={checkpoint} runId={job.runId}
                />
              )}
              {events.length > 96 && <p>showing the first 96 events on the map; the timeline has every event.</p>}
              <ol className="simulation-timeline">
                {shownEvents.map((item) => <li key={item.id}>
                  <strong>round {item.tick} · {item.type.replaceAll("_", " ")}</strong>
                  <small>{item.actorId} · simulated event</small>
                  <span>{item.payload.rationale || item.payload.response ||
                    (item.type === "tick-summary"
                      ? item.payload.accepted + " actions accepted" : "")}</span>
                </li>)}
              </ol>
            </div>
          )}
        </>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
