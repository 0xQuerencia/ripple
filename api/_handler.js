// Vercel runs every file in api/ as its own function, but files starting with "_" are not exposed.
// This is the one real handler; ripple.js and status.js re-export it so both routes share it.
import { createApi } from "../server/api.mjs";
import { settingsFromEnv } from "../server/config.mjs";

// On Vercel every request arrives through Vercel's own proxy, so trust exactly one hop unless told otherwise.
export default createApi(settingsFromEnv(process.env, { trustedProxyHops: 1 }));
