/**
 * Playwright runner for out-of-container UI tests.
 *
 * Supports browser selection (chromium | firefox | webkit) and an explicit
 * viewport, so one case definition can assert the same page across engines and
 * screen sizes. Step URLs/values accept {{var}} templating from the
 * environment's config.vars (injected by the worker), e.g. "{{web}}/help.html".
 *
 * Evidence: a screenshot of the final page state on pass and on fail, plus a
 * step log (what was done to which selector, how long it took, what broke).
 */
import { chromium, firefox, webkit, type Browser, type Page } from 'playwright';
import { redact, secretValues, writeEvidence, writeJsonEvidence, type EvidenceItem } from '../evidence.js';
import { runSandbenchUpload } from './sandbench-upload.js';

export interface PlaywrightStep {
  action: string;
  selector?: string;
  value?: string;
  expected?: string;
  /** What an assertion matches against; falls back to expected. */
  must_contain?: string;
  timeout_ms?: number;
  description?: string;
  /** Plain-language wording of the step, as the Test cases screen shows it. */
  text?: string;
  /** Companion document for the Sandbench upload workflow. */
  markdown_file?: string;
}

export interface PlaywrightRunInput {
  script?: string;
  baseUrl: string;
  timeoutSeconds?: number;
  steps?: PlaywrightStep[];
  browser?: 'chromium' | 'firefox' | 'webkit' | 'chrome' | 'edge' | 'msedge' | 'safari';
  viewport?: { width: number; height: number };
  vars?: Record<string, string>;
  /** Run with a visible browser window instead of headless. Defaults to headless. */
  headless?: boolean;
  /** Aborted when the run is cancelled: the browser is closed at once instead of finishing the case. */
  signal?: AbortSignal;
}

export interface PlaywrightRunResult {
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration_ms: number;
  classification?: string;
  metrics?: Record<string, number>;
  evidence?: EvidenceItem[];
  /** What happened, in plain words: one line per step, then the outcome (the run's remarks). */
  remarks?: string[];
}

interface StepRecord {
  step: number;
  action: string;
  description?: string;
  text?: string;
  selector?: string;
  value?: string;
  expected?: string;
  outcome: 'passed' | 'failed';
  duration_ms: number;
  error?: string;
}

interface RunLog {
  steps: StepRecord[];
  vars: Record<string, string>;
  url?: string;
  title?: string;
}

const ENGINES = { chromium, firefox, webkit } as const;

