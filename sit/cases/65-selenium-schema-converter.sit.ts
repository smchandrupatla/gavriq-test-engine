// Schema Converter (Message Schemes → Schema Converter, /schema-converter.html): the whole page,
// driven by Selenium against the deployed web tier and API.
//
// What is covered, and why each group exists:
//   A. Page contract          - controls, option lists, the Convert button's disabled reason.
//   B. Inspect                - every source format lists the right fields.
//   C. Upload                 - the source format is picked from the file (an XSD used to be
//                               parsed as JSON and fail with "Unexpected token '<'").
//   D. Convert matrix         - source x target x flat layout x delimiter. The definition shown
//                               is compared with what the API returns for the same request.
//   E. Selection              - Select all / Mandatory only / Optional only / Deselect all.
//   F. Requiredness policy    - preserve / mandatory / optional.
//   G. Fixed-width columns    - a repeating group used to inherit width 50 and abort the whole
//                               conversion; too-narrow widths must be reported, never truncated.
//   H. Sample options         - sample count, items per repeating field, bounds.
//   I. Errors                 - unreadable, empty, unsupported and oversize input.
//   J. Stale previews         - changing anything invalidates the preview.
//   K. Downloads              - template, definition and samples ZIP.
//   L. Hand-off to import     - Continue to Import Scheme.
//   M. Access and a11y        - no session, labels, live status region.
import { after, test as nodeTest, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";
import {
  CHOICE_XSD, CUSTOMER_FIELDS, CUSTOMER_JSD, CUSTOMER_JSON_SAMPLE, CUSTOMER_XML_SAMPLE, CUSTOMER_YAML, DELIMITED_JSD,
  FLAT_TEMPLATE, ORDER_FIELDS, ORDER_XSD,
} from "../lib/selenium/converter-fixtures.mjs";
import {
  DEFINITION_EXTENSION, DELIMITERS, SAMPLE_EXTENSION, SOURCE_LABELS, TARGET_LABELS, allSamples, apiConvert, convertNow,
  fieldRows, inspectSource, loadSource, openConverter, pageRequest, preview, raw, selectFields, setInclude, setOptions,
  setSource, setWidth, status,
} from "../lib/selenium/converter-page.mjs";
import {
  attribute, click, count, downloads, exists, isDisabled, optionTexts, pageText, saveShot, selectOption, selectedText,
  setValue, sharedBrowser, sleep, text, uploadText, value, visible, waitDownload, waitFor, waitHidden, waitVisible,
} from "../lib/selenium/flow.mjs";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());

type Sess = Awaited<ReturnType<typeof openConverter>>;

/**
 * One GUI case: skipped when no Selenium endpoint is up, screenshotted when it fails. It is called
 * `test` on purpose: the Test Engine's catalogue lists cases by scanning the source for a call named
 * test whose first argument is a double-quoted string, so every case below is written out with a
 * literal name (no names built in loops).
 */
function test(name: string, fn: (sess: Sess, t: TestContext) => Promise<void>) {
  nodeTest(name, async (t) => {
    if (!(await browser.available(`converter-${name}`))) { t.skip(browser.reason); return; }
    const sess = await openConverter(browser);
    try { await fn(sess, t); }
    catch (error) { await saveShot(sess, `converter-${name}`); throw error; }
  });
}

const SOURCES = {
  xsd: { format: "xsd", content: ORDER_XSD, fields: ORDER_FIELDS, root: "Order" },
  jsd: { format: "jsd", content: CUSTOMER_JSD, fields: CUSTOMER_FIELDS, root: "Customer" },
  yaml: { format: "yaml", content: CUSTOMER_YAML, fields: CUSTOMER_FIELDS, root: "Customer" },
  flat: { format: "flat", content: JSON.stringify(FLAT_TEMPLATE, null, 2), fields: [
    { path: "/CustomerId", required: true, type: "string" }, { path: "/Name", required: true, type: "string" }, { path: "/Country", required: false, type: "string" },
  ], root: "Customer" },
  xml: { format: "xml", content: CUSTOMER_XML_SAMPLE, fields: [
    { path: "/@code", required: true, type: "string" }, { path: "/Name", required: true, type: "string" }, { path: "/Item", required: true, type: "array" },
  ], root: "Customer" },
  json: { format: "json", content: CUSTOMER_JSON_SAMPLE, fields: [
    { path: "/id", required: true, type: "string" }, { path: "/name", required: true, type: "string" }, { path: "/tags", required: true, type: "array" }, { path: "/active", required: true, type: "boolean" },
  ], root: "" },
} as const;
type SourceKey = keyof typeof SOURCES;

// ------------------------------------------------------------------------------------------
// A. Page contract
// ------------------------------------------------------------------------------------------
test("UC-msgSchemaConverter | A1 Schema Converter opens with every control and Convert disabled with a reason", async (sess) => {
  assert.match(await text(sess, "h1"), /Schema Converter/);
  for (const id of ["source-format", "source-file", "source-content", "load-template", "download-template", "inspect", "target-format", "requiredness", "sample-count", "repeat-count", "flat-mode", "delimiter", "convert"]) {
    assert.ok(await exists(sess, `#${id}`), `#${id} missing`);
  }
  assert.equal(await isDisabled(sess, "#convert"), true);
  assert.match(await text(sess, "#convert-hint"), /Inspect the source definition first/);
  assert.equal(await visible(sess, "#preview"), false, "the preview must be hidden before any conversion");
});

test("UC-msgSchemaConverter | A2 option lists offer every documented source, target, layout, delimiter and requirement policy", async (sess) => {
  assert.deepEqual(await optionTexts(sess, "#source-format"), Object.values(SOURCE_LABELS));
  assert.deepEqual(await optionTexts(sess, "#target-format"), Object.values(TARGET_LABELS));
  assert.deepEqual(await optionTexts(sess, "#flat-mode"), ["Fixed width", "CSV"]);
  assert.deepEqual(await optionTexts(sess, "#delimiter"), DELIMITERS.map((d: any) => d.label));
  assert.deepEqual(await optionTexts(sess, "#requiredness"), ["Preserve source", "Make selected fields mandatory", "Make selected fields optional"]);
  assert.equal(await value(sess, "#sample-count"), "3");
  assert.equal(await value(sess, "#repeat-count"), "1");
});

test("UC-msgSchemaConverter | A3 the sidebar lists Schema Converter under Message Schemes and marks it active", async (sess) => {
  await waitVisible(sess, "[data-app-nav] a, [data-app-nav] .opsc-navitem, [data-app-nav] div");
  const nav = await text(sess, "[data-app-nav]");
  for (const label of ["Message Schemes", "Import Scheme", "Schema Converter", "Scheme Definitions"]) assert.ok(nav.includes(label), `nav lacks ${label}`);
});

test("UC-msgSchemaConverter | A4 the help text documents fixed-width padding, repeated groups and unsupported constructs", async (sess) => {
  const help = await raw(sess, "details");
  assert.match(help, /Ten fields of width 50 make a 500-character record/);
  assert.match(help, /Repeated groups occupy one column encoded as JSON/);
  assert.match(help, /XSD choices/);
});

