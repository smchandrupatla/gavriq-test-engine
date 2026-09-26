function trimSlash(url: string): string {
  return url.replace(/\/$/, "");
}

export const ENV = {
  apiBase: trimSlash(process.env.SIT_API_BASE || "http://api:8787"),
  testhubBase: trimSlash(process.env.SIT_TESTHUB_BASE || "http://testhub:8091"),
  webBase: trimSlash(process.env.SIT_WEB_BASE || "http://web:80"),
  dbviewerBase: trimSlash(process.env.SIT_DBVIEWER_BASE || "http://dbviewer:8090"),
  tenantSlug: process.env.SIT_TENANT_SLUG || "acme-demo",
  username: process.env.SIT_USERNAME || "operator.acme",
  // Must match dev/demo-seed/sand-bench-demo-tenants-users.json's operator.acme
  // temporaryPassword -- b9e119e rotated every demo seed password to this value but
  // missed this default, so every SIT run failed at login with 401 until now.
  password: process.env.SIT_PASSWORD || "SandBenchDemo1234!",
  messageTypeCode: process.env.SIT_MESSAGE_TYPE || "pain.001.001.09",
  // Performance cases (91-performance-soak, 92-performance-burst) are bounded-duration by
  // design -- see those files for why. Defaults are kept short so they don't meaningfully
  // slow down a normal Test Engine run; raise SIT_SOAK_DURATION_MS (and friends) for a
  // deliberate, longer endurance check run outside the regular CI/deploy-gate path.
  soakDurationMs: Number(process.env.SIT_SOAK_DURATION_MS) || 15000,
  soakConcurrency: Number(process.env.SIT_SOAK_CONCURRENCY) || 3,
  burstSize: Number(process.env.SIT_BURST_SIZE) || 30,
  burstWaves: Number(process.env.SIT_BURST_WAVES) || 3,
  burstWaveGapMs: Number(process.env.SIT_BURST_WAVE_GAP_MS) || 500,
};

export const SERVICES: Array<{ name: string; healthUrl: string }> = [
  { name: "main application (api)", healthUrl: `${ENV.apiBase}/health` },
  { name: "test hub (MQ/Kafka/API mimic)", healthUrl: `${ENV.testhubBase}/health` },
  { name: "db viewer", healthUrl: `${ENV.dbviewerBase}/health` },
  { name: "web front end", healthUrl: `${ENV.webBase}/index.html` },
];
