import { useState } from "react";

async function loadReport(runId) {
  const response = await fetch("/api/simulation-runs/" + encodeURIComponent(runId) + "/report");
  const value = await response.json();
  if (!response.ok) throw new Error(value.error || "Report unavailable");
  return value;
}

function saveFile(name, body, type) {
  const blob = new Blob([body], { type });
  const href = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = href;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
}

export function ReportTools({ runId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    setError("");
    try {
      const result = await loadReport(runId);
      setData(result);
    } catch (caught) {
      setError(caught.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="simulation-report" aria-label="Simulation report">
      <h3>field report</h3>
      <p>every finding is labeled: source, assumption, calculation or simulated action.</p>
      <button type="button" className="text-button" disabled={busy}
        onClick={open}>prepare report</button>
      {error && <p role="alert">{error}</p>}
      {data && <>
        <div className="history-actions">
          <button type="button" className="text-button" onClick={() =>
            saveFile("ripple-" + runId.slice(0, 8) + ".md",
              data.markdown, "text/markdown;charset=utf-8")}>export markdown</button>
          <button type="button" className="text-button" onClick={() =>
            saveFile("ripple-" + runId.slice(0, 8) + ".json",
              JSON.stringify(data.report, null, 2), "application/json")}>export JSON</button>
        </div>
        <p>run: {data.report.runId} · {data.report.inputs.ticks} rounds</p>
        <h3>evidence and assumptions</h3>
        <ul>
          {data.report.evidence.map((item, index) =>
            <li key={item.id || index}>
              [{item.provenance}] {item.text} {item.sourceRefs?.join("; ")}
            </li>)}
        </ul>
        <h3>observations</h3>
        <ul>{data.report.findings.map((item, index) =>
          <li key={index}>[{item.provenance}] {item.text}</li>)}</ul>
        <h3>limits</h3>
        <ul>{data.report.limitations.map((line) => <li key={line}>{line}</li>)}</ul>
      </>}
    </section>
  );
}
