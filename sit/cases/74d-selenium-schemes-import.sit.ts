// Scheme definitions, the schema pages and Import Scheme variations, driven through the browser and
// confirmed through the API (/api/v1/catalog/iso/uploads, /api/v1/catalog/schemas/*).
//
//   SCH*  Scheme definitions (family -> message -> details: Tree / Diagram / List, download, delete, use),
//         the Schema register page, Create schema (builder), the standalone Create schema and Schema
//         tree pages, and the Schema canvas.
//   IMP*  Import Scheme: source formats, the Markdown choice, one-file rule, empty, flat, mismatched and
//         oversize input, the result checklist and Clear test data.
//
// 72-* already covers the import -> definition -> dataset -> feeder journey, duplicate and declined imports,
// JSON Schema dropping `required` and malformed XSD. Not repeated here. { todo } marks a product defect.
import { after, test as nodeTest, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { CUSTOMER_JSD, FLAT_TEMPLATE, ORDER_XSD } from "../lib/selenium/converter-fixtures.mjs";
import {
  apiJson, captureDownloads, click, clickText, count, exists, attribute, isDisabled, pageText, saveShot, selectOption, setValue, sharedBrowser, sleep, text,
  typeInto, uniqueName, uploadText, value, waitDownload, waitFor as baseWaitFor, waitVisible,
} from "../lib/selenium/flow.mjs";
import { confirmImport, importOutcome, importSchema } from "../lib/selenium/flows.mjs";
import {
  answerAlert, clickDetail, detailButton, dropDraft, dropUploads, mainText, openFamily, openSchemeDefinitions, openSchemeDetails, rowsOf,
  schemaDrafts, uploadByCode, uploadsFromApi,
} from "../lib/selenium/definitions.mjs";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());

/** A busy shared machine makes pages slow, so every wait here allows 30 s unless a case says otherwise. */
const waitFor = (fn: () => unknown, o: { timeout?: number; interval?: number; message?: string } = {}) => baseWaitFor(fn, { timeout: 30000, ...o });

type Sess = Awaited<ReturnType<typeof browser.signedIn>>;
type Body = (sess: Sess, t: TestContext) => Promise<void>;

/** One GUI case: skipped when Selenium is down, screenshotted when it fails. Named test on purpose (see header). */
function test(name: string, a: Body | { todo: string }, b?: Body) {
  const fn = (typeof a === "function" ? a : b) as Body;
  const opts = typeof a === "function" ? {} : a;
  nodeTest(name, opts, async (t) => {
    if (!(await browser.available(`schemes-${name}`))) { t.skip(browser.reason); return; }
    const sess = await browser.signedIn();
    try { await fn(sess, t); }
    catch (error) { await saveShot(sess, `schemes-${name}`); throw error; }
  });
}

const prefixes: string[] = [];
const drafts: string[] = [];
after(async () => { for (const p of prefixes) await dropUploads(p); for (const id of drafts) await dropDraft(id); });
function root(prefix: string) { const r = uniqueName(prefix); prefixes.push(r); return r; }
const xsdFor = (r: string) => ORDER_XSD.replace('name="Order"', `name="${r}"`);

/** Imports an Order-shaped XSD under a unique root and returns the root (the scheme's code). */
async function importOrder(sess: Sess, prefix = "SitSd") {
  const r = root(prefix);
  await importSchema(sess, browser, { format: "XSD", fileName: `${r}.xsd`, content: xsdFor(r) });
  const outcome = await importOutcome(sess);
  assert.equal(outcome.stored, true, outcome.text);
  return r;
}

// ==========================================================================================
// SCH  Scheme definitions
// ==========================================================================================
test("SCH1 an imported scheme is listed as its own family with an Imported, Parsed card showing its field counts", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDefinitions(sess, browser);
  const family = await sess.exec("const c=[...document.querySelectorAll('.opsc-family-card')].find(c=>c.querySelector('.opsc-family-name').textContent.trim()===arguments[0]);return c?c.innerText.replace(/\\n+/g,' | '):null;", [r]);
  assert.ok(family, "the family card");
  assert.match(family, /1 imported message type/);
  await openFamily(sess, r);
  const card = await sess.exec("const c=document.querySelector(\".opsc-msgtype-card[data-scheme-code='\"+arguments[0]+\"']\");return c?{source:c.getAttribute('data-scheme-source'),text:c.innerText.replace(/\\n+/g,' | '),del:!!c.querySelector('.opsc-msgtype-delete')}:null;", [r]);
  assert.equal(card.source, "imported");
  assert.match(card.text, /Imported/);
  assert.match(card.text, /Parsed/);
  assert.equal(card.del, true);
  const api = await uploadByCode(r);
  assert.match(card.text, new RegExp(`FIELDS \\| ${api.fieldCount}`));
  assert.match(card.text, new RegExp(`MANDATORY \\| ${api.mandatoryCount}`));
  assert.deepEqual([api.fieldCount, api.mandatoryCount], [5, 4]);
});

test("SCH2 the details page opens on the Tree view: node counts, the elements with their occurrence and type", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDetails(sess, browser, r);
  const t = await mainText(sess);
  assert.match(t, /7 nodes/);
  assert.match(t, /7 elements/);
  assert.match(t, /3 levels deep/);
  for (const n of ["OrderId", "Customer", "Line", "Sku", "Qty", "Note"]) assert.ok(t.includes(n), `${n} missing from the tree`);
  assert.match(t, /1\.\.∞/);
  assert.match(t, /0\.\.1/);
  assert.match(t, /xs:integer/);
});

