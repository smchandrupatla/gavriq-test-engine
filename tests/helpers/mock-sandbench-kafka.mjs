// Stand-ins for the two systems the Kafka tests (sit/cases/25-kafka-schedule, 26-kafka-data-feeder)
// talk to, so the tests themselves can be exercised without Docker:
//   startFakeKafkaProxy()  a Kafka REST proxy (Confluent v2 / Redpanda pandaproxy): produce, consumer group, poll
//   startMockSandBench()   the slice of the Sand Bench API the tests use, with a "worker" that fires
//                          schedules and trickles data feeders through the fake proxy
// The real Kafka Desk (gavriq-kafka-desk) is run unchanged against the fake proxy by the test.
// This proves the test's logic and that it fails for the right reasons. It does not replace running
// the real stack (scripts/kafka-stack.sh), which is the only proof of the real connectivity.
import http from "node:http";

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    return {};
  }
}

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

function closeServer(server) {
  return new Promise((resolve) => {
    server.closeAllConnections?.();
    server.close(resolve);
  });
}

export async function startFakeKafkaProxy() {
  const log = [];
  const consumers = new Map();
  const server = http.createServer(async (req, res) => {
    const body = await readJson(req);
    const url = new URL(req.url, "http://proxy.local");
    const send = (status, payload) => {
      res.writeHead(status, { "content-type": "application/vnd.kafka.v2+json" });
      res.end(payload === undefined ? "" : JSON.stringify(payload));
    };
    let m;
    if ((m = url.pathname.match(/^\/topics\/([^/]+)$/)) && req.method === "POST") {
      const offsets = body.records.map((record) => {
        const offset = log.length;
        log.push({ topic: decodeURIComponent(m[1]), key: record.key, value: record.value, partition: 0, offset });
        return { partition: 0, offset };
      });
      return send(200, { offsets });
    }
    if ((m = url.pathname.match(/^\/consumers\/([^/]+)$/)) && req.method === "POST") {
      consumers.set(body.name, { topics: [], cursor: 0 });
      return send(200, { instance_id: body.name });
    }
    if ((m = url.pathname.match(/^\/consumers\/([^/]+)\/instances\/([^/]+)\/subscription$/)) && req.method === "POST") {
      const consumer = consumers.get(m[2]);
      if (!consumer) return send(404, {});
      consumer.topics = body.topics;
      return send(204);
    }
    if ((m = url.pathname.match(/^\/consumers\/([^/]+)\/instances\/([^/]+)\/records$/)) && req.method === "GET") {
      const consumer = consumers.get(m[2]);
      if (!consumer) return send(404, {});
      const out = log.slice(consumer.cursor).filter((row) => consumer.topics.includes(row.topic));
      consumer.cursor = log.length;
      return send(200, out);
    }
    if ((m = url.pathname.match(/^\/consumers\/([^/]+)\/instances\/([^/]+)$/)) && req.method === "DELETE") {
      consumers.delete(m[2]);
      return send(204);
    }
    return send(404, {});
  });
  const base = await listen(server);
  return { base, log, close: () => closeServer(server) };
}

/**
 * mode:
 *   "broker"       every message is produced to the proxy and acknowledged with its real partition/offset
 *   "simulated"    nothing is produced; deliveries say "simulated, not delivered" (no SBE_REDPANDA_PROXY)
 *   "drop-second"  the second message is acknowledged by "Sand Bench" but never reaches the broker
 *   "no-worker"    schedules never fire
 */
