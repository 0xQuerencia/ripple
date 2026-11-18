import test from "node:test";
import assert from "node:assert/strict";
import { browserWorkspace, validWriteOrigin, privateRoute } from "../workers/session.mjs";
import { handleJsonApi } from "../workers/nodeApi.mjs";

const secret = "a-super-long-key-used-only-for-testing-123456789";

test("each browser receives an isolated, signed and reusable workspace", async () => {
  const url = "https://ripple-api.example.com/api/projects";
  const fresh = await browserWorkspace(new Request(url), secret);
  assert.match(fresh.cookie, /HttpOnly; Secure; SameSite=Lax/);
  const existing = await browserWorkspace(new Request(url, {
    headers: { Cookie: fresh.cookie.split(";")[0] }
  }), secret);
  assert.equal(existing.id, fresh.id);
  assert.equal(existing.cookie, null);
  const malicious = await browserWorkspace(new Request(url, {
    headers: { Cookie: "ripple_sid=" + fresh.id + ".wrongvalue" }
  }), secret);
  assert.notEqual(malicious.id, fresh.id);
  const differentBrowser = await browserWorkspace(new Request(url), secret);
  assert.notEqual(differentBrowser.id, fresh.id);
  await assert.rejects(browserWorkspace(new Request(url), "short"));
});

test("unsafe cross-origin writes are refused without breaking reads", () => {
  const url = "https://ripple-api.example.com/api/projects";
  assert.equal(validWriteOrigin(new Request(url), "https://ripple.querencia.art"), true);
  assert.equal(validWriteOrigin(new Request(url, {
    method: "POST", headers: { "Origin": "https://bad.example", "Content-Type": "application/json" }
  }), "https://ripple.querencia.art"), false);
  assert.equal(validWriteOrigin(new Request(url, {
    method: "POST", headers: { "Origin": "https://ripple.querencia.art", "Content-Type": "application/json" }
  }), "https://ripple.querencia.art"), true);
  assert.equal(validWriteOrigin(new Request(url, {
    method: "POST", headers: { "Origin": "https://ripple.querencia.art", "Content-Type": "text/plain" }
  }), "https://ripple.querencia.art"), false);
  assert.equal(validWriteOrigin(new Request(url, {
    method: "POST", headers: { "Origin": "https://ripple.querencia.art",
      "Content-Type": "application/json", "Sec-Fetch-Site": "cross-site" }
  }), "https://ripple.querencia.art"), false);
});

test("private route matching cannot overlap public Quick Ripple endpoints", () => {
  assert.equal(privateRoute("/api/projects"), true);
  assert.equal(privateRoute("/api/projects/abc/scenarios"), true);
  assert.equal(privateRoute("/api/saved-runs/abc"), true);
  assert.equal(privateRoute("/api/simulation-jobs/abc"), true);
  assert.equal(privateRoute("/api/simulation-runs/abc/report"), true);
  assert.equal(privateRoute("/api/status"), false);
  assert.equal(privateRoute("/api/ripple"), false);
  assert.equal(privateRoute("/api/projectile"), false);
});

test("Node API bridge carries headers, response status and JSON bodies", async () => {
  const handler = async (req, res) => {
    assert.equal(req.method, "POST");
    assert.equal(req.headers.host, "ripple-api.example.com");
    assert.equal(req.ripplePrivateAccessVerified, true);
    const payload = JSON.parse(req.body);
    res.writeHead(201, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ value: payload.value }));
  };
  const response = await handleJsonApi(handler, new Request("https://ripple-api.example.com/api/projects", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: 42 })
  }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { value: 42 });
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});