test("SCH3 selecting a tree row shows its path, type and occurrence", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDetails(sess, browser, r);
  await sess.exec("[...document.querySelectorAll('.opsc-main *')].find(e=>e.children.length===0&&e.textContent.trim()==='Sku').click();");
  await waitFor(async () => (await mainText(sess)).includes(`/${r}/Line/Sku`), { message: "the path of Sku" });
  const t = await mainText(sess);
  assert.match(t, /Element/);
  assert.match(t, /Type\s+xs:string/);
  assert.match(t, /Occurs\s+1 · mandatory/);
});

test("SCH4 Collapse all hides the children of the tree and Expand all shows them again", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDetails(sess, browser, r);
  assert.ok((await mainText(sess)).includes("Sku"));
  await clickDetail(sess, "Collapse all");
  await waitFor(async () => !(await mainText(sess)).includes("Sku"), { message: "Sku to disappear" });
  assert.ok(!(await mainText(sess)).includes("OrderId"));
  await clickDetail(sess, "Expand all");
  await waitFor(async () => (await mainText(sess)).includes("Sku"), { message: "Sku to return" });
});

test("SCH5 the Diagram view groups fields with their mandatory counts and marks optional fields", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDetails(sess, browser, r);
  await clickDetail(sess, "Diagram");
  await waitFor(async () => /5 fields · 4 mandatory/.test(await mainText(sess)), { message: "the diagram summary" });
  const t = await mainText(sess);
  assert.match(t, /Line\s+2 fields · 2 mandatory/);
  assert.match(t, /Note[\s\S]*Optional/);
  assert.match(t, /Order Identification/);
});

test("SCH6 the List view has a column per property and one row per field; the chosen view is remembered", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDetails(sess, browser, r);
  try {
    await clickDetail(sess, "List");
    await waitFor(async () => /FIELD\s+PATH\s+TYPE\s+OCCURS\s+MANDATORY/.test(await mainText(sess)), { message: "the list header" });
    const t = await mainText(sess);
    for (const path of ["OrderId", "Customer", "Line/Sku", "Line/Qty", "Note"]) assert.ok(t.includes(`/${r}/${path}`), `${path} missing`);
    assert.equal(await sess.exec("return localStorage.getItem('sbe.schemeFieldView');"), "list");
    await openSchemeDetails(sess, browser, r);
    await waitFor(async () => /FIELD\s+PATH\s+TYPE/.test(await mainText(sess)), { message: "the list view to be remembered" });
  } finally { await sess.exec("localStorage.removeItem('sbe.schemeFieldView');"); }
});

test("SCH7 Download XSD saves the stored file under its own name with the uploaded content", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDetails(sess, browser, r);
  await captureDownloads(sess);
  await clickDetail(sess, "Download XSD");
  const file = await waitDownload(sess);
  assert.equal(file.name, `${r}.xsd`);
  assert.equal(file.text, xsdFor(r));
});

test("SCH8 Use this to create message definition opens the studio with that scheme chosen", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDetails(sess, browser, r);
  await clickDetail(sess, "Use this to create message definition");
  await waitFor(async () => (await text(sess, "[data-testid='studio-badge']")) === r, { timeout: 20000, message: "the scheme code as the chosen message" });
  await waitFor(async () => !(await isDisabled(sess, "#sbe-studio-name")), { message: "the name field to enable" });
});

test("SCH9 official ISO message types are reference data: no Imported pill and no Delete", async (sess) => {
  await openSchemeDefinitions(sess, browser);
  await openFamily(sess, "pain");
  const cards = await sess.exec("return [...document.querySelectorAll('.opsc-msgtype-card')].map(c=>({source:c.getAttribute('data-scheme-source'),del:!!c.querySelector('.opsc-msgtype-delete'),text:c.innerText}));");
  assert.ok(cards.length >= 1);
  for (const c of cards) {
    assert.equal(c.source, "catalogue");
    assert.equal(c.del, false);
    assert.match(c.text, /Official/);
  }
});

test("SCH10 Back from the details returns to the message list, and from there to the families", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDetails(sess, browser, r);
  await clickDetail(sess, "Back");
  await waitFor(() => exists(sess, ".opsc-msgtype-card"), { message: "the message cards" });
  assert.ok(!(await exists(sess, ".opsc-viewtoggle")));
  await clickDetail(sess, "Back");
  await waitFor(() => exists(sess, ".opsc-family-card"), { message: "the family cards" });
});

test("SCH11 declining the Delete dialog keeps the scheme", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDefinitions(sess, browser);
  await openFamily(sess, r);
  await sess.exec("document.querySelector(\".opsc-msgtype-card[data-scheme-code='\"+arguments[0]+\"'] .opsc-msgtype-delete\").click();", [r]);
  assert.equal(await answerAlert(sess, false), `Delete schema ${r}? Its stored files, fields and constraints are removed. This cannot be undone.`);
  await sleep(600);
  assert.ok(await uploadByCode(r), "the scheme must survive a declined delete");
  assert.equal(await exists(sess, `.opsc-msgtype-card[data-scheme-code='${r}']`), true);
});

test("SCH12 accepting the Delete dialog removes the scheme from the page and the API, and the same file imports again", async (sess) => {
  const r = await importOrder(sess);
  await openSchemeDetails(sess, browser, r);
  await clickDetail(sess, "Delete schema");
  assert.match(await answerAlert(sess, true), new RegExp(`^Delete schema ${r}\\?`));
  await waitFor(async () => (await uploadByCode(r)) === null, { message: "the API to drop the scheme" });
  await waitFor(async () => (await pageText(sess)).includes(`Deleted ${r}`) || !(await exists(sess, `.opsc-msgtype-card[data-scheme-code='${r}']`)), { message: "the page to drop the card" });
  await importSchema(sess, browser, { format: "XSD", fileName: `${r}.xsd`, content: xsdFor(r) });
  const again = await importOutcome(sess);
  assert.equal(again.stored, true, `the same file must import again after the delete: ${again.text}`);
  assert.equal((await uploadByCode(r))?.fieldCount, 5);
});

