import { randomUUID } from "node:crypto";

export function proposeClaims(source, parsed) {
  const rows = parsed.spans || [];
  const headers = parsed.kind === "csv" ? rows[0]?.cells || [] : null;
  return rows.slice(headers ? 1 : 0).filter((span) => span.quote.trim()).slice(0, 200)
    .map((span) => {
      const text = headers
        ? span.cells.map((value, index) => String(headers[index] || "column " + (index + 1)) +
          ": " + value).join(", ")
        : span.quote.replace(/^\s*[-*#]+\s*/, "").trim();
      if (!text) return null;
      const location = headers ? { row: span.row } : {
        charStart: span.charStart, charEnd: span.charEnd
      };
      return {
        schemaVersion: 1, id: randomUUID(), ownerId: source.ownerId,
        projectId: source.projectId, createdAt: new Date().toISOString(),
        text: text.slice(0, 2000), provenance: "observed",
        sourceSpans: [{ sourceId: source.id, ...location, quote: span.quote.slice(0, 1000) }],
        confidenceStatus: "unverified", reviewed: false, rejected: false
      };
    }).filter(Boolean);
}

export function flagConflicts(claims) {
  const map = new Map();
  for (const claim of claims) {
    if (claim.rejected) continue;
    const match = /^([^,:]{2,50}):\s*([^,]{1,300})$/.exec(claim.text.trim());
    if (!match) continue;
    const key = match[1].trim().toLowerCase();
    const value = match[2].trim().toLowerCase();
    if (!map.has(key)) map.set(key, new Set());
    map.get(key).add(value);
  }
  return claims.map((claim) => {
    const match = /^([^,:]{2,50}):\s*([^,]{1,300})$/.exec(claim.text.trim());
    const conflict = match && map.get(match[1].trim().toLowerCase())?.size > 1;
    return conflict && !claim.rejected ? { ...claim, confidenceStatus: "conflicted" } : claim;
  });
}
