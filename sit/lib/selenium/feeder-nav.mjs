// Helpers for the Data Feeder variation cases (75-*) and the navigation-health cases (76-*).
//
// Part 1: the Data Feeder form as a person uses it (datasets, window, pacing, spikes, plan) plus
// independent API helpers that make the datasets and feeders a case needs, so cases never depend
// on data another case left behind.
// Part 2: a browser session of our own with browser console logging switched on, so a page whose
// script fails to parse (or throws while loading) is caught even though the page "opens".
import { ENV } from "../env.ts";
import { apiJson } from "../client.ts";
import {
  click, clickText, count, exists, pageText, rowsOf, setValue, sleep, text, uniqueName, value, waitFor, waitVisible,
} from "./flow.mjs";
import { selectOptionContaining } from "./flows.mjs";
import { closeSession, seleniumReady, seleniumUrl, session } from "./webdriver.mjs";
import { enterConsole } from "./console.mjs";

export { apiJson, uniqueName, rowsOf, sleep };

// ==========================================================================================
// Part 1: data feeders
// ==========================================================================================
export const FEEDER_URL = "/data-feeder-form.html";
export const WIN_START = "2031-03-10T09:00";
export const WIN_END_1H = "2031-03-10T10:00";
export const WIN_END_24H = "2031-03-11T09:00";

/** The ISO string a datetime-local value means in the browser's own zone (what the API stores). */
export async function isoOf(sess, local) {
  return sess.exec("return new Date(arguments[0]).toISOString();", [local]);
}

/** A local datetime-local string `hours` after another one. */
export async function plusHours(sess, local, hours) {
  return sess.exec(
    "const d=new Date(new Date(arguments[0]).getTime()+arguments[1]*3600e3),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+'T'+p(d.getHours())+':'+p(d.getMinutes());",
    [local, hours]);
}

/** Makes a dataset of `rows` messages through the API. Returns { id, name, rows }. */
export async function createDataset(prefix, rows = 5) {
  const name = uniqueName(prefix);
  const made = await apiJson("/api/v1/datasets", { method: "POST", body: JSON.stringify({ name, messageTypeCode: "pain.001.001.09" }) });
  if (made.status !== 200 && made.status !== 201) throw new Error(`could not create dataset ${name}: ${made.status} ${JSON.stringify(made.body)}`);
  const id = made.body.id;
  for (let sent = 0; sent < rows; sent += 50) {
    const batch = [];
    for (let i = sent; i < Math.min(rows, sent + 50); i++) batch.push({ name: `${name}-m${i + 1}`, format: "json", content: JSON.stringify({ n: i + 1 }) });
    const put = await apiJson(`/api/v1/datasets/${id}/messages`, { method: "POST", body: JSON.stringify({ messages: batch }) });
    if (put.status !== 200) throw new Error(`could not fill dataset ${name}: ${put.status} ${JSON.stringify(put.body)}`);
  }
  return { id, name, rows };
}

/** A complete valid feeder body; `over` replaces any part. */
export function feederBody(datasetId, over = {}) {
  return {
    name: uniqueName("Feeder"),
    description: "",
    datasets: [{ datasetId, weight: 100 }],
    repeatCount: 20,
    sendOrder: "random",
    externalSystemId: null,
    windowStart: "2031-03-10T09:00:00.000Z",
    windowEnd: "2031-03-10T10:00:00.000Z",
    pacing: { mode: "random-gaps", gapsSeconds: [1, 2, 3, 5] },
    spikes: [],
    seed: 12345,
    ...over,
  };
}

export async function postFeeder(body) {
  return apiJson("/api/v1/data-feeders", { method: "POST", body: JSON.stringify(body) });
}

