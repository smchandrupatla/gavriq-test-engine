#!/usr/bin/env tsx
/**
 * Record agent — the host-side daemon that lets the Dockerized engine open a
 * real browser on the user's machine.
 *
 * On loop:
 *   1. Heartbeat the engine, telling it which Playwright browsers are
 *      installed on this host (chromium / firefox / webkit).
 *   2. Poll /api/v1/record/pending for a queued session. When one lands:
 *        a. Headless pre-visit of the start URL → snapshot of the page's
 *           visible-text (first ~500 chars) + title. That becomes the case's
 *           "pre-existing data" preconditions line.
 *        b. Spawn `playwright codegen --browser <b> --target playwright-test
 *           -o <tmp> <url>` on the user's machine; a real browser window
 *           opens on their screen.
 *        c. While codegen writes, tail the output file every 1s and post the
 *           parsed step preview back to the engine so the console shows the
 *           live step list growing.
 *        d. When the browser closes, replay the captured script in a
 *           headless browser and walk the DOM to collect visible-element
 *           properties (headings, buttons, links, labels, placeholders, aria,
 *           tooltips, viewport). Those become auto-assertion steps attached
 *           to the session so the committed case checks every element.
 *        e. POST /sessions/:id/finished with the raw script + the snapshot +
 *           the auto-assertion steps.
 *
 * The engine is otherwise completely passive — it never spawns a browser of
 * its own, and does not need a display.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, access, stat } from 'node:fs/promises';
import { tmpdir, hostname } from 'node:os';
import path from 'node:path';
import { chromium, firefox, webkit, type Page } from 'playwright';
import { parseCodegen, type RecordedStep } from '../../api/src/record/parser.js';

type Browser = 'chromium' | 'firefox' | 'webkit';
const ALL_BROWSERS: Browser[] = ['chromium', 'firefox', 'webkit'];
const ENGINE = (process.env.TEST_ENGINE_API || 'http://127.0.0.1:8797').replace(/\/+$/, '');
const POLL_MS = Number(process.env.RECORD_POLL_MS || 1000);
const TAIL_MS = Number(process.env.RECORD_TAIL_MS || 1000);
const AGENT_VERSION = '0.2.0';
// Density of auto-assertions: 'none' | 'landmarks' | 'all'. landmarks = h1-h6,
// buttons, links, inputs with aria-label/placeholder, elements with tooltips.
const DEFAULT_DENSITY = (process.env.RECORD_ASSERT_DENSITY || 'landmarks') as 'none' | 'landmarks' | 'all';

type EngineSession = {
  id: string;
  url: string;
  browser: Browser;
  application_key: string;
  state: string;
};

const engines = { chromium, firefox, webkit };

async function detectBrowsers(): Promise<Browser[]> {
  const found: Browser[] = [];
  for (const b of ALL_BROWSERS) {
    try {
      const p = engines[b].executablePath();
      if (!p) continue;
      await access(p);
      found.push(b);
    } catch { /* not installed */ }
  }
  return found;
}

