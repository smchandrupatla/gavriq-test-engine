// Page object for /create-schema.html, the four-step wizard (Format & source, Layout,
// Fields, Review & create). Every method drives the DOM a person uses and reads back what
// the page shows; results are confirmed independently through the API (apiJson) by the
// callers in sit/cases/74f-74h, never from the page's own success banner alone.
import {
  apiJson, click, clickText, count, selectOption, setChecked, setValue, text, typeInto, uploadText, waitFor, waitVisible,
} from "./flow.mjs";

export async function openCreateSchema(sess, browser) {
  await browser.open("/create-schema.html");
  await waitVisible(sess, "#schema-name", { timeout: 20000 });
}

/** Step 0: name the schema and, if given, choose its format ('flat' | 'xml' | 'json'). */
export async function setupSchema(sess, { name, format }) {
  await typeInto(sess, "#schema-name", name);
  if (format) await click(sess, `input[name=format][value=${format}]`);
}

/** Step 0: "blank" (the default), "existing" (a registered schema) or "upload" (a file). */
export async function setSourceMode(sess, mode) {
  await selectOption(sess, "#source-mode", mode);
}

/** Attaches a definition file to #source-file, triggering loadSource(). */
export async function uploadSource(sess, fileName, content, mime = "application/xml") {
  await uploadText(sess, "#source-file", fileName, content, mime);
}

export async function sourceStatus(sess) {
  return text(sess, "#source-status");
}

/** Waits for the registered-schema dropdown to finish its refresh (more than the placeholder
 *  option). */
export async function waitForSourceList(sess) {
  await waitFor(async () => (await count(sess, "#source-existing option")) > 1, { timeout: 15000, message: "the registered schema list to load" });
}

/** Chooses the #source-existing option whose visible text contains `fragment` (its code
 *  changes between runs, since it is inferred from the schema name each case gives it). */
export async function selectExistingSource(sess, fragment) {
  const chosen = await sess.exec(
    "const e=document.getElementById('source-existing');const i=[...e.options].findIndex(o=>o.text.includes(arguments[0]));if(i<0)return {missing:[...e.options].map(o=>o.text.trim())};e.selectedIndex=i;e.dispatchEvent(new Event('change',{bubbles:true}));return {text:e.options[i].text.trim()};",
    [fragment]
  );
  if (chosen.missing) throw new Error(`selectExistingSource: no option containing "${fragment}". Options: ${chosen.missing.join(" | ")}`);
  return chosen;
}

/** Clicks "Load editable copy" and waits for #source-status to settle past "Loading...". */
export async function loadExistingSource(sess) {
  await click(sess, "#source-load");
  return waitFor(async () => {
    const t = await sourceStatus(sess);
    return t && !/^Loading definition/i.test(t) ? t : null;
  }, { timeout: 20000, message: "the source to finish loading" });
}

/** Step 0, flat format only: "single" (the default) or "multi" (header/detail/trailer). */
export async function setRecordMode(sess, mode) {
  await selectOption(sess, "#record-mode", mode);
}

/** Advances past the current step via "Next"/"Review schema" and waits for the target step.
 *  Stepping into Review (3) also triggers generate() -- a real conversion round trip -- so
 *  this allows more time than a plain client-side step change needs. */
export async function nextStep(sess, toStep) {
  await click(sess, "#schema-next");
  await waitVisible(sess, `[data-step='${toStep}']`, { timeout: 20000 });
}

export async function backStep(sess, toStep) {
  await click(sess, "#schema-back");
  await waitVisible(sess, `[data-step='${toStep}']`, { timeout: 15000 });
}

/** Clicks "Add field" (or "Add group"/"Add child") so a new, selected field appears. */
export async function addField(sess, { group = false, child = false } = {}) {
  await click(sess, group ? "#add-group" : child ? "#field-child" : "#add-field");
}

/** Fills the field editor panel for whatever field/group is currently selected and applies it. */
export async function fillField(sess, { name, type, required = false, attribute = false, description, width } = {}) {
  if (name !== undefined) await typeInto(sess, "#field-name", name);
  if (type) await selectOption(sess, "#field-type", type);
  await setChecked(sess, "#field-required", required);
  if (attribute) await setChecked(sess, "#field-attribute", true);
  if (description !== undefined) await typeInto(sess, "#field-description", description);
  if (width !== undefined) await setValue(sess, "#field-width", String(width));
  await click(sess, "#field-apply");
}

