import { useCallback, useEffect, useState } from "react";

async function call(path, method = "GET", data) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const answer = await response.json();
  if (!response.ok) throw new Error(answer.error || "Could not save this ripple");
  return answer;
}

export function ProjectHistory({ current, onOpen }) {
  const [projects, setProjects] = useState([]);
  const [selected, setSelected] = useState(null);
  const [runs, setRuns] = useState([]);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [available, setAvailable] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const result = await call("/api/projects");
      setProjects(result.projects);
      setSelected((old) => result.projects.some((p) => p.id === old)
        ? old : result.projects[0]?.id ?? null);
      setAvailable(true);
    } catch {
      setAvailable(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!selected) { setRuns([]); return; }
    let live = true;
    call("/api/projects/" + encodeURIComponent(selected) + "/runs")
      .then((response) => { if (live) setRuns(response.runs); })
      .catch((error) => { if (live) setMessage(error.message); });
    return () => { live = false; };
  }, [selected, saving]);

  async function apply(action) {
    try {
      setMessage("");
      setSaving(true);
      await action();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  const chosen = projects.find((p) => p.id === selected);
  return (
    <section className="history" aria-label="Saved projects">
      <h2>little worlds worth keeping.</h2>
      {!available ? (
        <p>projects are available in local mode. use npm run dev or the local server.</p>
      ) : (
        <>
          <form onSubmit={(event) => {
            event.preventDefault();
            apply(async () => {
              const { project } = await call("/api/projects", "POST", { title });
              setTitle("");
              setSelected(project.id);
            });
          }}>
            <input aria-label="New project title" placeholder="name your project" maxLength={160}
              value={title} onChange={(event) => setTitle(event.target.value)} required />
            <button type="submit" className="pixel-button" disabled={saving}>new project</button>
          </form>
          <div className="history-projects">
            {projects.map((project) => (
              <div className="history-card" key={project.id}>
                <div className="history-title">
                  <button type="button" aria-pressed={selected === project.id}
                    onClick={() => setSelected(project.id)}>{project.title}</button>
                  <button type="button" className="text-button" disabled={saving}
                    onClick={() => {
                      const name = window.prompt("project name", project.title);
                      if (name) apply(() => call("/api/projects/" + project.id, "PATCH", { title: name }));
                    }}>rename</button>
                  <button type="button" className="text-button" disabled={saving}
                    onClick={() => apply(() => call("/api/projects/" + project.id + "/clone", "POST"))}>copy</button>
                  <button type="button" className="text-button" disabled={saving}
                    onClick={() => {
                      if (window.confirm("delete this project and its runs?"))
                        apply(() => call("/api/projects/" + project.id, "DELETE"));
                    }}>delete</button>
                </div>
              </div>
            ))}
          </div>
          {chosen && (
            <div className="history-runs">
              <div className="history-actions">
                <h3>{chosen.title}</h3>
                <button type="button" className="pixel-button"
                  disabled={saving || current.status !== "done" || !current.events.length}
                  onClick={() => apply(async () => {
                    await call("/api/projects/" + chosen.id + "/runs", "POST", {
                      events: current.events, mode: current.mode, model: current.model,
                      summary: current.summary,
                    });
                    const response = await call("/api/projects/" + chosen.id + "/runs");
                    setRuns(response.runs);
                    setMessage("ripple saved!");
                  })}>save this ripple</button>
              </div>
              {runs.length === 0 && <p>nothing saved here yet.</p>}
              {runs.map((run) => (
                <div className="history-run" key={run.id}>
                  <strong>{run.title || run.id}</strong>
                  <span>{new Date(run.createdAt).toLocaleDateString()}</span>
                  <button type="button" className="text-button" onClick={() => apply(async () => {
                    const saved = await call("/api/saved-runs/" + run.id);
                    onOpen({ runId: run.id, mode: run.mode, model: run.modelId,
                      summary: run.summary, events: saved.events,
                      startedAt: Date.parse(run.createdAt) });
                  })}>reopen</button>
                  <button type="button" className="text-button" onClick={() => apply(async () => {
                    await call("/api/saved-runs/" + run.id, "DELETE");
                    setRuns((all) => all.filter((item) => item.id !== run.id));
                  })}>delete</button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
