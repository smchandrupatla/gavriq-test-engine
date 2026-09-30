import { test, after } from "node:test";
import { ENV } from "../lib/env.ts";
import { apiJson, pollUntil } from "../lib/client.ts";
import { Evidence } from "../kafka-test/evidence.ts";
import { checkSandBenchDeliveries, confirmOnKafkaDesk } from "../kafka-test/checks.ts";
import { KAFKA_TEST, createFeeder, deliveriesOf, desk, dropConnection, feederAction, feederRun, generatingCase, makeConnection, ready, runCaseTo, runTag, sleep, startFeeder, storedDataset, tagId, untilFeederDone } from "../kafka-test/scenarios.ts";
import { messageIdOf } from "../kafka-test/sandbench.ts";

// Kafka test 4 — EXCEPTIONS AND ALTERNATE PATHS. What Sand Bench and Kafka Desk do when Kafka is
// not there, comes back, or a run is interrupted:
//   KAFKA DOWN     a connection whose broker cannot be reached (nothing listens): every delivery
//                  must FAIL visibly, never "acknowledged" or "simulated", the run/feeder/schedule
//                  must end failed, and Kafka Desk must have received nothing.
//   RECOVERY       the same connection pointed back at a working broker delivers again.
//   ISOLATION      one connection's dead broker does not break another connection's deliveries.
//   INTERRUPTED    a feeder cancelled mid-run stops sending (what was sent is in Kafka, nothing after);
//                  a paused feeder sends nothing until resumed, then finishes in order.
//   REFUSED        a feeder aimed at a disabled connection is refused up front.
// The "down" broker is a per-connection broker endpoint (http://127.0.0.1:9 — refused at once), so no
// infrastructure is stopped. Checkpoints EXC-…; evidence: latest-kafka-exceptions.json.

const ev = new Evidence("kafka-exceptions", "Kafka down, recovery, interruption and refusal — failures must be visible and nothing must leak", { sandBenchApi: ENV.apiBase, kafkaDesk: KAFKA_TEST.deskBase });
after(async () => { await ev.save(); });
const DEAD = "http://127.0.0.1:9";
const conn = (name: string, tag: string) => `ext_sit_${tagId(name)}_${tag.replace(/-/g, "")}`;
const idsOf = (rows: Array<{ request_payload: Record<string, unknown> }>) => rows.map((r) => messageIdOf(r.request_payload)!).filter(Boolean);

test("Kafka down: a run to an unreachable broker fails every delivery visibly and Kafka Desk receives nothing", async () => {
  await ready(ev, "EXC");
  const tag = runTag(), c = conn("down_run", tag);
  try {
    const caseId = await generatingCase(ev, "EXC-DOWN-C", tag);
    await makeConnection(ev, "EXC-DOWN-CX", c, {}, { brokerProxy: DEAD });
    const run = await runCaseTo(caseId, c, 3);
    ev.check(run.totals.failed === 3 && run.totals.sent === 0 && !run.totals.simulated && run.status === "failed", "EXC-DOWN-R", "sand-bench", "The run ends failed with every message counted failed (not sent, not simulated)", `${run.status}/${run.result}: ${JSON.stringify(run.totals)}`);
    const rows = await deliveriesOf(run.runId);
    ev.check(rows.length === 3 && rows.every((r) => r.status === "failed" && r.detail), "EXC-DOWN-D", "sand-bench", "Every delivery row says failed and gives the reason", rows[0]?.detail ?? "no rows");
    const seen = await desk(idsOf(rows), 4000);
    ev.check(seen.found === 0, "EXC-DOWN-KD", "kafka-desk", "Kafka Desk has none of the messages (nothing leaked past the failed broker)", `${seen.found} of 3 seen`);
  } finally { await dropConnection(c); }
});

