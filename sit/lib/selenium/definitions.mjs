// Page objects for the Systems and Definitions cases (74-*): External systems, Saved definitions,
// the Message Designer studio, Scheme definitions and Import Scheme. Built on flow.mjs; nothing in
// the shared files is changed. Every function drives the DOM a person uses; callers confirm the
// outcome through the API (apiJson), never from a toast alone.
import {
  apiJson, click, clickText, count, exists, must, pageText, rowsOf, selectOption, setValue, sleep, text, typeInto,
  uploadText, value, visible, waitFor, waitVisible,
} from "./flow.mjs";

export const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// ------------------------------------------------------------------------------------------
// External systems (/external-systems.html)
// ------------------------------------------------------------------------------------------
export async function openExternalSystems(sess, browser) {
  await browser.open("/external-systems.html");
  await waitVisible(sess, "#add");
  await waitFor(async () => /^\d+ external systems?$/.test(await text(sess, "#view-status")), { message: "the external systems list to load" });
}

/** Fills the Add form (only what is given) and clicks Create. Returns the status line the page shows. */
export async function addSystem(sess, f) {
  if (f.id !== undefined) await typeInto(sess, "#new-id", f.id);
  else await typeInto(sess, "#new-id", "");
  await typeInto(sess, "#new-name", f.name ?? "");
  if (f.channel) await selectOption(sess, "#new-channel", f.channel);
  await typeInto(sess, "#new-endpoint", f.endpoint ?? "");
  await typeInto(sess, "#new-dest", f.dest ?? "");
  if (f.headers !== undefined) await setValue(sess, "#new-headers", f.headers);
  await sess.exec("document.getElementById('status').textContent='';");
  await click(sess, "#add");
  const status = await waitFor(async () => (await text(sess, "#status")) || null, { message: "a status line after Create" });
  // The status line is written before the list reloads; wait for the new row so callers can edit it.
  const made = /^created (\S+)$/.exec(status)?.[1];
  if (made) await waitFor(async () => (await idsInPanel(sess, "all")).includes(made), { message: `the row ${made} to be listed` });
  return status;
}

export async function systemFromApi(id) {
  const res = await apiJson("/api/v1/external-systems");
  return rowsOf(res.body).find((s) => s.id === id) || null;
}
export async function allSystems() {
  return rowsOf((await apiJson("/api/v1/external-systems")).body);
}
export async function dropSystem(id) {
  await apiJson(`/api/v1/external-systems/${encodeURIComponent(id)}`, { method: "DELETE" });
}

/** The ids listed in a tab's table (all = the main table, mq | kafka | ftp | api = a family panel). */
export async function idsInPanel(sess, tab) {
  const body = tab === "all" ? "#view-rows" : `#rows-${tab}`;
  return sess.exec("return [...document.querySelectorAll(arguments[0]+' [data-save]')].map(b=>b.getAttribute('data-save'));", [body]);
}
/** The family tab a row belongs to, by the rule the page applies (explicit family, else the channel). */
export function familyOf(row) {
  if (row.family) return row.family;
  if (row.channel === "file" || row.channel === "ftp") return "ftp";
  return row.channel === "mq" || row.channel === "kafka" ? row.channel : "api";
}
export async function showTab(sess, tab) {
  await click(sess, `#tab-${tab}`);
  await waitFor(async () => (await sess.exec("return document.getElementById('tab-'+arguments[0]).getAttribute('aria-selected');", [tab])) === "true", { message: `tab ${tab} selected` });
}
export async function panelActive(sess) {
  return sess.exec("const p=[...document.querySelectorAll('.panel')].filter(x=>x.classList.contains('active')&&getComputedStyle(x).display!=='none');return p.map(x=>x.id);");
}
/** Edits the row's fields in the main table and clicks its Update button. */
export async function updateRow(sess, id, { channel, endpoint, dest, headers }) {
  const q = (k) => `#view-rows [data-${k}='${id}']`;
  if (channel !== undefined) await selectOption(sess, q("ch"), channel);
  if (endpoint !== undefined) await typeInto(sess, q("ep"), endpoint);
  if (dest !== undefined) await typeInto(sess, q("dest"), dest);
  if (headers !== undefined) await setValue(sess, q("hd"), headers);
  await sess.exec("document.getElementById('status').textContent='';");
  await click(sess, q("save"));
  return waitFor(async () => (await text(sess, "#status")) || null, { message: "a status line after Update" });
}
export async function rowValues(sess, id) {
  return sess.exec(
    "const g=(k)=>{const e=document.querySelector(\"#view-rows [data-\"+k+\"='\"+arguments[0]+\"']\");return e?e.value:null};return {channel:g('ch'),endpoint:g('ep'),dest:g('dest'),headers:g('hd')};",
    [id]);
}
export async function integration() {
  return (await apiJson("/api/v1/integration")).body;
}

