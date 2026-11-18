import { runSyntheticEvaluation } from "../tests/evaluation/harness.mjs";

const summary = await runSyntheticEvaluation();
console.log(JSON.stringify(summary, null, 2));
if (!summary.allReplayVerified || !summary.allSourceIdsGrounded ||
    !summary.allInterventionsRecognized) process.exitCode = 1;
