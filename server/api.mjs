import { CAUSES, SYSTEM_BY_ID } from "../shared/world.mjs";
import { buildDemoChain, guessOrigin } from "../shared/engine.mjs";
import { MAX_CAUSE_TEXT } from "../shared/ripple.mjs";
import { DEFAULT_MODEL, streamGemma } from "./gemma.mjs";
import { clientIp } from "./network.mjs";

const MAX_BODY_BYTES = 4096;
const NOTICE_NO_KEY =
  "No Gemini API key is configured, so this ripple uses the offline demo engine.";
const NOTICE_BUSY =
  "Gemma is busy right now (the hourly budget is used up), so this ripple uses the offline demo engine. Try again soon.";
const NOTICE_FAILED =
  "Gemma did not answer this time, so this ripple uses the offline demo engine.";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function send(res, status, payload) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.writeHead(status);
  res.end(JSON.stringify(payload));
}

async function readJson(req) {
  // Hosts such as Vercel read and parse the body before the handler runs, leaving nothing to stream.
  if (req.body !== undefined && req.body !== null)
    return alreadyParsed(req.body);
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES)
      throw new HttpError(413, "That request is too large.");
    chunks.push(chunk);
  }
  return parseObject(Buffer.concat(chunks).toString("utf8"));
}

function alreadyParsed(body) {
  const text =
    typeof body === "string"
      ? body
      : Buffer.isBuffer(body)
        ? body.toString("utf8")
        : JSON.stringify(body);
  if (Buffer.byteLength(text) > MAX_BODY_BYTES)
    throw new HttpError(413, "That request is too large.");
  return parseObject(text);
}

/** The body must be a JSON object; anything else is the visitor's mistake. */
function parseObject(text) {
  try {
    const body = JSON.parse(text);
    if (body && typeof body === "object" && !Array.isArray(body)) return body;
  } catch {
    /* handled below */
  }
  throw new HttpError(400, "Send a JSON object.");
}

/** Normalise a request into one trusted shape. Anything unexpected is a 400, never passed on. */
function parseRippleRequest(body) {
  const preset =
    typeof body.causeId === "string"
      ? CAUSES.find((c) => c.id === body.causeId)
      : null;
  if (preset)
    return {
      text: preset.title,
      description: preset.description,
      tone: preset.tone,
      targetId: preset.target,
    };
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text || text.length > MAX_CAUSE_TEXT)
    throw new HttpError(
      400,
      `Describe your cause in 1 to ${MAX_CAUSE_TEXT} characters.`,
    );
  // A custom cause may name a starting system, but normally Gemma decides where it begins.
  if (body.targetId != null && !SYSTEM_BY_ID[body.targetId])
    throw new HttpError(400, "That is not a system on the map.");
  return {
    text,
    description: "",
    tone: body.tone === "positive" ? "positive" : "negative",
    targetId: body.targetId ?? null,
  };
}

function createRateLimiter({ limit, windowMs }) {
  const hits = new Map();
  return (ip) => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
    const entry = hits.get(ip) ?? { count: 0, reset: now + windowMs };
    entry.count += 1;
    hits.set(ip, entry);
    return entry.count <= limit;
  };
}

const line = (event) => `${JSON.stringify(event)}\n`;

function* demoEvents(input, notice) {
  const targetId = input.targetId ?? guessOrigin(input.text);
  const system = SYSTEM_BY_ID[targetId];
  yield {
    type: "start",
    mode: "demo",
    model: null,
    notice,
    origin: {
      targetId,
      name: system.name,
      area: system.domain,
      icon: system.id,
      known: true,
      title: input.text,
      tone: input.tone,
      description: input.description,
    },
  };
  for (const effect of buildDemoChain({ targetId, tone: input.tone }))
    yield { type: "effect", effect };
  yield { type: "done" };
}

const MAX_ATTEMPTS = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 105_000;

class BudgetExhausted extends Error {}
const LARGE_MODEL = "gemma-4-31b-it";

/** Server errors, rate limits and dropped connections usually pass; a bad key or model name will not. */
const isTransient = (error) =>
  !(error instanceof BudgetExhausted) &&
  (error.status === undefined || error.status === 429 || error.status >= 500);
const otherModel = (model) =>
  model === LARGE_MODEL ? DEFAULT_MODEL : LARGE_MODEL;
const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    if (signal.aborted) return reject(signal.reason);
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal.reason);
    };
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal.addEventListener("abort", onAbort, { once: true });
  });

/**
 * The HTTP API: GET /api/status and POST /api/ripple (a stream of StreamEvent lines, see
 * shared/types.js). Everything a visitor can send is validated here, and every failure ends in an
 * answer the interface can show: Gemma is retried, then the offline demo steps in and says so.
 *
 * @param {object} options
 * @param {string} options.apiKey            Gemini key; empty means demo mode only
 * @param {string} options.model             preferred Gemma model
 * @param {typeof fetch} [options.fetchImpl] replaceable so tests never touch the network
 * @param {number} [options.limit]           questions per visitor per window
 * @param {number} [options.trustedProxyHops] reverse proxies in front of this server (see network.mjs)
 * @param {number} [options.globalLimit]     Gemma calls across all visitors per hour
 * @returns {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse, next?: () => void) => Promise<void>}
 */