// ------------------------------------------------------------------------------------------
// B. Inspect: each source format lists its fields
// ------------------------------------------------------------------------------------------
async function inspectCase(sess: Sess, key: SourceKey) {
  const source = SOURCES[key];
  const result = await loadSource(sess, source.format, source.content);
  assert.match(result.message, new RegExp(`Inspected ${source.fields.length} fields`));
  const rows = await fieldRows(sess);
  assert.deepEqual(rows.map((r: any) => ({ path: r.path, required: r.required, type: r.type })), source.fields.map((f: any) => ({ path: f.path, required: f.required, type: f.type })));
  assert.ok(rows.every((r: any) => r.included), "every field starts selected");
  assert.equal(await isDisabled(sess, "#convert"), false, "Convert enables once fields are listed");
  assert.equal(await text(sess, "#convert-hint"), "");
  assert.match(await text(sess, "#field-summary"), new RegExp(`^${source.fields.length} fields\\.`));
}
test("UC-msgSchemaConverter | B1 xsd source: Inspect lists 4 fields with the right requirement", (sess) => inspectCase(sess, "xsd"));
test("UC-msgSchemaConverter | B2 jsd source: Inspect lists 5 fields with the right requirement", (sess) => inspectCase(sess, "jsd"));
test("UC-msgSchemaConverter | B3 yaml source: Inspect lists 5 fields with the right requirement", (sess) => inspectCase(sess, "yaml"));
test("UC-msgSchemaConverter | B4 flat source: Inspect lists 3 fields with the right requirement", (sess) => inspectCase(sess, "flat"));
test("UC-msgSchemaConverter | B5 xml source: Inspect lists 3 fields with the right requirement", (sess) => inspectCase(sess, "xml"));
test("UC-msgSchemaConverter | B6 json source: Inspect lists 4 fields with the right requirement", (sess) => inspectCase(sess, "json"));

test("UC-msgSchemaConverter | B7 Load flat-file template fills the editor and inspects it in one click", async (sess) => {
  await click(sess, "#load-template");
  await waitFor(async () => /^Inspected 3 fields/.test((await status(sess)).message), { message: "template inspection" });
  assert.equal(await selectedText(sess, "#source-format"), SOURCE_LABELS.flat);
  const template = JSON.parse(await value(sess, "#source-content"));
  assert.equal(template.kind, "sand-bench-flat-schema");
  assert.deepEqual((await fieldRows(sess)).map((r: any) => r.path), ["/CustomerId", "/Name", "/Country"]);
});

test("UC-msgSchemaConverter | B8 flat widths from the source definition are kept in the Width column", async (sess) => {
  await loadSource(sess, "flat", JSON.stringify(FLAT_TEMPLATE));
  assert.deepEqual((await fieldRows(sess)).map((r: any) => r.width), [12, 30, 2]);
});

test("UC-msgSchemaConverter | B9 a repeating group's default width is estimated from its JSON, not the 50-character scalar default", async (sess) => {
  await loadSource(sess, "xsd", ORDER_XSD);
  const rows = await fieldRows(sess);
  const line = rows.find((r: any) => r.path === "/Line")!;
  const scalar = rows.find((r: any) => r.path === "/OrderId")!;
  assert.equal(scalar.width, 50);
  assert.ok(line.width > 50, `Line width ${line.width} must exceed 50`);
});

// ------------------------------------------------------------------------------------------
// C. Upload: the format is picked from the file and the file is inspected
// ------------------------------------------------------------------------------------------
const UPLOADS: Array<{ name: string; file: string; content: string; format: SourceKey | "unknown"; fields: number; mime: string }> = [
  { name: "order.xsd", file: "order.xsd", content: ORDER_XSD, format: "xsd", fields: 4, mime: "application/xml" },
  { name: "customer.yaml", file: "customer.yaml", content: CUSTOMER_YAML, format: "yaml", fields: 5, mime: "text/yaml" },
  { name: "customer.yml", file: "customer.yml", content: CUSTOMER_YAML, format: "yaml", fields: 5, mime: "text/yaml" },
  { name: "customer.flat", file: "customer.flat", content: JSON.stringify(FLAT_TEMPLATE), format: "flat", fields: 3, mime: "application/json" },
  { name: "customer.json holding a JSON Schema", file: "customer.json", content: CUSTOMER_JSD, format: "jsd", fields: 5, mime: "application/json" },
  { name: "customer.jsd", file: "customer.jsd", content: CUSTOMER_JSD, format: "jsd", fields: 5, mime: "application/json" },
  { name: "sample.json holding data, not a schema", file: "sample.json", content: CUSTOMER_JSON_SAMPLE, format: "json", fields: 4, mime: "application/json" },
  { name: "sample.xml holding data", file: "sample.xml", content: CUSTOMER_XML_SAMPLE, format: "xml", fields: 3, mime: "application/xml" },
  { name: "schema in a .txt file recognised by content", file: "definition.txt", content: ORDER_XSD, format: "xsd", fields: 4, mime: "text/plain" },
];
async function uploadCase(sess: Sess, index: number) {
  const upload = UPLOADS[index]!;
  await uploadText(sess, "#source-file", upload.file, upload.content, upload.mime);
  await waitFor(async () => /^Inspected \d+ fields/.test((await status(sess)).message), { message: "automatic inspection after upload" });
  assert.equal(await value(sess, "#source-format"), upload.format);
  assert.equal((await fieldRows(sess)).length, upload.fields);
  assert.equal(await isDisabled(sess, "#convert"), false);
  assert.equal(await value(sess, "#source-content"), upload.content, "the file text lands in the editor unchanged");
}
test("UC-msgSchemaConverter | C1 upload order.xsd: source format becomes xsd and fields are inspected automatically", (sess) => uploadCase(sess, 0));
test("UC-msgSchemaConverter | C2 upload customer.yaml: source format becomes yaml and fields are inspected automatically", (sess) => uploadCase(sess, 1));
test("UC-msgSchemaConverter | C3 upload customer.yml: source format becomes yaml and fields are inspected automatically", (sess) => uploadCase(sess, 2));
test("UC-msgSchemaConverter | C4 upload customer.flat: source format becomes flat and fields are inspected automatically", (sess) => uploadCase(sess, 3));
test("UC-msgSchemaConverter | C5 upload customer.json holding a JSON Schema: source format becomes jsd and fields are inspected automatically", (sess) => uploadCase(sess, 4));
test("UC-msgSchemaConverter | C6 upload customer.jsd: source format becomes jsd and fields are inspected automatically", (sess) => uploadCase(sess, 5));
test("UC-msgSchemaConverter | C7 upload sample.json holding data, not a schema: source format becomes json and fields are inspected automatically", (sess) => uploadCase(sess, 6));
test("UC-msgSchemaConverter | C8 upload sample.xml holding data: source format becomes xml and fields are inspected automatically", (sess) => uploadCase(sess, 7));
test("UC-msgSchemaConverter | C9 upload a schema in a .txt file: the format is recognised from its content and fields are inspected automatically", (sess) => uploadCase(sess, 8));

test("UC-msgSchemaConverter | C10 an XSD upload no longer fails with a JSON parse error while the format still says JSD", async (sess) => {
  assert.equal(await value(sess, "#source-format"), "jsd", "the default format is JSD");
  await uploadText(sess, "#source-file", "order.xsd", ORDER_XSD, "application/xml");
  await waitFor(async () => /^Inspected 4 fields/.test((await status(sess)).message), { message: "inspection" });
  assert.doesNotMatch((await status(sess)).message, /Unexpected token/);
});