test("SCH13 the Schema register page lists the scheme with the same field counts as the API", async (sess) => {
  const r = await importOrder(sess);
  await browser.open("/message-designer-schema-register.html");
  await waitFor(async () => /Up to date · \d+ records?/.test(await text(sess, "#screen-status")), { timeout: 15000, message: "the register to load" });
  await waitFor(async () => (await pageText(sess)).includes(r), { message: "the new scheme in the register" });
  const row = await sess.exec("const r=[...document.querySelectorAll('table tr')].find(t=>t.textContent.includes(arguments[0]));return r?[...r.cells].map(c=>c.textContent.trim()):null;", [r]);
  const api = await uploadByCode(r);
  assert.ok(row.includes("Stored"), row.join());
  assert.ok(row.includes(String(api.fieldCount)) && row.includes(String(api.mandatoryCount)), row.join());
  assert.equal(await sess.exec("return document.querySelectorAll('table tbody tr').length;") > 0, true);
});

test("SCH14 Refresh on the Schema register picks up a scheme imported meanwhile", async (sess) => {
  await browser.open("/message-designer-schema-register.html");
  await waitFor(async () => /Up to date/.test(await text(sess, "#screen-status")), { message: "the register" });
  const r = await importOrder(sess);
  await browser.open("/message-designer-schema-register.html");
  await waitFor(async () => (await pageText(sess)).includes(r), { message: "the scheme in the register" });
});

test("SCH15 the old Imported schemes page opens the Scheme definitions screen", async (sess) => {
  await browser.open("/imported-schemes.html");
  await waitFor(async () => /page=schemeDefinitions/.test(String(await sess.url())), { message: "the redirect" });
  await waitFor(() => exists(sess, ".opsc-family-card"), { timeout: 20000, message: "the families" });
});

test("SCH16 /?page=msgSchemaRegister shows the Schema register", { todo: "the console has no msgSchemaRegister page, so the URL falls back to the Overview dashboard (only /message-designer-schema-register.html works)" }, async (sess) => {
  await browser.open("/?page=msgSchemaRegister");
  await sleep(4000);
  const t = await pageText(sess);
  assert.match(t, /Schema register/i, "the Overview dashboard is shown instead");
});

// ---- Create schema (the builder inside the console) ----
async function openBuilder(sess: Sess) {
  await browser.open("/?page=msgCreateSchema");
  await waitVisible(sess, "#sbe-sb-build", { timeout: 20000 });
  await waitFor(async () => (await count(sess, "#sbe-sb-kids .sbe-kid")) === 3, { message: "three default children" });
}
const sbStatus = (sess: Sess) => text(sess, "#sbe-sb-status");
const sbClick = (sess: Sess, id: string) => sess.exec("document.getElementById(arguments[0]).click();", [id]);
async function sbBuild(sess: Sess) {
  await sess.exec("document.getElementById('sbe-sb-status').textContent='';");
  await sbClick(sess, "sbe-sb-build");
  return waitFor(async () => (await sbStatus(sess)) || null, { message: "a status after Generate" }) as Promise<string>;
}

test("SCH17 Generate schema in each format names the file .xsd, .json or .flat.json and counts three fields", async (sess) => {
  await openBuilder(sess);
  const r = uniqueName("SbFmt");
  await setValue(sess, "#sbe-sb-name", r);
  await setValue(sess, "#sbe-sb-root", `Root${r}`);
  assert.deepEqual(await sess.exec("return [...document.querySelectorAll('#sbe-sb-format option')].map(o=>o.value);"), ["xml", "json", "flat"]);
  for (const [format, file] of [["XML / XSD", `${r}.xsd`], ["JSON Schema", `${r}.json`], ["Flat file", `${r}.flat.json`]]) {
    await selectOption(sess, "#sbe-sb-format", format);
    assert.equal(await sbBuild(sess), `Generated ${file} · 3 fields`);
  }
});

test("SCH18 the generated XSD holds the children that were typed, with their type and required flag", async (sess) => {
  await openBuilder(sess);
  const r = uniqueName("SbKid");
  await setValue(sess, "#sbe-sb-name", r);
  await setValue(sess, "#sbe-sb-root", `Root${r}`);
  await sess.exec("document.querySelectorAll('#sbe-sb-kids [data-k=rm]').forEach(b=>b.click());");
  await sbClick(sess, "sbe-sb-add");
  await sbClick(sess, "sbe-sb-add");
  await waitFor(async () => (await count(sess, "#sbe-sb-kids .sbe-kid")) === 2, { message: "two child rows" });
  await sess.exec("const rows=document.querySelectorAll('#sbe-sb-kids .sbe-kid');const set=(e,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);e.dispatchEvent(new Event('input',{bubbles:true}));};set(rows[0].querySelector('[data-k=name]'),'Amount');rows[0].querySelector('[data-k=type]').value='decimal';rows[0].querySelector('[data-k=req]').checked=true;set(rows[1].querySelector('[data-k=name]'),'Memo');rows[1].querySelector('[data-k=type]').value='string';rows[1].querySelector('[data-k=req]').checked=false;");
  assert.equal(await sbBuild(sess), `Generated ${r}.xsd · 2 fields`);
  const out = JSON.parse(await text(sess, "#sbe-sb-out"));
  assert.deepEqual(out.fields.map((f: { id: string; type: string; required: boolean }) => [f.id, f.type, f.required]), [["Amount", "decimal", true], ["Memo", "string", false]]);
  assert.match(out.artifact, /name="Amount" type="xs:decimal"/);
  assert.match(out.artifact, /name="Memo"[^>]*minOccurs="0"/);
});

