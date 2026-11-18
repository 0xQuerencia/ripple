const COOKIE = "ripple_sid";
const DAY = 86_400;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function base64url(bytes) {
  let result = "";
  for (const byte of bytes) result += String.fromCharCode(byte);
  return btoa(result).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(input) {
  const decoded = atob(input.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

async function keyFor(secret) {
  if (typeof secret !== "string" || secret.length < 32)
    throw new Error("RIPPLE_SESSION_SECRET is not configured");
  return crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {
    name: "HMAC", hash: "SHA-256"
  }, false, ["sign", "verify"]);
}

async function signed(session, key) {
  const signature = await crypto.subtle.sign("HMAC", key,
    new TextEncoder().encode("ripple-v1:" + session));
  return session + "." + base64url(new Uint8Array(signature));
}

function cookieFrom(request) {
  const header = request.headers.get("Cookie") || "";
  return header.split(";").map((part) => part.trim())
    .find((part) => part.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1) || "";
}

export async function browserWorkspace(request, secret) {
  const key = await keyFor(secret);
  const token = cookieFrom(request);
  const dot = token.indexOf(".");
  const candidate = dot < 0 ? "" : token.slice(0, dot);
  const signature = dot < 0 ? "" : token.slice(dot + 1);
  if (UUID.test(candidate) && /^[A-Za-z0-9_-]{40,60}$/.test(signature)) {
    try {
      const valid = await crypto.subtle.verify("HMAC", key,
        fromBase64url(signature),
        new TextEncoder().encode("ripple-v1:" + candidate));
      if (valid) return { id: candidate, cookie: null };
    } catch { /* invalid cookie gets a fresh isolated workspace */ }
  }
  const id = crypto.randomUUID();
  const value = await signed(id, key);
  return {
    id,
    cookie: `${COOKIE}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${365 * DAY}`
  };
}

export function validWriteOrigin(request, publicOrigin) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return true;
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    const allowed = [new URL(request.url).origin, publicOrigin].filter(Boolean)
      .map((value) => new URL(value).origin);
    return allowed.includes(new URL(origin).origin) &&
      (request.headers.get("Content-Type") || "").toLowerCase().startsWith("application/json");
  } catch { return false; }
}

export function privateRoute(pathname) {
  return /^\/api\/(?:projects(?:\/|$)|saved-runs(?:\/|$)|simulation-(?:jobs|runs)(?:\/|$))/.test(pathname);
}
