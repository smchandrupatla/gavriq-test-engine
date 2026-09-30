import { test, after } from "node:test";
import { ENV } from "../lib/env.ts";
import { Evidence } from "../kafka-test/evidence.ts";
import { checkSandBenchDeliveries, confirmOnKafkaDesk } from "../kafka-test/checks.ts";
import { KAFKA_TEST, createFeeder, deliveriesOf, dropConnection, generatingCase, makeConnection, ready, runCaseTo, runTag, startFeeder, storedDataset, tagId, untilFeederDone } from "../kafka-test/scenarios.ts";

// Kafka test 5 — LOAD. More messages, faster, in every wire form. Each test sends a volume through Sand
// Bench and then requires Kafka Desk to have consumed EVERY message exactly once (no loss, no
// duplicates) in the order sent, within the confirmation window. Volumes are set with
// SIT_KAFKA_LOAD_MESSAGES (default 200), SIT_KAFKA_LOAD_FEEDER_SECONDS (default 10). Throughput and
// timings are recorded in the evidence. Checkpoints LOAD-…; evidence: latest-kafka-load.json.

const N = Math.max(10, Math.floor(Number(process.env.SIT_KAFKA_LOAD_MESSAGES) || 200));
const SECONDS = Math.max(5, Number(process.env.SIT_KAFKA_LOAD_FEEDER_SECONDS) || 10);
const ev = new Evidence("kafka-load", `Load: ${N} messages per test, run, feeder and three feeders at once, JSON and XML/base64/pretty`, { sandBenchApi: ENV.apiBase, kafkaDesk: KAFKA_TEST.deskBase, messages: N, feederSeconds: SECONDS });
const metrics: Record<string, unknown> = {};
ev.sandBench.load = metrics;
after(async () => { await ev.save(); });
const conn = (name: string, tag: string) => `ext_sit_${tagId(name)}_${tag.replace(/-/g, "")}`;
const rate = (n: number, ms: number) => Math.round((n / Math.max(ms, 1)) * 10000) / 10;

async function runLoad(name: string, wire: { format?: "json" | "xml" | "flat"; layout?: "compact" | "pretty"; encoding?: "none" | "base64" }, expected: { format: string; encoding: string; layout: string }) {
  await ready(ev, "LOAD");
  const tag = runTag(), c = conn(name, tag), base = `LOAD-${name.toUpperCase()}`;
  try {
    const caseId = await generatingCase(ev, `${base}-C`, tag);
    await makeConnection(ev, `${base}-CX`, c, wire);
    const t0 = Date.now();
    const run = await runCaseTo(caseId, c, N);
    const sendMs = Date.now() - t0;
    ev.check(run.totals.sent === N && run.totals.failed === 0 && !run.totals.simulated, `${base}-R`, "sand-bench", `Sand Bench delivered all ${N} messages`, `${JSON.stringify(run.totals)} in ${(sendMs / 1000).toFixed(1)}s (${rate(N, sendMs)}/s)`);
    const rows = await deliveriesOf(run.runId);
    checkSandBenchDeliveries(ev, `${base}-SB`, run.runId, rows, N);
    await confirmOnKafkaDesk(ev, `${base}-KD`, run.runId, rows, { variant: name, wire: expected, ordered: true, waitMs: 60_000 });
    metrics[name] = { messages: N, sendSeconds: sendMs / 1000, perSecond: rate(N, sendMs), allConfirmedSeconds: (Date.now() - t0) / 1000 };
  } finally { await dropConnection(c); }
}

test("Kafka load: one test-case run of many generated JSON messages arrives once each and in order", { timeout: 600_000 }, () => runLoad("json", {}, { format: "json", encoding: "none", layout: "object" }));
test("Kafka load: one test-case run of many generated messages as XML, base64, pretty-printed arrives once each and in order", { timeout: 600_000 }, () => runLoad("xml_b64_pretty", { format: "xml", encoding: "base64", layout: "pretty" }, { format: "xml", encoding: "base64", layout: "pretty" }));
test("Kafka load: one test-case run of many generated messages as a flat file arrives once each and in order", { timeout: 600_000 }, () => runLoad("flat", { format: "flat", encoding: "none", layout: "compact" }, { format: "flat", encoding: "none", layout: "compact" }));

async function feederLoad(name: string, feeders: number) {
  await ready(ev, "LOAD");
  const tag = runTag(), c = conn(name, tag), base = `LOAD-${name.toUpperCase()}`;
  const per = Math.ceil(N / feeders);
  try {
    await makeConnection(ev, `${base}-CX`, c, {});
    const runs: Array<{ id: string; ids: string[] }> = [];
    const t0 = Date.now();
    for (let f = 0; f < feeders; f++) {
      const { datasetId, ids } = await storedDataset(ev, `${base}-DS${f + 1}`, `${tag}f${f + 1}`, per, "json");
      const created = await createFeeder(`SIT Kafka load ${name} ${f + 1} ${tag}`, datasetId, c, per, SECONDS);
      runs.push({ id: "", ids });
      runs[f]!.id = (await startFeeder(created.body.id)).body.id;
    }
    const started = Date.now();
    const done = await Promise.all(runs.map((r) => untilFeederDone(r.id, SECONDS * 1000 + 120_000)));
    const feedMs = Date.now() - started;
    ev.check(done.every((r) => r.status === "completed" && r.sent === per && r.failed === 0), `${base}-RUN`, "sand-bench", `${feeders} feeder${feeders > 1 ? "s" : ""} completed, ${per} messages each, none failed`, done.map((r) => `${r.status} ${r.sent}/${r.messageCount}`).join(" · "));
    ev.check(feedMs < (SECONDS + 60) * 1000, `${base}-T`, "sand-bench", `Feeding kept to its schedule (planned ${SECONDS}s)`, `took ${(feedMs / 1000).toFixed(1)}s for ${per * feeders} messages`);
    for (let f = 0; f < feeders; f++) {
      const rows = await deliveriesOf(done[f]!.testRunId!);
      checkSandBenchDeliveries(ev, `${base}-SB${f + 1}`, done[f]!.testRunId!, rows, per);
      await confirmOnKafkaDesk(ev, `${base}-KD${f + 1}`, done[f]!.testRunId!, rows, { variant: `feeder ${f + 1}`, ordered: true, waitMs: 60_000 });
    }
    metrics[name] = { feeders, messages: per * feeders, plannedSeconds: SECONDS, actualSeconds: feedMs / 1000, perSecond: rate(per * feeders, feedMs), allConfirmedSeconds: (Date.now() - t0) / 1000 };
  } finally { await dropConnection(c); }
}

test("Kafka load: a data feeder at a high rate delivers every message once, in order, on schedule", { timeout: 600_000 }, () => feederLoad("feeder", 1));
test("Kafka load: three data feeders at the same time deliver every message once, each in its own order", { timeout: 600_000 }, () => feederLoad("feeders3", 3));