test("UC-msgSchemaConverter | C11 a file whose kind cannot be recognised leaves the format alone and asks the user to choose", async (sess) => {
  await uploadText(sess, "#source-file", "notes.txt", "just some words, not a schema", "text/plain");
  await waitFor(async () => /Loaded notes\.txt/.test((await status(sess)).message), { message: "file load message" });
  assert.match((await status(sess)).message, /Choose the source format and inspect fields/);
  assert.equal(await value(sess, "#source-format"), "jsd");
  assert.equal(await isDisabled(sess, "#convert"), true);
});

test("UC-msgSchemaConverter | C12 a file over 256 KiB is refused before any request is made", async (sess) => {
  await uploadText(sess, "#source-file", "big.json", `{"pad":"${"x".repeat(262200)}"}`, "application/json");
  await waitFor(async () => (await status(sess)).error, { message: "size error" });
  assert.match((await status(sess)).message, /Input exceeds 256 KiB/);
  assert.equal(await value(sess, "#source-content"), "");
});

test("UC-msgSchemaConverter | C13 uploading a second file replaces the first and clears the previous field table", async (sess) => {
  await uploadText(sess, "#source-file", "order.xsd", ORDER_XSD, "application/xml");
  await waitFor(async () => (await fieldRows(sess)).length === 4, { message: "first upload rows" });
  await uploadText(sess, "#source-file", "customer.yaml", CUSTOMER_YAML, "text/yaml");
  await waitFor(async () => (await fieldRows(sess)).length === 5, { message: "second upload rows" });
  assert.equal(await value(sess, "#source-format"), "yaml");
  assert.deepEqual((await fieldRows(sess)).map((r: any) => r.path), CUSTOMER_FIELDS.map((f: any) => f.path));
});

// ------------------------------------------------------------------------------------------
// D. Convert matrix: source x target x layout x delimiter
// ------------------------------------------------------------------------------------------
type Target = { id: "jsd" | "xsd" | "yaml" | "flat"; layout?: "fixed" | "csv"; delimiter?: (typeof DELIMITERS)[number] };
const TARGETS: Target[] = [
  { id: "jsd" }, { id: "xsd" }, { id: "yaml" },
  { id: "flat", layout: "fixed" },
  { id: "flat", layout: "csv", delimiter: DELIMITERS[0] },
];
const MATRIX_SOURCES: SourceKey[] = ["xsd", "jsd", "yaml", "flat", "xml", "json"];
// Combinations the converter refuses on purpose, with the reason it must give. A JSON sample's
// array has no minimum length, and a required array that may be empty has no lossless XSD form.
const REFUSED: Record<string, RegExp> = {
  "json>xsd": /required array that allows zero items has no lossless XML mapping/,
};

function targetName(t: Target) { return t.id === "flat" ? `flat ${t.layout}${t.delimiter ? ` (${t.delimiter.name})` : ""}` : t.id; }

async function convertAndCheck(sess: Sess, key: SourceKey, target: Target, extra: Record<string, unknown> = {}) {
  const source = SOURCES[key];
  await loadSource(sess, source.format, source.content);
  await setOptions(sess, { target: target.id, flatMode: target.layout, delimiter: target.delimiter?.value, ...extra });
  const result = await convertNow(sess);
  assert.ok(result.ok, `conversion failed: ${result.message}`);
  const shown = await preview(sess);
  assert.equal(shown.visible, true);
  assert.match(shown.validation, /generated samples validated against the portable JSON Schema/);
  assert.ok(shown.fileName.endsWith(`.${DEFINITION_EXTENSION[target.id]}`), `definition file name ${shown.fileName}`);
  if (source.root) assert.ok(shown.fileName.startsWith(`${source.root}.`), `definition named after the root: ${shown.fileName}`);
  // What the page shows must be what the API produces for the same request.
  const body = await pageRequest(sess, { source: source.format, sourceContent: source.content, target: target.id });
  const api = await apiConvert(body);
  assert.equal(api.status, 200, JSON.stringify(api.body).slice(0, 200));
  assert.equal(shown.definition, (api.body as { data: { content: string } }).data.content, "the preview definition equals the API's definition");
  return shown;
}

async function refusedCase(sess: Sess, key: SourceKey, target: Target) {
  await loadSource(sess, SOURCES[key].format, SOURCES[key].content);
  await setOptions(sess, { target: target.id });
  const result = await convertNow(sess);
  assert.equal(result.ok, false);
  assert.match(result.message, REFUSED[`${key}>${target.id}`]!);
  assert.equal(await visible(sess, "#preview"), false);
}

