// Saved definitions (/message-designer-saved.html) and the read-only definition page, driven through the
// browser and confirmed through the API: All / Draft / Active chips, search, View, Edit / Continue, Export,
// Delete (confirm and decline), select all and bulk actions, Import template (rename, skip, replace),
// New definition, and the Export template page.
//
// The Test Engine catalogue scans for calls of test with a literal name, so every case name here is a literal.
// A case marked { todo } exposes a product defect: its assertion states what the page should do.
import { after, test as nodeTest, type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  apiJson, captureDownloads, clickText, count, saveShot, sharedBrowser, sleep, text, uniqueName, value, waitDownload, waitFor as baseWaitFor, waitVisible,
} from "../lib/selenium/flow.mjs";
import {
  answerDialog, ariaExists, publishNew, chipCount, chipTexts, chooseMode, chooseTile, clickAria, definitionFull, definitionRow, dialogInfo, dialogOpen,
  filterSaved, nameDefinition, openDefinitionView, openSaved, openStudio, rowAction, savedDefinition, savedFromApi, savedRowId, savedStatus,
  showChip, tickRow, viewMeta, visibleSavedNames,
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
    if (!(await browser.available(`saved-${name}`))) { t.skip(browser.reason); return; }
    const sess = await browser.signedIn();
    try { await fn(sess, t); }
    catch (error) { await saveShot(sess, `saved-${name}`); throw error; }
  });
}

// ==========================================================================================
// SD  Saved definitions
// ==========================================================================================
/** Makes a draft: choose a tile, one message, name it, and wait for the working copy to be saved. */
async function makeDraft(sess: Sess, name: string, tile = "camt.053.001.08", many?: number) {
  await openStudio(sess, browser);
  await chooseTile(sess, tile);
  await chooseMode(sess, many !== undefined, { count: many });
  await nameDefinition(sess, name);
  return savedDefinition(name);
}
async function makeActive(sess: Sess, name: string, messages = 1) {
  await publishNew(sess, browser, { tile: "camt.053.001.08", name, messages });
  return savedDefinition(name);
}
async function withSavedRow(sess: Sess, name: string) {
  await openSaved(sess, browser);
  await filterSaved(sess, name);
  await waitFor(async () => (await visibleSavedNames(sess)).includes(name), { message: `row ${name}` });
}

test("SD1 the list shows every saved definition with its status, and the chip counts equal the API", async (sess) => {
  const d = uniqueName("SdList"), a = uniqueName("SdAct");
  await makeDraft(sess, d);
  await makeActive(sess, a);
  await openSaved(sess, browser);
  await waitFor(async () => {
    const rows = await savedFromApi();
    const draft = rows.filter((r: { state: string }) => r.state === "draft").length;
    return (await chipCount(sess, "all")) === rows.length && (await chipCount(sess, "draft")) === draft && (await chipCount(sess, "active")) === rows.length - draft;
  }, { message: "chip counts to equal the API counts" });
  assert.deepEqual((await chipTexts(sess)).map((c: string) => c.replace(/\d+/, "N")), ["All (N)", "Draft (N)", "Active (N)"]);
});

test("SD2 the Draft chip lists only drafts and the Active chip only published definitions", async (sess) => {
  const d = uniqueName("SdChip"), a = uniqueName("SdChip");
  await makeDraft(sess, d);
  await makeActive(sess, a);
  await openSaved(sess, browser);
  await filterSaved(sess, "SdChip");
  await showChip(sess, "draft");
  await waitFor(async () => (await visibleSavedNames(sess)).includes(d), { message: "the draft in the Draft chip" });
  assert.ok(!(await visibleSavedNames(sess)).includes(a));
  const states = await sess.exec("return [...new Set([...document.querySelectorAll('#mdl-rows tr[data-id]')].map(r=>r.getAttribute('data-state')))];");
  assert.deepEqual(states, ["draft"]);
  await showChip(sess, "active");
  await waitFor(async () => (await visibleSavedNames(sess)).includes(a), { message: "the published definition in the Active chip" });
  assert.ok(!(await visibleSavedNames(sess)).includes(d));
  await showChip(sess, "all");
  assert.ok((await visibleSavedNames(sess)).includes(d) && (await visibleSavedNames(sess)).includes(a));
});

