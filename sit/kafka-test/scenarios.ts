import { ENV } from "../lib/env.ts";
import { apiJson, pollUntil } from "../lib/client.ts";
import { KAFKA_TEST } from "./env.ts";
import { verifyOnDesk } from "./desk.ts";
import { Evidence } from "./evidence.ts";
import { deliveriesOf, runTag, sleep, type Delivery } from "./sandbench.ts";

// Building blocks shared by the format, exception and load scenarios: a test case that generates
// messages, throw-away Kafka connections with chosen wire options, runs, and feeders.

export type Wire = { format?: "json" | "xml" | "flat"; layout?: "compact" | "pretty"; encoding?: "none" | "base64" };
export type Created = { id: string; etag?: string };

export const longCall = () => ({ signal: AbortSignal.timeout(180_000) });

/** Dataset + active test case that generates messages of the configured message type. */
export async function generatingCase(ev: Evidence, id: string, tag = runTag()): Promise<string> {
  const dataset = await apiJson<Created>("/api/v1/datasets", { method: "POST", body: JSON.stringify({ name: `SIT Kafka data ${tag}`, messageTypeCode: ENV.messageTypeCode }) });
  const testCase = await apiJson<Created>("/api/v1/test-cases", { method: "POST", body: JSON.stringify({ name: `SIT Kafka case ${tag}`, datasetId: dataset.body.id, objective: "Generated messages for the Kafka test.", status: "active", priority: "Medium" }) });
  ev.check(dataset.status === 200 && testCase.status === 200 && testCase.body.id, id, "sand-bench", "Dataset and test case created for generated messages", `dataset ${dataset.body.id}, test case ${testCase.body.id}`);
  return testCase.body.id;
}

/** A saved Kafka connection of the test's own (the endpoint chooser), removed again by dropConnection. */
export async function makeConnection(ev: Evidence, id: string, connectionId: string, wire: Wire = {}, extra: Record<string, unknown> = {}) {
  const res = await apiJson<{ id: string; payloadFormat?: string; payloadLayout?: string; payloadEncoding?: string; brokerProxy?: string; enabled?: boolean }>(`/api/v1/external-systems/${connectionId}`, {
    method: "PUT",
    body: JSON.stringify({
      id: connectionId, name: `SIT ${connectionId}`, channel: "kafka", kind: "desk", family: "kafka", endpoint: "/app/send", topic: "sandbench.out",
      headers: { "x-sandbench-target": "kafka-desk", "x-sandbench-app": "sit-kafka-test" },
      payloadFormat: wire.format ?? "", payloadLayout: wire.layout ?? "", payloadEncoding: wire.encoding ?? "", ...extra,
    }),
  });
  const saved = res.body;
  const ok = res.status === 200 && (wire.format ?? undefined) === saved.payloadFormat && (wire.layout ?? undefined) === saved.payloadLayout && (wire.encoding ?? undefined) === saved.payloadEncoding;
  ev.check(ok, id, "sand-bench", "Kafka connection saved with the chosen wire options", `${connectionId}: format ${saved.payloadFormat ?? "JSON object (default)"}, layout ${saved.payloadLayout ?? "default"}, encoding ${saved.payloadEncoding ?? "default"}${saved.brokerProxy ? `, broker ${saved.brokerProxy}` : ""}`, saved);
}

export async function dropConnection(connectionId: string) {
  await apiJson(`/api/v1/external-systems/${connectionId}`, { method: "DELETE" }).catch(() => undefined);
}

export type CaseRun = { runId: string; status: string; result: string; totals: { generated: number; sent: number; simulated?: number; blocked: number; failed: number } };

/** Run a test case to a connection and wait for the outcome (the run is synchronous). */
export async function runCaseTo(caseId: string, connectionId: string, count: number): Promise<CaseRun> {
  const res = await apiJson<{ accepted: boolean; run: CaseRun }>(`/api/v1/test-cases/${caseId}/run`, { method: "POST", body: JSON.stringify({ connectionId, count }), ...longCall() });
  if (res.status !== 200 || !res.body.run?.runId) throw new Error(`POST /api/v1/test-cases/${caseId}/run answered ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`);
  return res.body.run;
}