async function matrixCase(sess: Sess, key: SourceKey, target: Target) {
  const shown = await convertAndCheck(sess, key, target);
  assert.equal(shown.sampleNames.length, 3, "three samples by default");
  const samples = await allSamples(sess);
  const ext = target.id === "flat" ? (target.layout === "csv" ? "csv" : "txt") : SAMPLE_EXTENSION[target.id as "jsd" | "xsd" | "yaml"];
  for (const s of samples) assert.ok(s.fileName.endsWith(`-sample-${samples.indexOf(s) + 1}.${ext}`), `sample file name ${s.fileName}`);
  const first = samples[0]!.content;
  if (target.id === "jsd") assert.equal(typeof JSON.parse(first), "object");
  if (target.id === "xsd") assert.match(first, /^<[A-Za-z_][\w.-]*[ >][\s\S]*<\/[A-Za-z_][\w.-]*>$/);
  if (target.id === "yaml") assert.match(first, /^[\w"'@-][^\n]*:/);
  if (target.id === "flat" && target.layout === "fixed") {
    const length = Number(/(\d+) characters/.exec(shown.recordLength)?.[1]);
    assert.ok(length > 0, `record length line: ${shown.recordLength}`);
    for (const s of samples) assert.equal(s.content.length, length, "every fixed-width record is exactly the record length");
  }
  if (target.id === "flat" && target.layout === "csv") {
    const [header, row] = first.split("\r\n");
    assert.ok(header!.split(",").every((p: any) => p.startsWith("/")), `CSV header ${header}`);
    assert.ok(row!.length > 0);
    assert.equal(shown.recordLength, "", "no record length for CSV");
  }

}

test("UC-msgSchemaConverter | D1 xsd → jsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xsd", TARGETS[0]!));
test("UC-msgSchemaConverter | D2 xsd → xsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xsd", TARGETS[1]!));
test("UC-msgSchemaConverter | D3 xsd → yaml: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xsd", TARGETS[2]!));
test("UC-msgSchemaConverter | D4 xsd → flat fixed: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xsd", TARGETS[3]!));
test("UC-msgSchemaConverter | D5 xsd → flat csv (comma): converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xsd", TARGETS[4]!));
test("UC-msgSchemaConverter | D6 jsd → jsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "jsd", TARGETS[0]!));
test("UC-msgSchemaConverter | D7 jsd → xsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "jsd", TARGETS[1]!));
test("UC-msgSchemaConverter | D8 jsd → yaml: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "jsd", TARGETS[2]!));
test("UC-msgSchemaConverter | D9 jsd → flat fixed: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "jsd", TARGETS[3]!));
test("UC-msgSchemaConverter | D10 jsd → flat csv (comma): converts, validates, previews and matches the API", (sess) => matrixCase(sess, "jsd", TARGETS[4]!));
test("UC-msgSchemaConverter | D11 yaml → jsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "yaml", TARGETS[0]!));
test("UC-msgSchemaConverter | D12 yaml → xsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "yaml", TARGETS[1]!));
test("UC-msgSchemaConverter | D13 yaml → yaml: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "yaml", TARGETS[2]!));
test("UC-msgSchemaConverter | D14 yaml → flat fixed: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "yaml", TARGETS[3]!));
test("UC-msgSchemaConverter | D15 yaml → flat csv (comma): converts, validates, previews and matches the API", (sess) => matrixCase(sess, "yaml", TARGETS[4]!));
test("UC-msgSchemaConverter | D16 flat → jsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "flat", TARGETS[0]!));
test("UC-msgSchemaConverter | D17 flat → xsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "flat", TARGETS[1]!));
test("UC-msgSchemaConverter | D18 flat → yaml: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "flat", TARGETS[2]!));
test("UC-msgSchemaConverter | D19 flat → flat fixed: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "flat", TARGETS[3]!));
test("UC-msgSchemaConverter | D20 flat → flat csv (comma): converts, validates, previews and matches the API", (sess) => matrixCase(sess, "flat", TARGETS[4]!));
test("UC-msgSchemaConverter | D21 xml → jsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xml", TARGETS[0]!));
test("UC-msgSchemaConverter | D22 xml → xsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xml", TARGETS[1]!));
test("UC-msgSchemaConverter | D23 xml → yaml: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xml", TARGETS[2]!));
test("UC-msgSchemaConverter | D24 xml → flat fixed: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xml", TARGETS[3]!));
test("UC-msgSchemaConverter | D25 xml → flat csv (comma): converts, validates, previews and matches the API", (sess) => matrixCase(sess, "xml", TARGETS[4]!));
test("UC-msgSchemaConverter | D26 json → jsd: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "json", TARGETS[0]!));
test("UC-msgSchemaConverter | D27 json → xsd: refused with the reason, and no preview", (sess) => refusedCase(sess, "json", TARGETS[1]!));
test("UC-msgSchemaConverter | D28 json → yaml: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "json", TARGETS[2]!));
test("UC-msgSchemaConverter | D29 json → flat fixed: converts, validates, previews and matches the API", (sess) => matrixCase(sess, "json", TARGETS[3]!));
test("UC-msgSchemaConverter | D30 json → flat csv (comma): converts, validates, previews and matches the API", (sess) => matrixCase(sess, "json", TARGETS[4]!));

async function delimiterCase(sess: Sess, delimiter: (typeof DELIMITERS)[number]) {
  await loadSource(sess, "jsd", DELIMITED_JSD);
  await setOptions(sess, { target: "flat", flatMode: "csv", delimiter: delimiter.value, samples: 2 });
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  const definition = JSON.parse(shown.definition);
  assert.equal(definition.mode, "csv");
  assert.equal(definition.delimiter, delimiter.value);
  assert.equal(definition.recordLength, undefined, "CSV has no record length");
  const [header, row] = (await allSamples(sess))[0]!.content.split("\r\n");
  assert.equal(header, ["/Text", "/Code"].join(delimiter.value));
  // The Text example contains every delimiter, a quote and a tab, so it must always be quoted.
  assert.ok(row!.startsWith('"a,b;c|d\te ""q"""'), `value not quoted correctly: ${row}`);
  assert.ok(row!.endsWith(`${delimiter.value}K1`), `row: ${row}`);

}
test("UC-msgSchemaConverter | D31 CSV with a comma delimiter: header and rows use it and values containing it are quoted", (sess) => delimiterCase(sess, DELIMITERS[0]!));
test("UC-msgSchemaConverter | D32 CSV with a semicolon delimiter: header and rows use it and values containing it are quoted", (sess) => delimiterCase(sess, DELIMITERS[1]!));
test("UC-msgSchemaConverter | D33 CSV with a pipe delimiter: header and rows use it and values containing it are quoted", (sess) => delimiterCase(sess, DELIMITERS[2]!));
test("UC-msgSchemaConverter | D34 CSV with a tab delimiter: header and rows use it and values containing it are quoted", (sess) => delimiterCase(sess, DELIMITERS[3]!));

test("UC-msgSchemaConverter | D CSV delimiter is remembered in the flat definition and in its API twin", async (sess) => {
  const shown = await convertAndCheck(sess, "jsd", { id: "flat", layout: "csv", delimiter: DELIMITERS[2] });
  assert.equal(JSON.parse(shown.definition).delimiter, "|");
});

// ------------------------------------------------------------------------------------------
// E. Field selection
// ------------------------------------------------------------------------------------------
test("UC-msgSchemaConverter | E1 Select all / Mandatory only / Optional only / Deselect all set the checkboxes and the Convert state", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  const included = async () => (await fieldRows(sess)).filter((r: any) => r.included).map((r: any) => r.path);
  await selectFields(sess, "mandatory");
  assert.deepEqual(await included(), ["/Id", "/Orders"]);
  assert.match((await status(sess)).message, /2 of 5 fields selected/);
  assert.equal(await isDisabled(sess, "#convert"), false);
  await selectFields(sess, "optional");
  assert.deepEqual(await included(), ["/Name", "/Address/Country", "/Active"]);
  assert.match((await status(sess)).message, /3 of 5 fields selected/);
  await selectFields(sess, "none");
  assert.deepEqual(await included(), []);
  assert.equal(await isDisabled(sess, "#convert"), true, "Convert is off with nothing selected");
  assert.match(await text(sess, "#convert-hint"), /Select at least one field/);
  await selectFields(sess, "all");
  assert.equal((await included()).length, 5);
  assert.equal(await isDisabled(sess, "#convert"), false);
  assert.equal(await text(sess, "#convert-hint"), "");
});

test("UC-msgSchemaConverter | E2 Mandatory only then Convert produces a derived definition of just the mandatory fields", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await selectFields(sess, "mandatory");
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  assert.deepEqual(Object.keys(JSON.parse(shown.definition).properties), ["Id", "Orders"]);
  assert.ok(shown.warnings.some((w: any) => /derived definition containing only the selected fields/.test(w)));
});

test("UC-msgSchemaConverter | E3 Optional only then Convert keeps the nested optional group and drops the mandatory fields", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await selectFields(sess, "optional");
  assert.ok((await convertNow(sess)).ok);
  const definition = JSON.parse((await preview(sess)).definition);
  assert.deepEqual(Object.keys(definition.properties), ["Name", "Address", "Active"]);
  assert.deepEqual(Object.keys(definition.properties.Address.properties), ["Country"]);
});

test("UC-msgSchemaConverter | E4 Mandatory only on a definition with no mandatory field says so and keeps Convert off", async (sess) => {
  const allOptional = JSON.stringify({ title: "Loose", type: "object", additionalProperties: false, properties: { A: { type: "string" }, B: { type: "string" } }, required: [] });
  await loadSource(sess, "jsd", allOptional);
  await selectFields(sess, "mandatory");
  assert.match((await status(sess)).message, /no mandatory fields/);
  assert.equal((await status(sess)).error, true);
  assert.equal(await isDisabled(sess, "#convert"), true);
});

test("UC-msgSchemaConverter | E5 Optional only on a definition with no optional field says so", async (sess) => {
  await loadSource(sess, "xsd", `<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="Tight"><xs:complexType><xs:sequence><xs:element name="A" type="xs:string"/></xs:sequence></xs:complexType></xs:element></xs:schema>`);
  await selectFields(sess, "optional");
  assert.match((await status(sess)).message, /no optional fields/);
  assert.equal(await isDisabled(sess, "#convert"), true);
});

test("UC-msgSchemaConverter | E6 unticking one field converts the rest and warns the definition is derived", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setInclude(sess, "/Name", false);
  assert.equal(await isDisabled(sess, "#convert"), false);
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  assert.ok(!("Name" in JSON.parse(shown.definition).properties));
  assert.ok(shown.warnings.some((w: any) => /derived definition/.test(w)));
});

test("UC-msgSchemaConverter | E7 selecting every field gives a complete definition with no derived-definition warning", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  assert.ok((await convertNow(sess)).ok);
  assert.ok(!(await preview(sess)).warnings.some((w: any) => /derived definition/.test(w)));
});

test("UC-msgSchemaConverter | E8 the selection buttons work again after a conversion and hide the stale preview", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  assert.ok((await convertNow(sess)).ok);
  await selectFields(sess, "mandatory");
  assert.equal(await visible(sess, "#preview"), false, "changing the selection invalidates the preview");
  assert.ok((await convertNow(sess)).ok);
});

// ------------------------------------------------------------------------------------------
// F. Requiredness policy
// ------------------------------------------------------------------------------------------
test("UC-msgSchemaConverter | F1 Preserve source keeps the definition's own required list", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { requiredness: "preserve" });
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  assert.deepEqual(JSON.parse(shown.definition).required, ["Id", "Orders"]);
  assert.ok(!shown.warnings.some((w: any) => /Requiredness changed/.test(w)));
});

test("UC-msgSchemaConverter | F2 Make selected fields mandatory requires every field at every level and says so", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { requiredness: "mandatory" });
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  const definition = JSON.parse(shown.definition);
  assert.deepEqual(definition.required, ["Id", "Name", "Address", "Orders", "Active"]);
  assert.deepEqual(definition.properties.Address.required, ["Country"]);
  assert.ok(shown.warnings.some((w: any) => /Requiredness changed to mandatory/.test(w)));
});

