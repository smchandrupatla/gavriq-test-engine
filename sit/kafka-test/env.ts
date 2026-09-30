import path from "node:path";

// Settings for the "Kafka test" cases (sit/cases/25-kafka-schedule, 26-kafka-data-feeder).
// The Sand Bench side reuses sit/lib/env.ts (SIT_API_BASE, SIT_USERNAME, ...); only what is
// specific to Kafka Desk and to these tests lives here.

const trimSlash = (url: string) => url.replace(/\/$/, "");
const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

export const KAFKA_TEST = {
  /** Kafka Desk (gavriq-kafka-desk). "kafka-desk" is its alias on the shared network gavriq-kafka-net. */
  deskBase: trimSlash(process.env.SIT_KAFKA_DESK_BASE || "http://kafka-desk:8095"),
  /** Only when the desk runs with SBE_BASIC_USER / SBE_BASIC_PASS. */
  deskUser: process.env.SIT_KAFKA_DESK_USER || "",
  deskPass: process.env.SIT_KAFKA_DESK_PASS || "",
  /** The Sand Bench external system (saved connection) that points at Kafka Desk's topic. */
  connectionId: process.env.SIT_KAFKA_CONNECTION_ID || "ext_kafka_desk",
  /** Where checkpoint evidence is written. Inside the Test Engine container this is the shared evidence volume. */
  evidenceDir: path.join(process.env.EVIDENCE_DIR || path.resolve(process.cwd(), "evidence"), "kafka-test"),
  /** How long the worker may take to pick up a schedule that is due. */
  scheduleWaitMs: num(process.env.SIT_KAFKA_SCHEDULE_WAIT_MS, 90_000),
  /** How long Kafka Desk may take to show a message after Sand Bench had it acknowledged. */
  deskConfirmMs: num(process.env.SIT_KAFKA_DESK_CONFIRM_MS, 30_000),
  /** Data feeder shape: N messages spread over this many seconds. */
  feederMessages: Math.max(2, Math.floor(num(process.env.SIT_KAFKA_FEEDER_MESSAGES, 6))),
  feederSeconds: Math.max(4, num(process.env.SIT_KAFKA_FEEDER_SECONDS, 12)),
};

export function deskAuthHeaders(): Record<string, string> {
  if (!KAFKA_TEST.deskUser) return {};
  return { authorization: `Basic ${Buffer.from(`${KAFKA_TEST.deskUser}:${KAFKA_TEST.deskPass}`).toString("base64")}` };
}
