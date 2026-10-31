import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createApi } from "./api.mjs";
import { DEFAULT_MODEL } from "./gemma.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
try {
  process.loadEnvFile(join(root, ".env"));
} catch {
  /* .env is optional */
}

const dist = join(root, "dist");
const port = Number(process.env.PORT) || 8787;
const host = process.env.HOST || "0.0.0.0";

/** A non-negative whole number from the environment, or the fallback when it is missing or not one. */
function intFromEnv(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

const settings = {
  // How many reverse proxies sit in front of this server (Caddy, nginx, Cloudflare Tunnel...).
  // Needed so rate limits are per visitor, not per proxy. See docs/DEPLOY.md.
  trustedProxyHops: intFromEnv("TRUSTED_PROXY_HOPS", 0),
  limit: intFromEnv("RATE_LIMIT_PER_MINUTE", 12),
  globalLimit: intFromEnv("GLOBAL_LIMIT_PER_HOUR", 300),
};
const api = createApi({
  apiKey: process.env.GEMINI_API_KEY ?? "",
  model: process.env.GEMMA_MODEL || DEFAULT_MODEL,
  ...settings,
});

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".json": "application/json",
};
const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-src 'none'; object-src 'none'; base-uri 'self'",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

async function serveStatic(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
  } catch {
    res.writeHead(400);
    return res.end();
  }
  let file = normalize(join(dist, pathname));
  if (file !== dist && !file.startsWith(dist + sep)) {
    res.writeHead(403);
    return res.end();
  }
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) file = join(dist, "index.html");
  const immutable = file.includes(`${sep}assets${sep}`);
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    "Content-Type": TYPES[extname(file)] ?? "application/octet-stream",
    "Cache-Control": immutable
      ? "public, max-age=31536000, immutable"
      : "no-cache",
  });
  res.end(await readFile(file));
}

const server = createServer((req, res) => {
  api(req, res, () =>
    serveStatic(req, res).catch(() => {
      res.writeHead(500);
      res.end();
    }),
  );
});

server.listen(port, host, () => {
  console.log(
    `ripple on http://${host}:${port}  (${process.env.GEMINI_API_KEY ? "Gemma live" : "demo mode: set GEMINI_API_KEY"}, ` +
      `${settings.trustedProxyHops} trusted proxy hop(s), ${settings.limit}/min per visitor, ${settings.globalLimit}/hour overall)`,
  );
});

// `docker stop` and process managers send SIGTERM: finish in-flight ripples, then exit.
const SHUTDOWN_GRACE_MS = 10_000;
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), SHUTDOWN_GRACE_MS).unref();
  });
}