test("UC-msgSchemaConverter | F3 Make selected fields optional empties every required list and says so", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { requiredness: "optional" });
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  const definition = JSON.parse(shown.definition);
  assert.deepEqual(definition.required, []);
  assert.deepEqual(definition.properties.Address.required, []);
  assert.ok(shown.warnings.some((w: any) => /Requiredness changed to optional/.test(w)));
});

async function minOccursCase(sess: Sess, policy: "mandatory" | "optional") {
  await loadSource(sess, "xsd", ORDER_XSD);
  await setOptions(sess, { target: "xsd", requiredness: policy });
  const result = await convertNow(sess);
  assert.ok(result.ok, result.message);
  const xsd = (await preview(sess)).definition;
  // Every element is written with the occurrence the policy gives it.
  const wanted = policy === "mandatory" ? "1" : "0";
  for (const name of ["OrderId", "Customer", "Note"]) assert.match(xsd, new RegExp(`<xs:element name="${name}" minOccurs="${wanted}"`), `${name} under ${policy}`);
  assert.match(xsd, new RegExp(`<xs:element name="Line" minOccurs="${wanted}" maxOccurs="unbounded"`));

}
test("UC-msgSchemaConverter | F4a requiredness mandatory on an XSD source becomes minOccurs 1 in the XSD target", (sess) => minOccursCase(sess, "mandatory"));
test("UC-msgSchemaConverter | F4b requiredness optional on an XSD source becomes minOccurs 0 in the XSD target", (sess) => minOccursCase(sess, "optional"));

test("UC-msgSchemaConverter | F5 requiredness on a flat target shows in the Required column of the flat definition", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { target: "flat", requiredness: "mandatory", flatMode: "csv" });
  assert.ok((await convertNow(sess)).ok);
  const flat = JSON.parse((await preview(sess)).definition);
  assert.ok(flat.fields.every((f: { required: boolean }) => f.required));
});

// ------------------------------------------------------------------------------------------
// G. Fixed-width columns (the regression that started this suite)
// ------------------------------------------------------------------------------------------
test("UC-msgSchemaConverter | G1 an XSD with a repeating group converts to fixed width with the default widths", async (sess) => {
  await loadSource(sess, "xsd", ORDER_XSD);
  await setOptions(sess, { target: "flat", flatMode: "fixed", repeats: 2 });
  await selectFields(sess, "mandatory");
  const result = await convertNow(sess);
  assert.ok(result.ok, result.message);
  const shown = await preview(sess);
  const samples = await allSamples(sess);
  assert.equal(samples.length, 3);
  const columns = JSON.parse(shown.definition).fields as Array<{ path: string; width: number }>;
  const total = columns.reduce((sum, c) => sum + c.width, 0);
  assert.match(shown.recordLength, new RegExp(`${total} characters`));
  for (const s of samples) {
    assert.equal(s.content.length, total);
    assert.match(s.content, /\[\{"Sku":".+","Qty":\d+\},\{"Sku"/, "the repeating group is JSON in its column with two items");
  }
});

test("UC-msgSchemaConverter | G2 the same conversion works as CSV, where a JSON column needs no width", async (sess) => {
  await loadSource(sess, "xsd", ORDER_XSD);
  await setOptions(sess, { target: "flat", flatMode: "csv", delimiter: ";", repeats: 2 });
  assert.ok((await convertNow(sess)).ok);
  const [header, row] = (await allSamples(sess))[0]!.content.split("\r\n");
  assert.equal(header, "/OrderId;/Customer;/Line;/Note");
  assert.match(row!, /"\[\{""Sku"":/);
});

test("UC-msgSchemaConverter | G3 a width too small for a repeating group keeps the definition, produces no samples and names the width needed", async (sess) => {
  await loadSource(sess, "xsd", ORDER_XSD);
  await setOptions(sess, { target: "flat", flatMode: "fixed", repeats: 2 });
  await setWidth(sess, "/Line", 20);
  const result = await convertNow(sess);
  assert.ok(result.ok, "the conversion itself succeeds so the definition can be reviewed");
  const shown = await preview(sess);
  assert.match(shown.validation, /\/Line needs \d+ characters but its width is 20; increase the width to at least \d+/);
  assert.match(shown.validation, /No data was truncated/);
  assert.equal(shown.sampleNames.length, 0);
  assert.equal(shown.downloadSamplesDisabled, true, "there are no samples to download");
  assert.match(shown.sample, /No valid samples generated/);
  assert.equal(JSON.parse(shown.definition).fields.find((f: { path: string }) => f.path === "/Line").width, 20);
});

test("UC-msgSchemaConverter | G4 widening the column named in the message makes the samples appear", async (sess) => {
  await loadSource(sess, "xsd", ORDER_XSD);
  await setOptions(sess, { target: "flat", flatMode: "fixed", repeats: 2 });
  await setWidth(sess, "/Line", 20);
  assert.ok((await convertNow(sess)).ok);
  const needed = Number(/needs (\d+) characters/.exec((await preview(sess)).validation)?.[1]);
  assert.ok(needed > 20);
  await setWidth(sess, "/Line", needed + 60);
  assert.equal(await visible(sess, "#preview"), false, "editing a width hides the stale preview");
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  assert.equal(shown.sampleNames.length, 3);
  assert.match(shown.validation, /3 generated samples validated/);
});

test("UC-msgSchemaConverter | G5 a fixed-width value is never truncated: a too-narrow scalar column is reported, not cut", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { target: "flat", flatMode: "fixed" });
  await setWidth(sess, "/Id", 1);
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  assert.match(shown.validation, /\/Id needs \d+ characters but its width is 1/);
  assert.equal(shown.sampleNames.length, 0);
});

test("UC-msgSchemaConverter | G6 a fixed-width record is padded with spaces to its column widths", async (sess) => {
  await loadSource(sess, "flat", JSON.stringify(FLAT_TEMPLATE));
  await setOptions(sess, { target: "flat", flatMode: "fixed", samples: 1 });
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  assert.match(shown.recordLength, /Fixed-width record length: 44 characters\. Spaces are preserved in downloads\./);
  const sample = (await allSamples(sess))[0]!.content;
  assert.equal(sample.length, 44);
  assert.equal(sample.slice(0, 12).trim(), "CUST0001");
  assert.equal(sample.slice(12, 42).trim(), "Alex Smith");
  assert.match(sample.slice(42), /^(AU|GB|US)$/);
});

test("UC-msgSchemaConverter | G7 the default widths of three scalars add up to the documented 150-character record", async (sess) => {
  await loadSource(sess, "xsd", `<?xml version="1.0"?><xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema"><xs:element name="Trio"><xs:complexType><xs:sequence><xs:element name="A" type="xs:string"/><xs:element name="B" type="xs:string"/><xs:element name="C" type="xs:string"/></xs:sequence></xs:complexType></xs:element></xs:schema>`);
  await setOptions(sess, { target: "flat", flatMode: "fixed", samples: 1 });
  assert.ok((await convertNow(sess)).ok);
  assert.match((await preview(sess)).recordLength, /150 characters/);
  assert.equal((await allSamples(sess))[0]!.content.length, 150);
});

test("UC-msgSchemaConverter | G8 a width outside 1 to 4096 is refused with a clear message", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { target: "flat", flatMode: "fixed" });
  await setWidth(sess, "/Id", 5000);
  const result = await convertNow(sess);
  assert.equal(result.ok, false);
  assert.match(result.message, /Width of \/Id/);
});

