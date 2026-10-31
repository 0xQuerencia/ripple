import { DEFAULT_MODEL } from "./gemma.mjs";

/** A non-negative whole number from an environment value, or the fallback when it is missing or not one. */
function wholeNumber(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/**
 * Everything the API needs from the environment, in one place, so every way of running it
 * (dev server, Docker, Vercel) reads the same variables the same way.
 *
 * @param {Record<string, string | undefined>} env
 * @param {{ trustedProxyHops?: number }} [defaults] what to assume when TRUSTED_PROXY_HOPS is unset;
 *   a host that always sits behind its own proxy (Vercel) passes 1
 */
export function settingsFromEnv(env = process.env, defaults = {}) {
  return {
    apiKey: env.GEMINI_API_KEY ?? "",
    model: env.GEMMA_MODEL || DEFAULT_MODEL,
    // How many reverse proxies sit in front of the server. See docs/DEPLOY.md.
    trustedProxyHops: wholeNumber(
      env.TRUSTED_PROXY_HOPS,
      defaults.trustedProxyHops ?? 0,
    ),
    limit: wholeNumber(env.RATE_LIMIT_PER_MINUTE, 12),
    globalLimit: wholeNumber(env.GLOBAL_LIMIT_PER_HOUR, 300),
  };
}