// ------------------------------------------------------------------------------------------
// Saved definitions (/message-designer-saved.html)
// ------------------------------------------------------------------------------------------
export async function openSaved(sess, browser, { keepChip = false } = {}) {
  await browser.open("/message-designer-saved.html");
  await waitVisible(sess, "#mdl-search");
  await waitFor(async () => /saved definitions?\.|No saved definitions/.test(await text(sess, "#screen-status")) || (await count(sess, "#mdl-rows tr[data-id]")) > 0, { message: "the saved definitions list" });
  // The page remembers the last chip per browser tab; every case starts from All.
  if (!keepChip) await showChip(sess, "all");
}
export async function savedFromApi() {
  return rowsOf((await apiJson("/api/v1/definitions?source=saved")).body);
}
export async function definitionRow(name) {
  return (await savedFromApi()).find((d) => d.name === name) || null;
}
export async function definitionFull(id) {
  const res = await apiJson(`/api/v1/definitions/${id}`);
  return res.status === 200 ? res.body : null;
}
export async function filterSaved(sess, q) {
  await setValue(sess, "#mdl-search", q);
  await sleep(150);
}
export async function chipTexts(sess) {
  return sess.exec("return [...document.querySelectorAll('#mdl-show [data-show]')].map(e=>e.textContent.trim());");
}
export async function chipCount(sess, which) {
  const t = (await chipTexts(sess)).find((c) => c.toLowerCase().startsWith(which));
  return Number(/\((\d+)\)/.exec(t || "")?.[1] ?? NaN);
}
export async function showChip(sess, which) {
  await sess.exec("document.querySelector(\"#mdl-show [data-show='\"+arguments[0]+\"']\").click();", [which]);
  await waitFor(async () => (await sess.exec("return document.querySelector(\"#mdl-show [data-show='\"+arguments[0]+\"']\").getAttribute('aria-pressed');", [which])) === "true", { message: `chip ${which} pressed` });
}
export async function visibleSavedNames(sess) {
  return sess.exec("return [...document.querySelectorAll('#mdl-rows tr[data-id] .mdl-name')].map(e=>e.textContent.trim());");
}
export async function savedRowId(sess, name) {
  return sess.exec("const b=[...document.querySelectorAll('#mdl-rows tr[data-id]')].find(r=>r.querySelector('.mdl-name').textContent.trim()===arguments[0]);return b?b.getAttribute('data-id'):null;", [name]);
}
/** Clicks a row action (View, Continue, Edit, Export, Delete) by its aria-label. */
export async function rowAction(sess, name, action) {
  const ok = await sess.exec(
    "const r=[...document.querySelectorAll('#mdl-rows tr[data-id]')].find(r=>r.querySelector('.mdl-name').textContent.trim()===arguments[0]);if(!r)return false;const b=[...r.querySelectorAll('.mdl-row-actions button')].find(x=>x.textContent.trim()===arguments[1]);if(!b)return false;b.scrollIntoView({block:'center'});b.click();return true;",
    [name, action]);
  if (!ok) throw new Error(`no ${action} button on the saved row "${name}"`);
}
export async function tickRow(sess, name, on = true) {
  const ok = await sess.exec(
    "const r=[...document.querySelectorAll('#mdl-rows tr[data-id]')].find(r=>r.querySelector('.mdl-name').textContent.trim()===arguments[0]);if(!r)return false;const c=r.querySelector('input[type=checkbox]');if(c.checked!==arguments[1])c.click();return true;",
    [name, on]);
  if (!ok) throw new Error(`no saved row "${name}" to tick`);
}
export async function dialogOpen(sess) {
  return sess.exec("const d=document.getElementById('mdl-dialog');return !!d&&d.open;");
}
export async function dialogInfo(sess) {
  await waitFor(() => dialogOpen(sess), { message: "the confirmation dialog" });
  return sess.exec("return {title:document.getElementById('mdl-dialog-title').textContent,body:document.getElementById('mdl-dialog-body').innerText,confirm:document.getElementById('mdl-dialog-confirm').textContent};");
}
export async function answerDialog(sess, accept) {
  await sess.exec(`const b=document.getElementById(arguments[0]);b.click();`, [accept ? "mdl-dialog-confirm" : "mdl-dialog-cancel"]);
  await waitFor(async () => !(await dialogOpen(sess)), { message: "the dialog to close" });
}
export async function savedStatus(sess) {
  return text(sess, "#screen-status");
}

