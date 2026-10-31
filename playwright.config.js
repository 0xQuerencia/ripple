import { defineConfig } from "@playwright/test";

// Browser tests run against the offline demo engine (no Gemini key) so results are deterministic.
const PORT = 5179;
export default defineConfig({
  testDir: "./tests/browser",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    viewport: { width: 1440, height: 1000 },
  },
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}`,
    env: { GEMINI_API_KEY: "" },
    reuseExistingServer: false,
  },
});
