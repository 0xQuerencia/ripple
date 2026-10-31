import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { settingsFromEnv } from "../server/config.mjs";
import { SECURITY_HEADERS } from "../server/security.mjs";
import { createApi } from "../server/api.mjs";

test("settings come from the environment, with safe defaults", () => {
  const s = settingsFromEnv({});
  assert.deepEqual(s, {
    apiKey: "",
    model: "gemma-4-26b-a4b-it",
    trustedProxyHops: 0,
    limit: 12,
    globalLimit: 300,
  });
});

test("settings read every variable and ignore junk", () => {
  const s = settingsFromEnv({
    GEMINI_API_KEY: "k",
    GEMMA_MODEL: "gemma-4-31b-it",
    TRUSTED_PROXY_HOPS: "2",
    RATE_LIMIT_PER_MINUTE: "5",
    GLOBAL_LIMIT_PER_HOUR: "40",
  });
  assert.deepEqual(s, {
    apiKey: "k",
    model: "gemma-4-31b-it",
    trustedProxyHops: 2,
    limit: 5,
    globalLimit: 40,
  });
  const junk = settingsFromEnv({
    TRUSTED_PROXY_HOPS: "lots",
    RATE_LIMIT_PER_MINUTE: "-3",
    GLOBAL_LIMIT_PER_HOUR: "",
  });
  assert.deepEqual(
    [junk.trustedProxyHops, junk.limit, junk.globalLimit],
    [0, 12, 300],
  );
});

test("a host that always sits behind its own proxy can default the hop count to 1", () => {
  assert.equal(
    settingsFromEnv({}, { trustedProxyHops: 1 }).trustedProxyHops,
    1,
  );
  assert.equal(
    settingsFromEnv({ TRUSTED_PROXY_HOPS: "0" }, { trustedProxyHops: 1 })
      .trustedProxyHops,
    0,
  );
});

/** A request whose body the host already read and parsed, so there is nothing left to stream. */
function parsedRequest(body, ip = "5.5.5.5") {
  const req = Object.assign((async function* () {})(), {
    method: "POST",
    url: "/api/ripple",
    body,
    socket: {},
    headers: { "x-forwarded-for": ip },
  });
  let status = 0,
    text = "";
  const res = {
    setHeader() {},
    writeHead: (s) => {
      status = s;
    },
    write: (t) => {
      text += t;
    },
    end: (t) => {
      text += t ?? "";
    },
  };
  return {
    req,
    res,
    result: () => ({
      status,
      events: text
        .split("\n")
        .filter(Boolean)
        .map((l) => JSON.parse(l)),
    }),
  };
}

test("api: accepts a body the host already parsed (object, string or bytes)", async () => {
  const api = createApi({ apiKey: "", model: "m", trustedProxyHops: 1 });
  for (const body of [
    { causeId: "blackout" },
    '{"causeId":"blackout"}',
    Buffer.from('{"causeId":"blackout"}'),
  ]) {
    const { req, res, result } = parsedRequest(body);
    await api(req, res);
    assert.equal(result().status, 200, `body ${typeof body}`);
    assert.equal(result().events[0].origin.targetId, "power");
  }
});

test("api: a parsed body is still validated and size-limited", async () => {
  const api = createApi({ apiKey: "", model: "m", trustedProxyHops: 1 });
  for (const [body, expected] of [
    [{}, 400],
    ["{not json", 400],
    [["array"], 400],
    [{ text: "x".repeat(5000) }, 413],
  ]) {
    const { req, res, result } = parsedRequest(body);
    await api(req, res);
    assert.equal(result().status, expected, JSON.stringify(body).slice(0, 30));
  }
});

test("the Vercel config serves the same security headers as the Docker server", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  const sent = Object.fromEntries(
    config.headers.flatMap((rule) => rule.headers.map((h) => [h.key, h.value])),
  );
  assert.deepEqual(sent, SECURITY_HEADERS);
});

test("the Vercel config builds the site and gives the API time for a long ripple", async () => {
  const config = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );
  assert.equal(config.outputDirectory, "dist");
  assert.equal(config.buildCommand, "npm run build");
  assert.ok(
    config.functions["api/*.js"].maxDuration >= 90,
    "a ripple can take over a minute",
  );
});

test("both Vercel function entry points are real request handlers", async () => {
  for (const file of ["ripple", "status"]) {
    const mod = await import(`../api/${file}.js`);
    assert.equal(
      typeof mod.default,
      "function",
      `${file}.js should export a handler`,
    );
    assert.equal(mod.default.length >= 2, true);
  }
});

test("a secret file can never be uploaded to a host by accident", async () => {
  const ignore = await readFile(
    new URL("../.vercelignore", import.meta.url),
    "utf8",
  );
  for (const must of [".env", ".git", ".claude"])
    assert.match(ignore, new RegExp(`^${must.replace(".", "\\.")}$`, "m"));
});

test("link previews show the right line and a real 1200x630 image", async () => {
  const html = await readFile(
    new URL("../index.html", import.meta.url),
    "utf8",
  );
  const content = (key) =>
    html.match(
      new RegExp(`(?:property|name)="${key}"\\s+content="([^"]*)"`),
    )?.[1];
  const line = "Cause and Effect simulation. To answer your WHAT IFs";
  for (const key of ["description", "og:description", "twitter:description"])
    assert.equal(content(key), line, key);
  assert.equal(content("twitter:card"), "summary_large_image");
  // Previews need an absolute address, and it must point at a file that is really shipped.
  const image = content("og:image");
  assert.equal(content("twitter:image"), image);
  assert.match(image, /^https:\/\/.+\/og\.png$/);
  const png = await readFile(new URL("../public/og.png", import.meta.url));
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [1200, 630]);
  assert.ok(
    png.length < 600 * 1024,
    "keep it small enough for every app to fetch",
  );
});
