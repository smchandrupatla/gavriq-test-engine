// Page objects and API fixtures for the work-item screens: datasets, schedules, test cases,
// test suites, test runs and Rule Bench (standalone documents opened after console sign-in).
// Every helper drives the DOM a person uses; callers confirm the outcome through the API.
import {
  apiJson, click, clickText, count, findByText, isDisabled, must, pageText, rowsOf, selectOption, setValue, sleep,
  text, typeInto, uniqueName, value, visible, waitFor, waitVisible,
} from "./flow.mjs";
import { selectOptionContaining } from "./flows.mjs";

export { uniqueName };
export const ENTER = "";

// ------------------------------------------------------------------------------------------
// Generic helpers
// ------------------------------------------------------------------------------------------
export async function listOf(path) {
  const res = await apiJson(path);
  if (res.status !== 200) throw new Error(`GET ${path} answered ${res.status}`);
  return rowsOf(res.body);
}
export async function byName(path, name) {
  return (await listOf(path)).find((row) => row.name === name) || null;
}
export async function waitByName(path, name, message = `${name} in ${path}`) {
  return waitFor(() => byName(path, name), { timeout: 12000, message });
}
export async function countByName(path, name) {
  return (await listOf(path)).filter((row) => row.name === name).length;
}
export async function ready(sess, css, timeout = 20000) {
  await waitFor(() => visible(sess, css), { timeout, message: `${css} to be visible` });
}

/** JS click that tolerates a confirm() opening while the click is still on the stack. */
export async function clickRaising(sess, css) {
  try { await sess.exec("const e=document.querySelector(arguments[0]);e.scrollIntoView({block:'center'});e.click();", [css]); }
  catch (error) { if (!/unexpected alert|alert/i.test(String(error.message))) throw error; }
}

/** Clicks something that opens a confirm() and answers it. Returns the dialog text. */
export async function confirmClick(sess, css, { accept }) {
  await clickRaising(sess, css);
  const prompt = await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { timeout: 8000, message: `a confirmation dialog after clicking ${css}` });
  if (accept) await sess.acceptAlert(); else await sess.dismissAlert();
  return prompt;
}

export async function noDialogOpen(sess) {
  try { await sess.alertText(); return false; } catch { return true; }
}

// ------------------------------------------------------------------------------------------
// console-screen.js forms (schedules, test runs, rules): [data-field] inputs, #screen-action, #screen-status.
// ------------------------------------------------------------------------------------------
export const field = (name) => `[data-field="${name}"]`;
export async function screenReady(sess) { await ready(sess, "#screen-action"); }
export async function screenFill(sess, name, val) {
  const css = field(name);
  const kind = await sess.exec("const e=document.querySelector(arguments[0]);return e?e.tagName+':'+(e.type||''):null;", [css]);
  if (!kind) throw new Error(`no field ${name}`);
  if (kind.startsWith("SELECT")) return selectOption(sess, css, val);
  if (kind.includes("datetime-local") || kind.startsWith("TEXTAREA")) return setValue(sess, css, val);
  return typeInto(sess, css, String(val));
}
export async function screenSave(sess) { await click(sess, "#screen-action"); }
export async function screenStatus(sess) { return text(sess, "#screen-status"); }
export async function waitStatus(sess, pattern, timeout = 12000) {
  return waitFor(async () => { const s = await screenStatus(sess); return pattern.test(s) ? s : null; }, { timeout, message: `status matching ${pattern}` });
}
/** The message the page pins under a [data-field] control ('' when none). */
export async function fieldMessage(sess, name) {
  return String(await sess.exec(
    "const e=document.querySelector(arguments[0]);if(!e)return null;const n=e.nextElementSibling;return n&&n.classList.contains('sbe-field-error')?n.textContent.trim():'';",
    [field(name)]) ?? "");
}
export async function fieldInvalid(sess, name) {
  return Boolean(await sess.exec("const e=document.querySelector(arguments[0]);return !!e&&e.getAttribute('aria-invalid')==='true';", [field(name)]));
}
/** Rows the screen rendered from its read endpoint (tr[data-row]) as text. */
export async function screenRows(sess) {
  return sess.exec("return [...document.querySelectorAll('#screen-view tr[data-row]')].map(r=>(r.innerText||r.textContent).replace(/\\s+/g,' ').trim());");
}
export async function screenRowFor(sess, needle) {
  return waitFor(async () => (await screenRows(sess)).find((r) => r.includes(needle)) || null, { timeout: 12000, message: `a row containing ${needle}` });
}
export async function refreshScreen(sess) { await click(sess, "#screen-refresh"); await sleep(600); }

