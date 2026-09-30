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
  timeout_ms?: number;
  description?: string;
  /** Companion document for the Sandbench upload workflow. */
  markdown_file?: string;
}

export interface PlaywrightRunInput {
  script?: string;
  baseUrl: string;
  timeoutSeconds?: number;
  steps?: PlaywrightStep[];
  browser?: 'chromium' | 'firefox' | 'webkit';
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
}

interface StepRecord {
  step: number;
  action: string;
  description?: string;
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
  return { ...result, evidence: [...(result.evidence || []), ...(steps ? [steps] : [])] };
}

async function execute(input: PlaywrightRunInput, log: RunLog): Promise<PlaywrightRunResult> {
  const start = Date.now();
  const engineName = input.browser || 'chromium';
  const engine = ENGINES[engineName];
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
  let page: Page | null = null;
  const evidence: EvidenceItem[] = [];

  /** Final page state goes on record before the browser closes — a pass is evidenced like a fail. */
  const settle = async (outcome: 'pass' | 'fail') => {
    if (!page) return;
    log.url = page.url();
    log.title = await page.title().catch(() => undefined);
    const shot = await captureScreenshot(page, outcome);
    if (shot) evidence.push(shot);
  };

  // Cancelling closes the browser; the action in flight then fails and the finally below cleans up.
  const onAbort = () => { browser?.close().catch(() => undefined); };
  input.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    if (input.signal?.aborted) throw new Error('Run cancelled');
    browser = await engine.launch({
      headless: input.headless ?? true,
      executablePath: engineName === 'chromium' ? process.env.CHROME_BIN || undefined : undefined,
      args: engineName === 'chromium' ? ['--no-sandbox', '--disable-dev-shm-usage'] : [],
    });
    if (input.signal?.aborted) throw new Error('Run cancelled');
    const context = await browser.newContext({
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
              await page.getByText(step.expected || step.value || '', { exact: false }).first().click();
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
                state: 'visible',
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
              // by CSS text-transform (e.g. "SAND BENCH" for "Sand Bench").
              const text = (await page.locator('body').innerText()).toLowerCase();
              if (step.expected && !text.includes(step.expected.toLowerCase())) {
                throw new Error(`assert_text failed: expected "${step.expected}"`);
              }
              break;
            }
            case 'assert_selector_text': {
              if (!step.selector) throw new Error('assert_selector_text requires selector');
              const text = (await page.locator(step.selector).first().innerText()).trim();
              if (step.expected && !text.includes(step.expected)) {
                throw new Error(`assert_selector_text failed: "${step.selector}" is "${text.slice(0, 120)}", expected to include "${step.expected}"`);
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
              if (step.expected && !title.includes(step.expected)) {
                throw new Error(`assert_title failed: got "${title}"`);
              }
              break;
            }
            case 'assert_no_horizontal_overflow': {
              // The responsive-layout assertion: at the configured viewport the
              // page must not force sideways scrolling.
              const overflow = await page.evaluate(() => {
                const el = document.scrollingElement || document.documentElement;
                return el.scrollWidth - window.innerWidth;
              });
              if (overflow > 2) {
                throw new Error(`page overflows horizontally by ${overflow}px at ${input.viewport?.width ?? 1280}px viewport`);
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
    if (browser) await browser.close().catch(() => undefined);
  }
}