test("SD3 the Status column and row buttons say Draft with Continue, Active with Edit", async (sess) => {
  const d = uniqueName("SdSt"), a = uniqueName("SdSt");
  await makeDraft(sess, d);
  await makeActive(sess, a);
  const read = async (name: string) => sess.exec("const r=[...document.querySelectorAll('#mdl-rows tr[data-id]')].find(r=>r.querySelector('.mdl-name').textContent.trim()===arguments[0]);return {status:r.querySelector('.mdl-pill.draft,.mdl-pill.active,.mdl-pill.edited').textContent.trim(),buttons:[...r.querySelectorAll('.mdl-row-actions button')].map(b=>b.textContent.trim())};", [name]);
  await withSavedRow(sess, d);
  assert.deepEqual(await read(d), { status: "Draft", buttons: ["View", "Continue", "Export", "Delete"] });
  await withSavedRow(sess, a);
  assert.deepEqual(await read(a), { status: "Active", buttons: ["View", "Edit", "Export", "Delete"] });
});

test("SD4 the search box filters by name and says when nothing matches", async (sess) => {
  const a = uniqueName("SdFindA"), b = uniqueName("SdFindB");
  await makeDraft(sess, a);
  await makeDraft(sess, b);
  await openSaved(sess, browser);
  await filterSaved(sess, a);
  await waitFor(async () => (await visibleSavedNames(sess)).join() === a, { message: "only the first definition" });
  await filterSaved(sess, a.toUpperCase());
  assert.deepEqual(await visibleSavedNames(sess), [a], "search ignores case");
  await filterSaved(sess, "zzz-no-such-definition");
  assert.equal(await text(sess, "#mdl-rows .mdl-empty"), "No definition matches that filter.");
  await filterSaved(sess, "");
  assert.ok((await visibleSavedNames(sess)).includes(b));
});

test("SD5 the search also matches the message type and family", async (sess) => {
  const a = uniqueName("SdType");
  await makeDraft(sess, a, "camt.053.001.08");
  await openSaved(sess, browser);
  await filterSaved(sess, "camt.053.001.08");
  await waitFor(async () => (await visibleSavedNames(sess)).includes(a), { message: "the camt definition by type" });
  await filterSaved(sess, "camt");
  assert.ok((await visibleSavedNames(sess)).includes(a));
});

test("SD6 View opens the definition on a read-only page with its name, status and field count", async (sess) => {
  const a = uniqueName("SdView");
  const def = await makeActive(sess, a);
  await withSavedRow(sess, a);
  await rowAction(sess, a, "View");
  await waitFor(async () => String(await sess.url()).includes(`definition=${encodeURIComponent(def.id)}&mode=view`), { message: "the view URL" });
  await waitVisible(sess, "[data-testid='saved-definition-title']");
  assert.equal(await text(sess, "[data-testid='saved-definition-title']"), a);
  assert.equal(await text(sess, "[data-testid='saved-definition-mode']"), "Read only");
  const meta = await viewMeta(sess);
  assert.equal(meta["Message type"], "camt.053.001.08");
  assert.equal(meta["Status"], "Active");
  assert.match(meta["Fields"], new RegExp(`^${def.fieldCount} \\(\\d+ mandatory\\)$`));
  assert.equal(await count(sess, "#sbe-studio-name"), 0, "the read-only page has no editable name");
});

test("SD7 clicking the definition name also opens it in view mode", async (sess) => {
  const a = uniqueName("SdName");
  const def = await makeDraft(sess, a);
  await withSavedRow(sess, a);
  await sess.exec("[...document.querySelectorAll('#mdl-rows .mdl-name')].find(b=>b.textContent.trim()===arguments[0]).click();", [a]);
  await waitFor(async () => String(await sess.url()).includes(`definition=${encodeURIComponent(def.id)}&mode=view`), { message: "the view URL" });
});