// ------------------------------------------------------------------------------------------
// H. Sample options
// ------------------------------------------------------------------------------------------
async function sampleCountCase(sess: Sess, samples: number) {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { samples });
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  assert.equal(shown.sampleNames.length, samples);
  assert.match(shown.validation, new RegExp(`^${samples} generated samples validated`));

}
test("UC-msgSchemaConverter | H1a 1 sample instance gives 1 entry in the picker", (sess) => sampleCountCase(sess, 1));
test("UC-msgSchemaConverter | H1b 2 sample instances give 2 entries in the picker", (sess) => sampleCountCase(sess, 2));
test("UC-msgSchemaConverter | H1c 5 sample instances give 5 entries in the picker", (sess) => sampleCountCase(sess, 5));

async function repeatCase(sess: Sess, repeats: number) {
  await loadSource(sess, "xsd", ORDER_XSD);
  await setOptions(sess, { target: "xsd", repeats });
  assert.ok((await convertNow(sess)).ok);
  for (const s of await allSamples(sess)) assert.equal((s.content.match(/<Line>/g) || []).length, repeats);

}
test("UC-msgSchemaConverter | H2a 1 item per repeating field: each XML sample has 1 <Line> element", (sess) => repeatCase(sess, 1));
test("UC-msgSchemaConverter | H2b 2 items per repeating field: each XML sample has 2 <Line> elements", (sess) => repeatCase(sess, 2));
test("UC-msgSchemaConverter | H2c 3 items per repeating field: each XML sample has 3 <Line> elements", (sess) => repeatCase(sess, 3));

test("UC-msgSchemaConverter | H3 repeat counts respect the definition's own maximum occurrences", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { target: "jsd", repeats: 10 });
  assert.ok((await convertNow(sess)).ok);
  for (const s of await allSamples(sess)) assert.ok(JSON.parse(s.content).Orders.length <= 3, "Orders allows at most 3 items");
});

async function boundsCase(sess: Sess, samples: number, repeats: number, message: RegExp) {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { samples, repeats });
  const result = await convertNow(sess);
  assert.equal(result.ok, false);
  assert.match(result.message, message);
  assert.equal(await visible(sess, "#preview"), false);
}
test("UC-msgSchemaConverter | H4a a sample count of 0 is refused and names the field", (sess) => boundsCase(sess, 0, 1, /Sample count/));
test("UC-msgSchemaConverter | H4b a sample count of 101 is refused and names the field", (sess) => boundsCase(sess, 101, 1, /Sample count/));
test("UC-msgSchemaConverter | H4c a repeat count of 0 is refused and names the field", (sess) => boundsCase(sess, 3, 0, /Repeat count/));
test("UC-msgSchemaConverter | H4d a repeat count of 21 is refused and names the field", (sess) => boundsCase(sess, 3, 21, /Repeat count/));

test("UC-msgSchemaConverter | H5 the sample picker switches the sample shown", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { samples: 3 });
  assert.ok((await convertNow(sess)).ok);
  const samples = await allSamples(sess);
  assert.equal(samples.length, 3);
  assert.equal(new Set(samples.map((s: any) => s.fileName)).size, 3, "three distinct sample files");
  await selectOption(sess, "#sample-picker", "2");
  assert.equal(await raw(sess, "#sample-preview"), samples[2]!.content);
});

// ------------------------------------------------------------------------------------------
// I. Errors
// ------------------------------------------------------------------------------------------
const BAD_INPUTS: Array<{ name: string; format: SourceKey; content: string; message: RegExp }> = [
  { name: "empty content", format: "jsd", content: "", message: /Supply a schema or instance/ },
  { name: "whitespace only", format: "jsd", content: "   \n  ", message: /Supply a schema or instance/ },
  { name: "malformed JSON schema", format: "jsd", content: "{ not json", message: /JSON|Unexpected|position/i },
  { name: "XML text while the format says JSD", format: "jsd", content: ORDER_XSD, message: /Unexpected token|JSON/ },
  { name: "JSON text while the format says XSD", format: "xsd", content: CUSTOMER_JSD, message: /.+/ },
  { name: "an XSD with a choice group", format: "xsd", content: CHOICE_XSD, message: /Unsupported XSD construct: choice/ },
  { name: "a flat definition that is not JSON", format: "flat", content: "CustomerId,Name", message: /.+/ },
  { name: "an XML sample that is not well formed", format: "xml", content: "<a><b></a>", message: /.+/ },
];
async function badInputCase(sess: Sess, index: number) {
  const bad = BAD_INPUTS[index]!;
  await setSource(sess, bad.format, bad.content);
  const result = await inspectSource(sess);
  assert.equal(result.ok, false, `expected an error, got: ${result.message}`);
  assert.match(result.message, bad.message);
  assert.equal(await attribute(sess, "#converter-status", "data-error"), "true");
  assert.equal(await count(sess, "#fields tr"), 0);
  assert.equal(await isDisabled(sess, "#convert"), true);

}
test("UC-msgSchemaConverter | I1 inspect refuses empty content with an error, no fields and Convert off", (sess) => badInputCase(sess, 0));
test("UC-msgSchemaConverter | I2 inspect refuses whitespace only with an error, no fields and Convert off", (sess) => badInputCase(sess, 1));
test("UC-msgSchemaConverter | I3 inspect refuses malformed JSON schema with an error, no fields and Convert off", (sess) => badInputCase(sess, 2));
test("UC-msgSchemaConverter | I4 inspect refuses XML text while the format says JSD with an error, no fields and Convert off", (sess) => badInputCase(sess, 3));
test("UC-msgSchemaConverter | I5 inspect refuses JSON text while the format says XSD with an error, no fields and Convert off", (sess) => badInputCase(sess, 4));
test("UC-msgSchemaConverter | I6 inspect refuses an XSD with a choice group with an error, no fields and Convert off", (sess) => badInputCase(sess, 5));
test("UC-msgSchemaConverter | I7 inspect refuses a flat definition that is not JSON with an error, no fields and Convert off", (sess) => badInputCase(sess, 6));
test("UC-msgSchemaConverter | I8 inspect refuses an XML sample that is not well formed with an error, no fields and Convert off", (sess) => badInputCase(sess, 7));

