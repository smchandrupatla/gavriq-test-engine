import { test } from "node:test";
import { ENV } from "../lib/env.ts";
import { apiJson } from "../lib/client.ts";
import { KAFKA_TEST } from "../kafka-test/env.ts";
import { verifyOnDesk } from "../kafka-test/desk.ts";
import { Evidence } from "../kafka-test/evidence.ts";
import { deliveriesOf, preflight, runTag, sleep } from "../kafka-test/sandbench.ts";
import { checkSandBenchDeliveries, checkVisibleInKafkaDesk, confirmOnKafkaDesk } from "../kafka-test/checks.ts";

// Kafka test 2 of 2 — DATA FEEDER.
//
// A person creates a data feeder in Sand Bench: a dataset of messages with known IDs, trickled
// to the Kafka Desk connection over a short window. The test starts it and watches it the
// way a person would: while it runs, messages must already be turning up in Kafka Desk (the
// generation is visible, not just a total at the end). When it has finished it compares the
// two systems message by message:
//   Sand Bench  — every message of the run was acknowledged by the broker (topic/partition/offset);
//   Kafka Desk  — consumed every message ID from the topic, at those offsets, in the order sent.
// Checkpoints FDR-SB-* are Sand Bench's, FDR-KD-* are Kafka Desk's. Evidence:
// EVIDENCE_DIR/kafka-test/latest-kafka-data-feeder.json (Test Engine → Kafka test).

type Created = { id: string; etag?: string };
type FeederRun = { id: string; testRunId: string | null; status: string; messageCount: number; sent: number; failed: number; blocked: number; progress: number; lastError: string | null; channel: string };

