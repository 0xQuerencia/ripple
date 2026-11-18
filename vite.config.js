import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createApi } from "./server/api.mjs";
import { settingsFromEnv } from "./server/config.mjs";

/** Serve /api from the dev and preview servers so `npm run dev` is the only command to run. */
function rippleApi(env) {
  const api = createApi(settingsFromEnv(env));
  const mount = (server) => {
    server.middlewares.use(api);
  };
  return {
    name: "ripple-api",
    configureServer: mount,
    configurePreviewServer: mount,
  };
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), rippleApi(loadEnv(mode, process.cwd(), ""))],
  build: {
    // 250+ tiny sprites: ship them as files, not as data URIs inside the JavaScript.
    assetsInlineLimit: 0,
    rollupOptions: {
      output: { manualChunks: { "world-canvas": ["@xyflow/react"] } },
    },
  },
}));
