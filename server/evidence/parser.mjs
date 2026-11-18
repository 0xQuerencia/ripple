import { createHash, randomUUID } from "node:crypto";
import { extname } from "node:path";

const SUPPORTED = { ".txt": "text/plain", ".md": "text/markdown", ".csv": "text/csv" };
const MAX_BYTES = 128 * 1024;
const MAX_LINES = 2000;
const MAX_COLUMNS = 64;

function parseCsv(text) {
  const rows = [];
  let row = [], cell = "", quoted = false, afterQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') { quoted = false; afterQuote = true; }
      else cell += c;
      continue;
    }
    if (c === '"' && !afterQuote && cell === "") { quoted = true; continue; }
    if (c === "," || c === "\n") {
      row.push(cell);
      if (row.length > MAX_COLUMNS) throw new Error("CSV has too many columns");
      cell = "";
      afterQuote = false;
      if (c === "\n") {
        if (rows.length >= MAX_LINES) throw new Error("Too many rows");
        rows.push(row);
        row = [];
      }
      continue;
    }
    if (afterQuote || c === '"') throw new Error("Invalid CSV quotes");
    cell += c;
    if (cell.length > 4096) throw new Error("CSV cell is too long");
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (cell || row.length) {
    row.push(cell);
    if (row.length > MAX_COLUMNS || rows.length >= MAX_LINES) throw new Error("CSV too large");
    rows.push(row);
  }
  return rows;
}

export function parseSource({ filename, content, mime }) {
  if (typeof filename !== "string" || !/^[^/\\\x00-\x1f]{1,255}$/.test(filename))
    throw new Error("Invalid filename");
  if (typeof content !== "string" || content.includes("\0") || /[\x01-\x08\x0b\x0c\x0e-\x1f]/.test(content))
    throw new Error("Invalid text content");
  const ext = extname(filename).toLowerCase();
  if (!SUPPORTED[ext]) throw new Error("Only TXT, Markdown and CSV are supported");
  if (mime && mime !== SUPPORTED[ext] && !(ext === ".md" && mime === "text/plain"))
    throw new Error("File type does not match its extension");
  const bytes = Buffer.byteLength(content, "utf8");
  if (!bytes || bytes > MAX_BYTES) throw new Error("File must be between 1 byte and 128 KB");
  if (Buffer.from(content, "utf8").toString("utf8") !== content)
    throw new Error("Invalid UTF-8 characters");
  const normalized = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  let spans;
  if (ext === ".csv") {
    const rows = parseCsv(normalized);
    spans = rows.map((cells, index) => ({
      sourceRow: index + 1, row: index + 1, cells,
      quote: cells.join(" | ").slice(0, 1000),
    }));
  } else {
    const lines = normalized.split("\n");
    if (lines.length > MAX_LINES) throw new Error("Too many lines");
    let start = 0;
    spans = lines.map((line, index) => {
      const span = { sourceRow: index + 1, charStart: start,
        charEnd: start + line.length, quote: line.slice(0, 1000) };
      start += line.length + 1;
      return span;
    }).filter((span) => span.quote.trim());
  }
  if (spans.length > MAX_LINES) throw new Error("Too many source spans");
  return {
    kind: ext.slice(1), bytes,
    hash: createHash("sha256").update(Buffer.from(content, "utf8")).digest("hex"),
    text: normalized,
    spans,
  };
}

export function makeSource(ownerId, projectId, filename, parsed) {
  const now = new Date().toISOString();
  return { schemaVersion: 1, id: randomUUID(), ownerId, projectId,
    filename, kind: parsed.kind, hash: parsed.hash, bytes: parsed.bytes,
    status: "parsed", privacy: "private", createdAt: now };
}