test("SD8 Continue on a draft reopens the studio with the saved name, message and count", async (sess) => {
  const a = uniqueName("SdCont");
  const def = await makeDraft(sess, a, "camt.053.001.08", 7);
  await withSavedRow(sess, a);
  await rowAction(sess, a, "Continue");
  await waitFor(async () => String(await sess.url()).includes(`definition=${encodeURIComponent(def.id)}&mode=edit`), { message: "the edit URL" });
  await waitFor(async () => (await value(sess, "#sbe-studio-name")) === a, { timeout: 20000, message: "the saved name" });
  await waitFor(async () => (await sess.exec("return document.getElementById('sbe-studio-batch-count')?document.getElementById('sbe-studio-batch-count').value:''")) === "7" || /7 messages/.test(await sess.exec("return document.body.innerText")), { message: "the saved count of 7" });
  assert.equal(await studioAttrMode(sess), "many");
});
async function studioAttrMode(sess: Sess) { return sess.exec("const e=document.querySelector(\"[data-testid='studio']\");return e?e.getAttribute('data-mode'):null;"); }

test("SD9 Edit on an active definition reopens it in the studio in edit mode", async (sess) => {
  const a = uniqueName("SdEdit");
  const def = await makeActive(sess, a);
  await withSavedRow(sess, a);
  await rowAction(sess, a, "Edit");
  await waitFor(async () => String(await sess.url()).includes(`definition=${encodeURIComponent(def.id)}&mode=edit`), { message: "the edit URL" });
  await waitFor(async () => (await value(sess, "#sbe-studio-name")) === a, { timeout: 20000, message: "the saved name" });
  assert.equal(await sess.exec("return document.querySelector(\"[data-testid='studio']\").getAttribute('data-state');"), "active");
});

test("SD10 Export asks first; accepting downloads a .sbdef.json that holds the definition", async (sess) => {
  const a = uniqueName("SdExp");
  const def = await makeActive(sess, a);
  await withSavedRow(sess, a);
  await captureDownloads(sess);
  await rowAction(sess, a, "Export");
  const info = await dialogInfo(sess);
  assert.match(info.title, /^Export this definition\?/);
  assert.ok(info.body.includes(a));
  await answerDialog(sess, true);
  const file = await waitDownload(sess);
  assert.match(file.name, /\.sbdef\.json$/);
  const doc = JSON.parse(file.text);
  assert.equal(doc.format, "sandbench.message-definition-template");
  assert.equal(doc.count, 1);
  assert.equal(doc.definitions[0].name, a);
  assert.equal(doc.definitions[0].msgTypeCode, "camt.053.001.08");
  assert.equal(doc.definitions[0].fields.length, def.fieldCount);
  assert.match(await savedStatus(sess), /^Exported 1 definition to .*\.sbdef\.json\.$/);
});

test("SD11 declining the Export dialog downloads nothing", async (sess) => {
  const a = uniqueName("SdExpNo");
  await makeDraft(sess, a);
  await withSavedRow(sess, a);
  await captureDownloads(sess);
  const before = (await sess.exec("return (window.__sitDownloads||[]).length;")) as number;
  await rowAction(sess, a, "Export");
  await dialogInfo(sess);
  await answerDialog(sess, false);
  await sleep(600);
  assert.equal(await sess.exec("return (window.__sitDownloads||[]).length;"), before);
});

test("SD12 Delete asks first; accepting removes it from the list and from the API", async (sess) => {
  const a = uniqueName("SdDel");
  const def = await makeDraft(sess, a);
  await withSavedRow(sess, a);
  await rowAction(sess, a, "Delete");
  const info = await dialogInfo(sess);
  assert.equal(info.title, "Delete this definition?");
  assert.equal(info.confirm, "Delete definition");
  assert.ok(info.body.includes(a));
  await answerDialog(sess, true);
  await waitFor(async () => (await savedStatus(sess)) === "Deleted 1 definition.", { message: "the deleted notice" });
  assert.equal(await definitionRow(a), null);
  assert.equal(await definitionFull(def.id), null);
  assert.ok(!(await visibleSavedNames(sess)).includes(a));
});

test("SD13 declining the Delete dialog keeps the definition", async (sess) => {
  const a = uniqueName("SdKeep");
  await makeDraft(sess, a);
  await withSavedRow(sess, a);
  await rowAction(sess, a, "Delete");
  await dialogInfo(sess);
  await answerDialog(sess, false);
  assert.ok(await definitionRow(a), "the definition must survive a declined delete");
  assert.ok((await visibleSavedNames(sess)).includes(a));
});

