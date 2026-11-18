import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url)));

test("hosted project and simulation requests proxy to Cloudflare", () => {
  const paths = [
    "/api/projects",
    "/api/projects/:path*",
    "/api/saved-runs/:path*",
    "/api/simulation-jobs/:path*",
    "/api/simulation-runs/:path*"
  ];
  assert.deepEqual(config.rewrites.map((rule) => rule.source), paths);
  for (const rule of config.rewrites)
    assert.equal(rule.destination,
      "https://ripple-api.querencia.art" + rule.source);
});

test("public Quick Ripple endpoints are not replaced", () => {
  assert.equal(config.rewrites.some((rule) =>
    ["/api/status", "/api/ripple"].includes(rule.source)), false);
});
