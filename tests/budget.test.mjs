import test from "node:test";
import assert from "node:assert/strict";
import { createApi } from "../server/api.mjs";

async function request(api, body = { causeId: "blackout" }) {
  const req = Object.assign((async function* () {
    yield Buffer.from(JSON.stringify(body));
  })(), { method: "POST", url: "/api/ripple", headers: {}, socket: { remoteAddress: "127.0.0.1" } });
  let output = "";
  const res = {
    writableEnded: false,
    setHeader() {},
    writeHead() {},
    write(chunk) { output += chunk; },
    end(chunk = "") { output += chunk; this.writableEnded = true; },
    on() {},
  };
  await api(req, res);
  return output.trim().split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

test("global call budget counts retries, not just visitor requests", async () => {
  let calls = 0;
  const api = createApi({
    apiKey: "test", model: "test-model", globalLimit: 2,
    retryDelayMs: 0, log: () => {},
    fetchImpl: async () => { calls++; return { ok: false, status: 503 }; },
  });
  const first = await request(api);
  const second = await request(api);
  assert.equal(calls, 2);
  assert.match(first[0].notice, /budget|busy/i);
  assert.match(second[0].notice, /budget|busy/i);
});

test("request deadline aborts a hanging upstream call", async () => {
  let stopped = false;
  const api = createApi({
    apiKey: "test", model: "test-model", requestTimeoutMs: 15,
    retryDelayMs: 0, log: () => {},
    fetchImpl: (_url, options) => new Promise((resolve, reject) => {
      options.signal.addEventListener("abort", () => {
        stopped = true;
        reject(new Error("aborted"));
      }, { once: true });
    }),
  });
  await request(api);
  assert.equal(stopped, true);
});