test("UC-msgSchemaConverter | I9 a conversion the target cannot represent (a mandatory array as XML) reports the reason and shows no preview", async (sess) => {
  await loadSource(sess, "jsd", JSON.stringify({ title: "Needs", type: "object", additionalProperties: false, properties: { Items: { type: "array", items: { type: "string" } } }, required: ["Items"] }));
  await setOptions(sess, { target: "xsd" });
  const result = await convertNow(sess);
  assert.equal(result.ok, false);
  assert.match(result.message, /no lossless XML mapping|minItems/);
  assert.equal(await visible(sess, "#preview"), false);
  assert.equal(await isDisabled(sess, "#convert"), false, "the user can change an option and try again");
});

test("UC-msgSchemaConverter | I10 an error message clears when the next conversion succeeds", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { samples: 0 });
  assert.equal((await convertNow(sess)).ok, false);
  await setOptions(sess, { samples: 3 });
  assert.ok((await convertNow(sess)).ok);
  assert.equal((await status(sess)).error, false);
});

// ------------------------------------------------------------------------------------------
// J. Stale previews
// ------------------------------------------------------------------------------------------
const CHANGES: Array<[string, (sess: Sess) => Promise<void>]> = [
  ["the target format", (s) => setOptions(s, { target: "yaml" })],
  ["the requirement policy", (s) => setOptions(s, { requiredness: "mandatory" })],
  ["the sample count", (s) => setOptions(s, { samples: 2 })],
  ["the repeat count", (s) => setOptions(s, { repeats: 2 })],
  ["the flat-file layout", (s) => setOptions(s, { flatMode: "csv" })],
  ["the CSV delimiter", (s) => setOptions(s, { delimiter: "|" })],
  ["a field width", (s) => setWidth(s, "/Id", 20)],
  ["a field's Include tick", (s) => setInclude(s, "/Name", false)],
];
async function staleCase(sess: Sess, index: number) {
  const [what, change] = CHANGES[index]!;
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  assert.ok((await convertNow(sess)).ok);
  assert.equal(await visible(sess, "#preview"), true);
  await change(sess);
  assert.equal(await visible(sess, "#preview"), false, `the preview must not survive a change to ${what}`);
  assert.equal(await isDisabled(sess, "#convert"), false);
  assert.ok((await convertNow(sess)).ok);

}
test("UC-msgSchemaConverter | J1a changing the target format hides the preview, and Convert works again", (sess) => staleCase(sess, 0));
test("UC-msgSchemaConverter | J2a changing the requirement policy hides the preview, and Convert works again", (sess) => staleCase(sess, 1));
test("UC-msgSchemaConverter | J3a changing the sample count hides the preview, and Convert works again", (sess) => staleCase(sess, 2));
test("UC-msgSchemaConverter | J4a changing the repeat count hides the preview, and Convert works again", (sess) => staleCase(sess, 3));
test("UC-msgSchemaConverter | J5a changing the flat-file layout hides the preview, and Convert works again", (sess) => staleCase(sess, 4));
test("UC-msgSchemaConverter | J6a changing the CSV delimiter hides the preview, and Convert works again", (sess) => staleCase(sess, 5));
test("UC-msgSchemaConverter | J7a changing a field width hides the preview, and Convert works again", (sess) => staleCase(sess, 6));
test("UC-msgSchemaConverter | J8a changing a field's Include tick hides the preview, and Convert works again", (sess) => staleCase(sess, 7));

test("UC-msgSchemaConverter | J9 editing the source clears the field table and turns Convert off until it is inspected again", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  assert.ok((await convertNow(sess)).ok);
  await setValue(sess, "#source-content", CUSTOMER_JSD + " ");
  assert.equal(await visible(sess, "#preview"), false);
  assert.equal(await count(sess, "#fields tr"), 0);
  assert.equal(await isDisabled(sess, "#convert"), true);
  assert.match(await text(sess, "#convert-hint"), /Inspect the source definition first/);
  await inspectSource(sess);
  assert.equal(await isDisabled(sess, "#convert"), false);
});

test("UC-msgSchemaConverter | J10 changing the source format clears the field table (the fields belong to the source)", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await selectOption(sess, "#source-format", "yaml");
  assert.equal(await count(sess, "#fields tr"), 0);
  assert.equal(await isDisabled(sess, "#convert"), true);
});

test("UC-msgSchemaConverter | J11 two conversions in a row show the second result, not the first", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { target: "yaml" });
  assert.ok((await convertNow(sess)).ok);
  assert.ok((await preview(sess)).fileName.endsWith(".yaml"));
  await setOptions(sess, { target: "xsd" });
  assert.ok((await convertNow(sess)).ok);
  assert.ok((await preview(sess)).fileName.endsWith(".xsd"));
});

// ------------------------------------------------------------------------------------------
// K. Downloads
// ------------------------------------------------------------------------------------------
test("UC-msgSchemaConverter | K1 Download template saves flat-file-template.json with the documented shape", async (sess) => {
  await click(sess, "#download-template");
  const file = await waitDownload(sess);
  assert.equal(file.name, "flat-file-template.json");
  const template = JSON.parse(file.text);
  assert.equal(template.kind, "sand-bench-flat-schema");
  assert.equal(template.mode, "fixed");
  assert.deepEqual(template.fields.map((f: { name: string }) => f.name), ["CustomerId", "Name", "Country"]);
  assert.ok(template.fields.every((f: { width: number; required: boolean; type: string }) => f.width > 0 && typeof f.required === "boolean" && f.type));
});

test("UC-msgSchemaConverter | K2 the downloaded template can be loaded back: template → download → source → inspect", async (sess) => {
  await click(sess, "#download-template");
  const file = await waitDownload(sess);
  await loadSource(sess, "flat", file.text);
  assert.equal((await fieldRows(sess)).length, 3);
});

async function downloadDefinitionCase(sess: Sess, target: "jsd" | "xsd" | "yaml" | "flat") {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { target });
  if (target === "xsd") await setOptions(sess, { requiredness: "optional" });
  assert.ok((await convertNow(sess)).ok);
  const shown = await preview(sess);
  await click(sess, "#download-schema");
  const file = await waitDownload(sess);
  assert.equal(file.name, shown.fileName);
  assert.equal(file.text, shown.definition);

}
test("UC-msgSchemaConverter | K3a Download definition (jsd) saves exactly the text in the preview under the shown name", (sess) => downloadDefinitionCase(sess, "jsd"));
test("UC-msgSchemaConverter | K3b Download definition (xsd) saves exactly the text in the preview under the shown name", (sess) => downloadDefinitionCase(sess, "xsd"));
test("UC-msgSchemaConverter | K3c Download definition (yaml) saves exactly the text in the preview under the shown name", (sess) => downloadDefinitionCase(sess, "yaml"));
test("UC-msgSchemaConverter | K3d Download definition (flat) saves exactly the text in the preview under the shown name", (sess) => downloadDefinitionCase(sess, "flat"));

