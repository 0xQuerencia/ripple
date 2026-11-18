import test from "node:test";
import assert from "node:assert/strict";
import { streamGemma } from "../server/gemma.mjs";
import { createApi } from "../server/api.mjs";
import { ndjson } from "../src/run/rippleClient.js";

test("long upstream frames are rejected", async () => {
  const body = (async function* () { yield Buffer.alloc(280_000, 97); })();
  const stream = streamGemma(
    { text: "a storm" },
    { apiKey: "test", fetchImpl: async () => ({ ok: true, status: 200, body }) },
  );
  await assert.rejects(async () => {
    for await (const event of stream) void event;
  }, /stream limit/);
});

test("many short NDJSON lines in a single chunk are allowed", async () => {
  const lines = Array.from({ length: 100 }, () => '{"type":"done"}\n').join("");
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(lines));
      controller.close();
    },
  });
  let count = 0;
  for await (const event of ndjson(body)) count += event.type === "done" ? 1 : 0;
  assert.equal(count, 100);
});

test("API rejects explicitly non-JSON requests", async () => {
  const api = createApi({ apiKey: "", model: "demo" });
  const req = Object.assign((async function* () {
    yield Buffer.from('{"text":"example"}');
  })(), { method: "POST", url: "/api/ripple", headers: { "content-type": "text/plain" }, socket: { remoteAddress: "127.0.0.1" } });
  let status;
  const res = { setHeader() {}, writeHead(code) { status = code; }, end() {} };
  await api(req, res);
  assert.equal(status, 415);
});
