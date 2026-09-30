import { test, after } from "node:test";
import { ENV } from "../lib/env.ts";
import { Evidence } from "../kafka-test/evidence.ts";
import { checkSandBenchDeliveries, confirmOnKafkaDesk } from "../kafka-test/checks.ts";
import { KAFKA_TEST, createFeeder, deliveriesOf, dropConnection, generatingCase, makeConnection, ready, runCaseTo, runTag, startFeeder, storedDataset, tagId, untilFeederDone, type Wire } from "../kafka-test/scenarios.ts";

// Kafka test 3 — MESSAGE FORMATS. Every combination of what the Sand Bench endpoint chooser offers:
//   format    JSON · XML · flat file
//   encoding  human readable (plain) · base64
//   layout    compact · pretty-printed
// = 12 combinations, each with its own saved Kafka connection and its own freshly generated messages.
// Sand Bench must acknowledge every message and say which wire form it used; Kafka Desk, reading the
// topic on its own, must find the same message IDs and recognise the form (format, encoding, layout)
// it was sent in. Two feeder cases then send stored XML and JSON documents the same way.
// Checkpoints FMT-<format>-<encoding>-<layout>-…; evidence: latest-kafka-formats.json.

const ev = new Evidence("kafka-formats", "Every format, encoding and layout: JSON / XML / flat file × plain / base64 × compact / pretty", { sandBenchApi: ENV.apiBase, kafkaDesk: KAFKA_TEST.deskBase, messageType: ENV.messageTypeCode });
after(async () => { await ev.save(); });

const COUNT = 3;
type Fmt = "json" | "xml" | "flat";
type Enc = "plain" | "base64";
type Lay = "compact" | "pretty";

async function generated(fmt: Fmt, enc: Enc, lay: Lay) {
  await ready(ev, "FMT");
  const key = `${fmt}-${enc}-${lay}`;
  const base = `FMT-${key}`;
  const tag = runTag();
  const connection = `ext_sit_${tagId(key)}_${tag.replace(/-/g, "")}`;
  const wire: Wire = { format: fmt, encoding: enc === "base64" ? "base64" : "none", layout: lay };
  try {
    const caseId = await generatingCase(ev, `${base}-C`, tag);
    await makeConnection(ev, `${base}-CX`, connection, wire);
    const run = await runCaseTo(caseId, connection, COUNT);
    ev.check(run.totals.sent === COUNT && run.totals.failed === 0 && !run.totals.simulated, `${base}-R`, "sand-bench", `The run delivered ${COUNT} ${fmt.toUpperCase()} messages (${enc}, ${lay}) to Kafka`, `run ${run.runId}: ${JSON.stringify(run.totals)}`);
    const rows = await deliveriesOf(run.runId);
    checkSandBenchDeliveries(ev, `${base}-SB`, run.runId, rows, COUNT);
    const label = `${fmt}, ${enc === "base64" ? "base64" : "plain"}, ${lay}`;
    ev.check(rows.every((r) => (r.detail || "").includes(`; ${label})`)), `${base}-W`, "sand-bench", `Sand Bench's acknowledgement names the wire form used (${label})`, rows[0]?.detail || "no deliveries");
    await confirmOnKafkaDesk(ev, `${base}-KD`, run.runId, rows, { variant: key, wire: { format: fmt, encoding: wire.encoding!, layout: lay } });
  } finally {
    await dropConnection(connection);
  }
}

async function feeder(source: "xml" | "json", fmt: Fmt | undefined, enc: Enc, lay: Lay) {
  await ready(ev, "FMT");
  const key = `feeder-${source}-${fmt ?? "native"}-${enc}-${lay}`;
  const base = `FMT-${key}`;
  const tag = runTag();
  const connection = `ext_sit_${tagId(key)}_${tag.replace(/-/g, "")}`;
  const n = 4;
  try {
    const { datasetId, ids } = await storedDataset(ev, `${base}-DS`, tag, n, source);
    await makeConnection(ev, `${base}-CX`, connection, { ...(fmt ? { format: fmt } : {}), encoding: enc === "base64" ? "base64" : "none", layout: lay });
    const created = await createFeeder(`SIT Kafka ${key} ${tag}`, datasetId, connection, n, 4);
    ev.check(created.status === 201, `${base}-F`, "sand-bench", "Data feeder created for the connection", `POST /api/v1/data-feeders → ${created.status}`);
    const started = await startFeeder(created.body.id);
    ev.check(started.status === 201, `${base}-S`, "sand-bench", "Feeder started", `run ${started.body.id}`);
    const run = await untilFeederDone(started.body.id, 90_000);
    ev.check(run.status === "completed" && run.sent === n && run.failed === 0, `${base}-RUN`, "sand-bench", `The feeder sent all ${n} stored ${source.toUpperCase()} messages`, `${run.status}: sent ${run.sent}, failed ${run.failed}, blocked ${run.blocked}`);
    const rows = await deliveriesOf(run.testRunId!);
    checkSandBenchDeliveries(ev, `${base}-SB`, run.testRunId!, rows, n);
    const wireForm = { format: fmt ?? source, encoding: enc === "base64" ? "base64" : "none", layout: lay };
    await confirmOnKafkaDesk(ev, `${base}-KD`, run.testRunId!, rows, { variant: key, wire: wireForm, ordered: true });
    ev.check(rows.every((r, i) => String(r.request_payload.name) === ids[i]), `${base}-O`, "sand-bench", "Sent in dataset order", `${ids[0]} … ${ids[n - 1]}`);
  } finally {
    await dropConnection(connection);
  }
}

test("Kafka formats: JSON, human readable, compact", () => generated("json", "plain", "compact"));
test("Kafka formats: JSON, human readable, pretty-printed", () => generated("json", "plain", "pretty"));
test("Kafka formats: JSON, base64, compact", () => generated("json", "base64", "compact"));
test("Kafka formats: JSON, base64, pretty-printed", () => generated("json", "base64", "pretty"));
test("Kafka formats: XML, human readable, compact", () => generated("xml", "plain", "compact"));
test("Kafka formats: XML, human readable, pretty-printed", () => generated("xml", "plain", "pretty"));
test("Kafka formats: XML, base64, compact", () => generated("xml", "base64", "compact"));
test("Kafka formats: XML, base64, pretty-printed", () => generated("xml", "base64", "pretty"));
test("Kafka formats: flat file, human readable, compact", () => generated("flat", "plain", "compact"));
test("Kafka formats: flat file, human readable, pretty-printed", () => generated("flat", "plain", "pretty"));
test("Kafka formats: flat file, base64, compact", () => generated("flat", "base64", "compact"));
test("Kafka formats: flat file, base64, pretty-printed", () => generated("flat", "base64", "pretty"));
test("Kafka formats: a data feeder sends stored XML documents as XML, base64, pretty-printed", { timeout: 180_000 }, () => feeder("xml", "xml", "base64", "pretty"));
test("Kafka formats: a data feeder sends stored JSON documents converted to XML, human readable, compact", { timeout: 180_000 }, () => feeder("json", "xml", "plain", "compact"));
test("Kafka formats: a data feeder sends stored XML documents converted to a flat file, base64, compact", { timeout: 180_000 }, () => feeder("xml", "flat", "base64", "compact"));