export function createApi({
  apiKey,
  model,
  fetchImpl = fetch,
  limit = 12,
  windowMs = 60_000,
  retryDelayMs = 700,
  trustedProxyHops = 0,
  globalLimit = 300,
  globalWindowMs = 3_600_000,
  requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  log = console.error,
}) {
  const allow = createRateLimiter({ limit, windowMs });
  // One shared budget for every visitor, so a public URL cannot spend the whole Gemini quota.
  const allowGemma = createRateLimiter({
    limit: globalLimit,
    windowMs: globalWindowMs,
  });

  /** Stream one Gemma attempt to the client. Nothing is sent until the first valid effect arrives. */
  async function relay(input, useModel, emit, state, signal, countedFetch) {
    let origin = null;
    for await (const event of streamGemma(input, {
      fetchImpl: countedFetch,
      apiKey,
      model: useModel,
      signal,
      timeoutMs: Math.max(1, requestTimeoutMs),
      onUsage: (usage) => {
        state.usage = {
          promptTokens: usage.promptTokenCount ?? null,
          outputTokens: usage.candidatesTokenCount ?? null,
          totalTokens: usage.totalTokenCount ?? null,
        };
      },
    })) {
      if (event.type === "refused") {
        emit(event);
        state.refused = true;
        return;
      }
      if (event.type === "origin") {
        origin = {
          ...event.node,
          targetId: event.node.key,
          title: input.text,
          tone: input.tone,
          description: event.description || input.description,
        };
      } else if (event.type === "effect" && origin) {
        if (!state.effects)
          emit({ type: "start", mode: "gemma", model: useModel, origin });
        state.effects += 1;
        emit(event);
      } else if (event.type === "summary" && state.effects) emit(event);
    }
    if (!state.effects) throw new Error("Gemma returned no valid effects");
    emit({ type: "done", usage: { ...state.usage, upstreamAttempts: state.upstreamAttempts } });
  }

  async function ripple(req, res) {
    const contentType = req.headers?.["content-type"];
    if (contentType && !/^application\/json(?:\s*;|\s*$)/i.test(contentType))
      throw new HttpError(415, "Send JSON, please.");
    if (!allow(clientIp(req, trustedProxyHops)))
      throw new HttpError(429, "Slow down a little. Try again in a minute.");
    const input = parseRippleRequest(await readJson(req));

    res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Accel-Buffering", "no");
    res.writeHead(200);
    const emit = (event) => res.write(line(event));
    const emitAll = (events) => {
      for (const event of events) emit(event);
      res.end();
    };
    if (!apiKey) return emitAll(demoEvents(input, NOTICE_NO_KEY));

    const abort = new AbortController();
    const deadline = AbortSignal.timeout(requestTimeoutMs);
    const signal = AbortSignal.any([abort.signal, deadline]);
    res.on?.("close", () => {
      if (!res.writableEnded) abort.abort();
    });
    const state = { effects: 0, upstreamAttempts: 0, usage: {} };
    let budgetBlocked = false;
    const countedFetch = (url, options) => {
      if (signal.aborted) throw signal.reason;
      if (!allowGemma("all")) throw new BudgetExhausted();
      state.upstreamAttempts++;
      return fetchImpl(url, options);
    };
    for (let attempt = 1; attempt <= MAX_ATTEMPTS && !signal.aborted; attempt++) {
      const useModel = attempt === MAX_ATTEMPTS ? otherModel(model) : model;
      try {
        await relay(input, useModel, emit, state, signal, countedFetch);
        return res.end();
      } catch (error) {
        if (error instanceof BudgetExhausted) budgetBlocked = true;
        if (!signal.aborted)
          log(`[ripple] Gemma attempt ${attempt}/${MAX_ATTEMPTS}: ${error.status ?? error.name ?? "upstream error"}`);
        if (signal.aborted) return;
        if (state.effects) {
          emit({ type: "done", partial: true, usage: { ...state.usage, upstreamAttempts: state.upstreamAttempts } });
          return res.end();
        }
        if (!isTransient(error)) break;
        if (attempt < MAX_ATTEMPTS) {
          try {
            await sleep(retryDelayMs * attempt, signal);
          } catch {
            return;
          }
        }
      }
    }
    if (signal.aborted) return;
    return emitAll(demoEvents(input, budgetBlocked ? NOTICE_BUSY : NOTICE_FAILED));
  }

  return async function handle(req, res, next) {
    const path = new URL(req.url ?? "/", "http://localhost").pathname;
    if (!path.startsWith("/api/"))
      return next ? next() : send(res, 404, { error: "Not found." });
    try {
      if (req.method === "GET" && path === "/api/status")
        return send(res, 200, { ai: Boolean(apiKey), model });
      if (req.method === "POST" && path === "/api/ripple")
        return await ripple(req, res);
      return send(res, 404, { error: "Not found." });
    } catch (error) {
      if (error instanceof HttpError)
        return send(res, error.status, { error: error.message });
      log(`[api] unexpected error: ${error.name || "Error"}`);
      if (res.headersSent) {
        if (!res.writableEnded) res.end(line({ type: "done", partial: true }));
        return;
      }
      return send(res, 500, { error: "Something went wrong on our side." });
    }
  };
}
