export async function workOne(queue, workerId, executeTick, {
  now = () => Date.now(),
  leaseMs = 30_000,
  signal: externalSignal,
} = {}) {
  const job = queue.claim(workerId, { now: now(), leaseMs });
  if (!job) return null;
  const { ownerId, runId, id } = job;
  const store = queue.store;
  const run = store.getRun(ownerId, runId);
  let checkpoint = store.getCheckpoint(ownerId, runId);
  let tick = checkpoint?.tick ?? 0;
  let seq = checkpoint?.seq ?? 0;
  let calls = job.spentCalls;
  let tokens = job.spentTokens;

  try {
    while (tick < job.rounds) {
      const current = queue.get(ownerId, id);
      if (!current || current.status !== "running" || current.leaseOwner !== workerId)
        return { status: current?.status ?? "lost", tick };
      if (externalSignal?.aborted) return { status: "interrupted", tick };
      if (run.budget.maxCalls > 0 && calls >= run.budget.maxCalls) {
        queue.fail(ownerId, id, workerId, "budget_exhausted");
        return { status: "failed", tick };
      }

      const controller = new AbortController();
      const signal = externalSignal
        ? AbortSignal.any([externalSignal, controller.signal])
        : controller.signal;
      const guard = setInterval(() => {
        const latest = queue.get(ownerId, id);
        if (!latest || latest.status !== "running" || latest.leaseOwner !== workerId)
          controller.abort();
        else if (!queue.heartbeat(ownerId, id, workerId, { now: now(), leaseMs }))
          controller.abort();
      }, Math.max(100, Math.floor(leaseMs / 3)));

      let result;
      try {
        result = await executeTick({ tick: tick + 1, seq, checkpoint, signal, run, job });
      } finally {
        clearInterval(guard);
      }
      const beforeCommit = queue.get(ownerId, id);
      if (signal.aborted || !beforeCommit || beforeCommit.status !== "running" ||
          beforeCommit.leaseOwner !== workerId ||
          !queue.heartbeat(ownerId, id, workerId, { now: now(), leaseMs }))
        return { status: beforeCommit?.status ?? "interrupted", tick };
      if (!result || !Array.isArray(result.events) || !result.checkpoint ||
          result.checkpoint.tick !== tick + 1)
        throw new Error("Invalid tick result");

      store.appendEvents(ownerId, runId, result.events, result.checkpoint);
      checkpoint = result.checkpoint;
      tick = checkpoint.tick;
      seq = checkpoint.seq;
      const usage = result.usage ?? {};
      const stepCalls = usage.calls ?? 0;
      const stepTokens = usage.tokens ?? 0;
      const progress = queue.progress(ownerId, id, workerId, {
        seq, calls: stepCalls, tokens: stepTokens, now: now()
      });
      calls += stepCalls;
      tokens += stepTokens;
      if (progress.status === "paused") return { status: "paused", tick };
      if ((run.budget.maxTokens > 0 && tokens > run.budget.maxTokens) ||
          (run.budget.maxCalls > 0 && calls > run.budget.maxCalls)) {
        queue.fail(ownerId, id, workerId, "budget_exhausted");
        return { status: "failed", tick };
      }
    }
    queue.complete(ownerId, id, workerId);
    return { status: "done", tick };
  } catch (error) {
    const current = queue.get(ownerId, id);
    if (current?.status === "running" && current.leaseOwner === workerId)
      queue.fail(ownerId, id, workerId);
    throw error;
  }
}
