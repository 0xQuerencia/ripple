import test from "node:test";
import assert from "node:assert/strict";
import { runSyntheticEvaluation } from "./evaluation/harness.mjs";

test("all synthetic pricing fixtures replay, remain grounded, and respond to intervention", async () => {
  const report = await runSyntheticEvaluation();
  assert.equal(report.kind, "synthetic-integrity-only");
  assert.equal(report.calibratedAgainstHistory, false);
  assert.equal(report.cases, 12);
  assert.equal(report.allReplayVerified, true);
  assert.equal(report.allSourceIdsGrounded, true);
  assert.equal(report.allInterventionsRecognized, true);
  assert.ok(report.agentResponseSensitivity >= 1);
});
