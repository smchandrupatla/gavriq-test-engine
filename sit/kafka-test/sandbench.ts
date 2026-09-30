import { apiJson, pollUntil } from "../lib/client.ts";
import { ENV } from "../lib/env.ts";
import { KAFKA_TEST } from "./env.ts";
import { deskJson, type DeskStatus } from "./desk.ts";
import type { Coordinates, Evidence, MessageEvidence } from "./evidence.ts";

// The Sand Bench side of the Kafka tests: set-up through the public API (the same calls the
// console makes), and reading back what Sand Bench recorded for each delivery.

export type Delivery = {
  id: string;
  seq: number;
  channel: string;
  status: string;
  request_payload: Record<string, unknown>;
  detail: string | null;
};

export type ExternalSystem = { id: string; name: string; channel: string; topic: string; enabled: boolean };

/** Same format Sand Bench writes on an acknowledged Kafka delivery: "<topic> (partition P, offset O)". */
export function parseCoordinates(detail: string | null | undefined): Coordinates | null {
  const match = /^(.+) \(partition (\d+), offset (\d+)\)$/.exec(String(detail || ""));
  return match ? { topic: match[1]!, partition: Number(match[2]), offset: Number(match[3]) } : null;
}

/** The message ID of a payload: its first MsgId-style value (any depth, including inside a dataset message's `content`), or a dataset message's name; null when it carries none. */
export function messageIdOf(payload: unknown, depth = 0): string | null {
  if (!payload || typeof payload !== "object" || depth > 4) return null;
  if (Array.isArray(payload)) {
    for (const item of payload.slice(0, 20)) {
      const found = messageIdOf(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  const entries = Object.entries(payload as Record<string, unknown>);
  for (const [key, value] of entries) {
    if (/^(msg_?id|message_?id)$/i.test(key) && (typeof value === "string" || typeof value === "number") && String(value).trim()) return String(value).trim();
  }
  // A dataset message (what a data feeder sends) is {name, format, content}: the document is
  // a JSON string inside `content`, and its name is its identity.
  const content = (payload as Record<string, unknown>).content;
  if (typeof content === "string" && content.trim().startsWith("{")) {
    try {
      const inner = messageIdOf(JSON.parse(content), depth + 1);
      if (inner) return inner;
    } catch { /* not JSON: fall through */ }
  }
  for (const [, value] of entries) {
    const found = messageIdOf(value, depth + 1);
    if (found) return found;
  }
  const name = (payload as Record<string, unknown>).name;
  if (depth === 0 && typeof name === "string" && name.trim() && typeof content === "string") return name.trim();
  return null;
}

/** Short unique tag for names and message ids made by one test run. */
export function runTag(): string {
  return `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(2, 14)}-${Math.random().toString(16).slice(2, 6)}`;
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The checkpoints every Kafka test starts with, so a failure in the wiring is reported as
 * the wiring, not as a missing message an hour later:
 *   Sand Bench is up and its Kafka channel really delivers (not "simulated"),
 *   Kafka Desk is up and consuming the topic from the broker,
 *   Sand Bench has the Kafka Desk connection, enabled, pointing at a topic.
 */
export async function preflight(ev: Evidence, prefix: string): Promise<ExternalSystem> {
  let ready: { status?: string; delivery?: { configured?: string[]; unconfigured?: string[]; unconfiguredDeliveries?: string } } = {};
  try {
    const res = await fetch(`${ENV.apiBase}/ready`, { signal: AbortSignal.timeout(8000) });
    ready = (await res.json().catch(() => ({}))) as typeof ready;
    if (!res.ok) ev.fail(`${prefix}-SB-01`, "sand-bench", "Sand Bench API is ready", `GET ${ENV.apiBase}/ready answered ${res.status}: ${JSON.stringify(ready)}`);
  } catch (error) {
    if ((error as Error).name === "CheckpointFailed") throw error;
    ev.fail(`${prefix}-SB-01`, "sand-bench", "Sand Bench API is ready", `${ENV.apiBase} is not reachable (${(error as Error).message}). Set SIT_API_BASE.`);
  }
  const configured = ready.delivery?.configured || [];
  ev.check(
    configured.includes("kafka"),
    `${prefix}-SB-01`, "sand-bench", "Sand Bench is ready and its Kafka channel delivers to a real broker",
    () => configured.includes("kafka")
      ? `delivery.configured = [${configured.join(", ")}]`
      : `kafka is not among the channels that deliver (${configured.join(", ") || "none"}); deliveries would be "${ready.delivery?.unconfiguredDeliveries || "simulated"}", not sent. api and worker need SBE_REDPANDA_PROXY — start Sand Bench with compose.kafkadesk.yml.`,
    ready.delivery
  );

  let status: DeskStatus = {};
  const seen = await pollUntil(
    async () => {
      const health = await deskJson<{ status?: string }>("/health");
      if (health.status !== 200) return { ok: false as const, why: `GET /health answered ${health.status}` };
      const s = await deskJson<DeskStatus>("/app/status");
      status = s.body;
      return { ok: Boolean(s.status === 200 && s.body.tap?.connected), why: s.status !== 200 ? `GET /app/status answered ${s.status}` : `tap connected=${s.body.tap?.connected} lastError=${s.body.tap?.lastError ?? "none"}` };
    },
    (r) => r.ok,
    { timeoutMs: 60_000, intervalMs: 2000 }
  ).catch((error: Error) => ({ ok: false as const, why: `${KAFKA_TEST.deskBase} is not reachable (${error.message}). Set SIT_KAFKA_DESK_BASE, or start Kafka Desk with: docker compose --profile kafka up -d` }));
  ev.check(
    seen.ok,
    `${prefix}-KD-01`, "kafka-desk", "Kafka Desk is up and consuming the topic from the broker",
    () => seen.ok ? `subscribed to ${status.tap?.topics?.join(", ")} via ${status.tap?.proxy}` : seen.why,
    status.tap
  );

  const systems = await apiJson<{ data: ExternalSystem[] }>("/api/v1/external-systems");
  const system = systems.body.data?.find((row) => row.id === KAFKA_TEST.connectionId);
  ev.check(
    systems.status === 200 && system && system.enabled !== false && system.channel === "kafka" && system.topic,
    `${prefix}-SB-02`, "sand-bench", "Sand Bench has the Kafka Desk connection, enabled, with a topic",
    () => system ? `${system.name} (${system.id}) → topic ${system.topic}` : `external system ${KAFKA_TEST.connectionId} not found (GET /api/v1/external-systems answered ${systems.status})`,
    system
  );
  return system!;
}

export async function deliveriesOf(runId: string): Promise<Delivery[]> {
  const res = await apiJson<{ data: Delivery[]; total: number }>(`/api/v1/runs/${encodeURIComponent(runId)}/deliveries?limit=500`);
  if (res.status !== 200) throw new Error(`GET /api/v1/runs/${runId}/deliveries answered ${res.status}`);
  return res.body.data || [];
}

export function sandBenchRow(runId: string, d: Delivery): MessageEvidence["sandBench"] {
  return { runId, seq: d.seq, status: d.status, detail: d.detail, coordinates: parseCoordinates(d.detail) };
}
