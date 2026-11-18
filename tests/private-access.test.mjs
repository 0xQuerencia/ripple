import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { createPrivateAccessVerifier, isPrivateApiPath } from "../server/security/privateAccess.mjs";
import { isLocal } from "../server/projects/api.mjs";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "key-1", alg: "RS256" };
const config = {
  RIPPLE_ACCESS_TEAM: "sample-team",
  RIPPLE_ACCESS_AUD: "1234567890abcdef1234567890abcdef",
  RIPPLE_PRIVATE_HOSTNAME: "lab.ripple.example.com",
  RIPPLE_ACCESS_EMAIL: "owner@example.com"
};
const time = 1_800_000_000;
let requests = 0;
const fetchImpl = async (url) => {
  requests++;
  assert.equal(url, "https://sample-team.cloudflareaccess.com/cdn-cgi/access/certs");
  return { ok: true, json: async () => ({ keys: [jwk] }) };
};
const claims = () => ({
  iss: "https://sample-team.cloudflareaccess.com",
  aud: [config.RIPPLE_ACCESS_AUD],
  email: "owner@example.com", exp: time + 3600, iat: time - 10
});
const encode = (part) => Buffer.from(JSON.stringify(part)).toString("base64url");
const token = (payload = claims(), header = { alg: "RS256", kid: "key-1" }) => {
  const content = encode(header) + "." + encode(payload);
  return content + "." + sign("RSA-SHA256", Buffer.from(content), privateKey).toString("base64url");
};
const request = (jwt, hostname = config.RIPPLE_PRIVATE_HOSTNAME) =>
  ({ headers: { host: hostname, "cf-access-jwt-assertion": jwt } });

test("signed Access assertions grant only the named owner access", async () => {
  requests = 0;
  const verify = createPrivateAccessVerifier(config, { fetchImpl, now: () => time });
  assert.equal(await verify(request(token())), true);
  assert.equal(await verify(request(token())), true);
  assert.equal(requests, 1);
  assert.equal(await verify(request(token(), "other.example.com")), false);
  assert.equal(await verify(request(token({ ...claims(), email: "other@example.com" }))), false);
  assert.equal(await verify(request(token({ ...claims(), aud: ["other-aud"] }))), false);
  assert.equal(await verify(request(token({ ...claims(), exp: time - 1 }))), false);
  assert.equal(await verify(request(token({ ...claims(), iss: "https://evil.example" }))), false);
});

test("tampered assertions and missing configuration always fail closed", async () => {
  const verify = createPrivateAccessVerifier(config, { fetchImpl, now: () => time });
  const good = token();
  const invalidSignature = good.slice(0, -10) + "0".repeat(10);
  assert.equal(await verify(request(invalidSignature)), false);
  assert.equal(await verify(request("garbage")), false);
  assert.equal(await createPrivateAccessVerifier({}, { fetchImpl })(request(good)), false);
  assert.equal(await createPrivateAccessVerifier(config, {
    fetchImpl: async () => { throw new Error("unavailable"); }, now: () => time
  })(request(good)), false);
  assert.equal(await verify(request(token(claims(), { alg: "none", kid: "key-1" }))), false);
});

test("only project and simulation paths are private, never Quick Ripple", () => {
  for (const path of ["/api/projects", "/api/projects/abc/sources",
    "/api/saved-runs/x", "/api/simulation-jobs/x",
    "/api/simulation-runs/x/report"])
    assert.equal(isPrivateApiPath(path), true, path);
  for (const path of ["/api/status", "/api/ripple", "/api/projectile", "/"])
    assert.equal(isPrivateApiPath(path), false, path);
  assert.equal(isLocal({ ripplePrivateAccessVerified: true }), true);
  assert.equal(isLocal({ socket: { remoteAddress: "172.17.0.1" },
    headers: { host: "lab.ripple.example.com" } }), false);
});
