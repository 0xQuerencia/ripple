import { useCallback, useEffect, useState } from "react";

async function request(path, method = "GET", value) {
  const response = await fetch(path, {
    method, headers: { "Content-Type": "application/json" },
    body: value === undefined ? undefined : JSON.stringify(value),
  });
  const answer = await response.json();
  if (!response.ok) throw new Error(answer.error || "Something went wrong");
  return answer;
}

export function EvidenceReview({ projectId }) {
  const [sources, setSources] = useState([]);
  const [claims, setClaims] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const root = "/api/projects/" + projectId;
  const refresh = useCallback(async () => {
    const [sourcesResult, claimsResult] = await Promise.all([
      request("/api/projects/" + projectId + "/sources"),
      request("/api/projects/" + projectId + "/claims"),
    ]);
    setSources(sourcesResult.sources);
    setClaims(claimsResult.claims);
  }, [projectId]);

  useEffect(() => {
    let active = true;
    refresh().catch((error) => { if (active) setMessage(error.message); });
    return () => { active = false; };
  }, [refresh]);

  async function execute(task) {
    setBusy(true);
    setMessage("");
    try {
      await task();
      await refresh();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function upload(file) {
    if (!file) return;
    if (file.size > 128 * 1024) {
      setMessage("Files must be 128 KB or smaller.");
      return;
    }
    await execute(async () => {
      await request(root + "/sources", "POST", {
        filename: file.name, content: await file.text(),
        mime: file.type || undefined
      });
      setMessage("source saved. review its claims before using them.");
    });
  }

  return (
    <section className="evidence" aria-label="Evidence review">
      <header>
        <h3>what we know</h3>
        <label>
          attach TXT, MD or CSV
          <input type="file" accept=".txt,.md,.csv" disabled={busy}
            onChange={(event) => {
              upload(event.target.files?.[0]);
              event.target.value = "";
            }} />
        </label>
      </header>
      <p>sources are private and stay local. their contents are data, not instructions.</p>
      {sources.map((source) => (
        <div key={source.id} className="evidence-source">
          <span>{source.filename} <small>{source.bytes} bytes</small></span>
          <button type="button" className="text-button" disabled={busy}
            onClick={() => execute(() => request(root + "/sources/" + source.id + "/extract", "POST"))}>
            extract claims
          </button>
          <button type="button" className="text-button" disabled={busy}
            onClick={() => execute(() => request(root + "/sources/" + source.id, "DELETE"))}>
            remove
          </button>
        </div>
      ))}
      {claims.length > 0 && <h3>review these statements</h3>}
      <div className="evidence-claims">
        {claims.map((claim) => {
          const span = claim.sourceSpans[0];
          const source = sources.find((item) => item.id === span.sourceId);
          return (
            <div className="evidence-claim" key={claim.id}>
              <div className="evidence-claim-head">
                <small>{source?.filename || "source"} · {span.row ? "row " + span.row :
                  "character " + span.charStart}</small>
                <small className={claim.confidenceStatus === "conflicted" ? "conflicted" : ""}>
                  {claim.rejected ? "rejected" :
                    claim.confidenceStatus === "conflicted" ? "conflict: check source" :
                    claim.reviewed ? "reviewed" : "needs review"} · {claim.provenance}
                </small>
              </div>
              <textarea aria-label={"Claim from " + (source?.filename || "source")}
                disabled={busy} maxLength={2000} value={drafts[claim.id] ?? claim.text}
                onChange={(event) => setDrafts((old) => ({ ...old, [claim.id]: event.target.value }))} />
              <div className="history-actions">
                <button type="button" className="text-button" disabled={busy}
                  onClick={() => execute(() => request(root + "/claims/" + claim.id, "PATCH", {
                    decision: "accept", text: drafts[claim.id] ?? claim.text
                  }))}>accept</button>
                <button type="button" className="text-button" disabled={busy}
                  onClick={() => execute(() => request(root + "/claims/" + claim.id, "PATCH", {
                    decision: "reject"
                  }))}>reject</button>
              </div>
            </div>
          );
        })}
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
