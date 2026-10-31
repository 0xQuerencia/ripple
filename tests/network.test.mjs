import test from "node:test";
import assert from "node:assert/strict";
import { clientIp } from "../server/network.mjs";

const req = (forwarded, socket = "10.0.0.1") => ({
  socket: { remoteAddress: socket },
  headers: forwarded === undefined ? {} : { "x-forwarded-for": forwarded },
});

test("with no trusted proxy the socket address is the visitor, and the header is ignored", () => {
  assert.equal(clientIp(req("6.6.6.6"), 0), "10.0.0.1");
  assert.equal(clientIp(req(), 0), "10.0.0.1");
});

test("behind one proxy the visitor is the address that proxy appended, not anything the client wrote", () => {
  // A visitor can send their own X-Forwarded-For; the proxy appends the real address after it.
  assert.equal(clientIp(req("fake-1, fake-2, 203.0.113.9"), 1), "203.0.113.9");
  assert.equal(clientIp(req("203.0.113.9"), 1), "203.0.113.9");
});

test("behind two proxies the visitor is the second address from the right", () => {
  assert.equal(
    clientIp(req("spoofed, 203.0.113.9, 172.16.0.4"), 2),
    "203.0.113.9",
  );
});

test("a missing or too-short header falls back to the socket address", () => {
  assert.equal(clientIp(req(undefined), 1), "10.0.0.1");
  assert.equal(clientIp(req("203.0.113.9"), 3), "10.0.0.1");
  assert.equal(clientIp({ headers: {} }, 0), "unknown");
});
