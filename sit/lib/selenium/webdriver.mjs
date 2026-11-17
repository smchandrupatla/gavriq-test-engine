import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export function seleniumUrl() {
  return String(process.env.SIT_SELENIUM_URL || "http://127.0.0.1:4444").replace(/\/$/, "");
}

export function evidenceDir() {
  return process.env.SIT_EVIDENCE_DIR || path.resolve(process.cwd(), "sit/public/evidence");
}

export async function seleniumReady(timeoutMs = 1500) {
  try {
    const res = await fetch(`${seleniumUrl()}/status`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return false;
    const body = await res.json().catch(() => ({}));
    return Boolean(body.value?.ready || body.ready || res.ok);
  } catch {
    return false;
  }
}

async function wd(method, pathname, body) {
  const res = await fetch(`${seleniumUrl()}${pathname}`, {
    method,
    headers: { "content-type": "application/json", "cache-control": "no-cache" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.value?.error) {
    const msg = json.value?.message || json.value?.error || `webdriver ${res.status} ${pathname}`;
    throw new Error(msg);
  }
  return json.value;
}

// `prompts: true` leaves JavaScript dialogs (confirm/alert) open so the case can read and
// answer them with acceptAlert()/dismissAlert(); the default keeps the driver's own
// dismiss-and-notify behaviour, which every existing case relies on.
export async function openSession({ prompts = false } = {}) {
  const value = await wd("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        ...(prompts ? { unhandledPromptBehavior: "ignore" } : {}),
        "goog:chromeOptions": {
          args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900",
            ...(process.env.BASELINE_CONTAINER === '1' ? ['--host-resolver-rules=MAP unpkg.com ~NOTFOUND'] : [])],
        },
      },
    },
  });
  const id = value.sessionId || value;
  return typeof id === "string" ? id : value.sessionId;
}

export async function closeSession(id) {
  if (!id) return;
  try { await wd("DELETE", `/session/${id}`); } catch { /* ignore */ }
}

const ELEMENT_KEY = "element-6066-11e4-a52e-4f735466cecf";
function refArg(arg) {
  return arg && typeof arg === "object" && typeof arg.el === "string" ? { [ELEMENT_KEY]: arg.el } : arg;
}

export function session(id) {
  const base = `/session/${id}`;
  return {
    id,
    async go(url) { await wd("POST", `${base}/url`, { url }); },
    async source() { return wd("GET", `${base}/source`); },
    async title() { return wd("GET", `${base}/title`); },
    async url() { return wd("GET", `${base}/url`); },
    async find(using, value) {
      try {
        const el = await wd("POST", `${base}/element`, { using, value });
        return el[Object.keys(el)[0]] || el.ELEMENT;
      } catch { return null; }
    },
    async finds(using, value) {
      try {
        const list = await wd("POST", `${base}/elements`, { using, value });
        return (list || []).map((el) => el[Object.keys(el)[0]] || el.ELEMENT);
      } catch { return []; }
    },
    async click(el) { await wd("POST", `${base}/element/${el}/click`, {}); },
    async clear(el) { await wd("POST", `${base}/element/${el}/clear`, {}); },
    async type(el, text) {
      await wd("POST", `${base}/element/${el}/value`, { text: String(text), value: String(text).split("") });
    },
    async text(el) { return wd("GET", `${base}/element/${el}/text`); },
    async shot() { return wd("GET", `${base}/screenshot`); },
    // Runs a script in the page. Element ids returned by find()/finds() are passed as
    // { el: id } and reach the script as the real DOM node (see flow.mjs).
    async exec(script, args = []) { return wd("POST", `${base}/execute/sync`, { script, args: args.map(refArg) }); },
    async execAsync(script, args = []) { return wd("POST", `${base}/execute/async`, { script, args: args.map(refArg) }); },
    async attr(el, name) { return wd("GET", `${base}/element/${el}/attribute/${encodeURIComponent(name)}`); },
    async prop(el, name) { return wd("GET", `${base}/element/${el}/property/${encodeURIComponent(name)}`); },
    async displayed(el) { return wd("GET", `${base}/element/${el}/displayed`); },
    async enabled(el) { return wd("GET", `${base}/element/${el}/enabled`); },
    async selected(el) { return wd("GET", `${base}/element/${el}/selected`); },
    async alertText() { return wd("GET", `${base}/alert/text`); },
    async acceptAlert() { await wd("POST", `${base}/alert/accept`, {}); },
    async dismissAlert() { await wd("POST", `${base}/alert/dismiss`, {}); },
    async back() { await wd("POST", `${base}/back`, {}); },
    async refresh() { await wd("POST", `${base}/refresh`, {}); },
    async setWindowSize(width, height) { await wd("POST", `${base}/window/rect`, { width, height }); },
  };
}

function safe(name) {
  return String(name || "shot").replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80);
}

export async function saveShot(sess, name) {
  const dir = evidenceDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${safe(name)}.png`);
  try {
    const b64 = await sess.shot();
    await writeFile(file, Buffer.from(b64, "base64"));
    return file;
  } catch (err) {
    const note = path.join(dir, `${safe(name)}.error.txt`);
    await writeFile(note, String(err.message || err));
    return note;
  }
}

export async function recordSkip(name, reason) {
  const dir = evidenceDir();
  await mkdir(dir, { recursive: true });
  const file = path.join(dir, `${safe(name)}.skipped.json`);
  await writeFile(file, JSON.stringify({ name, reason, at: new Date().toISOString() }, null, 2));
  return file;
}

/** @typedef {ReturnType<typeof session>} Session */

/**
 * Run `fn` in a fresh WebDriver session, or report a skip when Selenium is down.
 * @template T
 * @param {(sess: Session) => Promise<T>} fn
 * @returns {Promise<{ skipped: true, reason: string } | { skipped: false, result: T }>}
 */
export async function withBrowser(fn, options = {}) {
  const ready = await seleniumReady();
  if (!ready) {
    return { skipped: true, reason: `Selenium not reachable at ${seleniumUrl()}. Start profile selenium.` };
  }
  const id = await openSession(options);
  const sess = session(id);
  try {
    return { skipped: false, result: await fn(sess) };
  } finally {
    await closeSession(id);
  }
}