export const tagId = (s: string) => s.replace(/[^a-z0-9]+/gi, "_").toLowerCase();

/** Which of these ids has Kafka Desk consumed from the broker, waiting up to waitMs. */
export async function desk(ids: string[], waitMs: number) {
  const v = await verifyOnDesk(ids.map((id) => ({ id })), waitMs);
  return { found: v.body.found ?? 0, missing: v.body.missing ?? [], raw: v.body };
}

/** A dataset of `count` stored messages ("format" content) with known ids; returns the dataset id and ids. */
export async function storedDataset(ev: Evidence, id: string, tag: string, count: number, format: "json" | "xml"): Promise<{ datasetId: string; ids: string[] }> {
  const ds = await apiJson<Created>("/api/v1/datasets", { method: "POST", body: JSON.stringify({ name: `SIT Kafka ${format} data ${tag}` }) });
  const ids = Array.from({ length: count }, (_u, i) => `SIT-K${format.toUpperCase()}-${tag}-${String(i + 1).padStart(3, "0")}`);
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const res = await apiJson(`/api/v1/datasets/${ds.body.id}/messages`, {
      method: "POST",
      body: JSON.stringify({ messages: batch.map((mid, j) => ({ name: mid, format, content: format === "xml" ? `<Doc><MsgId>${mid}</MsgId><Seq>${i + j + 1}</Seq><Amt>10.50</Amt></Doc>` : JSON.stringify({ MsgId: mid, seq: i + j + 1, amt: 10.5 }) })) }),
      ...longCall(),
    });
    if (res.status !== 200) throw new Error(`storing messages answered ${res.status}: ${JSON.stringify(res.body)}`);
  }
  ev.pass(id, "sand-bench", `Dataset of ${count} stored ${format.toUpperCase()} messages with known IDs`, `${ds.body.id}: ${ids[0]} … ${ids[count - 1]}`);
  return { datasetId: ds.body.id, ids };
}

export type FeederRun = { id: string; testRunId: string | null; status: string; messageCount: number; sent: number; failed: number; blocked: number; lastError: string | null; channel: string };

export async function createFeeder(name: string, datasetId: string, connectionId: string, count: number, seconds: number) {
  const start = new Date(Date.now() + 1500);
  return apiJson<Created & { name: string }>("/api/v1/data-feeders", {
    method: "POST",
    body: JSON.stringify({
      name, description: "Created by the Test Engine Kafka test.", datasets: [{ datasetId, weight: 1 }], messageCount: count, sendOrder: "sequential", externalSystemId: connectionId,
      windowStart: start.toISOString(), windowEnd: new Date(start.getTime() + seconds * 1000).toISOString(),
      pacing: { mode: "fixed", intervalSeconds: Math.max(0.01, seconds / Math.max(1, count)) }, spikes: [], seed: 7,
    }),
  });
}

export const startFeeder = (feederId: string) => apiJson<FeederRun>(`/api/v1/data-feeders/${feederId}/runs`, { method: "POST", body: JSON.stringify({ startMode: "now" }) });
export const feederRun = async (runId: string) => (await apiJson<FeederRun>(`/api/v1/data-feeder-runs/${runId}`)).body;
export const feederAction = (runId: string, action: "pause" | "resume" | "cancel") => apiJson<FeederRun>(`/api/v1/data-feeder-runs/${runId}/${action}`, { method: "POST" });

export async function untilFeederDone(runId: string, timeoutMs: number): Promise<FeederRun> {
  return pollUntil(() => feederRun(runId), (r) => !["running", "paused"].includes(r.status), { timeoutMs, intervalMs: 1000 });
}

export { deliveriesOf, sleep, runTag, KAFKA_TEST };
export type { Delivery };

import { preflight } from "./sandbench.ts";
const readyMemo = new WeakMap<Evidence, Promise<unknown>>();
/** The wiring checkpoints (Sand Bench delivers to Kafka, Kafka Desk consuming, connection present), recorded once per evidence file. */
export function ready(ev: Evidence, prefix: string) {
  if (!readyMemo.has(ev)) readyMemo.set(ev, preflight(ev, prefix));
  return readyMemo.get(ev)!;
}
