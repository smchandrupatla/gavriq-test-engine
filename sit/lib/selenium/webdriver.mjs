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

export async function openSession() {
  const value = await wd("POST", "/session", {
    capabilities: {
      alwaysMatch: {
        browserName: "chrome",
        "goog:chromeOptions": {
          args: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
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

export async function withBrowser(fn) {
  const ready = await seleniumReady();
  if (!ready) {
    return { skipped: true, reason: `Selenium not reachable at ${seleniumUrl()}. Start profile selenium.` };
  }
  const id = await openSession();
  const sess = session(id);
  try {
    return { skipped: false, result: await fn(sess) };
  } finally {
    await closeSession(id);
  }
}
