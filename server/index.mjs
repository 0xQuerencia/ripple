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
const api = createApi({
  apiKey: process.env.GEMINI_API_KEY ?? "",
  model: process.env.GEMMA_MODEL || DEFAULT_MODEL,
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
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
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

createServer((req, res) => {
  api(req, res, () =>
    serveStatic(req, res).catch(() => {
      res.writeHead(500);
      res.end();
    }),
  );
}).listen(port, () => {
  console.log(
    `ripple on http://localhost:${port}  (${process.env.GEMINI_API_KEY ? "Gemma live" : "demo mode: set GEMINI_API_KEY"})`,
  );
});