/** Creates a feeder through the API and returns it (throws when refused). */
export async function makeFeeder(datasetId, over = {}) {
  const res = await postFeeder(feederBody(datasetId, over));
  if (res.status !== 201) throw new Error(`could not create feeder: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body;
}

export async function getFeeder(id) {
  const res = await apiJson(`/api/v1/data-feeders/${id}`);
  return res.status === 200 ? res.body : null;
}

export async function feederNamed(name) {
  const res = await apiJson("/api/v1/data-feeders?include=archived");
  return rowsOf(res.body).find((f) => f.name === name) || null;
}

export async function feederCountNamed(name) {
  const res = await apiJson("/api/v1/data-feeders?include=archived");
  return rowsOf(res.body).filter((f) => f.name === name).length;
}

// ---- opening ------------------------------------------------------------------------------
export async function openNewFeeder(browser) {
  const sess = await browser.open(FEEDER_URL);
  await waitVisible(sess, "#df-save", { timeout: 20000 });
  await waitFor(async () => (await count(sess, "#df-datasets select")) >= 1, { message: "the first dataset row" });
  await planShown(sess);
  return sess;
}

export async function openSavedFeeder(browser, id, expectName) {
  const sess = await browser.open(`${FEEDER_URL}?id=${id}`);
  await waitVisible(sess, "#df-save", { timeout: 20000 }).catch(() => {});
  await waitFor(async () => {
    const n = await value(sess, "#df-name");
    return expectName === undefined ? n : n === expectName;
  }, { timeout: 20000, message: "the saved feeder to load" });
  await planShown(sess);
  return sess;
}

/** Waits until the plan preview has drawn (or told the person why it cannot). */
export async function planShown(sess) {
  await waitFor(async () => {
    const t = await text(sess, "#df-plan-status");
    return t && !/^Updating plan/.test(t) && !/^Fill in the settings/.test(t) ? t : null;
  }, { timeout: 20000, message: "the send plan status" });
}

/** Waits until the plan tile "Messages" shows this number (formatted like the page does). */
export async function planMessages(sess, n) {
  const shown = n.toLocaleString("en-US");
  await waitFor(async () => (await tileValue(sess, "Messages")) === shown, { timeout: 20000, message: `the plan to show ${shown} messages` });
}

export async function tiles(sess) {
  return sess.exec("return [...document.querySelectorAll('#df-tiles .df-tile')].map(t=>({label:(t.querySelector('.df-tile-label')||{}).textContent||'',value:(t.querySelector('.df-tile-value')||{}).textContent||'',note:(t.querySelector('.df-tile-note')||{}).textContent||''}));");
}

export async function tileValue(sess, label) {
  const all = await tiles(sess);
  const t = all.find((x) => x.label === label);
  return t ? t.value : null;
}

// ---- form fields --------------------------------------------------------------------------
export async function pickDataset(sess, row, fragment) {
  return selectOptionContaining(sess, `select[aria-label="Dataset ${row}"]`, fragment);
}

export async function datasetRows(sess) {
  return sess.exec("return [...document.querySelectorAll('#df-datasets .df-row.dataset')].map((r,i)=>{const s=r.querySelector('select'),w=r.querySelector('input'),b=r.querySelector('button');return {selected:s.options[s.selectedIndex]?s.options[s.selectedIndex].text:'',value:s.value,weight:w.value,weightDisabled:w.disabled,removeDisabled:b.disabled,options:[...s.options].map(o=>({text:o.text,value:o.value,disabled:o.disabled}))};});");
}

export async function setWeight(sess, row, weight) {
  await setValue(sess, `input[aria-label="Percentage of dataset ${row}"]`, String(weight));
}

export async function addDataset(sess) {
  const before = await count(sess, "#df-datasets .df-row.dataset");
  await click(sess, "#df-add-dataset");
  await waitFor(async () => (await count(sess, "#df-datasets .df-row.dataset")) === before + 1, { message: "another dataset row" });
}

export async function removeDataset(sess, row) {
  const before = await count(sess, "#df-datasets .df-row.dataset");
  await click(sess, `button[aria-label="Remove dataset ${row}"]`);
  await waitFor(async () => (await count(sess, "#df-datasets .df-row.dataset")) === before - 1, { message: "the dataset row to go" });
}

export async function setWindow(sess, start, end) {
  await setValue(sess, "#df-start", start);
  if (end !== undefined) await setValue(sess, "#df-end", end);
}

export async function setCount(sess, n) {
  // The feeder form now asks for repeat cycles, not a raw message count.
  await setValue(sess, "#df-repeat", String(n));
}

export async function pressed(sess, css) {
  return sess.exec("return [...document.querySelectorAll(arguments[0])].map(b=>[b.textContent.trim(),b.getAttribute('aria-pressed')]);", [css]);
}

/** { "0.5 s": true, ... } for the random-gap chips. */
export async function gapChips(sess) {
  const rows = await sess.exec("return [...document.querySelectorAll('#df-gaps button.df-chip')].map(b=>[b.textContent.trim(),b.getAttribute('aria-pressed')==='true',b.disabled]);");
  return Object.fromEntries(rows.map(([label, on]) => [label, on]));
}

export async function gapChipsDisabled(sess) {
  return sess.exec("return [...document.querySelectorAll('#df-gaps button,#df-gaps input')].map(b=>b.disabled);");
}

export async function toggleGap(sess, label) {
  await sess.exec("const b=[...document.querySelectorAll('#df-gaps button.df-chip')].find(x=>x.textContent.trim()===arguments[0]);if(!b)throw new Error('no gap chip '+arguments[0]);b.scrollIntoView({block:'center'});b.click();", [label]);
}

export async function setOnlyGaps(sess, labels) {
  const now = await gapChips(sess);
  for (const [label, on] of Object.entries(now)) {
    if (on !== labels.includes(label)) await toggleGap(sess, label);
  }
}

/** Types a value into the "Other..." gap box with real keystrokes and presses Enter. */
export async function typeCustomGap(sess, textValue) {
  const el = await waitFor(() => sess.find("css selector", "#df-gaps input.df-chip-add"), { message: "the custom gap box" });
  await sess.clear(el);
  await sess.type(el, textValue);
  await sess.type(el, "");
}

export async function choosePacing(sess, mode) {
  await sess.exec("const r=document.querySelector('input[name=pacingMode][value='+JSON.stringify(arguments[0])+']');r.scrollIntoView({block:'center'});r.click();", [mode]);
}

export async function setOrder(sess, which) {
  await click(sess, `[data-order="${which}"]`);
}

export async function chooseSystem(sess, valueOrText) {
  await sess.exec("const e=document.getElementById('df-system');const i=[...e.options].findIndex(o=>o.value===arguments[0]||o.text.includes(arguments[0]));if(i<0)throw new Error('no system '+arguments[0]);e.selectedIndex=i;e.dispatchEvent(new Event('change',{bubbles:true}));", [valueOrText]);
}

export async function spikeRows(sess) {
  return sess.exec("return [...document.querySelectorAll('#df-spike-rows .df-row.spike')].map(r=>{const i=r.querySelectorAll('input');return {from:i[0].value,to:i[1].value,mult:i[2].value,label:i[3].value};});");
}

export async function addSpike(sess) {
  const before = await count(sess, "#df-spike-rows .df-row.spike");
  await click(sess, "#df-add-spike");
  await waitFor(async () => (await count(sess, "#df-spike-rows .df-row.spike")) === before + 1, { message: "another spike row" });
}

export async function setSpike(sess, n, field, val) {
  const label = { from: "starts", to: "ends", mult: "rate multiplier", label: "label" }[field];
  await setValue(sess, `[aria-label="Spike ${n} ${label}"]`, String(val));
}

/** Everything the form shows, for round-trip comparisons. */
export async function formState(sess) {
  return sess.exec(`
    const v=id=>{const e=document.getElementById(id);return e?e.value:null;};
    const mode=(document.querySelector('input[name=pacingMode]:checked')||{}).value;
    const order=(document.querySelector('[data-order][aria-pressed=true]')||{}).dataset;
    const chips={};document.querySelectorAll('#df-gaps button.df-chip').forEach(b=>{chips[b.textContent.trim()]=b.getAttribute('aria-pressed')==='true';});
    return {name:v('df-name'),description:v('df-description'),count:v('df-repeat'),order:order?order.order:null,system:v('df-system'),
      start:v('df-start'),end:v('df-end'),mode,interval:v('df-interval'),chips,title:document.getElementById('screen-title').textContent,docTitle:document.title};`);
}

/** The inline error texts by slot id (err-name, err-messageCount, ...), only non-empty ones. */
export async function fieldErrors(sess) {
  return sess.exec("const o={};document.querySelectorAll('.df-error').forEach(n=>{const t=(n.textContent||'').trim();if(t)o[n.id]=t;});return o;");
}

export async function statusLine(sess) {
  return text(sess, "#df-status");
}

/** Clicks Save and returns the new id from the address bar (creating), or waits for "Saved." (editing). */
export async function saveNew(sess) {
  await click(sess, "#df-save");
  return waitFor(async () => {
    const m = /[?&]id=(dfd_[A-Za-z0-9]+)/.exec(String(await sess.url()));
    if (m) return m[1];
    const err = await statusLine(sess);
    if (/attention|Could not|Check/i.test(err)) throw new Error(`save was refused: ${err} ${JSON.stringify(await fieldErrors(sess))}`);
    return null;
  }, { timeout: 20000, message: "the saved feeder id in the address bar" });
}

export async function saveEdit(sess) {
  await click(sess, "#df-save");
  return waitFor(async () => {
    const t = await statusLine(sess);
    return /^Saved\.|^Saved\. /.test(t) ? t : null;
  }, { timeout: 20000, message: "the Saved. status" });
}

/** Clicks Save on a form that must be refused; returns the status line and the inline errors. */
export async function saveRefused(sess) {
  await click(sess, "#df-save");
  return waitFor(async () => {
    const status = await statusLine(sess);
    const errs = await fieldErrors(sess);
    if (/attention/.test(status) && Object.keys(errs).length) return { status, errors: errs };
    return null;
  }, { timeout: 15000, message: "the refusal message" });
}

// ---- plan ---------------------------------------------------------------------------------
export async function sampleTable(sess) {
  return sess.exec("return [...document.querySelectorAll('#df-sample tbody tr')].map(r=>[...r.children].map(c=>c.textContent.trim()));");
}

export async function sampleHeaders(sess) {
  return sess.exec("return [...document.querySelectorAll('#df-sample thead th')].map(c=>c.textContent.trim());");
}

export async function chartBarCount(sess) {
  return count(sess, "#df-chart path.bar");
}

export async function chartTable(sess) {
  return sess.exec("return [...document.querySelectorAll('#df-chart-table tbody tr')].map(r=>[...r.children].map(c=>c.textContent.trim()));");
}

export async function warnings(sess) {
  return sess.exec("return [...document.querySelectorAll('#df-warnings li')].map(l=>l.textContent.trim());");
}

export async function planFor(id, query = "") {
  const res = await apiJson(`/api/v1/data-feeders/${id}/plan${query}`);
  if (res.status !== 200) throw new Error(`plan ${res.status}`);
  return res.body.plan;
}

/** POSTs unsaved settings to the plan preview (same call the page makes). */
export async function previewPlan(body, query = "") {
  return apiJson(`/api/v1/data-feeders/plan${query}`, { method: "POST", body: JSON.stringify(body) });
}

export async function downloadCsvText(id, headers = {}) {
  const t = await apiJson("/api/v1/session/login", { method: "POST", body: "{}" }).catch(() => null);
  void t;
  const { authToken } = await import("../client.ts");
  const token = await authToken();
  const res = await fetch(`${ENV.apiBase}/api/v1/data-feeders/${id}/plan.csv`, { headers: { authorization: `Bearer ${token}`, ...headers } });
  return { status: res.status, type: res.headers.get("content-type"), disposition: res.headers.get("content-disposition"), text: await res.text() };
}

export { clickText, count, exists, pageText, selectOptionContaining, setValue, text, value, waitFor, waitVisible, click };

// ==========================================================================================
// Part 2: navigation health, with browser console logs
// ==========================================================================================
const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
void ELEMENT_KEY;

async function wdRaw(method, pathname, body) {
  const res = await fetch(`${seleniumUrl()}${pathname}`, {
    method,
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.value?.error) throw new Error(json.value?.message || json.value?.error || `webdriver ${res.status} ${pathname}`);
  return json.value;
}

/** A browser session of our own with the browser console log switched on (webdriver.mjs's openSession has no way to ask for it). */
export async function openLoggedSession({ prompts = true } = {}) {
  const value = await wdRaw("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        ...(prompts ? { unhandledPromptBehavior: "ignore" } : {}),
        "goog:loggingPrefs": { browser: "ALL" },
        "goog:chromeOptions": {
          args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900",
            ...(process.env.BASELINE_CONTAINER === "1" ? ["--host-resolver-rules=MAP unpkg.com ~NOTFOUND"] : [])],
        },
      },
    },
  });
  const id = value.sessionId;
  return { id, sess: session(id), close: () => closeSession(id), wd: (method, path, body) => wdRaw(method, `/session/${id}${path}`, body) };
}

/** Reads (and thereby clears) the browser console entries recorded since the last read. */
export async function readBrowserLog(handle) {
  for (const path of ["/se/log", "/goog/log"]) {
    try {
      const entries = await handle.wd("POST", path, { type: "browser" });
      if (Array.isArray(entries)) return entries;
    } catch { /* try the next endpoint */ }
  }
  return [];
}

/** Console noise this local stack always has and no page can fix: no internet, two scripts index.html names that are absent. */
export function isBenignLog(entry) {
  const m = String(entry.message || "");
  if (/unpkg\.com/.test(m)) return true;
  if (/\/js\/sync-button\.js|\/js\/row-identity-bind\.js/.test(m)) return true;
  return false;
}

/** SEVERE entries a page's own scripts produced (uncaught errors, parse errors). */
export function scriptErrors(entries) {
  // With no internet the CDN libraries never arrive, so "React is not defined" is that same known noise, not a page fault.
  const cdnDown = entries.some((e) => /unpkg\.com/.test(String(e.message)));
  return entries.filter((e) => e.level === "SEVERE" && !isBenignLog(e) && /Uncaught|SyntaxError|ReferenceError|TypeError|RangeError|EvalError/.test(String(e.message))
    && !(cdnDown && /\b(React|ReactDOM) is not defined/.test(String(e.message))));
}

/** Every SEVERE entry that is not known noise (reported so other failures such as 404s stay visible). */
export function otherSevere(entries) {
  return entries.filter((e) => e.level === "SEVERE" && !isBenignLog(e) && !scriptErrors([e]).length);
}

/** Signs in on a fresh logged session and returns the handle. */
export async function loggedConsole() {
  if (!(await seleniumReady())) return null;
  const handle = await openLoggedSession();
  await enterConsole(handle.sess);
  await readBrowserLog(handle);
  return handle;
}

/** The page's real title: .opsc-pagehead-title / .opsc-hero-title, else the first visible <h1> that is not the brand, else the breadcrumb, else <title>. */
export async function titleInfo(sess) {
  return sess.exec(`
    const vis=e=>!!(e&&(e.offsetWidth||e.offsetHeight||e.getClientRects().length));
    const t=e=>e.textContent.trim().replace(/\\s+/g,' ');
    const head=[...document.querySelectorAll('.opsc-pagehead-title, .opsc-hero-title')].filter(vis)[0];
    if(head) return {text:t(head),source:'pagehead'};
    const h1=[...document.querySelectorAll('h1')].filter(vis).find(e=>!/^sand bench$/i.test(t(e)));
    if(h1) return {text:t(h1),source:'h1'};
    const crumb=[...document.querySelectorAll('.opsc-crumbs b')].filter(vis)[0];
    if(crumb) return {text:t(crumb),source:'breadcrumb'};
    return {text:document.title,source:'document.title'};`);
}

export async function titleOf(sess) {
  return (await titleInfo(sess)).text;
}

/** The sidebar as a person sees it: which entries are highlighted, which group is open, what is listed. */
export async function sidebarState(sess) {
  return sess.exec(`
    const sb=document.querySelector('.opsc-sidebar');
    if(!sb) return {present:false,active:[],expanded:[],items:[]};
    const vis=e=>!!(e.offsetWidth||e.offsetHeight||e.getClientRects().length);
    const t=e=>e.textContent.trim().replace(/\\s+/g,' ');
    return {present:true,
      active:[...sb.querySelectorAll('.active')].filter(vis).map(t),
      expanded:[...sb.querySelectorAll('.expanded-parent')].map(t),
      items:[...sb.querySelectorAll('.opsc-navitem,.opsc-subitem')].filter(vis).map(t)};`);
}

export async function bootFailed(sess) {
  return Boolean(await sess.exec("return /Official console JS did not boot|JSX console CONFIG was not exposed/i.test((document.body?document.body.innerText:'')+' '+(document.getElementById('login-err')?document.getElementById('login-err').textContent:''));"));
}

async function clickEl(sess, el) {
  await sess.exec("arguments[0].scrollIntoView({block:'center'});", [{ el }]);
  try { await sess.click(el); } catch { await sess.exec("arguments[0].click();", [{ el }]); }
}

/** Opens the console home and waits for its sidebar. */
export async function openConsoleHome(sess) {
  await sess.go(`${ENV.webBase}/`);
  await waitFor(() => sess.find("css selector", "#console-root:not(.hidden) .opsc-sidebar"), { timeout: 30000, message: "the console sidebar" });
  await sleep(600);
}

/**
 * Clicks a sidebar entry the way a person does: opens its group when it is closed, then clicks the
 * entry. `label === group` means the top-level item itself (Overview, Patterns) or, for a group that
 * is also a page, its header (which only opens the group).
 */
export async function clickSidebar(sess, group, label) {
  const findItem = (css, wanted) => sess.exec(
    "const t=e=>e.textContent.trim().replace(/\\s+/g,' ');const m=[...document.querySelectorAll(arguments[0])].find(e=>t(e)===arguments[1]);return m||null;", [css, wanted]);
  const header = await waitFor(async () => elOf(await findItem(".opsc-sidebar .opsc-navitem", group)), { message: `the sidebar item ${group}` });
  if (label === group) { await clickEl(sess, header); return; }
  const open = await sess.exec("arguments[0].classList.contains('expanded-parent')", [{ el: header }]);
  if (!open) await clickEl(sess, header);
  const sub = await waitFor(async () => elOf(await findItem(".opsc-sidebar .opsc-subitem", label)), { message: `the sidebar entry ${label} under ${group}` });
  await clickEl(sess, sub);
}

function elOf(value) {
  if (!value || typeof value !== "object") return null;
  return value[ELEMENT_KEY] || value.ELEMENT || null;
}

/** True when the entry is listed in the sidebar (any group). */
export async function sidebarLists(sess, label) {
  return (await sidebarState(sess)).items.includes(label);
}

/**
 * Visits one screen and reports what a person and the browser console would see.
 * via "click": console home, then the sidebar. via "url": straight to the address.
 * Waits for the wanted title (up to 20 s) but never throws, so the case can say what was wrong.
 */
export async function visit(handle, { via, group, label, url, title }) {
  const sess = handle.sess;
  const matches = (t) => (title instanceof RegExp ? title.test(t) : t === title);
  if (via === "click") {
    await openConsoleHome(sess);
    await sleep(500);
    await readBrowserLog(handle);
    await clickSidebar(sess, group, label);
  } else {
    await readBrowserLog(handle);
    await sess.go(url.startsWith("http") ? url : `${ENV.webBase}${url}`);
  }
  let info = { text: "", source: "" };
  try { info = await waitFor(async () => { const i = await titleInfo(sess); return matches(i.text) ? i : null; }, { timeout: 20000, message: "the title" }); }
  catch { info = await titleInfo(sess); }
  await sleep(1500);
  const log = await readBrowserLog(handle);
  return {
    title: info.text, titleSource: info.source, url: String(await sess.url()), docTitle: String(await sess.title()),
    sidebar: await sidebarState(sess), boot: await bootFailed(sess),
    scriptErrors: scriptErrors(log), otherSevere: otherSevere(log),
  };
}

// ==========================================================================================
// Case scaffolding shared by the feeder case files (75-*, 75b-*)
// ==========================================================================================
/**
 * Fixtures and wrappers for a case file: `fixtures()` makes the datasets once through the API,
 * `gui(name, t, body)` skips cleanly when Selenium is down and screenshots on failure,
 * `fillBasic()` fills name, first dataset, count and window on the open New feeder form.
 */
export function feederRig(browser, saveShot, typeInto) {
  let fixturePromise = null;
  const fixtures = () => {
    fixturePromise ||= (async () => ({
      a: await createDataset("DfxA", 5),
      b: await createDataset("DfxB", 3),
      c: await createDataset("DfxC", 8),
      empty: await createDataset("DfxEmpty", 0),
    }))();
    return fixturePromise;
  };
  async function gui(name, t, body) {
    if (!(await browser.available(`df-${name}`))) { t.skip(browser.reason); return; }
    const sess = await browser.signedIn();
    const fx = await fixtures();
    try { await body(sess, fx); }
    catch (error) { await saveShot(sess, `df-${name}`); throw error; }
  }
  async function fillBasic(sess, ds, o = {}) {
    const name = o.name ?? uniqueName("Var");
    await typeInto(sess, "#df-name", name);
    await pickDataset(sess, 1, ds.name);
    await setCount(sess, o.count ?? 20);
    await setWindow(sess, o.start ?? WIN_START, o.end ?? WIN_END_1H);
    return name;
  }
  return { fixtures, gui, fillBasic };
}

/** Fills the sign-in gate and presses Sign in. */
export async function gateSignIn(sess, { tenant = ENV.tenantSlug, user = ENV.username, password = ENV.password } = {}) {
  await waitVisible(sess, "#gate #login", { timeout: 20000 });
  for (const [css, v] of [["#tenant", tenant], ["#username", user], ["#password", password]]) {
    const el = await sess.find("css selector", css);
    await sess.clear(el);
    if (v) await sess.type(el, v);
  }
  await click(sess, "#gate #login");
}

export async function storedTokens(sess) {
  return sess.exec("return {session:sessionStorage.getItem('sbe_token'),local:localStorage.getItem('sbe_token')};");
}