/** @param {{ proxyBase?: string, mode?: "broker" | "simulated" | "drop-second" | "no-worker", topic?: string }} [options] */
export async function startMockSandBench({ proxyBase, mode = "broker", topic = "sandbench.out" } = {}) {
  const datasets = new Map();
  const schedules = new Map();
  const runs = new Map();
  const feeders = new Map();
  const feederRuns = new Map();
  const timers = new Set();
  let n = 0;
  const id = (prefix) => `${prefix}_${(++n).toString(16)}${Math.random().toString(16).slice(2, 6)}`;

  async function produce(payload) {
    if (mode === "simulated") return { status: "simulated", detail: `simulated, not delivered: ${topic}` };
    const res = await fetch(`${proxyBase}/topics/${topic}`, {
      method: "POST",
      headers: { "content-type": "application/vnd.kafka.json.v2+json" },
      body: JSON.stringify({ records: [{ key: topic, value: payload }] }),
    });
    const ack = (await res.json()).offsets[0];
    return { status: "acknowledged", detail: `${topic} (partition ${ack.partition}, offset ${ack.offset})` };
  }

  async function deliver(runId, seq, payload) {
    let result;
    if (mode === "drop-second" && seq === 2) result = { status: "acknowledged", detail: `${topic} (partition 0, offset 9999)` };
    else result = await produce(payload);
    runs.get(runId).deliveries.push({ id: id("del"), seq, channel: "kafka", status: result.status, request_payload: payload, detail: result.detail });
  }

  function later(ms, fn) {
    const timer = setTimeout(() => {
      timers.delete(timer);
      fn().catch(() => {});
    }, Math.max(0, ms));
    timers.add(timer);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://sandbench.mock");
    const p = url.pathname;
    const send = (status, body) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(body));
    };
    const body = req.method === "GET" || req.method === "DELETE" ? {} : await readJson(req);
    let m;

    if (p === "/ready") return send(200, { status: "ready", delivery: { configured: mode === "simulated" ? [] : ["kafka"], unconfigured: mode === "simulated" ? ["kafka"] : [], unconfiguredDeliveries: "simulated" } });
    if (p === "/api/v1/session/login") return send(200, { token: "mock-token" });
    if (p === "/api/v1/external-systems") return send(200, { data: [{ id: "ext_kafka_desk", name: "Sand Bench Kafka Desk", channel: "kafka", topic, enabled: true }] });

    if (p === "/api/v1/datasets" && req.method === "POST") {
      const dsId = id("ds");
      datasets.set(dsId, { id: dsId, name: body.name, messageTypeCode: body.messageTypeCode || null, messages: [] });
      return send(200, { id: dsId, name: body.name });
    }
    if ((m = p.match(/^\/api\/v1\/datasets\/([^/]+)\/messages$/)) && req.method === "POST") {
      const ds = datasets.get(m[1]);
      if (!ds) return send(404, {});
      ds.messages.push(...body.messages.map((msg) => ({ name: msg.name, format: msg.format, content: msg.content })));
      return send(200, { datasetId: ds.id, stored: body.messages.length });
    }
    if (p === "/api/v1/test-cases" && req.method === "POST") {
      const tcId = id("tc");
      return send(200, { id: tcId, name: body.name, datasetId: body.datasetId });
    }

    if (p === "/api/v1/schedules" && req.method === "POST") {
      const sId = id("sch");
      const row = { id: sId, name: body.name, status: "scheduled", enabled: true, next_run_at: body.startsAt, last_run_id: null, last_error: null, run_count: 0, target_id: body.targetId, connection_id: body.connectionId };
      schedules.set(sId, row);
      if (mode !== "no-worker") {
        later(Date.parse(body.startsAt) - Date.now() + 200, async () => {
          const runId = id("run");
          runs.set(runId, { deliveries: [] });
          for (let i = 1; i <= 5; i += 1) await deliver(runId, i, { msgId: `MOCK-SCH-${runId}-${i}`, instdAmt: 100 + i, ccy: "EUR" });
          Object.assign(row, { status: "completed", last_run_id: runId, run_count: 1 });
        });
      }
      return send(201, row);
    }
    if ((m = p.match(/^\/api\/v1\/schedules\/([^/]+)$/))) {
      const row = schedules.get(m[1]);
      if (!row) return send(404, {});
      if (req.method === "DELETE") { schedules.delete(m[1]); return send(200, { id: m[1], deleted: true }); }
      return send(200, row);
    }
    if ((m = p.match(/^\/api\/v1\/runs\/([^/]+)\/deliveries$/))) {
      const run = runs.get(m[1]);
      if (!run) return send(404, {});
      return send(200, { data: run.deliveries, total: run.deliveries.length });
    }

    if (p === "/api/v1/data-feeders" && req.method === "POST") {
      const fId = id("dfd");
      const row = { id: fId, name: body.name, ...body };
      feeders.set(fId, row);
      return send(201, row);
    }
    if ((m = p.match(/^\/api\/v1\/data-feeders\/([^/]+)\/plan$/))) {
      const f = feeders.get(m[1]);
      if (!f) return send(404, {});
      const sample = Array.from({ length: f.messageCount }, (_u, i) => ({ seq: i + 1, at: new Date(Date.parse(f.windowStart) + (i * (Date.parse(f.windowEnd) - Date.parse(f.windowStart))) / Math.max(1, f.messageCount - 1)).toISOString() }));
      return send(200, { feederId: f.id, plan: { summary: { messageCount: f.messageCount, durationSeconds: (Date.parse(f.windowEnd) - Date.parse(f.windowStart)) / 1000 }, sample, warnings: [] } });
    }
    if ((m = p.match(/^\/api\/v1\/data-feeders\/([^/]+)\/runs$/)) && req.method === "POST") {
      const f = feeders.get(m[1]);
      if (!f) return send(404, {});
      const ds = datasets.get(f.datasets[0].datasetId);
      const runId = id("dfr");
      const testRunId = id("run");
      runs.set(testRunId, { deliveries: [] });
      const run = { id: runId, feederId: f.id, testRunId, status: "running", messageCount: f.messageCount, sent: 0, failed: 0, blocked: 0, progress: 0, lastError: null, channel: "kafka" };
      feederRuns.set(runId, run);
      const startMs = Date.now();
      const spanMs = Date.parse(f.windowEnd) - Date.parse(f.windowStart);
      for (let i = 0; i < f.messageCount; i += 1) {
        later((i * spanMs) / Math.max(1, f.messageCount - 1) - (Date.now() - startMs), async () => {
          if (run.status !== "running") return;
          await deliver(testRunId, i + 1, ds.messages[i % ds.messages.length]);
          run.sent += 1;
          run.progress = run.sent / run.messageCount;
          if (run.sent + run.failed + run.blocked >= run.messageCount) run.status = "completed";
        });
      }
      return send(201, run);
    }
    if ((m = p.match(/^\/api\/v1\/data-feeder-runs\/([^/]+)(?:\/(cancel))?$/))) {
      const run = feederRuns.get(m[1]);
      if (!run) return send(404, {});
      if (m[2] === "cancel") {
        if (run.status !== "running") return send(409, { error: "cannot cancel" });
        run.status = "cancelled";
        return send(200, run);
      }
      return send(200, run);
    }
    return send(404, { error: `mock has no ${req.method} ${p}` });
  });

  const base = await listen(server);
  return {
    base,
    schedules,
    feederRuns,
    close: async () => {
      for (const timer of timers) clearTimeout(timer);
      await closeServer(server);
    },
  };
}