test("SCH19 Remove takes a child row out and the count follows", async (sess) => {
  await openBuilder(sess);
  await sess.exec("document.querySelector('#sbe-sb-kids [data-k=rm]').click();");
  await waitFor(async () => (await count(sess, "#sbe-sb-kids .sbe-kid")) === 2, { message: "two rows" });
  const r = uniqueName("SbRm");
  await setValue(sess, "#sbe-sb-name", r);
  assert.match(await sbBuild(sess), /· 2 fields$/);
});

test("SCH20 Save draft stores the schema (the API lists it) and saving again does not duplicate it", async (sess) => {
  await openBuilder(sess);
  const r = uniqueName("SbSave");
  await setValue(sess, "#sbe-sb-name", r);
  await setValue(sess, "#sbe-sb-root", `Root${r}`);
  await sbClick(sess, "sbe-sb-save");
  const first = await waitFor(async () => /^Saved sch_/.test(await sbStatus(sess)) ? await sbStatus(sess) : null, { message: "the saved notice" });
  const id = first.replace("Saved ", "");
  drafts.push(id);
  const list = (await schemaDrafts()).filter((d: { name: string }) => d.name === r);
  assert.equal(list.length, 1);
  assert.deepEqual([list[0].id, list[0].status, list[0].format, list[0].fieldCount], [id, "draft", "xml", 3]);
  await sbClick(sess, "sbe-sb-save");
  await sleep(1200);
  assert.equal((await schemaDrafts()).filter((d: { name: string }) => d.name === r).length, 1, "a second Save must not create a second draft");
});

test("SCH21 Download artefact saves the generated file under its generated name", async (sess) => {
  await openBuilder(sess);
  const r = uniqueName("SbDl");
  await setValue(sess, "#sbe-sb-name", r);
  await sbBuild(sess);
  await captureDownloads(sess);
  await sbClick(sess, "sbe-sb-dl");
  const file = await waitDownload(sess);
  assert.equal(file.name, `${r}.xsd`);
  assert.match(file.text, /<xs:schema/);
});

