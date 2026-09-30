import test from "node:test";
import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { startFakeKafkaProxy, startMockSandBench } from "./helpers/mock-sandbench-kafka.mjs";
import { runAllCases } from "../sit/lib/runner.mjs";
import { KAFKA_TEST_CASES } from "../sit/kafka-test/plan.mjs";
import type { EvidenceFile } from "../sit/kafka-test/evidence.ts";

// The Kafka tests (sit/cases/25-kafka-schedule, 26-kafka-data-feeder) run for real, end to end,
// against: the REAL Kafka Desk server (gavriq-kafka-desk, a sibling checkout), a fake Kafka REST
// proxy, and a mock of the Sand Bench API whose "worker" fires schedules and trickles feeders.
//
// What this proves: the tests' logic, the evidence they write, and that they fail — at the right
// checkpoint — when Sand Bench only simulates delivery, when a message never reaches the broker,
// and when the worker never runs a schedule. What it cannot prove is the real Docker wiring;
// that is what running the cases from the Test Engine's "Kafka test" menu against
// `sh scripts/kafka-stack.sh up` is for.

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const deskDir = path.resolve(process.env.KAFKA_DESK_DIR || path.join(root, "..", "gavriq-kafka-desk"));
const haveDesk = existsSync(path.join(deskDir, "apps/kafkaportal/checkpoints.mjs"));
const skip = haveDesk ? false : `Kafka Desk checkout with checkpoints not found at ${deskDir} (set KAFKA_DESK_DIR)`;

let nextPort = 18400 + (process.pid % 300);

async function until(fn: () => Promise<boolean>, ms = 10_000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (await fn().catch(() => false)) return true;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return false;
}

async function scenario(mode: "broker" | "simulated" | "drop-second" | "no-worker", files: string[]) {
  const proxy = await startFakeKafkaProxy();
  const sandBench = await startMockSandBench({ proxyBase: proxy.base, mode });
  const port = nextPort++;
  const desk: ChildProcess = spawn(process.execPath, [path.join(deskDir, "apps/kafkaportal/server.mjs")], {
    cwd: deskDir,
    env: {
      ...process.env,
      PORT: String(port),
      SBE_STUB_BASE: "http://127.0.0.1:1",
      SBE_REDPANDA_PROXY: proxy.base,
      SBE_KAFKA_TOPIC: "sandbench.out",
      SBE_KAFKA_TAP_POLL_MS: "50",
      DESK_DATA_FILE: path.join(os.tmpdir(), `kafka-flow-${process.pid}-${port}.json`),
    },
    stdio: "pipe",
  });
  desk.stdout?.on("data", () => {});
  desk.stderr?.on("data", () => {});
  const deskBase = `http://127.0.0.1:${port}`;
  assert.ok(await until(async () => (await fetch(`${deskBase}/health`)).ok, 10_000), "Kafka Desk did not start");

  // KAFKA_FLOW_EVIDENCE_DIR keeps the evidence of a run for inspection (last scenario wins).
  const evidenceRoot = process.env.KAFKA_FLOW_EVIDENCE_DIR || mkdtempSync(path.join(os.tmpdir(), "kafka-evidence-"));
  const saved = { ...process.env };
  Object.assign(process.env, {
    SIT_API_BASE: sandBench.base,
    SIT_KAFKA_DESK_BASE: deskBase,
    EVIDENCE_DIR: evidenceRoot,
    SIT_KAFKA_FEEDER_MESSAGES: "5",
    SIT_KAFKA_FEEDER_SECONDS: "8",
    SIT_KAFKA_DESK_CONFIRM_MS: "3000",
    SIT_KAFKA_SCHEDULE_WAIT_MS: "8000",
  });
  // A child `node --test` that inherits NODE_TEST_CONTEXT believes it is a subtest of this run and
  // stops printing TAP, which is what the runner parses.
  delete process.env.NODE_TEST_CONTEXT;
  try {
    const outcome = await runAllCases({ files });
    const evidence: Record<string, EvidenceFile> = {};
    const dir = path.join(evidenceRoot, "kafka-test");
    if (existsSync(dir)) {
      for (const name of readdirSync(dir).filter((f) => f.startsWith("latest-"))) {
        const file = JSON.parse(readFileSync(path.join(dir, name), "utf8")) as EvidenceFile;
        evidence[file.case] = file;
      }
    }
    return { outcome, evidence, proxy, sandBench };
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in saved)) delete process.env[key];
    Object.assign(process.env, saved);
    desk.kill("SIGKILL");
    await sandBench.close();
    await proxy.close();
  }
}

const failedCheckpoint = (file: EvidenceFile) => file.checkpoints.find((cp) => cp.status === "failed");