test("SD14 select-all ticks every visible row and enables the bulk buttons; Clear selection resets", async (sess) => {
  const a = uniqueName("SdSel"), b = uniqueName("SdSel");
  await makeDraft(sess, a);
  await makeDraft(sess, b);
  await openSaved(sess, browser);
  await filterSaved(sess, "SdSel");
  await waitFor(async () => (await visibleSavedNames(sess)).length >= 2, { message: "two rows" });
  const visibleCount = (await visibleSavedNames(sess)).length;
  assert.equal(await text(sess, "#mdl-selected-count"), "No definitions selected");
  assert.equal(await sess.exec("return document.getElementById('mdl-bulk-export').disabled;"), true);
  await sess.exec("document.getElementById('mdl-select-all').click();");
  await waitFor(async () => (await text(sess, "#mdl-selected-count")) === `${visibleCount} definitions selected`, { message: "the selected count" });
  for (const id of ["mdl-bulk-export", "mdl-bulk-delete", "mdl-bulk-clear"]) assert.equal(await sess.exec("return document.getElementById(arguments[0]).disabled;", [id]), false);
  await sess.exec("document.getElementById('mdl-bulk-clear').click();");
  await waitFor(async () => (await text(sess, "#mdl-selected-count")) === "No definitions selected", { message: "the selection to clear" });
  assert.equal(await sess.exec("return document.querySelectorAll('#mdl-rows input[type=checkbox]:checked').length;"), 0);
});

test("SD15 ticking one row says '1 definition selected' and the header box shows partial selection", async (sess) => {
  const a = uniqueName("SdOne"), b = uniqueName("SdOne");
  await makeDraft(sess, a);
  await makeDraft(sess, b);
  await openSaved(sess, browser);
  await filterSaved(sess, "SdOne");
  await waitFor(async () => (await visibleSavedNames(sess)).length >= 2, { message: "two rows" });
  await tickRow(sess, a);
  assert.equal(await text(sess, "#mdl-selected-count"), "1 definition selected");
  assert.equal(await sess.exec("return document.getElementById('mdl-select-all').indeterminate;"), true);
  await tickRow(sess, a, false);
  assert.equal(await text(sess, "#mdl-selected-count"), "No definitions selected");
});

test("SD16 Export selected writes one file holding exactly the ticked definitions", async (sess) => {
  const a = uniqueName("SdBulkE"), b = uniqueName("SdBulkE"), c = uniqueName("SdBulkE");
  await makeDraft(sess, a);
  await makeActive(sess, b);
  await makeDraft(sess, c);
  await openSaved(sess, browser);
  await filterSaved(sess, "SdBulkE");
  await waitFor(async () => (await visibleSavedNames(sess)).length >= 3, { message: "three rows" });
  await tickRow(sess, a);
  await tickRow(sess, b);
  await captureDownloads(sess);
  await sess.exec("document.getElementById('mdl-bulk-export').click();");
  const info = await dialogInfo(sess);
  assert.equal(info.title, "Export 2 definitions?");
  await answerDialog(sess, true);
  const doc = JSON.parse((await waitDownload(sess)).text);
  assert.equal(doc.count, 2);
  assert.deepEqual(doc.definitions.map((d: { name: string }) => d.name).sort(), [a, b].sort());
});

test("SD17 Delete selected removes only the ticked definitions; declining removes none", async (sess) => {
  const a = uniqueName("SdBulkD"), b = uniqueName("SdBulkD"), c = uniqueName("SdBulkD");
  await makeDraft(sess, a);
  await makeDraft(sess, b);
  await makeDraft(sess, c);
  await openSaved(sess, browser);
  await filterSaved(sess, "SdBulkD");
  await waitFor(async () => (await visibleSavedNames(sess)).length >= 3, { message: "three rows" });
  await tickRow(sess, a);
  await tickRow(sess, b);
  await sess.exec("document.getElementById('mdl-bulk-delete').click();");
  assert.equal((await dialogInfo(sess)).title, "Delete 2 definitions?");
  await answerDialog(sess, false);
  assert.ok((await definitionRow(a)) && (await definitionRow(b)), "declined: both must remain");
  await sess.exec("document.getElementById('mdl-bulk-delete').click();");
  assert.equal((await dialogInfo(sess)).confirm, "Delete 2 definitions");
  await answerDialog(sess, true);
  await waitFor(async () => (await savedStatus(sess)) === "Deleted 2 definitions.", { message: "the deleted notice" });
  assert.equal(await definitionRow(a), null);
  assert.equal(await definitionRow(b), null);
  assert.ok(await definitionRow(c), "the unticked definition must remain");
});

