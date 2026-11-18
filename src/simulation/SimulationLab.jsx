import { useCallback, useEffect, useRef, useState } from "react";

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
  }, [jobId]);

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
    setJob(null);
    setJobId(id);
  }

  async function start(interventionId) {
    await runTask(async () => {
      const path = "/api/projects/" + projectId + "/scenarios/" + scenarioId + "/runs";
      const data = await api(path, "POST", { interventionId });
      openJob(data.job.id);
      setNotice("your simulation is running locally.");
    });
  }

  async function changeJob(action) {
    await runTask(async () => {
      const response = await api("/api/simulation-jobs/" + jobId, "PATCH", { action });
      setJob(response.job);
    });
  }

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
              <div className="history-actions">
                {job.status === "running" && <button type="button" className="text-button"
                  onClick={() => changeJob("pause")}>pause job</button>}
                {job.status === "paused" && <button type="button" className="text-button"
                  onClick={() => changeJob("resume")}>resume job</button>}
                {["running", "queued", "paused"].includes(job.status) &&
                  <button type="button" className="text-button"
                    onClick={() => changeJob("cancel")}>cancel job</button>}
              </div>
              <ol className="simulation-timeline">
                {events.map((item) => <li key={item.id}>
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