/** Selects the field/group whose row button reads exactly `name` in the Fields table. */
export async function selectRow(sess, name) {
  await clickText(sess, "#schema-fields button", name, { exact: true });
}

export async function fieldRowCount(sess) {
  return count(sess, "#schema-fields tr");
}

export async function statusText(sess) {
  return text(sess, "#schema-status");
}

export async function reviewSummary(sess) {
  return text(sess, "#review-summary");
}

export async function definitionPreview(sess) {
  return text(sess, "#definition-preview");
}

// ------------------------------------------------------------------------------------------
// Step 1, multi-record mode only: the record type field and the list of record types.
// ------------------------------------------------------------------------------------------
export async function setRecordTypeField(sess, { position, width }) {
  await setValue(sess, "#record-type-position", String(position));
  await setValue(sess, "#record-type-width", String(width));
}

/** The record list as the page shows it: one { name, matchValue } per row, in order. */
export async function recordRows(sess) {
  return sess.exec(
    "return [...document.querySelectorAll('#record-list tr')].map(tr=>{const i=tr.querySelectorAll('input');return {name:i[0].value,matchValue:i[1].value};});"
  );
}

export async function addRecord(sess) {
  await click(sess, "#add-record");
}

// Each row is <tr><td><input name></td><td><input matchValue></td><td><button></td></tr>:
// every <input> is the only one inside its own <td>, so "input:nth-of-type(N)" matches
// nothing past N=1 (nth-of-type counts among siblings sharing the SAME parent, and neither
// input has a sibling of its own type). Select by the <td>'s position instead.
export async function setRecordNameAt(sess, index, name) {
  await setValue(sess, `#record-list tr:nth-child(${index + 1}) td:nth-child(1) input`, name);
}

export async function setRecordMatchValueAt(sess, index, matchValue) {
  await setValue(sess, `#record-list tr:nth-child(${index + 1}) td:nth-child(2) input`, matchValue);
}

// ------------------------------------------------------------------------------------------
// Step 2, multi-record mode only: the tab row above the Fields table.
// ------------------------------------------------------------------------------------------
export async function switchToRecord(sess, name) {
  await clickText(sess, "#record-tabs button", name, { exact: true });
}

export async function recordTabNames(sess) {
  return sess.exec("return [...document.querySelectorAll('#record-tabs button')].map(b=>b.textContent.trim());");
}

// ------------------------------------------------------------------------------------------
// Step 3: create and confirm through the API.
// ------------------------------------------------------------------------------------------
/** Clicks Create schema, waits for the success panel and returns the registered id. */
export async function createSchema(sess) {
  await click(sess, "#schema-create");
  await waitFor(async () => !(await sess.exec("return document.getElementById('schema-success').hidden;")), { timeout: 30000, message: "the schema-created success panel" });
  const href = await sess.exec("const a=document.getElementById('open-designer');return a?a.getAttribute('href'):null;");
  const id = /schema=([^&]+)/.exec(href || "")?.[1];
  return { id: id ? decodeURIComponent(id) : null, detail: await text(sess, "#success-detail") };
}

export async function designerTypeDetailFromApi(id) {
  const res = await apiJson(`/api/v1/catalog/designer-types/${encodeURIComponent(id)}`);
  return res.status === 200 ? res.body?.data ?? res.body : null;
}

/** The exact file this schema was registered with (isoImport.ts's storeImportJob() always
 *  stores it under the "xsd" kind, regardless of whether the content is actually XML or
 *  JSON -- same endpoint create-schema.js's own "Load editable copy" flow reads). Parsed
 *  as JSON: for a flat/multi-record registration this is the "sand-bench-flat-schema"
 *  envelope itself, with every field's exact width/position -- detail unlike
 *  designerTypeDetailFromApi()'s ImportJob.fields shape, which has no width of its own. */
export async function rawFileFromApi(id) {
  const res = await apiJson(`/api/v1/catalog/iso/uploads/${encodeURIComponent(id)}/files/xsd`);
  return res.status === 200 ? res.body : null;
}

export async function dropDesignerType(id) {
  await apiJson(`/api/v1/catalog/designer-types/${encodeURIComponent(id)}`, { method: "DELETE" });
}