async function post(p: string, body: unknown): Promise<any> {
  const r = await fetch(ENGINE + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const text = await r.text();
  if (!r.ok) throw new Error(`POST ${p} → ${r.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : {};
}
async function get(p: string): Promise<{ status: number; data?: any }> {
  const r = await fetch(ENGINE + p);
  if (r.status === 204) return { status: 204 };
  const text = await r.text();
  if (!r.ok) throw new Error(`GET ${p} → ${r.status}: ${text.slice(0, 400)}`);
  return { status: r.status, data: JSON.parse(text) };
}

let installedBrowsers: Browser[] = [];
async function heartbeat(): Promise<void> {
  try {
    await post('/api/v1/record/agent', { browsers: installedBrowsers, version: AGENT_VERSION, machine: hostname() });
  } catch (err) {
    console.warn('[record-agent] heartbeat failed:', (err as Error).message);
  }
}

async function captureStartSnapshot(browser: Browser, url: string) {
  const b = await engines[browser].launch({ headless: true }).catch(() => null);
  if (!b) return undefined;
  try {
    const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const title = await page.title().catch(() => '');
    const body = (await page.locator('body').innerText().catch(() => '')) || '';
    const summary = body.replace(/\s+/g, ' ').trim().slice(0, 500);
    return { title, summary, capturedAt: new Date().toISOString() };
  } catch {
    return undefined;
  } finally {
    await b.close().catch(() => undefined);
  }
}

/**
 * After codegen exits, replay the recorded actions in headless and walk the
 * DOM at the final state to collect visible-element properties. Each becomes
 * an assert-step so the committed case checks everything on the screen.
 */
async function generateAutoAssertions(browser: Browser, script: string, density: 'none' | 'landmarks' | 'all'): Promise<RecordedStep[]> {
  if (density === 'none') return [];
  const parsed = parseCodegen(script);
  if (!parsed.startUrl) return [];
  const b = await engines[browser].launch({ headless: true }).catch(() => null);
  if (!b) return [];
  try {
    const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
    await replayHeadless(page, parsed.steps);
    const scraped = await scrapeAssertions(page, density);
    return scraped;
  } catch (err) {
    console.warn('[record-agent] auto-assertion pass failed:', (err as Error).message);
    return [];
  } finally {
    await b.close().catch(() => undefined);
  }
}

async function replayHeadless(page: Page, steps: RecordedStep[]): Promise<void> {
  for (const s of steps) {
    try {
      if (s.action === 'navigate' && s.value) await page.goto(s.value, { waitUntil: 'domcontentloaded', timeout: 15_000 });
      else if (s.action === 'click' && s.selector) await page.locator(s.selector).first().click({ timeout: 5_000 });
      else if (s.action === 'click_text' && s.value) await page.getByText(s.value, { exact: false }).first().click({ timeout: 5_000 });
      else if (s.action === 'type' && s.selector) await page.locator(s.selector).first().fill(s.value || '', { timeout: 5_000 });
      else if (s.action === 'select' && s.selector) await page.locator(s.selector).first().selectOption(s.value || '', { timeout: 5_000 });
      else if (s.action === 'wait_for' && s.selector) await page.waitForSelector(s.selector, { timeout: 5_000 });
      else if (s.action === 'wait' && s.value) await page.waitForTimeout(Number(s.value) || 500);
    } catch { /* skip failures; the final page state is good enough */ }
  }
}

async function scrapeAssertions(page: Page, density: 'landmarks' | 'all'): Promise<RecordedStep[]> {
  const url = page.url();
  const title = await page.title().catch(() => '');
  const viewport = page.viewportSize() || { width: 1280, height: 800 };

  const assertions: RecordedStep[] = [];
  // Fixed assertions: current URL + title + no horizontal overflow.
  if (title) {
    assertions.push({
      action: 'assert_title',
      expected: `The browser tab title contains “${title}”.`,
      must_contain: title,
      text: `Check that the browser tab shows the title “${title}”.`,
    } as RecordedStep & { must_contain: string });
  }

  // Visible elements: text + properties.
  // The evaluate body is a string, not a TS arrow, so tsx's injected helpers
  // (like __name) do not leak into the browser context and break the scan.
  type Scraped = { role: string; name: string; text: string | null; placeholder: string | null; title: string | null; href: string | null; testid: string | null };
  const selectors = density === 'all'
    ? 'h1,h2,h3,h4,h5,h6,button,a[href],[role=button],[role=link],[role=heading],[role=tab],[aria-label],[title],[placeholder],[data-testid],input,textarea,select,label'
    : 'h1,h2,h3,h4,h5,h6,button,a[href],[role=button],[role=heading],[aria-label],[title],[placeholder],input[type=text],input[type=email],input[type=password],input[type=search],textarea';
  const scrapeBody = `(() => {
    var out = [];
    function trim(s) { return (s || '').replace(/\\s+/g, ' ').trim(); }
    function isVisible(el) {
      var r = el.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      var style = getComputedStyle(el);
      if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
      return true;
    }
    var nodes = Array.prototype.slice.call(document.querySelectorAll(${JSON.stringify(selectors)}));
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (!isVisible(el)) continue;
      var role = el.getAttribute('role') || el.tagName.toLowerCase();
      var text = trim(el.innerText || el.textContent);
      var placeholder = el.placeholder || null;
      var titleAttr = el.getAttribute('title');
      var href = el.href || null;
      var testid = el.getAttribute('data-testid');
      var name = trim(el.getAttribute('aria-label') || text || placeholder || titleAttr || '');
      if (!name) continue;
      out.push({ role: role, name: name, text: text || null, placeholder: placeholder, title: titleAttr, href: href, testid: testid });
    }
    return out;
  })()`;
  const rows: Scraped[] = await page.evaluate(scrapeBody);

  const seen = new Set<string>();
  for (const r of rows as Scraped[]) {
    const key = `${r.role}|${r.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const label = `${r.role} “${r.name}”`;
    const selector = r.testid
      ? `[data-testid=${JSON.stringify(r.testid)}]`
      : r.role === 'link' && r.href
        ? `a[href=${JSON.stringify(new URL(r.href, url).pathname)}]`
        : `role=${r.role}[name=${JSON.stringify(r.name)}]`;
    assertions.push({
      action: 'assert_selector_text',
      selector,
      expected: `The ${label} is visible with its recorded text.`,
      must_contain: r.name.slice(0, 80),
      text: `Check that the ${label} is still on the page.`,
    } as RecordedStep & { must_contain: string });
    if (r.placeholder) {
      assertions.push({
        action: 'assert_selector_text',
        selector: `[placeholder=${JSON.stringify(r.placeholder)}]`,
        expected: `A field with placeholder “${r.placeholder}” is on the page.`,
        must_contain: r.placeholder,
        text: `Check that a field with the placeholder “${r.placeholder}” is still on the page.`,
      } as RecordedStep & { must_contain: string });
    }
  }

  // Viewport check — the responsive layout must not overflow sideways at the recorded size.
  assertions.push({
    action: 'assert_no_horizontal_overflow',
    expected: `The page does not scroll sideways at ${viewport.width}px.`,
    text: `Check that the page does not force horizontal scrolling at ${viewport.width}px.`,
  });

  return assertions;
}

async function tailOutput(sessionId: string, outFile: string): Promise<() => void> {
  let stopped = false;
  let lastSize = 0;
  const tick = async () => {
    if (stopped) return;
    try {
      const st = await stat(outFile).catch(() => null);
      if (st && st.size > lastSize) {
        lastSize = st.size;
        const content = await readFile(outFile, 'utf8');
        const parsed = parseCodegen(content);
        const preview = parsed.steps.slice(-10).map((s) => ({ action: s.action, text: s.text }));
        await post(`/api/v1/record/sessions/${sessionId}/progress`, {
          state: 'recording',
          message: `${parsed.steps.length} step${parsed.steps.length === 1 ? '' : 's'} captured so far`,
          live_step_count: parsed.steps.length,
          live_steps: preview,
        }).catch(() => undefined);
      }
    } catch { /* ignore */ }
  };
  const h = setInterval(tick, TAIL_MS);
  return () => { stopped = true; clearInterval(h); };
}

async function runSession(s: EngineSession): Promise<void> {
  console.log(`[record-agent] session ${s.id.slice(0, 8)}: ${s.browser} ${s.url}`);
  await post(`/api/v1/record/sessions/${s.id}/progress`, { state: 'launching', message: `Pre-visiting ${s.url} in headless ${s.browser} to snapshot the starting page` });
  const snapshot = await captureStartSnapshot(s.browser, s.url);

  const dir = await mkdtemp(path.join(tmpdir(), 'record-agent-'));
  const outFile = path.join(dir, 'recording.ts');
  const args = ['playwright', 'codegen', `--browser=${s.browser}`, '--target=playwright-test', '-o', outFile, s.url];

  await post(`/api/v1/record/sessions/${s.id}/progress`, { state: 'recording', message: `Window open — drive the ${s.browser} browser` });
  const stopTail = await tailOutput(s.id, outFile);

  const child = spawn('npx', args, { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' });
  child.stdout.on('data', (buf: Buffer) => process.stdout.write(buf));
  child.stderr.on('data', (buf: Buffer) => process.stderr.write(buf));
  const exitCode: number | null = await new Promise((resolve) => {
    child.on('exit', (code) => resolve(code ?? 0));
    child.on('error', (err) => { console.error('[record-agent] spawn error:', err); resolve(-1); });
  });
  stopTail();

  let script = '';
  try { script = await readFile(outFile, 'utf8'); } catch { /* empty */ }

  if (!script && exitCode !== 0) {
    await post(`/api/v1/record/sessions/${s.id}/finished`, { error: `codegen exited with code ${exitCode}; no script written`, snapshot });
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
    return;
  }

  // Auto-assertion pass: headless replay + DOM scrape of the final page state.
  await post(`/api/v1/record/sessions/${s.id}/progress`, { state: 'recording', message: `Scanning the final page for elements to auto-assert (${DEFAULT_DENSITY})` }).catch(() => undefined);
  const autoAssertions = await generateAutoAssertions(s.browser, script, DEFAULT_DENSITY);

  await post(`/api/v1/record/sessions/${s.id}/finished`, { output: script, snapshot, auto_assertions: autoAssertions });
  await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  console.log(`[record-agent] session ${s.id.slice(0, 8)}: finished (${script.length} chars, ${autoAssertions.length} auto-assertions)`);
}

let busy = false;
async function pollOnce(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    const res = await get('/api/v1/record/pending');
    if (res.status === 204 || !res.data?.data) return;
    const s = res.data.data as EngineSession;
    await runSession(s).catch((err) => console.error('[record-agent] session error:', (err as Error).message));
  } catch (err) {
    console.warn('[record-agent] poll failed:', (err as Error).message);
  } finally {
    busy = false;
  }
}

// Playwright emits navigation errors from inside internal event emitters that
// Node sometimes sees as unhandled, even when our try/catch has them covered.
// Treat those as a logged warning instead of crashing the agent.
process.on('unhandledRejection', (err) => {
  console.warn('[record-agent] unhandled rejection:', (err as Error)?.message || err);
});
process.on('uncaughtException', (err) => {
  console.warn('[record-agent] uncaught exception:', (err as Error)?.message || err);
});

async function main() {
  installedBrowsers = await detectBrowsers();
  console.log(`[record-agent] host=${hostname()} engine=${ENGINE} browsers=${installedBrowsers.join(',') || '(none)'} density=${DEFAULT_DENSITY}`);
  if (!installedBrowsers.length) console.warn('[record-agent] no Playwright browsers found. Install with: npx playwright install');

  await heartbeat();
  // Keep the event loop alive. Do NOT .unref() — the infra-agent spawns us
  // with stdin ignored, so stdin.resume() cannot keep us running; the two
  // intervals below are the only reason we stay up.
  setInterval(heartbeat, 5000);
  setInterval(pollOnce, POLL_MS);
}

main().catch((err) => { console.error(err); process.exit(1); });
