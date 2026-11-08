// Selenium helpers for the business-flow and schema-converter cases (65-*, 72-*, 73-*).
//
// Built on the raw WebDriver session in webdriver.mjs, so they run against a Selenium grid
// or a bare chromedriver alike. Everything here drives the deployed web tier through the DOM
// a person uses; results are confirmed independently through the public API (apiJson), never
// from a toast or status line alone.
import { ENV } from "../env.ts";
import { apiJson } from "../client.ts";
import { closeSession, openSession, seleniumReady, session, seleniumUrl, recordSkip, saveShot } from "./webdriver.mjs";
import { enterConsole } from "./console.mjs";

export { apiJson, saveShot };

const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls fn() until it returns a truthy value; throws with the last observed state otherwise. */
export async function waitFor(fn, { timeout = 10000, interval = 200, message = "condition" } = {}) {
  const start = Date.now();
  let last;
  for (;;) {
    try {
      last = await fn();
      if (last) return last;
    } catch (error) {
      last = `error: ${error?.message || error}`;
    }
    if (Date.now() - start >= timeout) throw new Error(`Timed out after ${timeout}ms waiting for ${message}. Last: ${JSON.stringify(last)?.slice(0, 300)}`);
    await sleep(interval);
  }
}

// ---------------------------------------------------------------------------------------
// One browser per case file. Signing in and booting the console takes seconds; a matrix of
// forty combinations should pay that once. Each case still starts from a freshly loaded
// page (open(url)), so no case depends on another's page state.
// ---------------------------------------------------------------------------------------
export function sharedBrowser({ prompts = false } = {}) {
  let id = null;
  let sess = null;
  let unavailable = "";
  return {
    /** True when a Selenium endpoint is reachable; otherwise records why. */
    async available(label = "selenium") {
      if (unavailable) return false;
      if (sess) return true;
      if (!(await seleniumReady())) {
        unavailable = `Selenium not reachable at ${seleniumUrl()}. Start profile selenium.`;
        await recordSkip(label, unavailable);
        return false;
      }
      return true;
    },
    get reason() { return unavailable; },
    /** The signed-in session, created on first use. */
    async signedIn() {
      if (!sess) {
        id = await openSession({ prompts });
        sess = session(id);
        await enterConsole(sess);
      }
      return sess;
    },
    /** Opens a page in the signed-in session (the token survives in this tab's sessionStorage). */
    async open(path) {
      const s = await this.signedIn();
      try { await s.dismissAlert(); } catch { /* no dialog open */ }
      await s.go(path.startsWith("http") ? path : `${ENV.webBase}${path}`);
      return s;
    },
    /** A second, signed-out browser tab context is not needed: use fresh() for a new session. */
    async fresh() {
      const newId = await openSession({ prompts });
      return { sess: session(newId), close: () => closeSession(newId) };
    },
    async close() {
      if (id) await closeSession(id);
      id = null; sess = null;
    },
  };
}

// ---------------------------------------------------------------------------------------
// Element helpers. Selectors are plain CSS; text matching is by visible text.
// ---------------------------------------------------------------------------------------
export function elFrom(value) {
  if (!value || typeof value !== "object") return null;
  return value[ELEMENT_KEY] || value.ELEMENT || null;
}

export async function exists(sess, css) {
  return Boolean(await sess.find("css selector", css));
}

export async function must(sess, css, { timeout = 10000 } = {}) {
  return waitFor(() => sess.find("css selector", css), { timeout, message: `element ${css}` });
}

export async function visible(sess, css) {
  return Boolean(await sess.exec(
    "const e=document.querySelector(arguments[0]);return !!(e&&(e.offsetWidth||e.offsetHeight||e.getClientRects().length)&&!e.closest('[hidden]'));",
    [css]));
}

export async function waitVisible(sess, css, { timeout = 10000 } = {}) {
  return waitFor(() => visible(sess, css), { timeout, message: `${css} to be visible` });
}

export async function waitHidden(sess, css, { timeout = 10000 } = {}) {
  return waitFor(async () => !(await visible(sess, css)), { timeout, message: `${css} to be hidden` });
}