test("Kafka test: a data feeder created in Sand Bench sends its messages to Kafka and Kafka Desk confirms every message ID", { timeout: 420_000 }, async () => {
  const count = KAFKA_TEST.feederMessages;
  const seconds = KAFKA_TEST.feederSeconds;
  const ev = new Evidence("kafka-data-feeder", "Data feeder created in Sand Bench → messages in Kafka → confirmed by Kafka Desk", {
    sandBenchApi: ENV.apiBase,
    kafkaDesk: KAFKA_TEST.deskBase,
    connection: KAFKA_TEST.connectionId,
    feeder: { messages: count, seconds },
  });
  let liveRunId: string | null = null;
  let finalStatus = "running";
  try {
    const connection = await preflight(ev, "FDR");
    const tag = runTag();

    // -- Sand Bench: dataset with messages whose IDs this test knows ------------------------
    const ids = Array.from({ length: count }, (_unused, i) => `SIT-KFDR-${tag}-${String(i + 1).padStart(3, "0")}`);
    const dataset = await apiJson<Created>("/api/v1/datasets", { method: "POST", body: JSON.stringify({ name: `SIT Kafka feeder data ${tag}` }) });
    ev.check(dataset.status === 200 && dataset.body.id, "FDR-SB-03", "sand-bench", "Dataset created for the feeder", `POST /api/v1/datasets → ${dataset.status} ${dataset.body.id ?? JSON.stringify(dataset.body)}`);
    const stored = await apiJson<{ stored: number }>(`/api/v1/datasets/${dataset.body.id}/messages`, {
      method: "POST",
      body: JSON.stringify({
        messages: ids.map((id, i) => ({
          name: id,
          format: "json",
          content: JSON.stringify({ MsgId: id, kind: "sit-kafka-feeder", sequence: i + 1, note: "Sent by the Test Engine Kafka test." }),
        })),
      }),
    });
    ev.check(stored.status === 200 && stored.body.stored === count, "FDR-SB-03b", "sand-bench", `${count} messages with known IDs stored in the dataset`, `${stored.body.stored ?? 0} stored: ${ids[0]} … ${ids[count - 1]}`);
    ev.sandBench.datasetId = dataset.body.id;

    // -- Sand Bench: the feeder ------------------------------------------------------------
    const windowStart = new Date(Date.now() + 2000);
    const feeder = await apiJson<Created & { name: string }>("/api/v1/data-feeders", {
      method: "POST",
      body: JSON.stringify({
        name: `SIT Kafka feeder ${tag}`,
        description: "Created by the Test Engine Kafka test: trickles known messages to Kafka Desk.",
        datasets: [{ datasetId: dataset.body.id, weight: 1 }],
        messageCount: count,
        sendOrder: "sequential",
        externalSystemId: connection.id,
        windowStart: windowStart.toISOString(),
        windowEnd: new Date(windowStart.getTime() + seconds * 1000).toISOString(),
        pacing: { mode: "fixed", intervalSeconds: Math.max(0.5, seconds / count) },
        spikes: [],
        seed: 20260930,
      }),
    });
    ev.check(feeder.status === 201 && feeder.body.id, "FDR-SB-04", "sand-bench", "Data feeder created in Sand Bench for the Kafka Desk connection", `POST /api/v1/data-feeders → ${feeder.status}; ${feeder.body.name}: ${count} messages over ${seconds}s to ${connection.name} (topic ${connection.topic})`, feeder.body);
    ev.sandBench.feederId = feeder.body.id;

    const plan = await apiJson<{ plan: { summary?: { messageCount?: number; durationSeconds?: number }; sample?: Array<{ seq: number; at: string }>; warnings?: string[] } }>(`/api/v1/data-feeders/${feeder.body.id}/plan`);
    const planned = plan.body.plan?.summary?.messageCount;
    ev.check(
      plan.status === 200 && planned === count && (plan.body.plan?.sample?.length ?? 0) === count,
      "FDR-SB-05", "sand-bench", "The feeder's send plan lists every message with its send time",
      () => `GET /api/v1/data-feeders/${feeder.body.id}/plan → ${plan.status}; ${planned ?? "?"} planned over ${plan.body.plan?.summary?.durationSeconds ?? "?"}s, first at ${plan.body.plan?.sample?.[0]?.at ?? "?"}`
    );

    // -- Start it and watch it the way a person would ---------------------------------------
    const started = await apiJson<FeederRun>(`/api/v1/data-feeders/${feeder.body.id}/runs`, { method: "POST", body: JSON.stringify({ startMode: "now" }) });
    liveRunId = started.body.id || null;
    ev.check(started.status === 201 && liveRunId && started.body.channel === "kafka", "FDR-SB-06", "sand-bench", "Feeder started; it sends over the kafka channel", `POST …/runs → ${started.status}; run ${liveRunId}, status ${started.body.status}, channel ${started.body.channel}`, started.body);
    ev.sandBench.feederRunId = liveRunId;
    ev.sandBench.testRunId = started.body.testRunId;

    const deadline = Date.now() + seconds * 1000 + 90_000;
    const samples: Array<{ at: string; sent: number; seenByDesk: number }> = [];
    let run: FeederRun = started.body;
    let seenWhileRunning = 0;
    while (Date.now() < deadline) {
      run = (await apiJson<FeederRun>(`/api/v1/data-feeder-runs/${liveRunId}`)).body;
      const probe = await verifyOnDesk(ids.map((id) => ({ id })), 0);
      const seenByDesk = probe.body.found ?? 0;
      samples.push({ at: new Date().toISOString(), sent: run.sent, seenByDesk });
      finalStatus = run.status;
      if (["running", "paused"].includes(run.status)) seenWhileRunning = Math.max(seenWhileRunning, seenByDesk);
      if (!["running", "paused"].includes(run.status)) break;
      await sleep(1000);
    }
    ev.sandBench.progress = samples;
    ev.check(
      run.status === "completed",
      "FDR-SB-07", "sand-bench", "The feeder ran to completion",
      `status ${run.status}: sent ${run.sent}, failed ${run.failed}, blocked ${run.blocked} of ${run.messageCount}${run.lastError ? `; last error: ${run.lastError}` : ""}`,
      run
    );
    ev.check(
      run.sent === count && run.failed === 0 && run.blocked === 0,
      "FDR-SB-07b", "sand-bench", `All ${count} messages were sent, none failed or blocked`,
      `sent ${run.sent}, failed ${run.failed}, blocked ${run.blocked}`
    );
    ev.check(
      seenWhileRunning >= 1,
      "FDR-KD-01b", "kafka-desk", "Messages were appearing in Kafka Desk while the feeder was still sending (the feed is visible live)",
      () => `Kafka Desk had ${seenWhileRunning} of ${count} while the run was still going; ${samples.length} samples, ${samples.map((s) => s.seenByDesk).join("→")}`
    );

    // -- Sand Bench: what it says it delivered -----------------------------------------------
    const testRunId = run.testRunId!;
    const rows = await deliveriesOf(testRunId);
    checkSandBenchDeliveries(ev, "FDR-SB-08", testRunId, rows, count);
    const sentNames = rows.map((row) => String(row.request_payload?.name ?? ""));
    ev.check(
      JSON.stringify(sentNames) === JSON.stringify(ids),
      "FDR-SB-08d", "sand-bench", "The messages went out in dataset order with the IDs this test stored",
      () => JSON.stringify(sentNames) === JSON.stringify(ids) ? `${ids[0]} … ${ids[count - 1]}` : `expected ${ids.join(", ")} but Sand Bench sent ${sentNames.join(", ")}`
    );

    // -- Kafka Desk: what it independently saw ------------------------------------------------
    const messages = await confirmOnKafkaDesk(ev, "FDR-KD-02", testRunId, rows);
    const offsets = messages.map((m) => m.kafkaDesk.coordinates ?? null);
    const onePartition = new Set(offsets.map((o) => o?.partition)).size === 1;
    const ascending = onePartition && offsets.every((o, i) => i === 0 || o!.offset > offsets[i - 1]!.offset);
    ev.check(
      !onePartition || ascending,
      "FDR-KD-04", "kafka-desk", "On the topic the messages are in the order the feeder sent them",
      () => `offsets ${offsets.map((o) => o?.offset).join(", ")} (partition ${[...new Set(offsets.map((o) => o?.partition))].join("/")})`
    );
    await checkVisibleInKafkaDesk(ev, "FDR-KD-03", messages);
  } catch (error) {
    ev.finish(error);
    throw error;
  } finally {
    if (liveRunId && ["running", "paused"].includes(finalStatus)) {
      // If the test stopped early, do not leave a feeder trickling messages into Kafka.
      await apiJson(`/api/v1/data-feeder-runs/${liveRunId}/cancel`, { method: "POST" }).catch(() => undefined);
    }
    await ev.save();
  }
});