// ------------------------------------------------------------------------------------------
// Datasets
// ------------------------------------------------------------------------------------------
/** A dataset with real messages, made through the API (setup, not the behaviour under test). */
export async function makeDataset(name, messages = 3, type = "pain.001.001.09") {
  const made = await apiJson("/api/v1/datasets", { method: "POST", body: JSON.stringify({ name, messageTypeCode: type }) });
  if (made.status !== 200) throw new Error(`dataset setup failed: ${made.status}`);
  if (messages > 0) {
    const asm = await apiJson(`/api/v1/datasets/${made.body.id}/assemble`, { method: "POST", body: JSON.stringify({ items: [{ kind: "message_type", ref: type, count: messages }] }) });
    if (asm.status !== 200) throw new Error(`dataset assemble failed: ${asm.status}`);
  }
  return { id: made.body.id, name };
}
export async function datasetRow(id) {
  return (await listOf("/api/v1/datasets")).find((d) => d.id === id) || null;
}
export async function datasetMessages(id) {
  const res = await apiJson(`/api/v1/datasets/${id}/messages`);
  return { status: res.status, rows: rowsOf(res.body) };
}
export async function deleteDatasetApi(id) {
  const row = await datasetRow(id);
  if (!row) return;
  await apiJson(`/api/v1/datasets/${id}`, { method: "DELETE", headers: { "if-match": row.etag } });
}
export async function dsNewFill(sess, { name, type, mix = false }) {
  await ready(sess, "#ds-name");
  if (name !== undefined) await typeInto(sess, "#ds-name", name);
  if (type !== undefined) await typeInto(sess, "#ds-msg-type", type);
  if (mix) { await click(sess, "input[name=mode][value=mix]"); await ready(sess, "#source-pick"); }
}
export async function dsNewPick(sess, id) {
  await waitFor(() => must(sess, `.source[value="${id}"]`), { message: `source ${id}` });
  await click(sess, `.source[value="${id}"]`);
}
export async function dsNewSubmit(sess) { await click(sess, "#screen-action"); }
export async function dsListSearch(sess, q) {
  if (q === "") await setValue(sess, "#search", "");
  else await typeInto(sess, "#search", q);
  await sleep(500);
}
export async function dsVisibleIds(sess) {
  return sess.exec("return [...document.querySelectorAll('#dataset-rows tr.suite-row')].map(r=>r.getAttribute('data-id'));");
}
export async function dsOpenList(browser, sess) {
  await browser.open("/datasets.html");
  await waitFor(async () => (await count(sess, "#dataset-rows tr.suite-row")) > 0, { message: "dataset rows" });
}
export async function dsTick(sess, id) { await click(sess, `#dataset-rows input.pick[value="${id}"]`); }