export async function text(sess, css) {
  return String(await sess.exec("const e=document.querySelector(arguments[0]);return e?(e.innerText!==undefined&&e.offsetParent!==null?e.innerText:e.textContent):null;", [css]) ?? "").trim();
}

export async function value(sess, css) {
  return sess.exec("const e=document.querySelector(arguments[0]);return e?e.value:null;", [css]);
}

export async function isDisabled(sess, css) {
  return Boolean(await sess.exec("const e=document.querySelector(arguments[0]);return e?!!e.disabled:null;", [css]));
}

export async function count(sess, css) {
  return Number(await sess.exec("return document.querySelectorAll(arguments[0]).length;", [css]));
}

export async function texts(sess, css) {
  return sess.exec("return [...document.querySelectorAll(arguments[0])].map(e=>(e.innerText||e.textContent||'').trim());", [css]);
}

export async function attribute(sess, css, name) {
  return sess.exec("const e=document.querySelector(arguments[0]);return e?e.getAttribute(arguments[1]):null;", [css, name]);
}

export async function pageText(sess) {
  return String(await sess.exec("return document.body?document.body.innerText:'';"));
}

/** Scrolls an element into view and clicks it; falls back to a script click if something overlays it. */
export async function click(sess, css, { timeout = 10000 } = {}) {
  const el = await must(sess, css, { timeout });
  await sess.exec("arguments[0].scrollIntoView({block:'center'});", [{ el }]);
  try { await sess.click(el); }
  catch (error) {
    if (/unexpected alert/i.test(error.message)) throw error;
    await sess.exec("arguments[0].click();", [{ el }]);
  }
}

/** Finds the first element matching css whose trimmed text equals (or contains) text. */
export async function findByText(sess, css, wanted, { exact = true } = {}) {
  const found = await sess.exec(
    "const t=arguments[1],x=arguments[2];return [...document.querySelectorAll(arguments[0])].find(e=>{const s=(e.innerText||e.textContent||'').trim().replace(/\\s+/g,' ');return x?s===t:s.includes(t);})||null;",
    [css, wanted, exact]);
  return elFrom(found);
}

export async function clickText(sess, css, wanted, { exact = true, timeout = 10000 } = {}) {
  const el = await waitFor(() => findByText(sess, css, wanted, { exact }), { timeout, message: `${css} with text "${wanted}"` });
  await sess.exec("arguments[0].scrollIntoView({block:'center'});", [{ el }]);
  try { await sess.click(el); } catch { await sess.exec("arguments[0].click();", [{ el }]); }
}

/** Types real keystrokes into a field after clearing it. */
export async function typeInto(sess, css, textValue) {
  const el = await must(sess, css);
  await sess.exec("arguments[0].scrollIntoView({block:'center'});", [{ el }]);
  await sess.clear(el);
  if (textValue !== "") await sess.type(el, textValue);
}

/** Sets a field's value through the native setter and fires input and change, as a paste would. */
export async function setValue(sess, css, textValue) {
  const done = await sess.exec(
    "const e=document.querySelector(arguments[0]);if(!e)return false;const proto=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:e.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,arguments[1]);e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return true;",
    [css, String(textValue)]);
  if (!done) throw new Error(`setValue: no element ${css}`);
}

/** Chooses an option by visible text or value and fires the events a user's choice fires. */
export async function selectOption(sess, css, wanted) {
  const chosen = await sess.exec(
    "const e=document.querySelector(arguments[0]);if(!e)return null;const v=String(arguments[1]),w=v.trim();const i=[...e.options].findIndex(o=>o.value===v||o.text.trim()===w);if(i<0)return {missing:[...e.options].map(o=>o.text.trim())};e.selectedIndex=i;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {text:e.options[i].text.trim(),value:e.options[i].value};",
    [css, wanted]);
  if (!chosen) throw new Error(`selectOption: no <select> ${css}`);
  if (chosen.missing) throw new Error(`selectOption: "${wanted}" not in ${css}. Options: ${chosen.missing.join(" | ")}`);
  return chosen;
}

