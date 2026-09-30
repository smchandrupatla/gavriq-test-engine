import { KAFKA_TEST } from "./env.ts";
import { coordinatesOf, deskJson, verifyOnDesk } from "./desk.ts";
import type { Evidence, MessageEvidence } from "./evidence.ts";
import { messageIdOf, sandBenchRow, type Delivery } from "./sandbench.ts";

/** The checkpoints shared by both scenarios, once Sand Bench says it has sent the messages. */

/**
 * Sand Bench side: every delivery of the run is a real Kafka acknowledgement.
 * "simulated" (no broker configured) and "failed" are exactly the outcomes a run summary can
 * hide behind a green "sent" count, so they are checked one by one.
 */
export function checkSandBenchDeliveries(ev: Evidence, id: string, runId: string, rows: Delivery[], expected: number) {
  ev.check(rows.length === expected, `${id}a`, "sand-bench", `Sand Bench recorded ${expected} deliveries for the run`, `run ${runId}: ${rows.length} delivery rows`);
  const notAcked = rows.filter((row) => row.status !== "acknowledged");
  ev.check(
    notAcked.length === 0,
    `${id}b`, "sand-bench", "Every delivery was acknowledged by the Kafka broker (none simulated, failed or blocked)",
    () => notAcked.length ? notAcked.slice(0, 5).map((row) => `#${row.seq} ${row.status}: ${row.detail}`).join("; ") : `${rows.length}/${rows.length} acknowledged`
  );
  const noCoords = rows.filter((row) => !sandBenchRow(runId, row).coordinates);
  ev.check(
    noCoords.length === 0,
    `${id}c`, "sand-bench", "Every acknowledgement carries the broker's topic, partition and offset",
    () => noCoords.length ? `no coordinates on #${noCoords.map((row) => row.seq).join(", #")} (detail: ${noCoords[0]!.detail})` : rows.slice(0, 3).map((row) => row.detail).join(" | ") + (rows.length > 3 ? " | …" : "")
  );
}

/**
 * Kafka Desk side: the desk consumed every message from the broker (not merely "was told"),
 * at the very topic/partition/offset Sand Bench was given.
 */
export async function confirmOnKafkaDesk(ev: Evidence, id: string, runId: string, rows: Delivery[]): Promise<MessageEvidence[]> {
  const items = rows.map((row) => {
    const messageId = messageIdOf(row.request_payload);
    return messageId ? { id: messageId } : { payload: row.request_payload };
  });
  const verify = await verifyOnDesk(items, KAFKA_TEST.deskConfirmMs);
  ev.check(verify.status === 200, `${id}a`, "kafka-desk", "Kafka Desk answered the checkpoint request", `POST /app/checkpoints/verify → ${verify.status}`);

  const messages: MessageEvidence[] = rows.map((row, index) => {
    const result = verify.body.results[index];
    const sandBench = sandBenchRow(runId, row);
    const seen = coordinatesOf(result?.evidence);
    return {
      ordinal: index + 1,
      messageId: messageIdOf(row.request_payload),
      sandBench,
      kafkaDesk: { found: Boolean(result?.found), source: result?.evidence?.source, coordinates: seen, seenAt: result?.evidence?.seenAt, matchedBy: result?.matchedBy },
      coordinatesMatch: Boolean(sandBench.coordinates && seen && sandBench.coordinates.topic === seen.topic && sandBench.coordinates.partition === seen.partition && sandBench.coordinates.offset === seen.offset),
    };
  });
  ev.messages.push(...messages);

  const missing = messages.filter((m) => !m.kafkaDesk.found);
  ev.check(
    missing.length === 0,
    `${id}b`, "kafka-desk", `Kafka Desk consumed every message ID from Kafka (${messages.length - missing.length}/${messages.length})`,
    () => missing.length
      ? `not seen within ${Math.round(KAFKA_TEST.deskConfirmMs / 1000)}s: ${missing.map((m) => m.messageId ?? `#${m.ordinal}`).join(", ")}`
      : messages.map((m) => m.messageId ?? `#${m.ordinal}`).slice(0, 4).join(", ") + (messages.length > 4 ? ", …" : ""),
    { missing: missing.map((m) => m.messageId ?? m.ordinal) }
  );
  const mismatched = messages.filter((m) => !m.coordinatesMatch);
  ev.check(
    mismatched.length === 0,
    `${id}c`, "kafka-desk", "Each message sits at the same topic, partition and offset in Sand Bench's acknowledgement and in Kafka Desk",
    () => mismatched.length
      ? mismatched.slice(0, 3).map((m) => `${m.messageId ?? `#${m.ordinal}`}: Sand Bench ${fmt(m.sandBench.coordinates)} vs Kafka Desk ${fmt(m.kafkaDesk.coordinates)}`).join("; ")
      : messages.slice(0, 3).map((m) => `${m.messageId ?? `#${m.ordinal}`} @ ${fmt(m.kafkaDesk.coordinates)}`).join(" | ") + (messages.length > 3 ? " | …" : "")
  );
  return messages;
}

/** The Receive screen's data: a person opening Kafka Desk sees the message, findable by its id. */
export async function checkVisibleInKafkaDesk(ev: Evidence, id: string, messages: MessageEvidence[]) {
  const probe = messages.find((m) => m.messageId)?.messageId;
  if (!probe) {
    ev.pass(id, "kafka-desk", "Messages are listed in Kafka Desk's Receive list", "skipped: the generated messages carry no message id to search for");
    return;
  }
  const inbox = await deskJson<{ total: number; filtered: number; data: Array<{ topic: string }> }>(`/app/inbox?source=redpanda&q=${encodeURIComponent(probe)}`);
  ev.check(
    inbox.status === 200 && inbox.body.filtered >= 1,
    id, "kafka-desk", "The message is listed in Kafka Desk's Receive list and can be found by its ID",
    `GET /app/inbox?source=redpanda&q=${probe} → ${inbox.body.filtered ?? 0} match(es) of ${inbox.body.total ?? 0}`
  );
}

function fmt(c: { topic: string; partition: number; offset: number } | null | undefined) {
  return c ? `${c.topic}[${c.partition}]@${c.offset}` : "none";
}
