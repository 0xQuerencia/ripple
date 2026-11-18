import { buildDemoChain } from "../../shared/engine.mjs";
import { SYSTEM_BY_ID } from "../../shared/world.mjs";

const OFFLINE_NOTICE =
  "The server is unreachable, so this ripple uses the offline demo engine.";
const OFFLINE_GAP_MS = 120;
const MAX_STREAM_LINE = 64 * 1024;
const EVENT_TYPES = new Set(["start", "effect", "summary", "done", "refused"]);

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function fetchStatus(signal) {
  try {
    const response = await fetch("/api/status", { signal });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

export async function* ndjson(body) {
  if (!body?.getReader) throw new ApiError("The server did not send a readable stream.", 502);
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let newline;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const text = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (text.length > MAX_STREAM_LINE) throw new ApiError("The answer exceeded the stream limit.", 502);
      if (text) yield parseStreamEvent(text);
    }
    if (buffer.length > MAX_STREAM_LINE) throw new ApiError("The answer exceeded the stream limit.", 502);
  }
  buffer += decoder.decode();
  if (buffer.length > MAX_STREAM_LINE) throw new ApiError("The answer exceeded the stream limit.", 502);
  if (buffer.trim()) yield parseStreamEvent(buffer.trim());
}

function parseStreamEvent(line) {
  let event;
  try {
    event = JSON.parse(line);
  } catch {
    throw new ApiError("The answer contained invalid stream data.", 502);
  }
  if (!event || typeof event !== "object" || !EVENT_TYPES.has(event.type))
    throw new ApiError("The answer contained an unknown event.", 502);
  if (event.type === "start" && (!event.origin || typeof event.origin !== "object"))
    throw new ApiError("The answer has an invalid start event.", 502);
  if (event.type === "effect" && (!event.effect || typeof event.effect !== "object"))
    throw new ApiError("The answer has an invalid effect event.", 502);
  return event;
}

const wait = (ms, signal) =>
  new Promise((resolve, reject) => {
    const id = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(id);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });

/** Same event protocol as the server, produced locally when there is no server to ask. */
async function offlineRipple(
  { targetId, text, description, tone },
  { signal, onEvent },
) {
  const system = SYSTEM_BY_ID[targetId];
  onEvent({
    type: "start",
    mode: "demo",
    model: null,
    notice: OFFLINE_NOTICE,
    origin: {
      targetId,
      name: system.name,
      area: system.domain,
      icon: system.id,
      known: true,
      title: text,
      description,
      tone,
    },
  });
  for (const effect of buildDemoChain({ targetId, tone })) {
    await wait(OFFLINE_GAP_MS, signal);
    onEvent({ type: "effect", effect });
  }
  onEvent({ type: "done" });
}

/**
 * Ask the server for a ripple and forward each streamed event. A missing or broken server (404, 5xx,
 * network error) degrades to the offline demo; a rejected request (400, 429) is the user's to fix.
 * @param {{ api: object, local: object }} request what to send the server, and what to run offline if there is no server
 * @param {{ signal: AbortSignal, onEvent: (event: import("../../shared/types.js").StreamEvent) => void }} handlers
 */
export async function streamRipple(request, { signal, onEvent }) {
  let response;
  try {
    response = await fetch("/api/ripple", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request.api),
      signal,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    return offlineRipple(request.local, { signal, onEvent });
  }
  if (response.status === 404 || response.status >= 500)
    return offlineRipple(request.local, { signal, onEvent });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(
      body.error || "That did not work. Try again.",
      response.status,
    );
  }
  let count = 0;
  for await (const event of ndjson(response.body)) {
    if (++count > 200) throw new ApiError("The server sent too many events.", 502);
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    onEvent(event);
    if (event.type === "done" || event.type === "refused") break;
  }
}