/** Exports one definition through the page and returns the file's text. */
async function exportFile(sess: Sess, name: string) {
  await withSavedRow(sess, name);
  await captureDownloads(sess);
  await rowAction(sess, name, "Export");
  await dialogInfo(sess);
  await answerDialog(sess, true);
  return (await waitDownload(sess)).text as string;
}
async function importFileText(sess: Sess, content: string) {
  await sess.exec("const dt=new DataTransfer();dt.items.add(new File([arguments[0]],'t.sbdef.json',{type:'application/json'}));const i=document.getElementById('mdl-import-file');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));", [content]);
  return dialogInfo(sess);
}

test("SD18 Import template: an exported file is previewed, imported after the original is deleted, and the API holds it again", async (sess) => {
  const a = uniqueName("SdSrc");
  const original = await makeActive(sess, a);
  const file = await exportFile(sess, a);
  await apiJson(`/api/v1/definitions/${original.id}`, { method: "DELETE" });
  await openSaved(sess, browser);
  const info = await importFileText(sess, file);
  assert.equal(info.title, "Import 1 definition?");
  assert.ok(info.body.includes(a));
  assert.match(info.body, /No name clashes/);
  await answerDialog(sess, true);
  await waitFor(async () => (await savedStatus(sess)) === "Imported 1 definition.", { message: "the imported notice" });
  const row = await savedDefinition(a);
  assert.equal(row.msgTypeCode, "camt.053.001.08");
  assert.equal(row.fieldCount, original.fieldCount);
  assert.ok((await visibleSavedNames(sess)).includes(a));
});

test("SD19 Import template with a name clash offers rename, skip and replace; the default imports a renamed copy", async (sess) => {
  const a = uniqueName("SdClash");
  await makeDraft(sess, a);
  const file = await exportFile(sess, a);
  await openSaved(sess, browser);
  const info = await importFileText(sess, file);
  assert.match(info.body, /1 name is already in use\./);
  assert.deepEqual(await sess.exec("return [...document.querySelectorAll('#mdl-conflict option')].map(o=>o.value);"), ["rename", "skip", "replace"]);
  await answerDialog(sess, true);
  await waitFor(async () => /^Imported 1 definition\. 1 renamed\.$/.test(await savedStatus(sess)), { message: "the renamed notice" });
  const names = (await savedFromApi()).map((r: { name: string }) => r.name);
  assert.ok(names.includes(a));
  assert.ok(names.some((n: string) => n.startsWith(a) && n !== a && /imported/.test(n)), `no renamed copy of ${a} in the API`);
});

test("SD20 Import template with a clash and Skip keeps the existing definition and adds nothing", async (sess) => {
  const a = uniqueName("SdSkip");
  await makeDraft(sess, a);
  const file = await exportFile(sess, a);
  const before = (await savedFromApi()).filter((r: { name: string }) => r.name.startsWith(a)).length;
  await openSaved(sess, browser);
  await importFileText(sess, file);
  await sess.exec("const s=document.getElementById('mdl-conflict');s.value='skip';s.dispatchEvent(new Event('change',{bubbles:true}));");
  await answerDialog(sess, true);
  await waitFor(async () => /1 skipped\./.test(await savedStatus(sess)), { message: "the skipped notice" });
  assert.equal((await savedFromApi()).filter((r: { name: string }) => r.name.startsWith(a)).length, before);
});

test("SD21 Import template with a clash and Replace overwrites the existing definition's fields", async (sess) => {
  const a = uniqueName("SdRepl");
  const def = await makeDraft(sess, a);
  const file = await exportFile(sess, a);
  await openSaved(sess, browser);
  await importFileText(sess, file);
  await sess.exec("const s=document.getElementById('mdl-conflict');s.value='replace';s.dispatchEvent(new Event('change',{bubbles:true}));");
  await answerDialog(sess, true);
  await waitFor(async () => /1 replaced\./.test(await savedStatus(sess)), { message: "the replaced notice" });
  const same = (await savedFromApi()).filter((r: { name: string }) => r.name === a);
  assert.equal(same.length, 1, "replace must not duplicate");
  assert.equal(same[0].fieldCount, def.fieldCount);
});

