import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

export function officialPageIds() {
  const src = readFileSync(path.join(root, "apps/web/public/js/live-bind.js"), "utf8");
  const block = src.slice(src.indexOf("function officialNav"), src.indexOf("function ensureOfficialNav"));
  return [...block.matchAll(/page:\s*"([^"]+)"/g)].map((m) => m[1]);
}

export function officialNavLabels() {
  const src = readFileSync(path.join(root, "apps/web/public/js/live-bind.js"), "utf8");
  const block = src.slice(src.indexOf("function officialNav"), src.indexOf("function ensureOfficialNav"));
  return [...block.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1]);
}

export const STATIC_PAGES = [
  { path: "/", title: "Sand Bench", must: ["SAND BENCH", "login", "tenant"] },
  { path: "/help.html", title: "Help", must: ["Help", "GARVIQ"] },
  { path: "/about.html", title: "About", must: ["GARVIQ", "Sand Bench"] },
  { path: "/demo.html", title: "N-2 demo", must: ["sben", "demo"] },
  { path: "/not-production.html", title: "Not production", must: ["not production", "Testhub"] },
  { path: "/bring-your-own-xsd.html", title: "BYO XSD", must: ["XSD", "MDR"] },
  { path: "/mask-demo.html", title: "Mask demo", must: ["mask", "tenant"] },
];

export const SCREEN_CONTRACTS = {
  overview: { family: "Overview", texts: ["Overview", "Upload a scheme"], controls: ["New test run", "Design a rule"] },
  ruleBenchExisting: { family: "Rule Bench", texts: ["Existing rules"], controls: ["Create", "Stage", "Validate", "Export"] },
  ruleBenchCreate: { family: "Rule Bench", texts: ["Create new rule"], fields: ["name", "category"], controls: ["Save", "amount", "country", "field_equals"] },
  ruleBenchStage: { family: "Rule Bench", texts: ["Stage"], controls: ["Stage"] },
  ruleBenchValidate: { family: "Rule Bench", texts: ["Validate"], controls: ["Validate"] },
  ruleBenchExport: { family: "Rule Bench", texts: ["Export"], controls: ["Export"] },
  messageDesigner: { family: "Message Designer", texts: ["Create message definition"], fields: ["name"], controls: ["Save", "Generate"] },
  msgViewSaved: { family: "Message Designer", texts: ["Saved definitions"], controls: ["Open"] },
  msgDataFiles: { family: "Message Designer", texts: ["Saved test data"], controls: ["Download"] },
  msgImportSchema: { family: "Message Designer", texts: ["Import schema", "XSD"], controls: ["Upload"], fields: ["name"] },
  msgExportTemplate: { family: "Message Designer", texts: ["Export template"], controls: ["Download"] },
  trActive: { family: "Test Runs", texts: ["Active"], controls: ["New test run"] },
  trAll: { family: "Test Runs", texts: ["All test runs"], controls: ["New test run"] },
  trHistory: { family: "Test Runs", texts: ["history"], controls: ["Open"] },
  trNew: { family: "Test Runs", texts: ["New test run", "channel"], controls: ["File", "API", "MQ", "Kafka", "Send"] },
  dsAll: { family: "Datasets", texts: ["Saved datasets"], controls: ["Create"] },
  dsNew: { family: "Datasets", texts: ["Create new dataset"], fields: ["name"], controls: ["Save"] },
  tcPool: { family: "Test Cases", texts: ["All test cases"], controls: ["New test case"] },
  tcNew: { family: "Test Cases", texts: ["New test case"], fields: ["name"], controls: ["Save"] },
  tsAll: { family: "Test Suites", texts: ["All test suites"], controls: ["New test suite"] },
  tsNew: { family: "Test Suites", texts: ["New test suite"], fields: ["name"], controls: ["Save"] },
  schUpcoming: { family: "Schedules", texts: ["Upcoming"], controls: ["New schedule"] },
  schAll: { family: "Schedules", texts: ["All schedules"], controls: ["New schedule"] },
  schNew: { family: "Schedules", texts: ["New schedule"], fields: ["name"], controls: ["Save"] },
  repAll: { family: "Reports", texts: ["All reports"], controls: ["Download"] },
  repRuns: { family: "Reports", texts: ["Test run reports"], controls: ["Download"] },
  repSuites: { family: "Reports", texts: ["Test suite reports"], controls: ["Download", "JSON"] },
  repCoverage: { family: "Reports", texts: ["Coverage"], controls: ["Download"] },
  repCompliance: { family: "Reports", texts: ["Compliance"], controls: ["Download"] },
  repScheduled: { family: "Reports", texts: ["Scheduled exports"], controls: ["New"] },
  configuration: { family: "Configuration", texts: ["Configuration", "MQ", "Kafka"], controls: ["Test connection", "Save"] },
  naming: { family: "Configuration", texts: ["Naming"], fields: ["prefix"], controls: ["Save"] },
  externalSystems: { family: "Configuration", texts: ["External systems"], controls: ["Create", "Save"] },
};

export function contractFor(pageId) {
  return SCREEN_CONTRACTS[pageId] || { family: pageId, texts: [pageId], controls: [] };
}