test("schedule and data feeder: every message Sand Bench sends is confirmed by Kafka Desk, with matching offsets", { skip, timeout: 240_000 }, async () => {
  const { outcome, evidence, proxy } = await scenario("broker", ["25-kafka-schedule", "26-kafka-data-feeder"]);
  const summary = outcome.results.map((r: { name: string; status: string }) => `${r.status}: ${r.name}`).join("\n");
  assert.equal(outcome.results.length, 2, summary);
  assert.ok(outcome.results.every((r: { passed: boolean }) => r.passed), summary);

  const schedule = evidence["kafka-schedule"]!;
  assert.equal(schedule.result, "passed");
  assert.equal(schedule.messages.length, 5);
  assert.ok(schedule.messages.every((m) => m.messageId && m.kafkaDesk.found && m.kafkaDesk.source === "broker" && m.coordinatesMatch));
  assert.deepEqual(schedule.checkpoints.filter((c) => c.status !== "passed"), []);
  for (const id of ["SCH-SB-01", "SCH-KD-01", "SCH-SB-02", "SCH-SB-04", "SCH-SB-05", "SCH-SB-07b", "SCH-KD-02b", "SCH-KD-02c", "SCH-KD-03"]) {
    assert.ok(schedule.checkpoints.some((c) => c.id === id), `checkpoint ${id} missing from the schedule evidence`);
  }
  assert.ok(schedule.checkpoints.some((c) => c.system === "sand-bench") && schedule.checkpoints.some((c) => c.system === "kafka-desk"), "checkpoints are recorded for both systems");

  const feeder = evidence["kafka-data-feeder"]!;
  assert.equal(feeder.result, "passed");
  assert.equal(feeder.messages.length, 5);
  assert.deepEqual(feeder.messages.map((m) => m.messageId), feeder.messages.map((_m, i) => feeder.messages[0]!.messageId!.replace(/-001$/, `-${String(i + 1).padStart(3, "0")}`)));
  assert.ok(feeder.messages.every((m) => m.kafkaDesk.found && m.coordinatesMatch));
  assert.deepEqual(feeder.checkpoints.filter((c) => c.status !== "passed"), []);
  for (const id of ["FDR-SB-04", "FDR-SB-06", "FDR-SB-07", "FDR-KD-01b", "FDR-SB-08b", "FDR-KD-02b", "FDR-KD-02c", "FDR-KD-04"]) {
    assert.ok(feeder.checkpoints.some((c) => c.id === id), `checkpoint ${id} missing from the feeder evidence`);
  }
  const progress = (feeder.sandBench.progress as Array<{ sent: number; seenByDesk: number }>) || [];
  assert.ok(progress.length >= 3, "the feeder was watched while it ran");
  assert.ok(progress.some((p) => p.seenByDesk >= 1 && p.seenByDesk < 5), "Kafka Desk showed messages arriving while the feeder was still sending");

  // the menu's plan (sit/kafka-test/plan.mjs) lists exactly the checkpoints the cases write
  for (const def of KAFKA_TEST_CASES) {
    const written = evidence[def.key]!.checkpoints.map((c) => c.id).sort();
    assert.deepEqual(def.checkpoints.map((c: { id: string }) => c.id).sort(), written, `plan for ${def.key} drifted from the checkpoints the case writes`);
  }

  // every message really went through the (fake) broker: 5 scheduled + 5 fed
  assert.equal(proxy.log.length, 10);
});

test("if Sand Bench only simulates Kafka delivery, both tests fail at the first Sand Bench checkpoint", { skip, timeout: 120_000 }, async () => {
  const { outcome, evidence } = await scenario("simulated", ["25-kafka-schedule", "26-kafka-data-feeder"]);
  assert.equal(outcome.results.length, 2);
  assert.ok(outcome.results.every((r: { passed: boolean }) => !r.passed));
  assert.equal(failedCheckpoint(evidence["kafka-schedule"]!)?.id, "SCH-SB-01");
  assert.match(failedCheckpoint(evidence["kafka-schedule"]!)?.detail || "", /SBE_REDPANDA_PROXY|compose\.kafkadesk\.yml/);
  assert.equal(failedCheckpoint(evidence["kafka-data-feeder"]!)?.id, "FDR-SB-01");
  assert.equal(evidence["kafka-schedule"]!.result, "failed");
});

test("a message Sand Bench acknowledged but the broker never received is caught by Kafka Desk's checkpoint", { skip, timeout: 120_000 }, async () => {
  const { outcome, evidence } = await scenario("drop-second", ["25-kafka-schedule"]);
  assert.equal(outcome.results.length, 1);
  assert.equal(outcome.results[0]?.passed, false);
  const file = evidence["kafka-schedule"]!;
  assert.equal(failedCheckpoint(file)?.id, "SCH-KD-02b");
  // Sand Bench's own checkpoints all held: it believed the delivery was fine
  assert.ok(file.checkpoints.filter((c) => c.system === "sand-bench").every((c) => c.status === "passed"));
  const missing = file.messages.filter((m) => !m.kafkaDesk.found);
  assert.equal(missing.length, 1);
  assert.equal(missing[0]!.ordinal, 2);
  assert.match(failedCheckpoint(file)?.detail || "", /MOCK-SCH-.*-2/);
});

test("a schedule the worker never runs fails at the worker checkpoint and is cleaned up", { skip, timeout: 120_000 }, async () => {
  const { outcome, evidence, sandBench } = await scenario("no-worker", ["25-kafka-schedule"]);
  assert.equal(outcome.results[0]?.passed, false);
  assert.equal(failedCheckpoint(evidence["kafka-schedule"]!)?.id, "SCH-SB-05");
  assert.match(failedCheckpoint(evidence["kafka-schedule"]!)?.detail || "", /worker/);
  assert.equal(sandBench.schedules.size, 0, "the test deleted the schedule it created");
});
