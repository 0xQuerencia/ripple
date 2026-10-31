/**
 * Who is asking? Behind a reverse proxy every connection comes from the proxy, so the real visitor
 * has to be read from X-Forwarded-For. Each trusted proxy appends the address it saw to the right
 * of that header, so the visitor is the entry `trustedProxyHops` from the right. Anything further
 * left was written by the client and can be faked, so it is never used.
 *
 * @param {{ socket?: { remoteAddress?: string }, headers?: Record<string, string | string[] | undefined> }} req
 * @param {number} trustedProxyHops how many proxies sit between the internet and this server (0 = none)
 * @returns {string}
 */
export function clientIp(req, trustedProxyHops = 0) {
  const socketAddress = req.socket?.remoteAddress ?? "unknown";
  if (!trustedProxyHops) return socketAddress;
  const forwarded = String(req.headers?.["x-forwarded-for"] ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  return forwarded.at(-trustedProxyHops) ?? socketAddress;
}