// ------------------------------------------------------------------------------------------
// Test cases
// ------------------------------------------------------------------------------------------
export async function apiTestCase(id) {
  const res = await apiJson(`/api/v1/test-cases/${encodeURIComponent(id)}`);
  return res.status === 200 ? res.body.data : null;
}
export async function makeTestCase(name, extra = {}) {
  const res = await apiJson("/api/v1/test-cases", { method: "POST", body: JSON.stringify({ name, status: "active", ...extra }) });
  if (res.status !== 200) throw new Error(`test case setup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.id, name };
}
export async function makeSuite(name, caseIds) {
  const res = await apiJson("/api/v1/test-suites", { method: "POST", body: JSON.stringify({ name, caseIds }) });
  if (res.status !== 200) throw new Error(`suite setup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { id: res.body.id, name };
}
export async function tcOpen(browser, sess, query = "") {
  await browser.open(`/test-case-form.html${query}`);
  await ready(sess, "#f-title");
  await sleep(500); // owner is filled from the session a moment after load
}
export async function tcTitle(sess, title) { await typeInto(sess, "#f-title", title); }
export async function tcId(sess) { return value(sess, "#f-id"); }
export async function tcPriority(sess, p) { await click(sess, `input[name=priority][value="${p}"]`); }
export async function tcVisibility(sess, v) { await click(sess, `input[name=visibility][value="${v}"]`); }
export async function tcTag(sess, tag) { await typeInto(sess, "#f-tag-input", tag + ENTER); }
export async function tcTags(sess) {
  return sess.exec("return [...document.querySelectorAll('#tags-row .tag-chip')].map(c=>c.textContent.replace('✕','').trim());");
}
export async function tcAddStep(sess, s = {}) {
  const before = await count(sess, ".step-card");
  await click(sess, "#add-step");
  await waitFor(async () => (await count(sess, ".step-card")) === before + 1, { message: "a new step card" });
  const card = `.step-card[data-i="${before}"]`;
  if (s.text !== undefined) await typeInto(sess, `${card} input[data-field=text]`, s.text);
  if (s.expected !== undefined) await typeInto(sess, `${card} input[data-field=expected]`, s.expected);
  if (s.testData !== undefined) await typeInto(sess, `${card} input[data-field=testData]`, s.testData);
}
export async function tcStepTexts(sess) {
  return sess.exec("return [...document.querySelectorAll('.step-card input[data-field=text]')].map(i=>i.value);");
}
export async function tcInsertTemplate(sess, key) {
  await selectOption(sess, "#step-template", key);
  await click(sess, "#insert-template");
}
export async function tcStatus(sess) { return text(sess, "#status-msg"); }
export async function tcWaitStatus(sess, pattern, timeout = 12000) {
  return waitFor(async () => { const s = await tcStatus(sess); return pattern.test(s) ? s : null; }, { timeout, message: `status matching ${pattern}` });
}
export async function tcValidationText(sess) {
  await waitFor(() => visible(sess, "#validation-panel"), { message: "validation panel" });
  return text(sess, "#validation-panel");
}
export async function tcRowsShown(sess) {
  return sess.exec("return [...document.querySelectorAll('#rows-body tr.case-row, #rows-cards .card')].map(r=>r.getAttribute('data-id'));");
}

// ------------------------------------------------------------------------------------------
// Test runs
// ------------------------------------------------------------------------------------------
export async function runsList() { return listOf("/api/v1/runs"); }
export async function runDeliveries(id) {
  const res = await apiJson(`/api/v1/runs/${id}/deliveries?limit=500`);
  return rowsOf(res.body);
}
/**
 * Fills New test run, presses Start run and returns the run the API then holds that was not
 * there before. Waits for the page's own "Saved." first (or returns the refusal shown).
 */
export async function startRun(sess, browser, o = {}) {
  await browser.open("/test-runs-new.html");
  await screenReady(sess);
  const before = new Set((await runsList()).map((r) => r.id));
  if (o.type !== undefined) await screenFill(sess, "messageTypeCode", o.type);
  if (o.count !== undefined) await screenFill(sess, "count", o.count);
  if (o.channel) await screenFill(sess, "channel", o.channel);
  if (o.profile) await screenFill(sess, "profile", o.profile);
  if (o.rate !== undefined) await screenFill(sess, "targetRate", o.rate);
  if (o.seed !== undefined) await screenFill(sess, "seed", o.seed);
  if (o.rule) {
    if (o.rule.value !== undefined) await typeInto(sess, "#rule-value", o.rule.value);
    if (o.rule.field !== undefined) await typeInto(sess, "#rule-field", o.rule.field);
    if (o.rule.percent !== undefined) await typeInto(sess, "#rule-percent", String(o.rule.percent));
  }
  await screenSave(sess);
  if (o.expectRefusal) return { status: await waitStatus(sess, /attention|not found|required|valid|must|error/i), before };
  const status = await waitStatus(sess, /Saved\.|need|not found|required|valid/i, 25000);
  const created = await waitFor(async () => (await runsList()).filter((r) => !before.has(r.id) && (!o.channel || r.channel === o.channel)), { timeout: 15000, message: "a new run in the API" }).catch(() => []);
  return { status, run: created[0] || null, created, before };
}

// ------------------------------------------------------------------------------------------
// Rule Bench
// ------------------------------------------------------------------------------------------
export async function apiRule(id) {
  const res = await apiJson(`/api/v1/rules/${id}`);
  return res.status === 200 ? res.body.data : null;
}
export async function makeRule(name, extra = {}) {
  const res = await apiJson("/api/v1/rules", { method: "POST", body: JSON.stringify({ name, category: "aml", severity: "low", condition: { kind: "amount_gte", field: "amount", value: 1 }, ...extra }) });
  if (res.status !== 200) throw new Error(`rule setup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}
export async function stageRuleApi(rule) {
  const now = await apiRule(rule.id);
  const res = await apiJson(`/api/v1/rules/${rule.id}/transitions`, { method: "POST", headers: { "if-match": now.etag }, body: JSON.stringify({ transition: "stage", environment: "lab" }) });
  if (res.status !== 200) throw new Error(`stage setup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

// ------------------------------------------------------------------------------------------
// Rule Bench create wizard (rule-bench-create.html, IMP-RBW001..005): Details, Select schema,
// Build conditions, Test rule, Review and save. There is no single #screen-action/#screen-
// status form anymore (that pattern is console-screen.js's; this page has its own ids) --
// every helper below targets the wizard's own markup directly.
// ------------------------------------------------------------------------------------------
let ruleFixturePromise = null;
/**
 * Registers, once per process, a tiny flat JSON Schema catalogue entry with the fields the
 * RB cases build conditions against (amount/country/status/cdtrCtry/ccy/a/b -- number or
 * string, no enums), so the Conditions step always has a deterministic field set regardless
 * of whatever else is in the catalogue. The title carries a random suffix so a repeat run of
 * this file never collides with duplicate-schema-content detection from an earlier run.
 * Returns the schema's title: the exact text shown on the Schema step's row AND the exact
 * name of the Conditions step field tree's single root node (both come from the JSON
 * Schema's own "title", per schemaStructure.ts's jsonStructure() and isoImport.ts's
 * designerTypeSummary() -- one root, one click to expand, then its direct children are the
 * flat fields above).
 */
export async function ensureRuleFixtureSchema() {
  if (!ruleFixturePromise) {
    ruleFixturePromise = (async () => {
      const title = uniqueName("SitRuleFixture");
      const schema = {
        $schema: "http://json-schema.org/draft-07/schema#", title, type: "object",
        properties: {
          amount: { type: "number" }, country: { type: "string" }, status: { type: "string" },
          cdtrCtry: { type: "string" }, ccy: { type: "string" }, a: { type: "number" }, b: { type: "number" },
        },
      };
      const res = await apiJson("/api/v1/catalog/iso/uploads", {
        method: "POST",
        body: JSON.stringify({ schemas: [{ fileName: `${title}.json`, content: JSON.stringify(schema) }], confirm: true }),
      });
      if (res.status !== 202 && res.status !== 200) throw new Error(`rule fixture schema setup failed: ${res.status} ${JSON.stringify(res.body)}`);
      return title;
    })();
  }
  return ruleFixturePromise;
}

export async function rwOpen(browser) {
  const sess = await browser.open("/rule-bench-create.html");
  await ready(sess, "#rw-next");
  return sess;
}
/** Fills whichever Details fields are given; does not click Next. */
export async function rwFillDetails(sess, o = {}) {
  if (o.name !== undefined) await typeInto(sess, field("name"), o.name);
  if (o.category) await selectOption(sess, field("category"), o.category);
  if (o.severity) await selectOption(sess, field("severity"), o.severity);
  if (o.source) await selectOption(sess, field("source"), o.source);
  if (o.description !== undefined) await setValue(sess, field("description"), o.description);
}
export async function rwNext(sess) { await click(sess, "#rw-next"); }
export async function rwBack(sess) { await click(sess, "#rw-back"); }
export async function rwStatus(sess) { return text(sess, "#rw-status"); }
/** Picks an existing schema by its catalogue row text (the schema's title/desc) and waits
 *  for the selected-schema panel to confirm the bind. Does not click Next. */
export async function rwPickExistingSchema(sess, title) {
  await ready(sess, "#rw-schema-rows button");
  await clickText(sess, "#rw-schema-rows button", title, { exact: false });
  await waitVisible(sess, "#rw-schema-selected");
}
async function rwTreeClick(sess, exactName) {
  await clickText(sess, "#rw-condition-tree .sbe-st-name", exactName);
}
/** Picks `fieldName` in the Conditions step's field tree and adds it as a new leaf --
 *  wrapping into an ALL group if the tree already holds a bare leaf, or appending to
 *  whatever group already exists, exactly as rule-bench-create.js's #rw-field-use handler
 *  does for a person clicking the same button. */
export async function rwAddCondition(sess, fieldName, { operator, value } = {}) {
  await rwTreeClick(sess, fieldName);
  await click(sess, "#rw-field-use");
  await rwSetLastLeaf(sess, { operator, value });
}
/** Sets operator/value on the last (most recently rendered) `.rw-cond-leaf` in document
 *  order -- reliable because every rwAddCondition() call appends exactly one new leaf and
 *  this is always called immediately after, before any other leaf is added. */
export async function rwSetLastLeaf(sess, { operator, value } = {}) {
  if (operator !== undefined) {
    const ok = await sess.exec(
      "const rows=document.querySelectorAll('.rw-cond-leaf');const row=rows[rows.length-1];if(!row)return false;const sel=row.querySelector(\"select[aria-label='Operator']\");if(!sel)return false;const i=[...sel.options].findIndex(o=>o.value===arguments[0]);if(i<0)return false;sel.selectedIndex=i;sel.dispatchEvent(new Event('change',{bubbles:true}));return true;",
      [operator]);
    if (!ok) throw new Error(`rwSetLastLeaf: could not set operator "${operator}" on the last leaf`);
  }
  if (value !== undefined) {
    const payload = Array.isArray(value) ? value.join(",") : String(value);
    const ok = await sess.exec(
      "const rows=document.querySelectorAll('.rw-cond-leaf');const row=rows[rows.length-1];if(!row)return false;const el=row.querySelector(\"[aria-label='Condition value']\");if(!el)return false;const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,arguments[0]);el.dispatchEvent(new Event('change',{bubbles:true}));return true;",
      [payload]);
    if (!ok) throw new Error(`rwSetLastLeaf: could not set value "${payload}" on the last leaf`);
  }
}
export async function rwSetGroupKind(sess, kind) {
  await selectOption(sess, "#rw-condition-nodes select[aria-label='Group type']", kind);
}
export async function rwConditionStatus(sess) { return text(sess, "#rw-condition-status"); }
export async function rwConditionInterpretation(sess) { return text(sess, "#rw-condition-interpretation"); }
export async function rwApplyAdvancedJson(sess, raw) {
  await click(sess, "#rw-cond-advanced-toggle");
  await setValue(sess, "#rw-condition-json", raw);
  await click(sess, "#rw-cond-json-apply");
}
/**
 * Builds a condition on the Conditions step from a declarative spec and leaves the wizard
 * there. `spec` is one leaf `{field, operator, value}`, a group `{all:[leaf,...]}` /
 * `{any:[leaf,...]}`, or `{not: {field, operator, value}}`. This is the only way left to
 * reach a saved condition from this wizard -- there is no raw-JSON textarea in the final
 * save path (the advanced editor edits this same typed tree, not the server's payload
 * shape; see rule-condition-legacy-map.js).
 */
export async function rwBuildCondition(sess, rootTitle, spec) {
  await rwTreeClick(sess, rootTitle); // expands the fixture schema's single root, once
  if (spec.not) {
    await click(sess, "#rw-cond-add-not");
    await rwAddCondition(sess, spec.not.field, spec.not);
    return;
  }
  const kind = spec.all ? "all" : spec.any ? "any" : null;
  const leaves = kind ? spec[kind] : [spec];
  for (const leaf of leaves) await rwAddCondition(sess, leaf.field, leaf);
  if (kind === "any") await rwSetGroupKind(sess, "any");
}
export async function rwSaveDisabled(sess) { return isDisabled(sess, "#rw-save-rule"); }
export async function rwReviewUnmappableText(sess) { return text(sess, "#rw-review-condition-unmappable"); }
export async function rwSaveRule(sess) { await click(sess, "#rw-save-rule"); }
export async function rwReviewStatus(sess) { return text(sess, "#rw-review-status"); }
export async function rwSaveSuccessDetail(sess) { return text(sess, "#rw-save-success-detail"); }

/**
 * Drives the whole wizard end to end: Details -> pick the fixture schema -> build `o.condition`
 * (default: a single amount>=10000 leaf, the old form's implicit default) -> skip Test -> Save.
 * Returns the Review step's status line (so callers can assert a refusal) and, when Save
 * actually succeeded, the row the API then holds under `o.name`.
 */
export async function createRuleViaWizard(sess, browser, o = {}) {
  const rootTitle = await ensureRuleFixtureSchema();
  await rwOpen(browser); // same cached session as `sess` (sharedBrowser's one tab)
  await rwFillDetails(sess, o);
  if (o.detailsOnly) { await rwNext(sess); return { status: await rwStatus(sess) }; }
  await rwNext(sess); // Details -> Schema
  await rwPickExistingSchema(sess, rootTitle);
  await rwNext(sess); // Schema -> Conditions
  if (o.conditionJsonRaw !== undefined) {
    await rwTreeClick(sess, rootTitle);
    await rwApplyAdvancedJson(sess, o.conditionJsonRaw);
  } else if (o.condition !== false) {
    await rwBuildCondition(sess, rootTitle, o.condition || { field: "amount", operator: "gte", value: 10000 });
  }
  await rwNext(sess); // Conditions -> Test
  await rwNext(sess); // Test -> Review (no run required)
  await rwSaveRule(sess);
  const status = await rwReviewStatus(sess);
  if (/saved/i.test(status)) return { status, row: await waitByName("/api/v1/rules", o.name) };
  return { status };
}

export { findByText, pageText, selectOptionContaining };

/** Exact text (textContent, so CSS text-transform does not change case). */
export async function raw(sess, css) {
  return String(await sess.exec("const e=document.querySelector(arguments[0]);return e?e.textContent:null;", [css]) ?? "").trim();
}
/** The instant a datetime-local value means in the browser's own zone, as an ISO string. */
export async function browserIso(sess, localValue) {
  return sess.exec("return new Date(arguments[0]).toISOString();", [localValue]);
}
