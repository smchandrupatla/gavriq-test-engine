import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// officialNav()/ensureOfficialNav() live in live-bind-parts/part-00.js (the source part
// that live-bind.js loads, either via the built live-bind.bundle.js or by joining the
// live-bind-parts/*.js files at runtime). live-bind.js itself is just the loader stub and
// carries no nav data of its own, and live-bind.bundle.js is a gitignored build artifact
// that may not exist in a fresh checkout, so read the always-committed source part instead.
function officialNavSource() {
  return readFileSync(path.join(root, "apps/web/public/js/live-bind-parts/part-00.js"), "utf8");
}

export function officialPageIds() {
  const src = officialNavSource();
  const block = src.slice(src.indexOf("function officialNav"), src.indexOf("function ensureOfficialNav"));
  return [...new Set([...block.matchAll(/page:\s*"([^"]+)"/g)].map((m) => m[1]))];
}

export function officialNavLabels() {
  const src = officialNavSource();
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
  msgSchemaRegister: { family: "Message Designer", texts: ["Schema register"], controls: ["Imported schemes"] },
  schemeDefinitions: { family: "Message Designer", texts: ["Scheme definitions"], controls: ["Import Scheme", "Download"] },
  msgCreateSchema: { family: "Message Designer", texts: ["Create schema"], controls: ["Generate schema"] },
  msgSchemaCanvas: { family: "Message Designer", texts: ["Schema canvas"], controls: ["Add child", "Generate"] },
  trActive: { family: "Test Runs", texts: ["Active"], controls: ["New test run"] },
  trAll: { family: "Test Runs", texts: ["All test runs"], controls: ["New test run"] },
  trHistory: { family: "Test Runs", texts: ["history"], controls: ["Open"] },
  trNew: { family: "Test Runs", texts: ["New test run", "channel"], controls: ["File", "API", "MQ", "Kafka", "Send"] },
  dsAll: { family: "Datasets", texts: ["Saved datasets"], controls: ["Create"] },
  dsNew: { family: "Datasets", texts: ["Create new dataset"], fields: ["name"], controls: ["Save"] },
  tcPool: { family: "Test Cases", texts: ["All test cases"], controls: ["New test case"] },
  tcNew: { family: "Test Cases", texts: ["New test case"], fields: ["name"], controls: ["Save"] },
  testCasesBrowse: { family: "Test Cases", texts: ["Test cases"], controls: ["Run selected", "Select all"] },
  testCasesNew: { family: "Test Cases", texts: ["New test case"], fields: ["name"], controls: ["Save draft", "Create and close"] },
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
  configurationEnvironmentDefaults: { family: "Configuration", texts: ["Environment defaults"], controls: ["ON", "OFF"] },
  configurationNotifications: { family: "Configuration", texts: ["Notifications"], controls: ["ON", "OFF"] },
  configurationApiAccess: { family: "Configuration", texts: ["API access"], controls: ["ON", "OFF"] },
  configurationDataRetention: { family: "Configuration", texts: ["Data retention"], controls: ["ON", "OFF"] },
  configurationUserRoles: { family: "Configuration", texts: ["User roles"], controls: ["ON", "OFF"] },
  configurationEventing: { family: "Configuration", texts: ["Eventing"], controls: ["ON", "OFF"] },
  configurationAppConfigs: { family: "Configuration", texts: ["App configs"], controls: ["ON", "OFF"] },
  functionalAccess: { family: "Configuration", texts: ["Functional access"], controls: ["ON", "OFF"] },
  naming: { family: "Configuration", texts: ["Naming"], fields: ["prefix"], controls: ["Save"] },
  externalSystems: { family: "Configuration", texts: ["External systems"], controls: ["Create", "Save"] },
  useCaseTemplates: { family: "Configuration", texts: ["Use-case templates"], controls: ["Download use-case template"] },
  featureIds: { family: "Configuration", texts: ["Feature IDs"], controls: ["Save"] },
  useCaseReview: { family: "Configuration", texts: ["Use-case review"], controls: ["Review all use cases"] },
  applicationEvents: { family: "Configuration", texts: ["Application Events"], controls: ["Filter events"] },
};

export function contractFor(pageId) {
  return SCREEN_CONTRACTS[pageId] || { family: pageId, texts: [pageId], controls: [] };
}