// ------------------------------------------------------------------------------------------
// Message Designer studio (/?page=messageDesigner)
// ------------------------------------------------------------------------------------------
let studioSess = null;
export async function openStudio(sess, browser, query = "") {
  studioSess = sess;
  await browser.open(`/?page=messageDesigner${query}`);
  if (/definition=/.test(query)) await waitVisible(sess, "#sbe-studio-name", { timeout: 25000 });
  else await waitVisible(sess, ".sbe-studio-msg", { timeout: 25000 });
}
/** The read-only page a saved definition opens on (mode=view). */
export async function openDefinitionView(sess, browser, id) {
  await browser.open(`/?page=messageDesigner&definition=${encodeURIComponent(id)}&mode=view`);
  await waitVisible(sess, "[data-testid='saved-definition-title']", { timeout: 25000 });
}
/** The read-only definition page's actions are div[role=button] with an aria-label, not <button>. */
export async function clickAria(sess, label) {
  await click(sess, `[role='button'][aria-label='${label}']`);
}
export async function ariaExists(sess, label) {
  return exists(sess, `[role='button'][aria-label='${label}']`);
}
export async function viewMeta(sess) {
  return sess.exec("const o={};document.querySelectorAll('.sbe-sdef-meta > div').forEach(d=>{o[d.querySelector('dt').textContent.trim()]=d.querySelector('dd').textContent.trim();});return o;");
}
export async function tileCodes(sess) {
  return sess.exec("return [...document.querySelectorAll('.sbe-studio-msg[data-code]')].map(e=>e.getAttribute('data-code'));");
}
export async function messageCountText(sess) {
  return text(sess, "[data-testid='studio-message-count']");
}
export async function chipLabels(sess) {
  return sess.exec("return [...document.querySelectorAll('.sbe-studio-chip')].map(e=>({family:e.getAttribute('data-family'),label:e.textContent.trim(),pressed:e.getAttribute('aria-pressed')}));");
}
export async function openHelper(sess) {
  await sess.exec("const d=document.querySelector('.sbe-studio-helper');if(d&&!d.open)d.querySelector('summary').click();");
  await waitVisible(sess, "select[aria-label='Who sends it?']");
}
export async function chooseTile(sess, code) {
  await sess.exec("const b=document.querySelector(\".sbe-studio-msg[data-code='\"+arguments[0]+\"']\");b.scrollIntoView({block:'center'});b.click();", [code]);
  await waitVisible(sess, "input[type=radio]");
}
export async function chooseMode(sess, many, { count: n } = {}) {
  await sess.exec("const r=document.querySelector(\"input[name='sbe-studio-mode'][value='\"+arguments[0]+\"']\");r.scrollIntoView({block:'center'});r.click();", [many ? "many" : "one"]);
  if (many) await waitVisible(sess, "#sbe-studio-batch-count");
  if (many && n !== undefined) await setBatchCount(sess, n);
}
export async function setBatchCount(sess, n) {
  await typeInto(sess, "#sbe-studio-batch-count", String(n));
  await sess.exec("const e=document.getElementById('sbe-studio-batch-count');e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));");
}
export async function nameDefinition(sess, name) {
  await waitVisible(sess, "#sbe-studio-name");
  // One native input event, not keystrokes: on a busy machine keystrokes race the studio's re-renders
  // and the field ends up holding the suggested name plus a truncated copy of the typed one.
  await waitFor(async () => !(await sess.exec("return document.getElementById('sbe-studio-name').disabled;")), { message: "the name field to enable" });
  await setValue(sess, "#sbe-studio-name", name);
  await waitFor(async () => (await value(sess, "#sbe-studio-name")) === name, { message: "the name to stick" });
}
export async function goTab(sess, tab) {
  await waitFor(async () => !(await sess.exec("return document.getElementById('sbe-studio-tab-'+arguments[0]).disabled;", [tab])), { message: `tab ${tab} to enable` });
  await click(sess, `#sbe-studio-tab-${tab}`);
  await waitFor(async () => (await sess.exec("return document.getElementById('sbe-studio-tab-'+arguments[0]).getAttribute('aria-selected');", [tab])) === "true", { message: `tab ${tab} selected` });
}
export async function studioAttr(sess, name) {
  return sess.exec("const e=document.querySelector(\"[data-testid='studio']\");return e?e.getAttribute(arguments[0]):null;", [name]);
}
export async function saveStatusText(sess) {
  return text(sess, "[data-testid='studio-save']");
}
export async function publishState(sess) {
  return sess.exec("const b=document.querySelector(\"[data-testid='studio-publish']\");return b?{disabled:b.disabled,label:b.textContent.trim(),title:b.title||''}:null;");
}
/** Waits until the working copy is saved (the definition exists in the API) and returns it. */
export async function savedDefinition(name, { timeout = 60000 } = {}) {
  try {
    return await waitFor(() => definitionRow(name), { timeout, message: `definition "${name}" to be saved` });
  } catch (error) {
    // Say what the studio itself showed, so a slow machine and a broken save can be told apart.
    const shown = studioSess ? await studioSess.exec("const q=(t)=>{const e=document.querySelector(\"[data-testid='\"+t+\"']\");return e?e.innerText:'?'};return q('studio-save')+' / '+q('studio-status')+' / publish disabled='+(document.querySelector(\"[data-testid='studio-publish']\")||{}).disabled;").catch(() => "?") : "?";
    error.message += ` | studio shows: ${shown}`;
    throw error;
  }
}
export async function clickButton(sess, label, { exact = true } = {}) {
  await clickText(sess, "button", label, { exact });
}
export async function buttonExists(sess, label) {
  return Boolean(await sess.exec("return [...document.querySelectorAll('button')].some(b=>b.textContent.trim()===arguments[0]);", [label]));
}
export async function buttonDisabled(sess, label) {
  return sess.exec("const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===arguments[0]);return b?b.disabled:null;", [label]);
}
export async function preview(sess) {
  return text(sess, "[data-testid='studio-preview']");
}
export async function openMore(sess) {
  await sess.exec("const d=document.querySelector(\"[data-testid='studio-generate-more']\");if(d&&!d.open)d.querySelector('summary').click();");
  await sleep(100);
}
export async function sampleNames(sess) {
  return sess.exec("return [...document.querySelectorAll(\"[data-testid='studio-batch-table'] tbody tr td:first-child button\")].map(b=>b.textContent.trim());");
}
export async function panelText(sess, testid) {
  await waitFor(() => exists(sess, `[data-testid='${testid}']`), { message: `panel ${testid}` });
  return sess.exec("return document.querySelector(\"[data-testid='\"+arguments[0]+\"']\").innerText;", [testid]);
}
export async function closePanel(sess) {
  await sess.exec("const b=document.querySelector(\"aside[role='dialog'] .sbe-studio-side-head button\");if(b)b.click();");
  await waitFor(async () => !(await exists(sess, "aside[role='dialog']")), { message: "the side panel to close" });
}
export async function toastText(sess) {
  return sess.exec("const t=document.querySelector('.sbe-studio-toast,[role=status].sbe-studio-toast');return t?t.textContent:'';");
}
export async function datasetsOfDefinition(id) {
  const res = await apiJson(`/api/v1/definitions/${id}/datasets`);
  return rowsOf(res.body);
}
export async function datasetsLinkedTo(defId) {
  return rowsOf((await apiJson("/api/v1/datasets")).body).filter((d) => d.definition_id === defId);
}
/** The line the studio shows once a publish has stored its dataset. */
export async function waitPublished(sess, defName) {
  const line = await waitFor(async () => {
    const t = await pageText(sess);
    return new RegExp(`Dataset .${esc(defName)} v\\d+. holds (\\d+) messages?`).exec(t);
  }, { timeout: 90000, message: "the published-dataset notice" });
  return { datasetName: /Dataset .([^”"]+)./.exec(line[0])?.[1], held: Number(line[1]) };
}

/** Chooses a message type, one or many messages, names the definition and publishes it (patient under load). */
export async function publishNew(sess, browser, { tile, name, messages = 1 }) {
  await openStudio(sess, browser);
  await chooseTile(sess, tile);
  await chooseMode(sess, messages > 1, { count: messages > 1 ? messages : undefined });
  await nameDefinition(sess, name);
  await savedDefinition(name);
  await waitFor(async () => { const p = await publishState(sess); return p && !p.disabled; }, { timeout: 60000, message: "Publish to enable" });
  await click(sess, "[data-testid='studio-publish']");
  return waitPublished(sess, name);
}

// ------------------------------------------------------------------------------------------
// Scheme definitions and Import Scheme
// ------------------------------------------------------------------------------------------
export async function openSchemeDefinitions(sess, browser) {
  await browser.open("/?page=schemeDefinitions");
  await waitFor(async () => (await count(sess, ".opsc-family-card")) > 0, { timeout: 25000, message: "the scheme families" });
}
export async function uploadsFromApi() {
  return rowsOf((await apiJson("/api/v1/catalog/iso/uploads")).body);
}
export async function uploadByCode(code) {
  return (await uploadsFromApi()).find((r) => r.code === code) || null;
}
/** Deletes the imports whose name or code starts with the prefix (a case's own unique root). */
export async function dropUploads(prefix) {
  for (const row of await uploadsFromApi()) {
    if (String(row.code || "").startsWith(prefix) || String(row.name || "").startsWith(prefix)) {
      await apiJson(`/api/v1/catalog/designer-types/${encodeURIComponent(row.id)}`, { method: "DELETE" });
    }
  }
}
export async function schemaDrafts() {
  return rowsOf((await apiJson("/api/v1/catalog/schemas/drafts")).body);
}
export async function dropDraft(id) {
  await apiJson(`/api/v1/catalog/schemas/drafts/${encodeURIComponent(id)}`, { method: "DELETE" });
}
/** Scheme definitions: family card -> message card -> details. */
export async function openFamily(sess, name) {
  await waitFor(async () => sess.exec("const c=[...document.querySelectorAll('.opsc-family-card')].find(c=>c.querySelector('.opsc-family-name').textContent.trim()===arguments[0]);if(!c)return false;c.click();return true;", [name]), { message: `family card ${name}` });
  await waitFor(() => exists(sess, ".opsc-msgtype-card"), { message: "the message cards" });
}
export async function openSchemeDetails(sess, browser, code) {
  await openSchemeDefinitions(sess, browser);
  await openFamily(sess, code);
  await waitFor(async () => sess.exec("const c=document.querySelector(\".opsc-msgtype-card[data-scheme-code='\"+arguments[0]+\"']\");if(!c)return false;c.click();return true;", [code]), { message: `message card ${code}` });
  await waitFor(() => exists(sess, ".opsc-viewtoggle"), { timeout: 30000, message: "the details" });
  // The fields load after the toolbar: wait for the tree, diagram or list to have content.
  await waitFor(async () => /Select a row to see its path|fields · \d+ mandatory|FIELD\s+PATH/.test(await mainText(sess)), { timeout: 30000, message: "the field view to fill" });
}
export async function detailButton(sess, label) {
  return sess.exec("const b=[...document.querySelectorAll('.opsc-main button,.opsc-main [role=button]')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()===arguments[0]);return !!b;", [label]);
}
export async function clickDetail(sess, label) {
  await waitFor(() => detailButton(sess, label), { message: `the "${label}" button on the details page` });
  await sess.exec("const b=[...document.querySelectorAll('.opsc-main button,.opsc-main [role=button]')].find(b=>(b.getAttribute('aria-label')||b.textContent).trim()===arguments[0]);b.scrollIntoView({block:'center'});b.click();", [label]);
}
export async function mainText(sess) {
  return sess.exec("const m=document.querySelector('.opsc-main');return m?m.innerText:document.body.innerText;");
}
export async function answerAlert(sess, accept) {
  const prompt = await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { timeout: 8000, message: "a browser dialog" });
  if (accept) await sess.acceptAlert(); else await sess.dismissAlert();
  return prompt;
}
export { apiJson, click, clickText, count, exists, must, pageText, rowsOf, selectOption, setValue, sleep, text, typeInto, uploadText, value, visible, waitFor, waitVisible };
