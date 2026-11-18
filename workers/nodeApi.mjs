function lowerCaseHeaders(headers) {
  return Object.fromEntries(Array.from(headers, ([key, value]) => [key.toLowerCase(), value]));
}

/**
 * Adapt the existing Node-style JSON API handlers to fetch Request/Response.
 * The private APIs return JSON, not streaming responses.
 */
export async function handleJsonApi(handler, request) {
  const url = new URL(request.url);
  const body = ["POST", "PATCH", "PUT"].includes(request.method)
    ? await request.text() : undefined;
  if (body != null && new TextEncoder().encode(body).byteLength > 128_000)
    return Response.json({ error: "Request too large" }, { status: 413 });
  const req = {
    url: url.pathname + url.search,
    method: request.method,
    body,
    headers: { ...lowerCaseHeaders(request.headers), host: url.host },
    ripplePrivateAccessVerified: true
  };
  let status = 200;
  const headers = new Headers();
  let chunks = [];
  let finished = false;
  const res = {
    get headersSent() { return finished; },
    get writableEnded() { return finished; },
    setHeader(name, value) { headers.set(name, value); },
    writeHead(code, nextHeaders = {}) {
      status = code;
      for (const [name, value] of Object.entries(nextHeaders))
        headers.set(name, value);
      return this;
    },
    write(chunk = "") {
      chunks.push(String(chunk));
      return true;
    },
    end(chunk = "") {
      if (chunk) chunks.push(String(chunk));
      finished = true;
      return this;
    },
    on() { return this; }
  };
  try {
    await handler(req, res, () => {
      res.writeHead(404);
      res.end(JSON.stringify({ error: "Not found" }));
    });
    if (!finished) return Response.json({ error: "Response incomplete" }, { status: 500 });
    headers.set("Cache-Control", "no-store");
    return new Response(chunks.join(""), { status, headers });
  } catch {
    return Response.json({ error: "Internal error" }, {
      status: 500, headers: { "Cache-Control": "no-store" }
    });
  }
}