test("SD22 declining the Import dialog imports nothing", async (sess) => {
  const a = uniqueName("SdImpNo");
  const def = await makeActive(sess, a);
  const file = await exportFile(sess, a);
  await apiJson(`/api/v1/definitions/${def.id}`, { method: "DELETE" });
  await openSaved(sess, browser);
  await importFileText(sess, file);
  await answerDialog(sess, false);
  await sleep(500);
  assert.equal(await definitionRow(a), null);
});

test("SD23 Import template refuses a file that is not JSON and one that is not a definition template", async (sess) => {
  await openSaved(sess, browser);
  const attach = (name: string, content: string) => sess.exec("const dt=new DataTransfer();dt.items.add(new File([arguments[1]],arguments[0],{type:'application/json'}));const i=document.getElementById('mdl-import-file');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));", [name, content]);
  await attach("junk.json", "{ not json");
  await waitFor(async () => (await savedStatus(sess)) === "junk.json is not valid JSON, so it is not a definition template.", { message: "the JSON refusal" });
  await attach("other.json", JSON.stringify({ format: "something.else", definitions: [] }));
  await waitFor(async () => /^other\.json is not a Sand Bench message definition template/.test(await savedStatus(sess)), { message: "the format refusal" });
  assert.equal(await dialogOpen(sess), false);
});

test("SD24 the New definition link opens a blank studio", async (sess) => {
  await openSaved(sess, browser);
  assert.equal(await sess.exec("return document.getElementById('mdl-new').getAttribute('href');"), "/?page=messageDesigner");
  await sess.exec("document.getElementById('mdl-new').click();");
  await waitFor(async () => String(await sess.url()).endsWith("/?page=messageDesigner"), { message: "the designer URL" });
  await waitFor(async () => (await sess.exec("const e=document.querySelector(\"[data-testid='studio']\");return e&&e.getAttribute('data-state');")) === "new", { message: "an unsaved studio" });
  assert.equal(await value(sess, "#sbe-studio-name"), "");
});

test("SD25 Refresh reloads the list and a definition made elsewhere appears", async (sess) => {
  const a = uniqueName("SdRef");
  await openSaved(sess, browser);
  const res = await apiJson("/api/v1/definitions", { method: "POST", body: JSON.stringify({ name: a, status: "draft", version: "1", msgTypeCode: "camt.053.001.08", familyCode: "camt", fields: [] }) });
  assert.ok(res.status < 300, `create answered ${res.status}`);
  await filterSaved(sess, a);
  assert.deepEqual(await visibleSavedNames(sess), []);
  await sess.exec("document.getElementById('screen-refresh').click();");
  await waitFor(async () => (await visibleSavedNames(sess)).includes(a), { message: "the new definition after Refresh" });
});

test("SD26 the Export template page opens with its Generate button", async (sess) => {
  await browser.open("/message-designer-export-template.html");
  await waitVisible(sess, "#screen-action");
  assert.equal(await text(sess, "#screen-title"), "Export template");
  assert.equal(await text(sess, "#screen-action"), "Generate template");
  await waitFor(async () => (await text(sess, "#screen-output")) !== "Loading…", { message: "the output to load" });
});


// ---- the read-only page a definition opens on ----
async function viewOf(sess: Sess, name: string, active: boolean) {
  const def = active ? await makeActive(sess, name) : await makeDraft(sess, name);
  await openDefinitionView(sess, browser, def.id);
  return def;
}
async function answerBrowserDialog(sess: Sess, accept: boolean) {
  const prompt = await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { timeout: 8000, message: "a browser dialog" });
  if (accept) await sess.acceptAlert(); else await sess.dismissAlert();
  return prompt as string;
}

test("SD27 the read-only page's Export asks first; accepting downloads the template, declining downloads nothing", async (sess) => {
  const a = uniqueName("SdVExp");
  await viewOf(sess, a, true);
  await captureDownloads(sess);
  await clickAria(sess, "Export");
  assert.match(await answerBrowserDialog(sess, false), new RegExp(`^Export "${a}" as a definition template file`));
  await sleep(500);
  assert.equal(await sess.exec("return (window.__sitDownloads||[]).length;"), 0);
  await clickAria(sess, "Export");
  await answerBrowserDialog(sess, true);
  const file = await waitDownload(sess);
  assert.match(file.name, /\.sbdef\.json$/);
  assert.equal(JSON.parse(file.text).definitions[0].name, a);
});

