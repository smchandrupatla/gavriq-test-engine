#!/usr/bin/env node
// Post-deployment system integration test (SIT) engine — one-shot CLI entry point.
//
// Run this after `docker compose up` (or equivalent) brings the whole stack up: it waits
// for the main application, test hub (MQ/Kafka/API mimic), and db viewer to report
// healthy, then runs every case in sit/cases/*.sit.ts against the real, deployed
// services over the network — no in-process stubs, no mocked pg client. Exits non-zero
// if any case failed, so a deploy pipeline can gate on it.
//
// For a persistent, browsable dashboard instead of a one-shot exit-code gate, run
// sit/console.mjs — see sit/README.md. Both share this same case-execution engine
// (sit/lib/runner.mjs) so they can never disagree about the results.
import { SERVICES } from "./lib/env.ts";
import { waitForHealth } from "./lib/wait.mjs";
import { runAllCases, reportToTesthub } from "./lib/runner.mjs";

async function main() {
  console.log("sit/run.mjs: waiting for deployed services to become healthy...");
  for (const service of SERVICES) {
    await waitForHealth(service.healthUrl, { label: service.name });
    console.log(`  ready: ${service.name}`);
  }

  console.log("sit/run.mjs: running case files against the deployed stack...");
  const { results, durationMs, anyProcessFailed } = await runAllCases({
    onFileStart: (file) => console.log(`\n=== ${file.fileName} ===`),
    onOutput: (_file, chunk) => process.stdout.write(chunk),
  });

  const failedCount = results.filter((row) => row.status === 'failed' || (!row.status && !row.passed)).length;
  const skippedCount = results.filter(row => row.status === 'skipped' || row.status === 'todo').length;
  console.log(`\nsit/run.mjs: ${results.length} cases, ${results.filter(row => row.passed).length} passed, ${failedCount} failed, ${skippedCount} skipped/todo (${Math.round(durationMs / 1000)}s)`);

  const reported = await reportToTesthub(results, { durationMs });
  if (!reported) console.warn("sit/run.mjs: could not report results to test hub coverage page");

  if (failedCount > 0 || anyProcessFailed) {
    console.error("sit/run.mjs: post-deployment system integration tests FAILED");
    process.exit(1);
  }
  console.log("sit/run.mjs: post-deployment system integration tests passed");
}

main().catch((error) => {
  console.error("sit/run.mjs: fatal error", error);
  process.exit(1);
});