test("SCH22 Valid / invalid samples then Validate instance says the valid sample is valid", async (sess) => {
  await openBuilder(sess);
  await setValue(sess, "#sbe-sb-name", uniqueName("SbSmp"));
  await sbClick(sess, "sbe-sb-samples");
  await waitFor(async () => (await sbStatus(sess)) === "Samples ready", { message: "samples" });
  const out = JSON.parse(await text(sess, "#sbe-sb-out"));
  assert.ok(out.valid.includes("<Amt>") && out.invalid.length < out.valid.length);
  await sbClick(sess, "sbe-sb-validate");
  await waitFor(async () => /^Instance valid \(/.test(await sbStatus(sess)), { message: "the valid verdict" });
});

test("SCH23 Publish saves, tests and publishes the schema; it is listed as published and Delete asks first", async (sess) => {
  await openBuilder(sess);
  const r = uniqueName("SbPub");
  await setValue(sess, "#sbe-sb-name", r);
  await setValue(sess, "#sbe-sb-root", `Root${r}`);
  await sbClick(sess, "sbe-sb-publish");
  await waitFor(async () => (await sbStatus(sess)) === "Published", { timeout: 20000, message: "Published" });
  const row = (await schemaDrafts()).find((d: { name: string }) => d.name === r);
  assert.ok(row, "the API lists the schema");
  drafts.push(row.id);
  assert.equal(row.status, "published");
  const published = rowsOf((await apiJson("/api/v1/catalog/schemas/published")).body);
  assert.ok(published.some((p: { id: string }) => p.id === row.id));
  await waitFor(async () => (await text(sess, "#sbe-sb-published")).includes(row.code), { message: "the published list" });
  await sess.exec("[...document.querySelectorAll('#sbe-sb-published p')].find(p=>p.textContent.includes(arguments[0])).querySelector('button').click();", [row.code]);
  assert.match(await answerAlert(sess, false), new RegExp(`^Are you sure you want to delete scheme ${row.code.replace(/\./g, "\\.")}\\?`));
  await sleep(500);
  assert.ok((await schemaDrafts()).some((d: { id: string }) => d.id === row.id), "declined: still there");
  await sess.exec("[...document.querySelectorAll('#sbe-sb-published p')].find(p=>p.textContent.includes(arguments[0])).querySelector('button').click();", [row.code]);
  await answerAlert(sess, true);
  await waitFor(async () => !(await schemaDrafts()).some((d: { id: string }) => d.id === row.id), { message: "the draft to be deleted" });
  await waitFor(async () => (await sbStatus(sess)) === `Deleted ${row.code}`, { message: "the deleted notice" });
});

test("SCH24 the standalone Create schema page builds a draft for the format it offers", { todo: "create-schema.html offers 'xsd' and 'json-schema' but the API accepts only xml, json or flat, so Build draft answers 'format must be xml, json, or flat' for both options" }, async (sess) => {
  await browser.open("/create-schema.html");
  await waitVisible(sess, "#screen-action");
  const r = uniqueName("CsPage");
  await sess.exec("const i=document.querySelector('[data-field=name]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,arguments[0]);i.dispatchEvent(new Event('input',{bubbles:true}));", [r]);
  const failures: string[] = [];
  for (const option of ["xsd", "json-schema"]) {
    await sess.exec("const s=document.querySelector('[data-field=format]');s.value=arguments[0];s.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('screen-status').textContent='';document.getElementById('screen-action').click();", [option]);
    await sleep(1500);
    const status = await text(sess, "#screen-status");
    if (/must be xml, json, or flat|error|fail/i.test(status)) failures.push(`${option}: ${status}`);
  }
  assert.deepEqual(failures, [], "Build draft refused the page's own format options");
});

test("SCH25 the Schema tree page reads an XSD and shows its nodes, components and a details pane", async (sess) => {
  await browser.open("/schema-tree.html");
  await waitVisible(sess, "#sbe-tkind");
  assert.deepEqual(await sess.exec("return [...document.querySelectorAll('#sbe-tkind option')].map(o=>o.textContent.trim());"), ["XSD schema", "JSON schema", "XML file", "JSON file"]);
  await selectOption(sess, "#sbe-tkind", "XSD schema");
  await uploadText(sess, "#sbe-tfile", "order.xsd", ORDER_XSD, "application/xml");
  await waitFor(async () => /xsd · \d+ nodes/.test(await pageText(sess)), { message: "the node count" });
  const t = await pageText(sess);
  assert.match(t, /xsd · 12 nodes/);
  for (const n of ["OrderId", "Customer", "Line", "Sku", "Qty", "Note"]) assert.ok(t.includes(n), `${n} missing`);
  assert.match(t, /element \(7\)/);
  assert.match(t, /complexType \(2\)/);
});

test("SCH26 the Schema tree page reads a JSON Schema", async (sess) => {
  await browser.open("/schema-tree.html");
  await waitVisible(sess, "#sbe-tkind");
  await selectOption(sess, "#sbe-tkind", "JSON schema");
  await uploadText(sess, "#sbe-tfile", "customer.json", CUSTOMER_JSD, "application/json");
  await waitFor(async () => /json/i.test(await pageText(sess)) && /Address/.test(await pageText(sess)), { message: "the JSON tree" });
  const t = await pageText(sess);
  for (const n of ["Id", "Name", "Address", "Orders", "Active"]) assert.ok(t.includes(n), `${n} missing`);
});

// ---- Schema canvas ----
test("SCH27 the Schema canvas page opens with its design brief, format choices and actions", async (sess) => {
  await browser.open("/schema-canvas.html");
  await waitVisible(sess, "#sbe-cv-name");
  assert.deepEqual(await sess.exec("return [...document.querySelectorAll('#sbe-cv-format option')].map(o=>o.textContent.trim());"), ["XML / XSD", "JSON Schema", "Flat file"]);
  for (const id of ["load-baseline", "start-empty", "add-header", "add-trailer", "layout", "build", "download", "save", "samples", "publish"]) assert.ok(await exists(sess, `#sbe-cv-${id}`), `#sbe-cv-${id} missing`);
  assert.deepEqual(await sess.exec("return [...document.querySelectorAll('#sbe-cv-message-type option')].map(o=>o.textContent.trim());"), ["Operational message", "Event / notification", "Command", "Document", "Batch record"]);
});

test("SCH28 Add fixed header and Add fixed trailer add a framing record each, and Remove takes it out", async (sess) => {
  await browser.open("/schema-canvas.html");
  await waitVisible(sess, "#sbe-cv-add-header");
  await click(sess, "#sbe-cv-add-header");
  await click(sess, "#sbe-cv-add-trailer");
  await waitFor(async () => (await count(sess, "#sbe-cv-framing-header > *, #sbe-cv-framing-trailer > *")) >= 2, { message: "the framing records" });
  const before = await count(sess, "#sbe-cv-framing-header > *, #sbe-cv-framing-trailer > *");
  await sess.exec("[...document.querySelectorAll('#sbe-cv-framing-header button, #sbe-cv-framing-trailer button')].find(b=>b.textContent.trim()==='Remove').click();");
  await waitFor(async () => (await count(sess, "#sbe-cv-framing-header > *, #sbe-cv-framing-trailer > *")) === before - 1, { message: "one record fewer" });
});

test("SCH29 on the standalone Schema canvas, Start empty then Generate schema works for a signed-in operator", { todo: "schema-canvas-bind.js reads only window.__sbeToken, which the standalone page never sets: every canvas call answers 'Authentication required' for a signed-in operator" }, async (sess) => {
  await browser.open("/schema-canvas.html");
  await waitVisible(sess, "#sbe-cv-build");
  await setValue(sess, "#sbe-cv-name", uniqueName("Cv"));
  await sess.exec("document.getElementById('sbe-cv-start-empty').click();");
  await sess.exec("document.getElementById('sbe-cv-build').click();");
  const status = await waitFor(async () => (await text(sess, "#sbe-cv-status")) || null, { message: "a status" });
  assert.match(status, /^Generated .+ · \d+ fields$/, `the canvas said: ${status}`);
});

test("SCH30 /?page=msgSchemaCanvas shows the Schema canvas inside the console", { todo: "js/schema-canvas-lazy.js, which loads the canvas scripts, is not referenced by any page, so the console renders an empty host" }, async (sess) => {
  await browser.open("/?page=msgSchemaCanvas");
  await waitVisible(sess, "#sbe-schema-canvas", { timeout: 15000 });
  await sleep(4000);
  assert.ok(await exists(sess, "#sbe-cv-name"), "the canvas controls never mounted");
});

// ==========================================================================================
// IMP  Import Scheme variations
// ==========================================================================================
async function openImport(sess: Sess) {
  await browser.open("/?page=msgImportSchema");
  await waitVisible(sess, "#sbe-confirm-upload", { timeout: 20000 });
}
const chosenLine = (sess: Sess) => text(sess, "#sbe-import-selected");
async function attachMany(sess: Sess, css: string, files: Array<[string, string]>) {
  await sess.exec("const dt=new DataTransfer();for(const [n,c] of arguments[1])dt.items.add(new File([c],n,{type:'text/plain'}));const e=document.querySelector(arguments[0]);e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));", [css, files]);
}

test("IMP1 the Source format list is XSD, JSON Schema and Flat file, as configured under List boxes", async (sess) => {
  await openImport(sess);
  await waitFor(async () => (await attribute(sess, "#sbe-source-format", "data-sbe-formats")) === "configured", { message: "the configured formats" });
  assert.deepEqual(await sess.exec("return [...document.querySelectorAll('#sbe-source-format option')].map(o=>o.value+'='+o.textContent.trim());"), ["xsd=XSD", "json=JSON Schema", "flat=Flat file"]);
  const api = (await apiJson("/api/v1/list-boxes/sourceFormat")).body as { data: { items?: Array<{ value: string; label: string }> } };
  assert.deepEqual((api.data.items || []).slice(0, 3).map((i) => `${i.value}=${i.label}`), ["xsd=XSD", "json=JSON Schema", "flat=Flat file"]);
});

test("IMP2 the file picker's accepted types follow the chosen source format", async (sess) => {
  await openImport(sess);
  const accept = async (format: string) => { await selectOption(sess, "#sbe-source-format", format); return attribute(sess, "#sbe-schema-file", "accept"); };
  assert.equal(await accept("XSD"), ".xsd,application/xml,text/xml");
  assert.equal(await accept("JSON Schema"), ".json,.jsd,application/json");
  assert.equal(await accept("Flat file"), ".csv,.tsv,.txt,.dat,.flat,text/csv,text/plain");
});

test("IMP3 a fresh Import Scheme screen has nothing chosen, Confirm upload off and the Markdown answer No", async (sess) => {
  await openImport(sess);
  assert.equal(await chosenLine(sess), "No files chosen yet.");
  assert.equal(await text(sess, "#sbe-schema-chosen"), "No schema file chosen.");
  assert.equal(await isDisabled(sess, "#sbe-confirm-upload"), true);
  assert.equal(await value(sess, "#sbe-markdown-choice"), "no");
  assert.equal(await sess.exec("return document.getElementById('sbe-markdown-section').hidden;"), true);
});

test("IMP4 choosing a schema file names it, says how it will be uploaded and turns Confirm upload on", async (sess) => {
  await openImport(sess);
  const r = root("SitImp");
  await uploadText(sess, "#sbe-schema-file", `${r}.xsd`, xsdFor(r), "application/xml");
  await waitFor(async () => (await text(sess, "#sbe-schema-chosen")) === `Chosen: ${r}.xsd`, { message: "the chosen name" });
  assert.equal(await chosenLine(sess), `Ready — schema: ${r}.xsd · markdown: none. Confirm upload without Markdown.`);
  assert.equal(await isDisabled(sess, "#sbe-confirm-upload"), false);
});

test("IMP5 answering Yes to Markdown shows the Markdown file box and Validate, and turns Confirm off until validated; No hides them again", async (sess) => {
  await openImport(sess);
  const r = root("SitImp");
  await uploadText(sess, "#sbe-schema-file", `${r}.xsd`, xsdFor(r), "application/xml");
  await selectOption(sess, "#sbe-markdown-choice", "Yes");
  await waitFor(async () => !(await sess.exec("return document.getElementById('sbe-markdown-section').hidden;")), { message: "the Markdown section" });
  assert.equal(await isDisabled(sess, "#sbe-confirm-upload"), true, "Confirm needs Validate first");
  assert.equal(await isDisabled(sess, "#sbe-validate-md"), true, "Validate needs the Markdown file");
  await uploadText(sess, "#sbe-md-file", `${r}.md`, `# ${r}`, "text/markdown");
  await waitFor(async () => !(await isDisabled(sess, "#sbe-validate-md")), { message: "Validate to enable" });
  assert.equal(await isDisabled(sess, "#sbe-confirm-upload"), true);
  await selectOption(sess, "#sbe-markdown-choice", "No");
  await waitFor(async () => !(await isDisabled(sess, "#sbe-confirm-upload")), { message: "Confirm to enable without Markdown" });
  assert.equal(await sess.exec("return document.getElementById('sbe-markdown-section').hidden;"), true);
  assert.equal(await text(sess, "#sbe-md-chosen"), "No markdown file chosen.");
});

test("IMP6 with Markdown: Validate passes each check, Confirm upload is offered, and the stored scheme keeps both files", async (sess) => {
  const r = root("SitMd");
  await openImport(sess);
  await selectOption(sess, "#sbe-source-format", "XSD");
  await uploadText(sess, "#sbe-schema-file", `${r}.xsd`, xsdFor(r), "application/xml");
  await selectOption(sess, "#sbe-markdown-choice", "Yes");
  await uploadText(sess, "#sbe-md-file", `${r}.md`, `# ${r}\n\nFields: OrderId, Customer, Line, Sku, Qty, Note.\n`, "text/markdown");
  await waitFor(async () => !(await isDisabled(sess, "#sbe-validate-md")), { message: "Validate to enable" });
  await click(sess, "#sbe-validate-md");
  await waitFor(async () => (await text(sess, "#sbe-import-result")) === "All checks passed. Confirm upload is now available.", { timeout: 20000, message: "the validation verdict" });
  const steps = await text(sess, "#sbe-import-progress");
  assert.match(steps, /✓\s*Parsing schema file/);
  assert.match(steps, /✓\s*Parsing markdown definition/);
  assert.match(steps, /✓\s*Checking markdown covers schema fields/);
  await confirmImport(sess, { accept: true });
  const outcome = await importOutcome(sess);
  assert.equal(outcome.stored, true, outcome.text);
  const row = await uploadByCode(r);
  assert.ok(row);
  assert.equal(row.fieldCount, 5);
  assert.deepEqual((row.files as Array<{ kind: string }>).map((f) => f.kind).sort(), ["markdown", "xsd"]);
});

test("IMP7 with Markdown that leaves a field out: Validate names the missing field, Confirm stays off, nothing is stored", async (sess) => {
  const r = root("SitMd");
  await openImport(sess);
  await uploadText(sess, "#sbe-schema-file", `${r}.xsd`, xsdFor(r), "application/xml");
  await selectOption(sess, "#sbe-markdown-choice", "Yes");
  await uploadText(sess, "#sbe-md-file", `${r}.md`, `# ${r}\n\nFields: OrderId, Customer, Line, Sku, Note.\n`, "text/markdown");
  await waitFor(async () => !(await isDisabled(sess, "#sbe-validate-md")), { message: "Validate to enable" });
  await click(sess, "#sbe-validate-md");
  await waitFor(async () => /^Information about these schema elements is not available in the markdown: /.test(await text(sess, "#sbe-import-result")), { timeout: 20000, message: "the verdict" });
  assert.match(await text(sess, "#sbe-import-result"), /Qty/);
  assert.equal(await isDisabled(sess, "#sbe-confirm-upload"), true);
  assert.equal(await uploadByCode(r), null);
});

test("IMP8 two schema files at once are refused: 'Choose one schema file', and the choice is cleared", async (sess) => {
  await openImport(sess);
  const a = root("SitTwo"), b = root("SitTwo");
  await attachMany(sess, "#sbe-schema-file", [[`${a}.xsd`, xsdFor(a)], [`${b}.xsd`, xsdFor(b)]]);
  await waitFor(async () => (await text(sess, "#sbe-import-result")) === "Choose one schema file. You chose 2; import them one at a time.", { message: "the refusal" });
  assert.equal(await text(sess, "#sbe-schema-chosen"), "No schema file chosen.");
  assert.equal(await isDisabled(sess, "#sbe-confirm-upload"), true);
  assert.equal(await uploadByCode(a), null);
  assert.equal(await uploadByCode(b), null);
});

test("IMP9 a JSON Schema file is stored under a JSON Schema import with its fields", async (sess) => {
  const r = root("SitJs");
  await importSchema(sess, browser, { format: "JSON Schema", fileName: `${r}.json`, content: JSON.stringify({ ...JSON.parse(CUSTOMER_JSD), title: r }), mime: "application/json" });
  const outcome = await importOutcome(sess);
  assert.equal(outcome.stored, true, outcome.text);
  const row = await uploadByCode(r);
  assert.ok(row);
  assert.equal(row.fieldCount, 5);
  assert.equal(outcome.fieldCount, 5);
});

test("IMP10 a JSON Schema file picked under the XSD format is still read as JSON Schema", async (sess) => {
  const r = root("SitMix");
  await importSchema(sess, browser, { format: "XSD", fileName: `${r}.json`, content: JSON.stringify({ ...JSON.parse(CUSTOMER_JSD), title: r }), mime: "application/json" });
  const outcome = await importOutcome(sess);
  assert.equal(outcome.stored, true, outcome.text);
  assert.equal((await uploadByCode(r))?.fieldCount, 5);
});

test("IMP11 an XSD picked under the JSON Schema format is refused or read as an XSD, not stored with no fields", { todo: "the GUI sends `format` but the API ignores it: the file is stored as a 0-field scheme with no warning" }, async (sess) => {
  const r = root("SitMis");
  await importSchema(sess, browser, { format: "JSON Schema", fileName: `${r}.json`, content: xsdFor(r), mime: "application/json" });
  const outcome = await importOutcome(sess);
  const stored = (await uploadsFromApi()).find((u: { name: string; code: string }) => u.name.startsWith(r) || u.code.startsWith(r));
  assert.ok(!outcome.stored || (stored && stored.fieldCount === 5), `stored ${stored?.code} with ${stored?.fieldCount} fields: ${outcome.text}`);
});

test("IMP12 a flat file (header line of columns) imported under Flat file is stored with a field per column", { todo: "Flat file is offered as a source format but no parser reads it: the import is stored as 'custom.message' with 0 fields" }, async (sess) => {
  const r = root("SitFlat");
  await importSchema(sess, browser, { format: "Flat file", fileName: `${r}.csv`, content: "CustomerId,Name,Country\nC1,Alex,AU\n", mime: "text/csv" });
  const outcome = await importOutcome(sess);
  const stored = (await uploadsFromApi()).find((u: { name: string }) => u.name.startsWith(r));
  assert.ok(stored, `the import must be listed: ${outcome.text}`);
  assert.equal(stored.fieldCount, 3, `stored ${stored.code} with ${stored.fieldCount} fields`);
});

test("IMP13 a Sand Bench flat-file layout (the template the converter offers) is stored with its three fields", { todo: "the flat-schema JSON is stored as a scheme with 0 fields (its `fields` list is not read)" }, async (sess) => {
  const r = root("SitFlt");
  await importSchema(sess, browser, { format: "Flat file", fileName: `${r}.flat.json`, content: JSON.stringify({ ...FLAT_TEMPLATE, name: r }), mime: "application/json" });
  await importOutcome(sess);
  const stored = (await uploadsFromApi()).find((u: { name: string }) => u.name.startsWith(r));
  assert.ok(stored);
  assert.equal(stored.fieldCount, 3, `stored ${stored.code} with ${stored.fieldCount} fields`);
});

test("IMP14 an empty file is refused with a reason and nothing is stored", { todo: "an empty .xsd is stored as a scheme called 'custom.message' with 0 fields" }, async (sess) => {
  const r = root("SitEmpty");
  await importSchema(sess, browser, { format: "XSD", fileName: `${r}.xsd`, content: "" });
  const outcome = await importOutcome(sess);
  const stored = (await uploadsFromApi()).filter((u: { name: string }) => u.name.startsWith(r));
  assert.equal(stored.length, 0, `stored ${stored.map((s: { code: string }) => s.code).join()}: ${outcome.text}`);
  assert.equal(outcome.stored, false);
});

test("IMP15 the same content under a new file name is refused as a duplicate and only one copy is kept", async (sess) => {
  const r = root("SitDupN");
  await importSchema(sess, browser, { format: "XSD", fileName: `${r}.xsd`, content: xsdFor(r) });
  assert.equal((await importOutcome(sess)).stored, true);
  await importSchema(sess, browser, { format: "XSD", fileName: `${r}-copy.xsd`, content: xsdFor(r) });
  const second = await importOutcome(sess);
  assert.equal(second.stored, false);
  assert.match(second.text, /^Duplicate: .*already stored as /);
  assert.match(second.text, /delete it in Message Schemes > Scheme Definitions first/);
  assert.equal((await uploadsFromApi()).filter((u: { code: string }) => u.code === r).length, 1);
});

test("IMP16 an oversize file (over 28 million characters) is refused with a reason and nothing is stored", async (sess) => {
  const r = root("SitBig");
  await openImport(sess);
  await selectOption(sess, "#sbe-source-format", "XSD");
  await sess.exec("const c='<xs:schema xmlns:xs=\"http://www.w3.org/2001/XMLSchema\"><xs:element name=\"'+arguments[0]+'\" type=\"xs:string\"/><!--'+' '.repeat(28000100)+'--></xs:schema>';const dt=new DataTransfer();dt.items.add(new File([c],arguments[0]+'.xsd',{type:'application/xml'}));const e=document.getElementById('sbe-schema-file');e.files=dt.files;e.dispatchEvent(new Event('change',{bubbles:true}));", [r]);
  await waitFor(async () => (await text(sess, "#sbe-schema-chosen")) === `Chosen: ${r}.xsd`, { message: "the chosen file" });
  await confirmImport(sess, { accept: true });
  await waitFor(async () => {
    const result = await text(sess, "#sbe-import-result");
    return /^Stopped at/.test(result) || /^Stored/.test(result) || /✗/.test(await text(sess, "#sbe-import-progress"));
  }, { timeout: 90000, message: "the oversize verdict" });
  await sleep(500);
  const outcome = { steps: await text(sess, "#sbe-import-progress"), result: await text(sess, "#sbe-import-result") };
  assert.doesNotMatch(outcome.result, /^Stored/, "an oversize file must not be stored");
  assert.match(outcome.steps, /exceeds the 28000000 character import cap|too large/i);
  assert.equal(await uploadByCode(r), null);
});

test("IMP17 after a successful import the checklist shows both steps done and the result links to Scheme definitions", async (sess) => {
  const r = root("SitOk");
  await importSchema(sess, browser, { format: "XSD", fileName: `${r}.xsd`, content: xsdFor(r) });
  const outcome = await importOutcome(sess);
  assert.equal(outcome.stored, true);
  await waitFor(async () => /✓\s*Confirming it can be read back from Scheme Definitions/.test(await text(sess, "#sbe-import-progress")), { message: "the read-back step" });
  const steps = await text(sess, "#sbe-import-progress");
  assert.match(steps, new RegExp(`✓\\s*Storing schema, markdown, and constraints\\s*Stored as ${r} — 5 fields, 4 mandatory\\.`));
  assert.match(steps, /Confirmed readable — status: stored\./);
  await click(sess, "#sbe-import-jump");
  await waitFor(() => exists(sess, ".opsc-family-card"), { timeout: 20000, message: "Scheme definitions" });
  assert.ok(await sess.exec("return [...document.querySelectorAll('.opsc-family-card')].some(c=>c.innerText.includes(arguments[0]));", [r]));
});

test("IMP18 Confirm upload after choosing a file clears the choice so the same file is not sent twice", async (sess) => {
  const r = root("SitOnce");
  await importSchema(sess, browser, { format: "XSD", fileName: `${r}.xsd`, content: xsdFor(r) });
  assert.equal((await importOutcome(sess)).stored, true);
  await waitFor(async () => (await text(sess, "#sbe-schema-chosen")) === "No schema file chosen.", { message: "the choice to clear" });
  assert.equal(await isDisabled(sess, "#sbe-confirm-upload"), true);
});

test("IMP19 Clear test data asks for CLEAR: cancelling the prompt, or accepting it empty, clears nothing", async (sess) => {
  const r = root("SitClr");
  await importSchema(sess, browser, { format: "XSD", fileName: `${r}.xsd`, content: xsdFor(r) });
  assert.equal((await importOutcome(sess)).stored, true);
  await waitVisible(sess, "#sbe-clear-data-btn");
  await click(sess, "#sbe-clear-data-btn");
  const prompt = await answerAlert(sess, false);
  assert.match(prompt, /^Clear test data created on this screen \(.+\)\.\s*Type CLEAR to confirm\./);
  await sleep(600);
  assert.ok(await uploadByCode(r), "cancelled: the import must remain");
  await click(sess, "#sbe-clear-data-btn");
  await answerAlert(sess, true);
  await sleep(800);
  assert.ok(await uploadByCode(r), "empty answer: the import must remain");
});

void clickText; void typeInto;