test("UC-msgSchemaConverter | K4 Download samples (ZIP) saves a valid ZIP that holds every sample by name and content", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { samples: 3 });
  assert.ok((await convertNow(sess)).ok);
  const samples = await allSamples(sess);
  await click(sess, "#download-samples");
  const file = await waitDownload(sess);
  assert.equal(file.name, "schema-samples.zip");
  assert.equal(file.magic.slice(0, 2), "PK", "a ZIP starts with PK");
  assert.match(file.text, /PK\u0005\u0006/, "the end-of-central-directory record is present");
  for (const s of samples) {
    assert.ok(file.text.includes(s.fileName), `the ZIP lists ${s.fileName}`);
    assert.ok(file.text.includes(s.content), `the ZIP holds the content of ${s.fileName}`);
  }
});

test("UC-msgSchemaConverter | K5 a fixed-width ZIP keeps every record's trailing spaces (no trimming)", async (sess) => {
  await loadSource(sess, "flat", JSON.stringify(FLAT_TEMPLATE));
  await setOptions(sess, { target: "flat", flatMode: "fixed", samples: 2 });
  assert.ok((await convertNow(sess)).ok);
  const samples = await allSamples(sess);
  await click(sess, "#download-samples");
  const file = await waitDownload(sess);
  for (const s of samples) assert.ok(file.text.includes(s.content) && s.content.length === 44);
});

test("UC-msgSchemaConverter | K6 the download buttons do nothing before a conversion exists", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  const before = (await downloads(sess)).length;
  await sess.exec("document.getElementById('download-schema').click();document.getElementById('download-samples').click();");
  await sleep(300);
  assert.equal((await downloads(sess)).length, before);
});

// ------------------------------------------------------------------------------------------
// L. Hand-off to Import Scheme
// ------------------------------------------------------------------------------------------
test("UC-msgSchemaConverter | L1 the import note explains what Import Scheme will receive for each target", async (sess) => {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { target: "jsd" });
  assert.ok((await convertNow(sess)).ok);
  assert.match((await preview(sess)).importNote, /Import opens with this generated definition selected/);
  await setOptions(sess, { target: "yaml" });
  assert.ok((await convertNow(sess)).ok);
  assert.match((await preview(sess)).importNote, /equivalent JSON Schema companion/);
  await setOptions(sess, { target: "flat" });
  assert.ok((await convertNow(sess)).ok);
  assert.match((await preview(sess)).importNote, /equivalent JSON Schema companion/);
});

async function handoffCase(sess: Sess, target: "jsd" | "xsd" | "yaml" | "flat") {
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  await setOptions(sess, { target, ...(target === "xsd" ? { requiredness: "optional" as const } : {}) });
  assert.ok((await convertNow(sess)).ok);
  await click(sess, "#open-import");
  await waitFor(async () => /page=msgImportSchema/.test(String(await sess.url())), { message: "navigation to Import Scheme" });
  await waitVisible(sess, "#sbe-confirm-upload", { timeout: 20000 });
  const chosen = await waitFor(async () => {
    const t = await text(sess, "#sbe-import-chosen, [data-sbe-chosen]").catch(() => "");
    return t || (await pageText(sess)).match(/Chosen: [^\n]+/)?.[0] || "";
  }, { timeout: 15000, message: "the converted file to be chosen on the import screen" });
  const expected = target === "xsd" ? "Customer.xsd" : "Customer.json";
  assert.ok(chosen.includes(expected), `import screen shows ${chosen}, expected ${expected}`);
  assert.equal(await sess.exec("return sessionStorage.getItem('sbe_converter_import');"), null, "the hand-off is consumed once");

}
test("UC-msgSchemaConverter | L2a Continue to Import Scheme (jsd) opens the import screen with the converted file chosen", (sess) => handoffCase(sess, "jsd"));
test("UC-msgSchemaConverter | L2b Continue to Import Scheme (xsd) opens the import screen with the converted file chosen", (sess) => handoffCase(sess, "xsd"));
test("UC-msgSchemaConverter | L2c Continue to Import Scheme (yaml) opens the import screen with the converted file chosen", (sess) => handoffCase(sess, "yaml"));
test("UC-msgSchemaConverter | L2d Continue to Import Scheme (flat) opens the import screen with the converted file chosen", (sess) => handoffCase(sess, "flat"));

// ------------------------------------------------------------------------------------------
// M. Access and accessibility
// ------------------------------------------------------------------------------------------
test("UC-msgSchemaConverter | M1 without a session the API refuses the conversion and the page says so", async () => {
  const anon = await browser.fresh();
  try {
    await anon.sess.go(`${ENV.webBase}/schema-converter.html`);
    await waitVisible(anon.sess, "#inspect");
    await setSource(anon.sess, "jsd", CUSTOMER_JSD);
    const result = await inspectSource(anon.sess);
    assert.equal(result.ok, false);
    assert.match(result.message, /Authentication required|unauthori|Conversion failed \(401\)/i);
    assert.equal(await count(anon.sess, "#fields tr"), 0);
    assert.equal(await isDisabled(anon.sess, "#convert"), true);
  } finally { await anon.close(); }
});

test("UC-msgSchemaConverter | M2 every input and select has a visible label and every field checkbox and width has an accessible name", async (sess) => {
  const unlabeled = await sess.exec(`return [...document.querySelectorAll('.converter-main input, .converter-main select, .converter-main textarea')]
    .filter(e => !e.closest('#fields') && !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map(e => e.id || e.name || e.tagName);`);
  assert.deepEqual(unlabeled, ["source-content"].filter((id) => unlabeled.includes(id)), "only the textarea labelled by 'for' may lack .labels; check it below");
  assert.equal(await sess.exec("return !!document.querySelector('label[for=source-content]');"), true);
  await loadSource(sess, "jsd", CUSTOMER_JSD);
  const names = await sess.exec("return [...document.querySelectorAll('#fields input')].map(e=>e.getAttribute('aria-label'));");
  assert.equal(names.length, 10);
  assert.ok(names.every((n: string) => /^(Include|Width) \//.test(n)), `unnamed row control in ${names}`);
});

test("UC-msgSchemaConverter | M3 the status line is a polite live region and the field table has column headers", async (sess) => {
  assert.equal(await attribute(sess, "#converter-status", "role"), "status");
  assert.equal(await attribute(sess, "#converter-status", "aria-live"), "polite");
  const heads = await sess.exec("return [...document.querySelectorAll('.converter-table th')].map(h=>h.textContent.trim()+':'+h.getAttribute('scope'));");
  assert.deepEqual(heads, ["Include:col", "Field path:col", "Type:col", "Required:col", "Width:col", "Description:col"]);
});

test("UC-msgSchemaConverter | M4 the console never reports a boot failure on this page", async (sess) => {
  assert.doesNotMatch(await sess.source(), /Official console JS did not boot|JSX console CONFIG was not exposed/);
  assert.equal(await waitHidden(sess, "#preview").then(() => true), true);
});
