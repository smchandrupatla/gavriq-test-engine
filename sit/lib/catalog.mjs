/** Dashboard taxonomy for the Test Engine. Application first, then type / group / case. */

export const APPS = [
  { id: "sand-bench", title: "Sand Bench Enterprise", summary: "Rule assurance bench, official console, API." },
  { id: "testhub", title: "Testhub", summary: "External system simulator." },
  { id: "desks", title: "Channel desks", summary: "MQ, Kafka, and API desks." },
  { id: "security", title: "Security tooling", summary: "Trivy, ZAP, Semgrep, Security Desk." },
];

export function appOf(fileName = "", filePath = "") {
  const blob = `${filePath} ${fileName}`.replace(/\\/g, "/");
  const nested = blob.match(/cases\/apps\/([^/]+)\//) || blob.match(/apps\/([^/]+)\//);
  if (nested) return nested[1];
  if (fileName.startsWith("8") || /zap|sast|trivy|secportal/.test(blob)) return "security";
  if (/^(10-|20-|30-)/.test(fileName)) return "testhub";
  return "sand-bench";
}

export const TYPES = [
  { id: "health", title: "Health", summary: "Process and dependency reachability after deploy." },
  { id: "integration", title: "Integration", summary: "API round-trip with Testhub and inbound events." },
  { id: "gui", title: "GUI", summary: "Official console pages, Selenium screens, fields, workflows." },
  { id: "e2e", title: "End to end", summary: "First-run path a control owner can repeat." },
  { id: "security", title: "Security", summary: "ASVS 5.0 L1, OWASP API Top 10, vuln scan, pentest-lite." },
  { id: "performance", title: "Performance", summary: "Bounded-duration soak/endurance and burst-concurrency checks against the main application." },
];

export const GROUPS = {
  health: [{ id: "reachability", title: "Service reachability" }],
  integration: [
    { id: "mq", title: "MQ round-trip" },
    { id: "kafka", title: "Kafka round-trip" },
    { id: "api", title: "API round-trip" },
    { id: "worker", title: "Worker job queue" },
    { id: "dbviewer", title: "DB viewer cross-check" },
  ],
  gui: [{ id: "smoke", title: "Console smoke" }],
  e2e: [{ id: "first-run", title: "First-run path" }],
  security: [
    { id: "authentication", title: "Authentication (ASVS V6)" },
    { id: "session", title: "Session (ASVS V7)" },
    { id: "api-top10", title: "OWASP API Top 10" },
    { id: "headers", title: "Headers and methods (ASVS V4 / V3)" },
    { id: "vuln-scan", title: "Vulnerability scan (Trivy)" },
    { id: "sast", title: "SAST (Semgrep)" },
    { id: "dast", title: "DAST (OWASP ZAP)" },
    { id: "pentest", title: "Penetration-lite (login + injection)" },
  ],
  performance: [
    { id: "soak", title: "Soak / endurance (bounded duration)" },
    { id: "burst", title: "Burst concurrency" },
  ],
};

export function suiteOf(fileName) {
  if (fileName.startsWith('51-')) return 'integration';
  if (fileName.startsWith('64-')) return 'gui';
  if (fileName.startsWith("00-")) return "health";
  if (fileName.startsWith("30-") || fileName.startsWith("10-") || fileName.startsWith("20-") || fileName.startsWith("40-") || fileName.startsWith("50-")) return "integration";
  if (fileName.startsWith("60-") || fileName.startsWith("61-") || fileName.startsWith("62-") || fileName.startsWith("63-")) return "gui";
  if (fileName.startsWith("70-")) return "e2e";
  if (fileName.startsWith("8")) return "security";
  if (fileName.startsWith("91-") || fileName.startsWith("92-")) return "performance";
  return "other";
}

export function groupOf(fileName, testName = "") {
  if (fileName.startsWith('51-') || fileName.startsWith('64-')) return 'use-cases';
  const n = `${fileName} ${testName}`.toLowerCase();
  if (fileName.startsWith("91-")) return "soak";
  if (fileName.startsWith("92-")) return "burst";
  if (fileName.startsWith("00-")) return "reachability";
  if (fileName.startsWith("10-")) return "mq";
  if (fileName.startsWith("20-")) return "kafka";
  if (fileName.startsWith("30-")) return "api";
  if (fileName.startsWith("40-")) return "worker";
  if (fileName.startsWith("50-")) return "dbviewer";
  if (fileName.startsWith("60-")) return "smoke";
  if (fileName.startsWith("61-")) return "screens";
  if (fileName.startsWith("62-")) return "fields";
  if (fileName.startsWith("63-")) return "workflows";
  if (fileName.startsWith("85-") || n.includes("semgrep") || n.includes("sast")) return "sast";
  if (fileName.startsWith("84-") || n.includes("zap") || n.includes("dast")) return "dast";
  if (fileName.startsWith("83-") || n.includes("trivy") || n.includes("vuln")) return "vuln-scan";
  if (fileName.startsWith("82-") || n.includes("trace") || n.includes("header") || n.includes("content-type")) return "headers";
  if (n.includes("session/me") || n.includes("bearer") || n.includes("token")) return "session";
  if (n.includes("injection") || n.includes("or 1=1") || n.includes("wrong password")) return "pentest";
  if (n.includes("login") || n.includes("credential")) return "authentication";
  if (fileName.startsWith("81-") || n.includes("bola") || n.includes("anonymous") || n.includes("message-types")) return "api-top10";
  if (fileName.startsWith("80-")) return "authentication";
  return "other";
}

export function stepsFor(testName, fileName) {
  const type = suiteOf(fileName);
  const runStep = type === "gui"
    ? { action: "Run case", expect: "Page or Selenium contract holds", evidence: "TAP + screenshot if Selenium" }
    : type === "performance"
    ? { action: "Run case", expect: "Sustained/burst load stays within the error-rate and latency-drift thresholds", evidence: "TAP + console log with request counts, p50/p95, error rate" }
    : { action: "Run case", expect: "Assertion passes", evidence: "TAP + screenshot if Selenium" };
  return [
    { n: 1, action: "Select target", expect: "API / web URL from environment", evidence: "SIT_API_BASE" },
    { n: 2, ...runStep },
    { n: 3, action: "Record", expect: "Test Engine history row", evidence: "/api/runs" },
  ];
}