export async function optionTexts(sess, css) {
  return sess.exec("const e=document.querySelector(arguments[0]);return e?[...e.options].map(o=>o.text.trim()):null;", [css]);
}

export async function selectedText(sess, css) {
  return sess.exec("const e=document.querySelector(arguments[0]);return e&&e.selectedIndex>=0?e.options[e.selectedIndex].text.trim():null;", [css]);
}

export async function setChecked(sess, css, wanted) {
  const now = await sess.exec("const e=document.querySelector(arguments[0]);return e?e.checked:null;", [css]);
  if (now === null) throw new Error(`setChecked: no element ${css}`);
  if (now !== wanted) await click(sess, css);
}

/**
 * Puts a file into <input type=file> with the DataTransfer API, so it works whether the browser
 * runs beside this process or in a separate Selenium container that cannot see this filesystem.
 */
export async function uploadText(sess, css, fileName, content, mime = "text/plain") {
  const ok = await sess.exec(
    "const e=document.querySelector(arguments[0]);if(!e)return false;const dt=new DataTransfer();dt.items.add(new File([arguments[2]],arguments[1],{type:arguments[3]}));e.files=dt.files;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.files.length===1;",
    [css, fileName, content, mime]);
  if (!ok) throw new Error(`uploadText: could not attach ${fileName} to ${css}`);
}

// ---------------------------------------------------------------------------------------
// Downloads. The pages build a Blob, point a temporary <a download> at it and click it. That
// leaves nothing on disk to inspect in a headless remote browser, so capture the name and the
// bytes at the moment of the click instead.
// ---------------------------------------------------------------------------------------
export async function captureDownloads(sess) {
  await sess.exec(`
    if (window.__sitDownloads) return true;
    window.__sitDownloads = [];
    const blobs = new Map();
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (obj) => {
      const url = create(obj);
      if (obj instanceof Blob) obj.arrayBuffer().then((buf) => blobs.set(url, { type: obj.type, bytes: new Uint8Array(buf) }));
      return url;
    };
    const click = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) {
        const name = this.download, href = this.href;
        const record = { name, href, ready: false };
        window.__sitDownloads.push(record);
        const settle = () => {
          const blob = blobs.get(href);
          if (!blob) return setTimeout(settle, 20);
          let text = '';
          try { text = new TextDecoder().decode(blob.bytes); } catch (e) { text = ''; }
          Object.assign(record, { type: blob.type, size: blob.bytes.length, text, magic: String.fromCharCode(...blob.bytes.slice(0, 4)), ready: true });
        };
        settle();
        return;
      }
      return click.call(this);
    };
    return true;`);
}

export async function downloads(sess) {
  return sess.exec("return (window.__sitDownloads||[]).filter(d=>d.ready).map(d=>({name:d.name,type:d.type,size:d.size,text:d.text,magic:d.magic}));");
}

export async function waitDownload(sess, { after = 0, timeout = 8000 } = {}) {
  const list = await waitFor(async () => { const all = await downloads(sess); return all.length > after ? all : null; }, { timeout, message: "a download to be captured" });
  return list[list.length - 1];
}

// ---------------------------------------------------------------------------------------
// Session and API facts.
// ---------------------------------------------------------------------------------------
export async function sessionToken(sess) {
  return sess.exec("return sessionStorage.getItem('sbe_token')||localStorage.getItem('sbe_token')||null;");
}

/** A unique, XML-name-safe suffix so repeated runs never collide on names the API keeps unique. */
export function uniqueName(prefix) {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`.replace(/[^A-Za-z0-9]/g, "");
}

export function rowsOf(body) {
  const b = body && typeof body === "object" ? body : {};
  return Array.isArray(b) ? b : Array.isArray(b.data) ? b.data : Array.isArray(b.items) ? b.items : Array.isArray(b.rows) ? b.rows : [];
}

/** Local time as the value a datetime-local input takes: YYYY-MM-DDTHH:mm. */
export function localInputValue(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const CHROME_ERRORS = /Official console JS did not boot|JSX console CONFIG was not exposed/i;