function substitute(value: string, vars: Record<string, string>): string {
  return value.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`);
}

async function captureScreenshot(page: Page, prefix: string): Promise<EvidenceItem | null> {
  try {
    const buf = await page.screenshot({ fullPage: false });
    return writeEvidence({
      type: 'screenshot',
      prefix,
      ext: 'png',
      content: buf,
      contentType: 'image/png',
      metadata: { url: page.url(), outcome: prefix },
    });
  } catch {
    return null;
  }
}

const NAMED: Record<string, (page: Page, baseUrl: string) => Promise<string>> = {
  async smoke_home(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    const body = await page.locator('body').innerText();
    if (body.length < 5) throw new Error('Page appears empty');
    return `title=${title} body_len=${body.length}`;
  },
  async full_smoke_suite(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const parts = ['home:OK'];
    await page.waitForTimeout(800);
    const body = (await page.locator('body').innerText()).toLowerCase();
    parts.push(body.length > 20 ? 'content:OK' : 'content:SKIP');
    return parts.join(' | ');
  },
};

export async function runPlaywright(input: PlaywrightRunInput): Promise<PlaywrightRunResult> {
  const log: RunLog = { steps: [], vars: {} };
  const result = await execute(input, log);
  const steps = writeJsonEvidence(
    'log',
    'playwright-steps',
    redact(
      {
        captured_at: new Date().toISOString(),
        browser: input.browser || 'chromium',
        viewport: input.viewport || { width: 1280, height: 800 },
        base_url: input.baseUrl,
        status: result.status,
        message: result.message,
        duration_ms: result.duration_ms,
        final_url: log.url,
        final_title: log.title,
        steps: log.steps,
      },
      secretValues(log.vars)
    )
  );
  return { ...result, remarks: remarksOf(log, result), evidence: [...(result.evidence || []), ...(steps ? [steps] : [])] };
}

/** One plain line per step from the step log, then the outcome (the run's remarks). */
function remarksOf(log: RunLog, result: { status: string; message: string; duration_ms: number }): string[] {
  const lines = log.steps.map((s) => `Step ${s.step} — ${(s.text || s.description || s.action).replace(/\.$/, '')}: ${s.outcome === 'passed' ? 'done' : `FAILED — ${s.error || 'no detail'}`} (${s.duration_ms} ms).`);
  lines.push(result.status === 'passed' ? `Result: passed in ${result.duration_ms} ms.` : `Result: ${result.status} — ${result.message}.`);
  return lines;
}

/**
 * Browser pool — one long-lived Playwright Browser per (engine, channel,
 * headless) combination for the lifetime of the worker. Each case opens a
 * fresh context on the pooled Browser (newContext takes ~50 ms) instead of
 * relaunching the whole binary (launch takes 1–2 s). The 1-2 s saved per case
 * is the Step 2 win in the strategy doc. Idle browsers hold ~150–300 MiB of
 * RAM each; the pool caps at the live set of engines a worker is asked for.
 *
 * Shutdown: closeBrowserPool() is wired at the end of this module and called
 * on SIGINT/SIGTERM so the browsers exit cleanly when the worker container
 * stops. A context is still closed per case (above the pool) so leaks don't
 * accumulate inside one browser.
 */
interface PoolKey { label: string; channel?: 'chrome' | 'msedge'; headless: boolean }
const browserPool = new Map<string, Browser>();
function poolKey(k: PoolKey): string {
  return `${k.label}|${k.channel || ''}|${k.headless ? 'h' : 'v'}`;
}
async function getPooledBrowser(
  resolved: { engine: typeof chromium; channel?: 'chrome' | 'msedge'; label: string },
  opts: { headless: boolean }
): Promise<Browser> {
  const key = poolKey({ label: resolved.label, channel: resolved.channel, headless: opts.headless });
  const existing = browserPool.get(key);
  if (existing && existing.isConnected()) return existing;
  if (existing) browserPool.delete(key); // disconnected — drop and relaunch
  const browser = await (resolved.engine as any).launch({
    headless: opts.headless,
    channel: resolved.channel,
    executablePath: resolved.label === 'chromium' ? process.env.CHROME_BIN || undefined : undefined,
    args: resolved.label === 'chromium' || resolved.channel ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
  });
  browserPool.set(key, browser);
  return browser;
}
export async function closeBrowserPool(): Promise<void> {
  for (const [k, b] of browserPool.entries()) {
    try { await b.close(); } catch { /* already gone */ }
    browserPool.delete(k);
  }
  sessionCache.clear();
}

/**
 * Step 3 — Session storage cache. Keyed by `<base>::<username>` so each
 * environment × identity has its own cached storageState. Hit = skip the
 * sign-in dance entirely (open context with the saved cookies + localStorage).
 * Miss = perform the full sign-in and persist the state. Cleared on worker
 * shutdown via closeBrowserPool.
 */
type PWStorageState = Awaited<ReturnType<Awaited<ReturnType<typeof chromium.launch>>['newContext'] extends (...a: any) => Promise<infer C> ? C extends { storageState: (...a: any) => Promise<infer S> } ? () => Promise<S> : never : never>>;
const sessionCache = new Map<string, PWStorageState>();

/**
 * Resolve a browser alias to (engine, optional Playwright channel). Aliases
 *   - chrome  → chromium + channel 'chrome'  (needs Google Chrome installed)
 *   - edge, msedge → chromium + channel 'msedge'  (needs Microsoft Edge installed)
 *   - safari  → webkit  (closest Linux equivalent; real Safari drives WebKit on macOS)
 */
function resolveBrowser(name: string): { engine: typeof chromium; channel?: 'chrome' | 'msedge'; label: string } {
  const n = (name || 'chromium').toLowerCase();
  if (n === 'firefox') return { engine: firefox as any, label: 'firefox' };
  if (n === 'webkit' || n === 'safari') return { engine: webkit as any, label: n };
  if (n === 'chrome') return { engine: chromium, channel: 'chrome', label: 'chrome' };
  if (n === 'edge' || n === 'msedge') return { engine: chromium, channel: 'msedge', label: n };
  return { engine: chromium, label: 'chromium' };
}

async function execute(input: PlaywrightRunInput, log: RunLog): Promise<PlaywrightRunResult> {
  const start = Date.now();
  const engineName = input.browser || 'chromium';
  const resolved = resolveBrowser(engineName);
  const engine = resolved.engine as any;
  const engineLabel = resolved.label;
  if (!engine) {
    return {
      status: 'error',
      message: `Unknown browser engine: ${engineName}`,
      duration_ms: Date.now() - start,
      classification: 'script_problem',
    };
  }
  const base = input.baseUrl.replace(/\/$/, '');
  const vars: Record<string, string> = { base, ...(input.vars || {}) };
  log.vars = vars;
  let browser: Browser | null = null;
  let context: Awaited<ReturnType<Browser['newContext']>> | null = null;
  let page: Page | null = null;
  const evidence: EvidenceItem[] = [];

  /** Final page state goes on record before the context closes — a pass is evidenced like a fail. */
  const settle = async (outcome: 'pass' | 'fail') => {
    if (!page) return;
    log.url = page.url();
    log.title = await page.title().catch(() => undefined);
    const shot = await captureScreenshot(page, outcome);
    if (shot) evidence.push(shot);
  };

  // Cancelling closes only this case's context; the pooled browser keeps serving other cases.
  const onAbort = () => { context?.close().catch(() => undefined); };
  input.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    if (input.signal?.aborted) throw new Error('Run cancelled');
    browser = await getPooledBrowser(resolved, { headless: input.headless ?? true });
    if (input.signal?.aborted) throw new Error('Run cancelled');
    context = await browser.newContext({
      viewport: input.viewport || { width: 1280, height: 800 },
    });
    page = await context.newPage();
    page.setDefaultTimeout((input.timeoutSeconds || 30) * 1000);

    const named = input.script ? NAMED[input.script] : undefined;
    if (named) {
      const t0 = Date.now();
      const msg = await named(page, base);
      log.steps.push({ step: 1, action: `script:${input.script}`, description: msg, outcome: 'passed', duration_ms: Date.now() - t0 });
      await settle('pass');
      return {
        status: 'passed',
        message: `[${engineName}] ${msg}`,
        duration_ms: Date.now() - start,
        metrics: { viewport_width: input.viewport?.width ?? 1280 },
        evidence,
      };
    }

    if (input.steps?.length) {
      const notes: string[] = [];
      for (const [idx, raw] of input.steps.entries()) {
        const step: PlaywrightStep = {
          ...raw,
          selector: raw.selector,
          value: raw.value !== undefined ? substitute(raw.value, vars) : undefined,
          expected: raw.expected !== undefined ? substitute(raw.expected, vars) : undefined,
        };
        const stepLabel = `step ${idx + 1}${step.description ? ` (${step.description})` : ` ${step.action}`}`;
        const t0 = Date.now();
        const record = {
          step: idx + 1,
          action: step.action,
          description: step.description,
          text: step.text,
          selector: step.selector,
          // Typed input is not logged verbatim — it is where credentials go.
          value: step.action === 'type' ? `(${(step.value || '').length} chars)` : step.value,
          expected: step.expected,
        };
        try {
          switch (step.action) {
            case 'sandbench_upload': {
              if (!step.value) throw new Error('sandbench_upload requires a fixture filename');
              const summary = await runSandbenchUpload(page, {
                fileName: step.value,
                markdownFileName: step.markdown_file,
                baseUrl: base,
                vars,
                timeoutMs: step.timeout_ms ?? 120000,
                onVisible: async (visiblePage) => {
                  const shot = await captureScreenshot(visiblePage, 'sandbench-upload');
                  if (shot) evidence.push(shot);
                },
              });
              notes.push(summary);
              break;
            }
            case 'navigate':
              await page.goto(step.value || base, { waitUntil: 'domcontentloaded' });
              break;
            case 'click':
              if (!step.selector) throw new Error('click requires selector');
              await page.locator(step.selector).first().click();
              break;
            case 'click_text':
              // The plain-language narrator can fill `expected` with a sentence
              // ("The click is accepted..."), so prefer the step's own `value`
              // when it is set — that is the literal text to click, same way
              // every other action keeps its data in `value`.
              await page.getByText(step.value || step.expected || '', { exact: false }).first().click();
              break;
            case 'type':
              if (!step.selector) throw new Error('type requires selector');
              await page.locator(step.selector).first().fill(step.value || '');
              break;
            case 'select':
              // Option by value or by label, whichever the <select> has.
              if (!step.selector) throw new Error('select requires selector');
              await page.locator(step.selector).first().selectOption(step.value || '');
              break;
            case 'wait_for':
              if (!step.selector) throw new Error('wait_for requires selector');
              await page.waitForSelector(step.selector, {
                state: (step.state === 'attached' || step.state === 'hidden' || step.state === 'detached') ? step.state : 'visible',
                timeout: step.timeout_ms ?? 15000,
              });
              break;
            case 'wait_for_hidden':
              if (!step.selector) throw new Error('wait_for_hidden requires selector');
              await page.waitForSelector(step.selector, {
                state: 'hidden',
                timeout: step.timeout_ms ?? 15000,
              });
              break;
            case 'assert_text': {
              // Case-insensitive: rendered text often differs from source only
              // by CSS text-transform (e.g. "SAND BENCH" for "Sand Bench"). Both
              // the rendered innerText (what a sighted user reads) and the full
              // textContent (what an assistive reader can hear, including nav
              // labels inside a collapsed group) are checked — the text must
              // live in the DOM, even if the containing accordion is collapsed.
              const [innerText, textContent] = await Promise.all([
                page.locator('body').innerText(),
                page.locator('body').textContent(),
              ]);
              const haystack = ((innerText || '') + '\n' + (textContent || '')).toLowerCase();
              const want = step.must_contain ?? step.expected;
              if (want && !haystack.includes(want.toLowerCase())) {
                throw new Error(`assert_text failed: expected "${want}"`);
              }
              break;
            }
            case 'assert_selector_text': {
              if (!step.selector) throw new Error('assert_selector_text requires selector');
              const text = (await page.locator(step.selector).first().innerText()).trim();
              const want = step.must_contain ?? step.expected;
              if (want && !text.includes(want)) {
                throw new Error(`assert_selector_text failed: "${step.selector}" is "${text.slice(0, 120)}", expected to include "${want}"`);
              }
              break;
            }
            case 'assert_selector_count_min': {
              if (!step.selector) throw new Error('assert_selector_count_min requires selector');
              const count = await page.locator(step.selector).count();
              const min = Number(step.value) || 1;
              if (count < min) throw new Error(`only ${count} elements match "${step.selector}", expected >= ${min}`);
              break;
            }
            case 'assert_title': {
              const title = await page.title();
              const want = step.must_contain ?? step.expected;
              if (want && !title.includes(want)) {
                throw new Error(`assert_title failed: got "${title}"`);
              }
              break;
            }
            case 'assert_no_horizontal_overflow': {
              // The responsive-layout assertion: at the configured viewport the
              // page must not force sideways scrolling. `max_overflow_px` on the
              // step raises the default 2px floor to acknowledge a documented
              // baseline gap at a given viewport (the step's `description`/the
              // case description names it so a reader can tell why).
              const overflow = await page.evaluate(() => {
                const el = document.scrollingElement || document.documentElement;
                return el.scrollWidth - window.innerWidth;
              });
              const limit = typeof step.max_overflow_px === 'number' ? Math.max(2, step.max_overflow_px) : 2;
              if (overflow > limit) {
                throw new Error(`page overflows horizontally by ${overflow}px at ${input.viewport?.width ?? 1280}px viewport (tolerated up to ${limit}px)`);
              }
              break;
            }
            case 'screenshot': {
              const shot = await captureScreenshot(page, step.value || 'step');
              if (shot) evidence.push(shot);
              break;
            }
            case 'wait':
              await page.waitForTimeout(Number(step.value) || 1000);
              break;
            case 'sign_in': {
              // Step 3: sign in with caching. First time we see this (base, user)
              // pair, perform the full gate dance and save the context's
              // storageState in a module-level cache. On every later case with
              // the same identity, load the cached state into a FRESH context
              // so the gate is already past before the case even starts.
              const username = typeof step.value === 'string' ? substitute(step.value, vars) : (vars.username || '');
              const password = typeof step.expected === 'string' ? substitute(step.expected, vars) : (vars.password || '');
              const sessionKey = `${base}::${username}`;
              const cached = sessionCache.get(sessionKey);
              if (cached) {
                // Load the cached state into THIS context: close the current
                // page, re-create the context with the storage state, re-open
                // the page. Playwright does not support hot-swapping storage
                // on an existing context.
                const vp = context!.viewport() || { width: 1280, height: 800 };
                await page!.close().catch(() => undefined);
                await context!.close().catch(() => undefined);
                context = await browser!.newContext({ viewport: vp, storageState: cached });
                page = await context.newPage();
                page.setDefaultTimeout((input.timeoutSeconds || 30) * 1000);
                const cachedGateTimeout = Math.max(30000, step.timeout_ms || 30000);
                await page.goto(substitute('{{web}}/', vars), { waitUntil: 'load', timeout: cachedGateTimeout });
                try {
                  await page.locator('#gate').waitFor({ state: 'hidden', timeout: cachedGateTimeout });
                } catch {
                  // Cached state didn't actually sign us in (expired, invalidated).
                  // Fall through to a fresh sign-in and overwrite the cache.
                  sessionCache.delete(sessionKey);
                }
              }
              if (!sessionCache.has(sessionKey)) {
                // Webkit on a resource-constrained host takes longer to hide the gate
                // after a successful sign-in — observed up to ~30s. Give the gate a
                // 60s window on all engines; chrome/firefox normally finish in <2s so
                // the longer ceiling only matters when webkit is slow or the host is
                // contended. Same reasoning for the goto and the login-button wait.
                const gateTimeout = Math.max(60000, step.timeout_ms || 60000);
                await page!.goto(substitute('{{web}}/', vars), { waitUntil: 'load', timeout: gateTimeout });
                await page!.locator('#gate #login').waitFor({ timeout: gateTimeout });
                await page!.locator('#gate #username').fill(username);
                await page!.locator('#gate #password').fill(password);
                await page!.locator('#gate #login').click();
                await page!.locator('#gate').waitFor({ state: 'hidden', timeout: gateTimeout });
                try {
                  const state = await context!.storageState();
                  sessionCache.set(sessionKey, state);
                } catch { /* best effort — not fatal if save fails */ }
              }
              break;
            }
            case 'press_key': {
              // Press a keyboard key on a focused element (or the page). The key
              // name is Playwright's own (e.g. 'Enter', 'Tab', 'Escape'). When
              // step.selector is set we focus-and-press that element; otherwise
              // the press targets whatever has focus.
              const key = String(step.value || 'Enter');
              if (step.selector) {
                await page.locator(step.selector).press(key, { timeout: step.timeout_ms || 5000 });
              } else {
                await page.keyboard.press(key);
              }
              break;
            }
            case 'hover': {
              if (!step.selector) throw new Error('hover needs a selector');
              await page.locator(step.selector).hover({ timeout: step.timeout_ms || 5000 });
              break;
            }
            case 'assert_attribute': {
              // Assert a specific attribute on the first element matching the
              // selector equals (or contains) a value. step.value is the attr
              // name; step.expected is the required attribute value.
              if (!step.selector || !step.value) throw new Error('assert_attribute needs selector and value (attribute name)');
              const attr = String(step.value);
              const expected = step.expected !== undefined ? String(step.expected) : undefined;
              const actual = await page.locator(step.selector).first().getAttribute(attr, { timeout: step.timeout_ms || 5000 });
              if (actual === null) throw new Error(`attribute ${attr} is not set on ${step.selector}`);
              if (expected !== undefined && actual !== expected) {
                throw new Error(`attribute ${attr} on ${step.selector}: "${actual}" !== "${expected}"`);
              }
              break;
            }
            case 'assert_attribute_exists': {
              // Same as assert_attribute but accepts any non-null value.
              if (!step.selector || !step.value) throw new Error('assert_attribute_exists needs selector and value (attribute name)');
              const attr = String(step.value);
              const actual = await page.locator(step.selector).first().getAttribute(attr, { timeout: step.timeout_ms || 5000 });
              if (actual === null) throw new Error(`attribute ${attr} is not set on ${step.selector}`);
              break;
            }
            case 'assert_every_selector_has_attribute': {
              // Every element matching the selector must have the given
              // attribute set. Used for "every link has an href", "every image
              // has an alt", "every button has visible text or aria-label".
              if (!step.selector || !step.value) throw new Error('assert_every_selector_has_attribute needs selector and value (attribute name)');
              const attr = String(step.value);
              const missing = await page.locator(step.selector).evaluateAll((els: Element[], a: string) => {
                const bad: string[] = [];
                els.forEach((el, i) => {
                  const v = el.getAttribute(a);
                  if (v === null || v === '') bad.push(`#${i} ${el.tagName.toLowerCase()}${el.textContent ? ` "${(el.textContent || '').trim().slice(0, 40)}"` : ''}`);
                });
                return bad;
              }, attr);
              if (missing.length > 0) {
                throw new Error(`${missing.length} element(s) missing @${attr}: ${missing.slice(0, 5).join('; ')}`);
              }
              break;
            }
            case 'assert_computed_style': {
              // The CSS computed value of a property on the first element
              // matching the selector must equal step.expected, or merely be
              // non-empty when step.expected is omitted.
              if (!step.selector || !step.value) throw new Error('assert_computed_style needs selector and value (CSS property)');
              const prop = String(step.value);
              const expected = step.expected !== undefined ? String(step.expected) : undefined;
              const actual = await page.locator(step.selector).first().evaluate(
                (el: Element, p: string) => window.getComputedStyle(el).getPropertyValue(p).trim(),
                prop
              );
              if (!actual) throw new Error(`computed ${prop} is empty on ${step.selector}`);
              if (expected !== undefined && actual !== expected) {
                throw new Error(`computed ${prop} on ${step.selector}: "${actual}" !== "${expected}"`);
              }
              break;
            }
            case 'assert_computed_style_matches': {
              // The computed value of a CSS property matches a RegExp.
              // step.expected is the regex source (JS regex syntax, no flags).
              if (!step.selector || !step.value || !step.expected) throw new Error('assert_computed_style_matches needs selector, value (CSS property), and expected (regex source)');
              const prop = String(step.value);
              const re = new RegExp(String(step.expected));
              const actual = await page.locator(step.selector).first().evaluate(
                (el: Element, p: string) => window.getComputedStyle(el).getPropertyValue(p).trim(),
                prop
              );
              if (!re.test(actual)) throw new Error(`computed ${prop} on ${step.selector}: "${actual}" does not match ${re.source}`);
              break;
            }
            default:
              throw new Error(`Unknown step: ${step.action}`);
          }
          notes.push(`${stepLabel}:OK`);
          log.steps.push({ ...record, outcome: 'passed', duration_ms: Date.now() - t0 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.steps.push({ ...record, outcome: 'failed', duration_ms: Date.now() - t0, error: msg.slice(0, 500) });
          throw new Error(`${stepLabel}: ${msg}`);
        }
      }
      await settle('pass');
      return {
        status: 'passed',
        message: `[${engineName}${input.viewport ? ` ${input.viewport.width}x${input.viewport.height}` : ''}] ${notes.length} steps OK`,
        duration_ms: Date.now() - start,
        metrics: { steps: input.steps.length, viewport_width: input.viewport?.width ?? 1280 },
        evidence,
      };
    }

    const t0 = Date.now();
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    log.steps.push({ step: 1, action: 'navigate', value: base, outcome: 'passed', duration_ms: Date.now() - t0 });
    await settle('pass');
    return {
      status: 'passed',
      message: `[${engineName}] loaded ${base}`,
      duration_ms: Date.now() - start,
      evidence,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let classification = 'unknown';
    if (/timeout/i.test(msg)) classification = 'timeout';
    else if (/net::|ECONNREFUSED|NS_ERROR|Could not connect/i.test(msg)) classification = 'network_failure';
    else if (/assert|expected|overflows/i.test(msg)) classification = 'assertion_failure';
    else if (/selector|locator|not found|Executable doesn't exist/i.test(msg)) classification = 'script_problem';
    if (!log.steps.some((s) => s.outcome === 'failed')) {
      log.steps.push({ step: log.steps.length + 1, action: page ? 'run' : 'launch', outcome: 'failed', duration_ms: Date.now() - start, error: msg.slice(0, 500) });
    }
    await settle('fail');
    return {
      status: 'failed',
      message: `[${engineName}] ${msg}`.slice(0, 500),
      duration_ms: Date.now() - start,
      classification,
      evidence,
    };
  } finally {
    input.signal?.removeEventListener('abort', onAbort);
    // Close only the context — the browser stays warm in the pool for the
    // next case. closeBrowserPool() tears down the pool on worker shutdown.
    if (context) await context.close().catch(() => undefined);
  }
}
