import test from "node:test";
import assert from "node:assert/strict";
import { ndjson, ApiError } from "../src/run/rippleClient.js";

const body = (...parts) => new ReadableStream({
  start(controller) {
    for (const chunk of parts) controller.enqueue(new TextEncoder().encode(chunk));
    controller.close();
  },
});
const collect = async (stream) => {
  const events = [];
  for await (const event of ndjson(stream)) events.push(event);
  return events;
};

test("ndjson parses split lines and preserves partial done markers", async () => {
  const events = await collect(body('{"type":"start","origin":{}', '}\n{"type":"done","partial":true}'));
  assert.deepEqual(events.map((event) => event.type), ["start", "done"]);
  assert.equal(events[1].partial, true);
});

test("ndjson rejects invalid JSON and unknown event types", async () => {
  await assert.rejects(collect(body('{"type":')), ApiError);
  await assert.rejects(collect(body('{"type":"bogus"}\n')), ApiError);
});

test("ndjson does not buffer unbounded input", async () => {
  await assert.rejects(collect(body("x".repeat(65 * 1024))), /stream limit/);
});

test("ndjson refuses empty effect or start payloads", async () => {
  await assert.rejects(collect(body('{"type":"start"}\n')), /invalid start/);
  await assert.rejects(collect(body('{"type":"effect"}\n')), /invalid effect/);
});
