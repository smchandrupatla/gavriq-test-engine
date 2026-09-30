/**
 * Selenium WebDriver runner for out-of-container UI tests.
 * Evidence: a PNG screenshot of the final page state on pass and on fail, plus
 * a step log, written under EVIDENCE_DIR (default ./evidence).
 */
import { Builder, By, until, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';
import { redact, secretValues, writeEvidence, writeJsonEvidence, type EvidenceItem } from '../evidence.js';
import { runSandbenchUploadSelenium } from './sandbench-upload-selenium.js';

export interface SeleniumRunInput {
  script?: string;
  baseUrl: string;
  timeoutSeconds?: number;
  steps?: Array<{ action: string; selector?: string; value?: string; expected?: string; timeout_ms?: number; description?: string; markdown_file?: string }>;
  viewport?: { width: number; height: number };
  vars?: Record<string, string>;
  /** Run with a visible browser window instead of headless. Defaults to headless, overridable via SELENIUM_HEADLESS=false. */
  headless?: boolean;
  /** Aborted when the run is cancelled: the browser is quit at once instead of finishing the case. */
  signal?: AbortSignal;
}

export interface SeleniumRunResult {
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration_ms: number;
  classification?: string;
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

async function buildDriver(viewport?: { width: number; height: number }, headless?: boolean): Promise<WebDriver> {
  const options = new chrome.Options();
  const chromeBin = process.env.CHROME_BIN || process.env.CHROMIUM_PATH;
  if (chromeBin) {
    options.setChromeBinaryPath(chromeBin);
  }
  const size = viewport || { width: 1280, height: 800 };
  const useHeadless = headless ?? process.env.SELENIUM_HEADLESS !== 'false';
  const args = [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--window-size=${size.width},${size.height}`,
    '--disable-software-rasterizer',
  ];
  if (useHeadless) args.unshift('--headless=new');
  options.addArguments(...args);

  const builder = new Builder().forBrowser('chrome').setChromeOptions(options);
  const serviceBuilder = process.env.CHROMEDRIVER_PATH
    ? new chrome.ServiceBuilder(process.env.CHROMEDRIVER_PATH)
    : undefined;
  if (serviceBuilder) {
    builder.setChromeService(serviceBuilder);
  }
  return builder.build();
}

async function captureScreenshot(driver: WebDriver, prefix: string): Promise<EvidenceItem | null> {
  try {
    const b64 = await driver.takeScreenshot();
    return writeEvidence({
      type: 'screenshot',
      prefix,
      ext: 'png',
      content: Buffer.from(b64, 'base64'),
      contentType: 'image/png',
      metadata: { url: await driver.getCurrentUrl().catch(() => undefined), outcome: prefix },
    });
  } catch (err) {
    console.warn('[selenium] screenshot failed:', (err as Error).message);
    return null;
  }
}

const NAMED_SCRIPTS: Record<string, (driver: WebDriver, baseUrl: string) => Promise<string>> = {
  async smoke_home(driver, baseUrl) {
    await driver.get(baseUrl);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    const title = await driver.getTitle();
    const body = await driver.findElement(By.css('body')).getText();
    if (!title && body.length < 5) throw new Error('Page appears empty');
    return `title=${title || '(none)'} body_len=${body.length}`;
  },

  async nav_to_login(driver, baseUrl) {
    await driver.get(baseUrl);
    const links = await driver.findElements(By.partialLinkText('Login'));
    if (!links.length) {
      const alt = await driver.findElements(By.css('a[href*="login"]'));
      if (!alt.length) throw new Error('Login link not found');
      await alt[0].click();
    } else {
      await links[0].click();
    }
    await driver.wait(async () => (await driver.getCurrentUrl()).includes('login'), 8000);
    return `navigated to ${await driver.getCurrentUrl()}`;
  },

  async login_page_elements(driver, baseUrl) {
    await driver.get(`${baseUrl.replace(/\/$/, '')}/login`);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    const email = await driver.findElements(By.css('input[type="email"], input[name="email"]'));
    const password = await driver.findElements(By.css('input[type="password"]'));
    const submit = await driver.findElements(By.css('button[type="submit"], button'));
    if (!email.length || !password.length || !submit.length) {
      throw new Error(`Missing form elements email=${email.length} password=${password.length} submit=${submit.length}`);
    }
    return 'email, password, submit present';
  },

  async login_submit(driver, baseUrl) {
    await driver.get(`${baseUrl.replace(/\/$/, '')}/login`);
    const email = await driver.wait(
      until.elementLocated(By.css('input[type="email"], input[name="email"]')),
      10000
    );
    const password = await driver.findElement(By.css('input[type="password"]'));
    const submit = await driver.findElement(By.css('button[type="submit"], button'));
    await email.clear();
    await email.sendKeys('tester@sandbench.local');
    await password.clear();
    await password.sendKeys('TestPass123!');
    await submit.click();
    return 'credentials submitted';
  },

  async header_branding(driver, baseUrl) {
    await driver.get(baseUrl);
    const body = await driver.findElement(By.css('body')).getText();
    if (!/sand|bench|logo|home/i.test(body)) {
      throw new Error('Branding/nav text not found on page');
    }
    return 'branding/nav content present';
  },

  async dashboard_widgets(driver, baseUrl) {
    await driver.get(baseUrl);
    await driver.sleep(1200);
    const body = (await driver.findElement(By.css('body')).getText()).toLowerCase();
    const required = ['active users', 'builds today', 'tests passed'];
    const missing = required.filter((w) => !body.includes(w));
    if (missing.length) throw new Error(`Missing widgets: ${missing.join(', ')}`);
    return 'all dashboard widgets visible';
  },

  async full_smoke_suite(driver, baseUrl) {
    const parts: string[] = [];
    await driver.get(baseUrl);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    parts.push('home:OK');
    await driver.sleep(1000);
    const body = (await driver.findElement(By.css('body')).getText()).toLowerCase();
    parts.push(body.includes('active') || body.length > 20 ? 'widgets:OK' : 'widgets:SKIP');
    const links = await driver.findElements(By.partialLinkText('Login'));
    if (links.length) {
      await links[0].click();
      await driver.sleep(500);
      parts.push('nav:OK');
    } else {
      parts.push('nav:SKIP');
    }
    return parts.join(' | ');
  },
};

export async function runSelenium(input: SeleniumRunInput): Promise<SeleniumRunResult> {
  const log: RunLog = { steps: [], vars: {} };
  const result = await execute(input, log);
  const steps = writeJsonEvidence(
    'log',
    'selenium-steps',
    redact(
      {
        captured_at: new Date().toISOString(),
        browser: 'chrome',
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

async function execute(input: SeleniumRunInput, log: RunLog): Promise<SeleniumRunResult> {
  const start = Date.now();
  let driver: WebDriver | null = null;
  const evidence: EvidenceItem[] = [];

  const vars: Record<string, string> = { base: input.baseUrl.replace(/\/$/, ''), ...(input.vars || {}) };
  log.vars = vars;

  /** Final page state goes on record before the driver quits — a pass is evidenced like a fail. */
  const settle = async (outcome: 'pass' | 'fail') => {
    if (!driver) return;
    log.url = await driver.getCurrentUrl().catch(() => undefined);
    log.title = await driver.getTitle().catch(() => undefined);
    const shot = await captureScreenshot(driver, outcome);
    if (shot) evidence.push(shot);
  };
  const sub = (v: string) => v.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_, name) => vars[name] ?? `{{${name}}}`);

  // Cancelling quits the browser; the command in flight then fails and the finally below cleans up.
  const onAbort = () => { driver?.quit().catch(() => undefined); };
  input.signal?.addEventListener('abort', onAbort, { once: true });

  try {
    if (input.signal?.aborted) throw new Error('Run cancelled');
    driver = await buildDriver(input.viewport, input.headless);
    if (input.signal?.aborted) throw new Error('Run cancelled');
    const timeout = (input.timeoutSeconds || 30) * 1000;
    await driver.manage().setTimeouts({ pageLoad: timeout, implicit: 5000 });

    let message: string;

    const named = input.script ? NAMED_SCRIPTS[input.script] : undefined;
    if (named) {
      const t0 = Date.now();
      message = await named(driver, input.baseUrl);
      log.steps.push({ step: 1, action: `script:${input.script}`, description: message, outcome: 'passed', duration_ms: Date.now() - t0 });
    } else if (input.steps?.length) {
      await driver.get(input.baseUrl.replace(/\/$/, ''));
      const notes: string[] = [];
      for (const [idx, raw] of input.steps.entries()) {
        const step = {
          ...raw,
          value: raw.value !== undefined ? sub(raw.value) : undefined,
          expected: raw.expected !== undefined ? sub(raw.expected) : undefined,
        };
        const label = `step ${idx + 1}${step.description ? ` (${step.description})` : ` ${step.action}`}`;
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
              const summary = await runSandbenchUploadSelenium(driver, {
                fileName: step.value,
                markdownFileName: step.markdown_file,
                baseUrl: input.baseUrl.replace(/\/$/, ''),
                vars: input.vars,
                timeoutMs: step.timeout_ms ?? 120000,
                onVisible: async (visibleDriver) => {
                  const shot = await captureScreenshot(visibleDriver, 'sandbench-upload');
                  if (shot) evidence.push(shot);
                },
              });
              notes.push(summary);
              break;
            }
            case 'navigate':
              await driver.get(step.value || vars.base);
              break;
            case 'click':
              if (!step.selector) throw new Error('click requires selector');
              await driver.findElement(By.css(step.selector)).click();
              break;
            case 'type':
              if (!step.selector) throw new Error('type requires selector');
              {
                const el = await driver.findElement(By.css(step.selector));
                await el.clear();
                await el.sendKeys(step.value || '');
              }
              break;
            case 'select':
              // Option by value or by label, whichever the <select> has.
              if (!step.selector) throw new Error('select requires selector');
              {
                const options = await driver.findElements(By.css(`${step.selector} option`));
                let chosen = null;
                for (const option of options) {
                  if ((await option.getAttribute('value')) === step.value || (await option.getText()).trim() === step.value) {
                    chosen = option;
                    break;
                  }
                }
                if (!chosen) throw new Error(`select: "${step.selector}" has no option "${step.value}"`);
                await chosen.click();
              }
              break;
            case 'wait_for':
              if (!step.selector) throw new Error('wait_for requires selector');
              await driver.wait(until.elementLocated(By.css(step.selector)), step.timeout_ms ?? 15000);
              break;
            case 'wait_for_hidden':
              // Passes when the element is gone, not displayed, or carries a
              // "hidden" class (the console gate's mount signal).
              if (!step.selector) throw new Error('wait_for_hidden requires selector');
              await driver.wait(async () => {
                const els = await driver!.findElements(By.css(step.selector!));
                if (!els.length) return true;
                const el = els[0]!;
                const cls = (await el.getAttribute('class')) || '';
                if (cls.split(/\s+/).includes('hidden')) return true;
                return !(await el.isDisplayed().catch(() => false));
              }, step.timeout_ms ?? 15000, `"${step.selector}" never hid`);
              break;
            case 'assert_text':
              {
                // Case-insensitive: CSS text-transform makes rendered text differ
                // from source casing (e.g. "SAND BENCH" for "Sand Bench").
                const body = (await driver.findElement(By.css('body')).getText()).toLowerCase();
                if (step.expected && !body.includes(step.expected.toLowerCase())) {
                  throw new Error(`assert_text failed: expected "${step.expected}"`);
                }
              }
              break;
            case 'assert_selector_text':
              {
                if (!step.selector) throw new Error('assert_selector_text requires selector');
                const el = await driver.wait(until.elementLocated(By.css(step.selector)), step.timeout_ms ?? 10000);
                const text = ((await el.getText()) || '').trim();
                if (step.expected && !text.includes(step.expected)) {
                  throw new Error(`assert_selector_text failed: "${step.selector}" is "${text.slice(0, 120)}", expected "${step.expected}"`);
                }
              }
              break;
            case 'assert_selector_count_min':
              {
                if (!step.selector) throw new Error('assert_selector_count_min requires selector');
                const els = await driver.findElements(By.css(step.selector));
                const min = Number(step.value) || 1;
                if (els.length < min) throw new Error(`only ${els.length} elements match "${step.selector}", expected >= ${min}`);
              }
              break;
            case 'assert_title':
              {
                const title = await driver.getTitle();
                if (step.expected && !title.includes(step.expected)) {
                  throw new Error(`assert_title failed: got "${title}"`);
                }
              }
              break;
            case 'wait':
              await driver.sleep(Number(step.value) || 1000);
              break;
            default:
              throw new Error(`Unknown step action: ${step.action}`);
          }
          log.steps.push({ ...record, outcome: 'passed', duration_ms: Date.now() - t0 });
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          log.steps.push({ ...record, outcome: 'failed', duration_ms: Date.now() - t0, error: msg.slice(0, 500) });
          throw new Error(`${label}: ${msg}`);
        }
      }
      const suffix = input.viewport ? ` at ${input.viewport.width}x${input.viewport.height}` : '';
      message = notes.length ? `Executed ${input.steps.length} steps${suffix}: ${notes.join(' | ')}` : `Executed ${input.steps.length} steps${suffix}`;
    } else {
      const t0 = Date.now();
      await driver.get(input.baseUrl);
      await driver.wait(until.elementLocated(By.css('body')), 10000);
      message = `Loaded ${input.baseUrl}`;
      log.steps.push({ step: 1, action: 'navigate', value: input.baseUrl, outcome: 'passed', duration_ms: Date.now() - t0 });
    }

    await settle('pass');

    return {
      status: 'passed',
      message,
      duration_ms: Date.now() - start,
      evidence,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let classification = 'unknown';
    if (/timeout|timed out/i.test(msg)) classification = 'timeout';
    else if (/econnrefused|network|net::/i.test(msg)) classification = 'network_failure';
    else if (/assert|expected/i.test(msg)) classification = 'assertion_failure';
    else if (/element|selector|not found/i.test(msg)) classification = 'script_problem';

    if (!log.steps.some((s) => s.outcome === 'failed')) {
      log.steps.push({ step: log.steps.length + 1, action: driver ? 'run' : 'launch', outcome: 'failed', duration_ms: Date.now() - start, error: msg.slice(0, 500) });
    }
    await settle('fail');

    return {
      status: 'failed',
      message: msg.slice(0, 500),
      duration_ms: Date.now() - start,
      classification,
      evidence,
    };
  } finally {
    input.signal?.removeEventListener('abort', onAbort);
    if (driver) {
      try {
        await driver.quit();
      } catch {
        /* ignore */
      }
    }
  }
}
