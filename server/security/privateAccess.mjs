import { createPublicKey, verify as verifySignature } from "node:crypto";

const MAX_TOKEN_BYTES = 16_384;
const CERT_TTL_SECONDS = 300;

function decodeObject(encoded) {
  if (typeof encoded !== "string" || encoded.length > MAX_TOKEN_BYTES)
    throw new Error("Invalid token");
  const text = Buffer.from(encoded, "base64url").toString("utf8");
  const value = JSON.parse(text);
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error("Invalid token payload");
  return value;
}

function configOf(env) {
  const team = String(env.RIPPLE_ACCESS_TEAM || "").trim();
  const aud = String(env.RIPPLE_ACCESS_AUD || "").trim();
  const hostname = String(env.RIPPLE_PRIVATE_HOSTNAME || "").trim().toLowerCase();
  const email = String(env.RIPPLE_ACCESS_EMAIL || "").trim().toLowerCase();
  if (!/^[a-z0-9-]{1,63}$/i.test(team) ||
      !/^[a-z0-9_-]{10,160}$/i.test(aud) ||
      !/^[a-z0-9.-]{4,255}$/.test(hostname) ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return null;
  return { team, aud, hostname, email,
    issuer: `https://${team}.cloudflareaccess.com` };
}

export function createPrivateAccessVerifier(env = process.env, {
  fetchImpl = globalThis.fetch, now = () => Math.floor(Date.now() / 1000)
} = {}) {
  const config = configOf(env);
  let keys = [];
  let refreshedAt = 0;

  return async function verifyPrivateAccess(req) {
    if (!config) return false;
    let host;
    try {
      host = new URL("http://" + String(req.headers?.host || "")).hostname.toLowerCase();
    } catch {
      return false;
    }
    if (host !== config.hostname) return false;
    const token = req.headers?.["cf-access-jwt-assertion"];
    if (typeof token !== "string" || token.length > MAX_TOKEN_BYTES)
      return false;
    try {
      const parts = token.split(".");
      if (parts.length !== 3) return false;
      const header = decodeObject(parts[0]);
      const payload = decodeObject(parts[1]);
      const current = now();
      if (header.alg !== "RS256" || typeof header.kid !== "string" ||
          header.kid.length > 200 || payload.iss !== config.issuer ||
          !Array.isArray(payload.aud) || !payload.aud.includes(config.aud) ||
          String(payload.email || "").toLowerCase() !== config.email ||
          !Number.isInteger(payload.exp) || payload.exp <= current ||
          (Number.isInteger(payload.nbf) && payload.nbf > current + 60) ||
          (Number.isInteger(payload.iat) && payload.iat > current + 60))
        return false;
      if (refreshedAt + CERT_TTL_SECONDS <= current ||
          !keys.some((key) => key.kid === header.kid)) {
        const response = await fetchImpl(`${config.issuer}/cdn-cgi/access/certs`, {
          signal: AbortSignal.timeout(5000)
        });
        if (!response.ok) return false;
        const document = await response.json();
        if (!Array.isArray(document.keys) || document.keys.length > 20)
          return false;
        keys = document.keys.filter((key) =>
          key && key.kty === "RSA" && key.alg !== "none" &&
          typeof key.kid === "string" && key.n && key.e);
        refreshedAt = current;
      }
      const publicJwk = keys.find((key) => key.kid === header.kid);
      if (!publicJwk) return false;
      const key = createPublicKey({ key: publicJwk, format: "jwk" });
      return verifySignature("RSA-SHA256",
        Buffer.from(parts[0] + "." + parts[1]), key,
        Buffer.from(parts[2], "base64url"));
    } catch {
      return false;
    }
  };
}

export function isPrivateApiPath(path) {
  return /^\/api\/(?:projects(?:\/|$)|saved-runs(?:\/|$)|simulation-(?:jobs|runs)(?:\/|$))/.test(path);
}