test("SD28 the read-only page's Delete: declining keeps the definition, accepting removes it and returns to the list", async (sess) => {
  const a = uniqueName("SdVDel");
  const def = await viewOf(sess, a, false);
  await clickAria(sess, "Delete");
  assert.match(await answerBrowserDialog(sess, false), new RegExp(`^Delete "${a}"\\?`));
  assert.ok(await definitionRow(a));
  await clickAria(sess, "Delete");
  await answerBrowserDialog(sess, true);
  await waitFor(async () => String(await sess.url()).endsWith("/message-designer-saved.html"), { message: "the saved list" });
  assert.equal(await definitionFull(def.id), null);
});

test("SD29 the read-only page offers Continue editing for a draft and Edit for an active definition", async (sess) => {
  const d = uniqueName("SdVDraft"), a = uniqueName("SdVAct");
  await viewOf(sess, d, false);
  assert.ok(await ariaExists(sess, "Continue editing"));
  await viewOf(sess, a, true);
  assert.ok(await ariaExists(sess, "Edit"));
  await clickAria(sess, "Edit");
  await waitFor(async () => String(await sess.url()).includes("mode=edit"), { message: "edit mode" });
  await waitFor(async () => (await value(sess, "#sbe-studio-name")) === a, { timeout: 20000, message: "the name in the studio" });
});

test("SD30 the read-only page's New definition button opens a blank studio", async (sess) => {
  const a = uniqueName("SdVNew");
  await viewOf(sess, a, false);
  await clickAria(sess, "New definition");
  await waitVisible(sess, ".sbe-studio-msg");
  assert.ok(!String(await sess.url()).includes("definition="), "the definition id must leave the URL");
  assert.equal(await value(sess, "#sbe-studio-name"), "");
});

test("SD31 the read-only page's Tree and List buttons switch the field view", async (sess) => {
  const a = uniqueName("SdVTree");
  await viewOf(sess, a, true);
  const pressed = () => sess.exec("return [...document.querySelectorAll('.opsc-viewtoggle button')].map(b=>b.textContent.trim()+':'+b.getAttribute('aria-pressed'));");
  await clickText(sess, ".opsc-viewtoggle button", "List");
  await waitFor(async () => (await pressed()).includes("List:true"), { message: "List pressed" });
  await clickText(sess, ".opsc-viewtoggle button", "Tree");
  await waitFor(async () => (await pressed()).includes("Tree:true"), { message: "Tree pressed" });
});

test("SD32 Back to saved definitions returns to the list", async (sess) => {
  const a = uniqueName("SdVBack");
  await viewOf(sess, a, false);
  await clickAria(sess, "Back to saved definitions");
  await waitFor(async () => String(await sess.url()).endsWith("/message-designer-saved.html"), { message: "the saved list" });
});

test("SD33 the view of a deleted definition says it no longer exists", async (sess) => {
  const a = uniqueName("SdVGone");
  const def = await makeDraft(sess, a);
  await apiJson(`/api/v1/definitions/${def.id}`, { method: "DELETE" });
  await browser.open(`/?page=messageDesigner&definition=${encodeURIComponent(def.id)}&mode=view`);
  await waitFor(async () => /no longer exists/.test(await sess.exec("return document.body.innerText;")), { message: "the missing-definition message" });
});


test("SD34 the chosen status chip is remembered when the page is opened again", async (sess) => {
  await openSaved(sess, browser);
  await showChip(sess, "draft");
  await openSaved(sess, browser, { keepChip: true });
  assert.equal(await sess.exec("return document.querySelector(\"#mdl-show [data-show='draft']\").getAttribute('aria-pressed');"), "true");
  await showChip(sess, "all");
});


test("SD35 Generate template on the Export template page makes a template", { todo: "the page has no way to name a message type and its Generate template button always answers 'messageTypeCode and csv are required'" }, async (sess) => {
  await browser.open("/message-designer-export-template.html");
  await waitVisible(sess, "#screen-action");
  await sess.exec("document.getElementById('screen-status').textContent='';document.getElementById('screen-action').click();");
  await sleep(2000);
  const status = await text(sess, "#screen-status");
  assert.doesNotMatch(status, /required/i, `Generate template said: ${status}`);
});

void apiJson; void savedRowId; void value; void waitVisible; void count; void chipCount;