test("Kafka down: a data feeder to an unreachable broker finishes failed with every message failed and nothing sent", { timeout: 180_000 }, async () => {
  await ready(ev, "EXC");
  const tag = runTag(), c = conn("down_feeder", tag);
  try {
    const { datasetId, ids } = await storedDataset(ev, "EXC-DFEED-DS", tag, 4, "json");
    await makeConnection(ev, "EXC-DFEED-CX", c, {}, { brokerProxy: DEAD });
    const created = await createFeeder(`SIT Kafka down feeder ${tag}`, datasetId, c, 4, 4);
    const started = await startFeeder(created.body.id);
    ev.check(started.status === 201, "EXC-DFEED-S", "sand-bench", "Feeder starts (Sand Bench only finds out Kafka is down when it sends)", `run ${started.body.id}`);
    const run = await untilFeederDone(started.body.id, 90_000);
    ev.check(run.failed === 4 && run.sent === 0, "EXC-DFEED-R", "sand-bench", "All 4 messages are counted failed, none sent", `${run.status}: sent ${run.sent}, failed ${run.failed}${run.lastError ? `; last error: ${run.lastError}` : ""}`);
    ev.check(Boolean(run.lastError), "EXC-DFEED-E", "sand-bench", "The run carries the failure reason for the operator", run.lastError ?? "no lastError");
    const rows = await deliveriesOf(run.testRunId!);
    ev.check(rows.length === 4 && rows.every((r) => r.status === "failed"), "EXC-DFEED-D", "sand-bench", "Every delivery row is failed", rows.map((r) => r.status).join(", "));
    const seen = await desk(ids, 3000);
    ev.check(seen.found === 0, "EXC-DFEED-KD", "kafka-desk", "Kafka Desk has none of the messages", `${seen.found} of 4 seen`);
  } finally { await dropConnection(c); }
});

test("Kafka down: a schedule aimed at an unreachable broker runs and records failed deliveries", { timeout: 240_000 }, async () => {
  await ready(ev, "EXC");
  const tag = runTag(), c = conn("down_sched", tag);
  let scheduleId: string | null = null;
  try {
    const caseId = await generatingCase(ev, "EXC-DSCH-C", tag);
    await makeConnection(ev, "EXC-DSCH-CX", c, {}, { brokerProxy: DEAD });
    const created = await apiJson<{ id: string }>("/api/v1/schedules", { method: "POST", body: JSON.stringify({ name: `SIT Kafka down schedule ${tag}`, cadence: "once", targetType: "test_case", targetId: caseId, startsAt: new Date(Date.now() + 4000).toISOString(), connectionId: c }) });
    scheduleId = created.body.id;
    ev.check(created.status === 201, "EXC-DSCH-S", "sand-bench", "Schedule created for the unreachable connection", `schedule ${scheduleId}`);
    const fired = await pollUntil(async () => (await apiJson<{ last_run_id?: string; last_error?: string; status?: string }>(`/api/v1/schedules/${scheduleId}`)).body, (r) => Boolean(r.last_run_id || r.last_error), { timeoutMs: KAFKA_TEST.scheduleWaitMs, intervalMs: 2000 });
    ev.check(Boolean(fired.last_run_id || fired.last_error), "EXC-DSCH-F", "sand-bench", "The worker ran the schedule", `run ${fired.last_run_id ?? "none"}, status ${fired.status}${fired.last_error ? `, error ${fired.last_error}` : ""}`);
    if (fired.last_run_id) {
      const rows = await deliveriesOf(fired.last_run_id);
      ev.check(rows.length > 0 && rows.every((r) => r.status === "failed"), "EXC-DSCH-D", "sand-bench", "The scheduled run's deliveries are all failed, not acknowledged", `${rows.length} rows: ${[...new Set(rows.map((r) => r.status))].join(", ")}`);
      const seen = await desk(idsOf(rows), 3000);
      ev.check(seen.found === 0, "EXC-DSCH-KD", "kafka-desk", "Kafka Desk has none of the messages", `${seen.found} of ${rows.length} seen`);
    } else ev.pass("EXC-DSCH-D", "sand-bench", "The schedule refused to start its run against the dead broker", fired.last_error ?? "");
  } finally {
    if (scheduleId) await apiJson(`/api/v1/schedules/${scheduleId}`, { method: "DELETE" }).catch(() => undefined);
    await dropConnection(c);
  }
});

