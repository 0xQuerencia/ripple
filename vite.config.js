import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createApi } from "./server/api.mjs";
import { DEFAULT_MODEL } from "./server/gemma.mjs";

/** Serve /api from the dev and preview servers so `npm run dev` is the only command to run. */
function rippleApi(env) {
  const api = createApi({
    apiKey: env.GEMINI_API_KEY ?? "",
    model: env.GEMMA_MODEL || DEFAULT_MODEL,
  });
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
    rollupOptions: {
      output: { manualChunks: { "world-canvas": ["@xyflow/react"] } },
    },
  },
}));
