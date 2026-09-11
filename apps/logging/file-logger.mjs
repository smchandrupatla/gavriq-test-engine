/**
 * Shared JSON logger for every Sand Bench / GARVIQ process.
 * Writes NDJSON to stdout and to LOG_DIR/<service>.YYYY-MM-DD.log
 * Rotates by calendar day (24h). Optional Splunk HEC / Dynatrace ingest.
 */
import { appendFile, mkdir, readdir, unlink, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import os from "node:os";

const LEVELS = { debug: 20, info: 30, warn: 40, error: 50 };

export function loggingConfigFromEnv() {
  return {
    dir: process.env.LOG_DIR || path.join(process.cwd(), "logs"),
    service: process.env.LOG_SERVICE || process.env.APP_ROLE || "app",
    host: process.env.LOG_HOST || os.hostname(),
    forward: String(process.env.LOG_FORWARD || "off").toLowerCase(),
    retainDays: Number(process.env.LOG_RETAIN_DAYS || 7),
    splunk: {
      url: String(process.env.SPLUNK_HEC_URL || "").replace(/\/$/, ""),
      token: process.env.SPLUNK_HEC_TOKEN || "",
      index: process.env.SPLUNK_INDEX || "sandbench",
    },
    dynatrace: {
      url: String(process.env.DYNATRACE_LOG_INGEST || "").replace(/\/$/, ""),
      token: process.env.DYNATRACE_API_TOKEN || "",
    },
  };
}

function dayStamp(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function filePath(dir, service, date = new Date()) {
  return path.join(dir, `${service}.${dayStamp(date)}.log`);
}

async function ensureDir(dir) {
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });
}

async function recycle(dir, retainDays) {
  if (!existsSync(dir)) return;
  const cutoff = Date.now() - retainDays * 24 * 60 * 60 * 1000;
  const names = await readdir(dir);
  for (const name of names) {
    if (!name.endsWith(".log")) continue;
    const full = path.join(dir, name);
    try {
      const info = await stat(full);
      if (info.mtimeMs < cutoff) await unlink(full);
    } catch {
      /* keep going */
    }
  }
}

function line(cfg, level, fields, msg) {
  const event = {
    ts: new Date().toISOString(),
    level,
    service: cfg.service,
    host: cfg.host,
    msg: msg || fields.msg || "",
    ...fields,
  };
  delete event.msg;
  event.msg = msg || fields.msg || "";
  return event;
}

async function forwardSplunk(cfg, event) {
  if (!cfg.splunk.url || !cfg.splunk.token) return;
  const payload = {
    time: Date.parse(event.ts) / 1000,
    host: event.host,
    source: event.service,
    sourcetype: "_json",
    index: cfg.splunk.index,
    event,
  };
  try {
    await fetch(`${cfg.splunk.url}/services/collector`, {
      method: "POST",
      headers: {
        authorization: `Splunk ${cfg.splunk.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    /* file + stdout remain the source of truth */
  }
}

async function forwardDynatrace(cfg, event) {
  if (!cfg.dynatrace.url || !cfg.dynatrace.token) return;
  const payload = {
    content: event.msg,
    timestamp: event.ts,
    severity: String(event.level || "info").toUpperCase(),
    "service.name": event.service,
    "host.name": event.host,
    "sbe.requestId": event.requestId || "",
  };
  try {
    await fetch(cfg.dynatrace.url, {
      method: "POST",
      headers: {
        authorization: `Api-Token ${cfg.dynatrace.token}`,
        "content-type": "application/json; charset=utf-8",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(1500),
    });
  } catch {
    /* file + stdout remain the source of truth */
  }
}

export function createLogger(overrides = {}) {
  const cfg = { ...loggingConfigFromEnv(), ...overrides };
  if (overrides.service) cfg.service = overrides.service;
  let lastRecycle = 0;

  async function write(level, fields = {}, msg) {
    const event = line(cfg, level, typeof fields === "string" ? { msg: fields } : fields, typeof fields === "string" ? fields : msg);
    const raw = JSON.stringify(event);
    process.stdout.write(raw + "\n");
    try {
      await ensureDir(cfg.dir);
      await appendFile(filePath(cfg.dir, cfg.service), raw + "\n", "utf8");
      if (Date.now() - lastRecycle > 60 * 60 * 1000) {
        lastRecycle = Date.now();
        await recycle(cfg.dir, cfg.retainDays);
      }
    } catch (err) {
      process.stderr.write(JSON.stringify({ ts: new Date().toISOString(), level: "error", service: cfg.service, msg: "log file write failed", err: String(err.message || err) }) + "\n");
    }
    const dest = cfg.forward;
    if (dest === "splunk" || dest === "both") await forwardSplunk(cfg, event);
    if (dest === "dynatrace" || dest === "both") await forwardDynatrace(cfg, event);
    return event;
  }

  return {
    config: cfg,
    debug: (fields, msg) => write("debug", fields, msg),
    info: (fields, msg) => write("info", fields, msg),
    warn: (fields, msg) => write("warn", fields, msg),
    error: (fields, msg) => write("error", fields, msg),
    child(extra) {
      return createLogger({ ...cfg, ...extra, service: extra.service || cfg.service });
    },
  };
}

export function installProcessHandlers(log) {
  if (globalThis.__sbeLogHandlers) return;
  globalThis.__sbeLogHandlers = true;
  process.on("uncaughtException", (err) => {
    log.error({ err: { message: err.message, stack: err.stack } }, "uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    log.error({ err: { message: err.message, stack: err.stack } }, "unhandledRejection");
  });
  process.on("SIGTERM", () => {
    log.info({ signal: "SIGTERM" }, "process stopping");
  });
}

export function listLogFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdir(dir)
    .then((names) => names.filter((n) => n.endsWith(".log")).sort())
    .catch(() => []);
}

export { LEVELS, filePath, dayStamp, recycle };