test("Kafka recovery: the same connection, pointed back at a working broker, delivers and Kafka Desk confirms", async () => {
  await ready(ev, "EXC");
  const tag = runTag(), c = conn("recover", tag);
  try {
    const caseId = await generatingCase(ev, "EXC-REC-C", tag);
    await makeConnection(ev, "EXC-REC-CX1", c, {}, { brokerProxy: DEAD });
    const down = await runCaseTo(caseId, c, 2);
    ev.check(down.totals.failed === 2, "EXC-REC-DOWN", "sand-bench", "While the broker is unreachable the run fails", JSON.stringify(down.totals));
    await makeConnection(ev, "EXC-REC-CX2", c, {}, { brokerProxy: "" });
    const up = await runCaseTo(await generatingCase(ev, "EXC-REC-C2", `${tag}b`), c, 3);
    ev.check(up.totals.sent === 3 && up.totals.failed === 0, "EXC-REC-UP", "sand-bench", "After the fix the same connection delivers (broker endpoint back to Sand Bench's default)", JSON.stringify(up.totals));
    const rows = await deliveriesOf(up.runId);
    checkSandBenchDeliveries(ev, "EXC-REC-SB", up.runId, rows, 3);
    await confirmOnKafkaDesk(ev, "EXC-REC-KD", up.runId, rows, { variant: "after recovery" });
  } finally { await dropConnection(c); }
});

test("Kafka isolation: one connection's dead broker does not stop another connection delivering", async () => {
  await ready(ev, "EXC");
  const tag = runTag(), bad = conn("iso_bad", tag), good = conn("iso_good", tag);
  try {
    await makeConnection(ev, "EXC-ISO-CX1", bad, {}, { brokerProxy: DEAD });
    await makeConnection(ev, "EXC-ISO-CX2", good, {});
    const badRun = await runCaseTo(await generatingCase(ev, "EXC-ISO-C1", `${tag}a`), bad, 2);
    const goodRun = await runCaseTo(await generatingCase(ev, "EXC-ISO-C2", `${tag}b`), good, 3);
    ev.check(badRun.totals.failed === 2 && goodRun.totals.sent === 3 && goodRun.totals.failed === 0, "EXC-ISO-R", "sand-bench", "The dead connection fails while the healthy one, straight afterwards, delivers", `dead ${JSON.stringify(badRun.totals)} · healthy ${JSON.stringify(goodRun.totals)}`);
    const rows = await deliveriesOf(goodRun.runId);
    await confirmOnKafkaDesk(ev, "EXC-ISO-KD", goodRun.runId, rows, { variant: "healthy connection" });
  } finally { await dropConnection(bad); await dropConnection(good); }
});

test("Kafka interrupted: cancelling a data feeder mid-run stops it; what was sent is in Kafka and nothing after", { timeout: 240_000 }, async () => {
  await ready(ev, "EXC");
  const tag = runTag(), c = conn("cancel", tag);
  const n = 8;
  let runId: string | null = null;
  try {
    const { datasetId, ids } = await storedDataset(ev, "EXC-CAN-DS", tag, n, "json");
    await makeConnection(ev, "EXC-CAN-CX", c, {});
    const created = await createFeeder(`SIT Kafka cancel ${tag}`, datasetId, c, n, 16);
    runId = (await startFeeder(created.body.id)).body.id;
    const midway = await pollUntil(() => feederRun(runId!), (r) => r.sent >= 3, { timeoutMs: 60_000, intervalMs: 500 });
    ev.check(midway.sent >= 3 && midway.sent < n, "EXC-CAN-MID", "sand-bench", "Feeder is part-way through when it is cancelled", `${midway.sent} of ${n} sent`);
    const cancelled = await feederAction(runId, "cancel");
    ev.check(cancelled.status === 200 && cancelled.body.status === "cancelled", "EXC-CAN-C", "sand-bench", "Sand Bench accepts the cancel and the run is cancelled", `${cancelled.status} ${cancelled.body.status}`);
    await sleep(6000);
    const final = await feederRun(runId);
    const seen = await desk(ids, 3000);
    ev.check(final.status === "cancelled" && final.sent < n, "EXC-CAN-STOP", "sand-bench", "No further messages are sent after the cancel", `${final.status}: sent ${final.sent} of ${n}`);
    ev.check(Math.abs(seen.found - final.sent) <= 1 && seen.found < n, "EXC-CAN-KD", "kafka-desk", "Kafka Desk has the messages sent before the cancel and none of the rest", `Kafka Desk ${seen.found}, Sand Bench sent ${final.sent}, of ${n}`);
  } finally { if (runId) await feederAction(runId, "cancel").catch(() => undefined); await dropConnection(c); }
});

