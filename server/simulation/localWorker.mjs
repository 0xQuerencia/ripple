import { workOne } from "../jobs/worker.mjs";
import { createTickExecutor } from "./runner.mjs";

export function startLocalSimulationWorker(store, queue, { intervalMs = 250 } = {}) {
  const execute = createTickExecutor({
    store, getScenario: async (ownerId, scenarioId) => {
      const scenario = store.getScenario(ownerId, scenarioId);
      if (!scenario) throw new Error("Scenario not found");
      return scenario;
    }
  });
  let working = false;
  const loop = async () => {
    if (working) return;
    working = true;
    try {
      await workOne(queue, "local-" + process.pid, execute);
    } catch {
      console.error("[simulation] local job failed");
    } finally {
      working = false;
    }
  };
  const timer = setInterval(loop, intervalMs);
  timer.unref?.();
  return () => clearInterval(timer);
}
