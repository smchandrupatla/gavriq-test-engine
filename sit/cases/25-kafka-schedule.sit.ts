import { test } from "node:test";
import { ENV } from "../lib/env.ts";
import { apiJson, pollUntil } from "../lib/client.ts";
import { KAFKA_TEST } from "../kafka-test/env.ts";
import { Evidence } from "../kafka-test/evidence.ts";
import { deliveriesOf, preflight, runTag } from "../kafka-test/sandbench.ts";
import { checkSandBenchDeliveries, checkVisibleInKafkaDesk, confirmOnKafkaDesk } from "../kafka-test/checks.ts";

// Kafka test 1 of 2 — SCHEDULE.
//
// A person creates a schedule in Sand Bench that runs a test case and delivers its generated
// test messages to the Kafka Desk connection. Nothing here fires the run: the Sand Bench
// worker does, when the schedule is due. Then the test asks the two systems, independently,
// whether the messages made it:
//   Sand Bench  — the run's deliveries are broker acknowledgements (topic, partition, offset);
//   Kafka Desk  — it consumed every one of those message IDs from the topic, at those offsets.
// Checkpoints SCH-SB-* are Sand Bench's, SCH-KD-* are Kafka Desk's. Evidence:
// EVIDENCE_DIR/kafka-test/latest-kafka-schedule.json (Test Engine → Kafka test).

type Created = { id: string; etag?: string };
type ScheduleRow = { id: string; status?: string; enabled?: boolean; next_run_at?: string; last_run_id?: string | null; last_error?: string | null; run_count?: number };

test("Kafka test: a schedule created in Sand Bench sends its test messages to Kafka and Kafka Desk confirms every message ID", { timeout: 420_000 }, async () => {
  const ev = new Evidence("kafka-schedule", "Schedule created in Sand Bench → messages in Kafka → confirmed by Kafka Desk", {
    sandBenchApi: ENV.apiBase,
    kafkaDesk: KAFKA_TEST.deskBase,
    connection: KAFKA_TEST.connectionId,
    messageType: ENV.messageTypeCode,
  });
  let scheduleId: string | null = null;
  try {
    const connection = await preflight(ev, "SCH");
    const tag = runTag();

    // -- Sand Bench: what a person sets up ------------------------------------------------
    const dataset = await apiJson<Created>("/api/v1/datasets", {
      method: "POST",
      body: JSON.stringify({ name: `SIT Kafka schedule data ${tag}`, messageTypeCode: ENV.messageTypeCode }),
    });
    ev.check(dataset.status === 200 && dataset.body.id, "SCH-SB-03", "sand-bench", "Dataset created for the scheduled test case", `POST /api/v1/datasets → ${dataset.status} ${dataset.body.id ?? JSON.stringify(dataset.body)}`);
    const testCase = await apiJson<Created>("/api/v1/test-cases", {
      method: "POST",
      body: JSON.stringify({ name: `SIT Kafka schedule case ${tag}`, datasetId: dataset.body.id, objective: "Deliver generated messages to Kafka Desk on a schedule (Test Engine → Kafka test).", status: "active", priority: "Medium" }),
    });
    ev.check(testCase.status === 200 && testCase.body.id, "SCH-SB-03b", "sand-bench", "Test case created and linked to the dataset", `POST /api/v1/test-cases → ${testCase.status} ${testCase.body.id ?? JSON.stringify(testCase.body)}`);
    ev.sandBench.datasetId = dataset.body.id;
    ev.sandBench.testCaseId = testCase.body.id;

    const startsAt = new Date(Date.now() + 5000).toISOString();
    const created = await apiJson<ScheduleRow>("/api/v1/schedules", {
      method: "POST",
      body: JSON.stringify({ name: `SIT Kafka schedule ${tag}`, cadence: "once", targetType: "test_case", targetId: testCase.body.id, startsAt, connectionId: connection.id }),
    });
    scheduleId = created.body.id || null;
    ev.check(
      created.status === 201 && scheduleId,
      "SCH-SB-04", "sand-bench", "Schedule created in Sand Bench for the Kafka Desk connection",
      `POST /api/v1/schedules → ${created.status}; ${created.body.id} runs once at ${startsAt} to ${connection.name} (topic ${connection.topic})`,
      created.body
    );
    ev.sandBench.scheduleId = scheduleId;

    // -- Sand Bench: the worker fires it -------------------------------------------------
    const fired = await pollUntil(
      async () => (await apiJson<ScheduleRow>(`/api/v1/schedules/${scheduleId}`)).body,
      (row) => Boolean(row.last_run_id || row.last_error),
      { timeoutMs: KAFKA_TEST.scheduleWaitMs, intervalMs: 2000 }
    );
    ev.check(
      Boolean(fired.last_run_id) && !fired.last_error,
      "SCH-SB-05", "sand-bench", "The Sand Bench worker ran the schedule when it came due",
      () => fired.last_run_id
        ? `run ${fired.last_run_id} (schedule status ${fired.status}, run count ${fired.run_count})`
        : fired.last_error
          ? `the schedule could not start its run: ${fired.last_error}`
          : `not run within ${Math.round(KAFKA_TEST.scheduleWaitMs / 1000)}s (status ${fired.status}, next run ${fired.next_run_at}) — is the Sand Bench worker running?`,
      fired
    );
    const runId = fired.last_run_id!;
    ev.sandBench.runId = runId;

    // -- Sand Bench: what it says it delivered ---------------------------------------------
    const rows = await deliveriesOf(runId);
    ev.check(rows.length > 0, "SCH-SB-06", "sand-bench", "The scheduled run has deliveries", `${rows.length} delivery rows on run ${runId}`);
    checkSandBenchDeliveries(ev, "SCH-SB-07", runId, rows, rows.length);
    ev.check(rows.every((row) => row.channel === "kafka"), "SCH-SB-07d", "sand-bench", "All deliveries went over the kafka channel", [...new Set(rows.map((row) => row.channel))].join(", "));

    // -- Kafka Desk: what it independently saw ---------------------------------------------
    const messages = await confirmOnKafkaDesk(ev, "SCH-KD-02", runId, rows);
    await checkVisibleInKafkaDesk(ev, "SCH-KD-03", messages);
    ev.sandBench.messages = messages.length;
  } catch (error) {
    ev.finish(error);
    throw error;
  } finally {
    if (scheduleId) {
      // A one-off schedule is finished once it has run; deleting keeps the schedule list clean.
      await apiJson(`/api/v1/schedules/${scheduleId}`, { method: "DELETE" }).catch(() => undefined);
    }
    await ev.save();
  }
});