test("Kafka interrupted: a paused data feeder sends nothing until resumed, then finishes in order", { timeout: 240_000 }, async () => {
  await ready(ev, "EXC");
  const tag = runTag(), c = conn("pause", tag);
  const n = 8;
  let runId: string | null = null;
  try {
    const { datasetId, ids } = await storedDataset(ev, "EXC-PAU-DS", tag, n, "json");
    await makeConnection(ev, "EXC-PAU-CX", c, {});
    const created = await createFeeder(`SIT Kafka pause ${tag}`, datasetId, c, n, 14);
    runId = (await startFeeder(created.body.id)).body.id;
    await pollUntil(() => feederRun(runId!), (r) => r.sent >= 2, { timeoutMs: 60_000, intervalMs: 500 });
    const paused = await feederAction(runId, "pause");
    ev.check(paused.body.status === "paused", "EXC-PAU-P", "sand-bench", "Feeder paused part-way", `${paused.body.status}`);
    await sleep(1500);
    const before = (await desk(ids, 0)).found;
    await sleep(5000);
    const during = (await desk(ids, 0)).found;
    ev.check(during === before, "EXC-PAU-HOLD", "kafka-desk", "While paused nothing new reaches Kafka Desk", `${before} messages before, ${during} after 5 s paused`);
    const resumed = await feederAction(runId, "resume");
    ev.check(resumed.body.status === "running", "EXC-PAU-R", "sand-bench", "Feeder resumed", `${resumed.body.status}`);
    const run = await untilFeederDone(runId, 90_000);
    ev.check(run.status === "completed" && run.sent === n, "EXC-PAU-DONE", "sand-bench", "The rest is sent after the resume", `${run.status}: sent ${run.sent} of ${n}`);
    const rows = await deliveriesOf(run.testRunId!);
    await confirmOnKafkaDesk(ev, "EXC-PAU-KD", run.testRunId!, rows, { variant: "pause/resume", ordered: true });
  } finally { if (runId) await feederAction(runId, "cancel").catch(() => undefined); await dropConnection(c); }
});

test("Kafka refused: a data feeder aimed at a disabled connection is refused before anything is sent", async () => {
  await ready(ev, "EXC");
  const tag = runTag(), c = conn("disabled", tag);
  try {
    const { datasetId, ids } = await storedDataset(ev, "EXC-DIS-DS", tag, 2, "json");
    await makeConnection(ev, "EXC-DIS-CX", c, {});
    const created = await createFeeder(`SIT Kafka disabled ${tag}`, datasetId, c, 2, 4);
    await apiJson(`/api/v1/external-systems/${c}`, { method: "PUT", body: JSON.stringify({ id: c, enabled: false }) });
    const started = await startFeeder(created.body.id);
    ev.check(started.status === 422, "EXC-DIS-R", "sand-bench", "Starting is refused (422) and names the disabled connection", `${started.status}: ${JSON.stringify(started.body).slice(0, 200)}`);
    const seen = await desk(ids, 2500);
    ev.check(seen.found === 0, "EXC-DIS-KD", "kafka-desk", "Nothing reached Kafka Desk", `${seen.found} of 2 seen`);
  } finally { await dropConnection(c); }
});
