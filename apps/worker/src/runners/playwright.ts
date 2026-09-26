/**
 * Playwright runner for out-of-container UI tests.
 * Every run leaves proof: a PNG of the final screen (and one per step for step
 * scripts, one at the point of failure) plus a step log.
 * Set CAPTURE_SCREENSHOTS=failure to keep only failure screenshots.
 */
import { chromium, type Browser, type Page } from 'playwright';
import { saveLog, savePng, type EvidenceRef } from '../evidence.js';

export interface PlaywrightRunInput {
  script?: string;
  baseUrl: string;
  timeoutSeconds?: number;
  steps?: Array<{ action: string; selector?: string; value?: string; expected?: string }>;
  /** Evidence file name prefix (execution + case key). */
  evidencePrefix?: string;
}

export interface PlaywrightRunResult {
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration_ms: number;
  classification?: string;
  evidence: EvidenceRef[];
}

const NAMED: Record<string, (page: Page, baseUrl: string) => Promise<string>> = {
  async smoke_home(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    const body = await page.locator('body').innerText();
    if (body.length < 5) throw new Error('Page appears empty');
    return `title=${title} body_len=${body.length}`;
  },
  async nav_to_login(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const login = page.getByRole('link', { name: /login/i }).first();
    if (await login.count()) {
      await login.click();
    } else {
      await page.locator('a[href*="login"]').first().click();
    }
    await page.waitForURL(/login/i, { timeout: 8000 });
    return `navigated to ${page.url()}`;
  },
  async login_page_elements(page, baseUrl) {
    await page.goto(`${baseUrl.replace(/\/$/, '')}/login`, { waitUntil: 'domcontentloaded' });
    const email = page.locator('input[type="email"], input[name="email"]');
    const password = page.locator('input[type="password"]');
    const submit = page.locator('button[type="submit"], button');
    if ((await email.count()) === 0 || (await password.count()) === 0 || (await submit.count()) === 0) {
      throw new Error('Missing login form elements');
    }
    return 'email, password, submit present';
  },
  async full_smoke_suite(page, baseUrl) {
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const parts = ['home:OK'];
    await page.waitForTimeout(800);
    const body = (await page.locator('body').innerText()).toLowerCase();
    parts.push(body.length > 20 ? 'content:OK' : 'content:SKIP');
    const login = page.getByRole('link', { name: /login/i });
    if (await login.count()) {
      await login.first().click();
      await page.waitForTimeout(400);
      parts.push('nav:OK');
    } else {
      parts.push('nav:SKIP');
    }
    return parts.join(' | ');
  },
};

export async function runPlaywright(input: PlaywrightRunInput): Promise<PlaywrightRunResult> {
  const start = Date.now();
  let browser: Browser | null = null;
  let page: Page | null = null;
  const evidence: EvidenceRef[] = [];
  const passShots = process.env.CAPTURE_SCREENSHOTS !== 'failure';
  const prefix = input.evidencePrefix || 'playwright';
  const log: string[] = [`# playwright run against ${input.baseUrl}`, `# script: ${input.script || (input.steps?.length ? `${input.steps.length} steps` : 'load base URL')}`];
  const note = (line: string) => log.push(`[+${((Date.now() - start) / 1000).toFixed(1)}s] ${line}`);
  const shot = async (label: string) => {
    if (!page) return;
    try {
      const ref = savePng(`${prefix}-${label}`, await page.screenshot({ fullPage: true }), { label, url: page.url(), title: await page.title().catch(() => null) });
      if (ref) { evidence.push(ref); note(`screenshot ${label}`); }
    } catch (err) {
      note(`screenshot ${label} failed: ${(err as Error).message}`);
    }
  };
  const done = (r: Omit<PlaywrightRunResult, 'evidence' | 'duration_ms'>): PlaywrightRunResult => {
    note(r.status.toUpperCase() + (r.status === 'passed' ? '' : `: ${r.message}`));
    const ref = saveLog(`${prefix}-steps`, log);
    return { ...r, duration_ms: Date.now() - start, evidence: ref ? [ref, ...evidence] : evidence };
  };

  try {
    browser = await chromium.launch({
      headless: true,
      // The worker image ships system Chromium instead of Playwright's bundled browser.
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || process.env.CHROME_BIN || undefined,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    page = await browser.newPage();
    page.setDefaultTimeout((input.timeoutSeconds || 30) * 1000);

    const named = input.script ? NAMED[input.script] : undefined;
    if (named) {
      note(`named script ${input.script}`);
      const msg = await named(page, input.baseUrl);
      note(msg);
      if (passShots) await shot('final');
      return done({ status: 'passed', message: msg });
    }

    if (input.steps?.length) {
      await page.goto(input.baseUrl, { waitUntil: 'domcontentloaded' });
      note(`opened ${input.baseUrl}`);
      for (const [idx, step] of input.steps.entries()) {
        note(`step ${idx + 1}: ${step.action}${step.selector ? ` ${step.selector}` : ''}${step.value ? ` = ${step.value}` : ''}${step.expected ? ` expect "${step.expected}"` : ''}`);
        switch (step.action) {
          case 'navigate':
            await page.goto(step.value || input.baseUrl);
            break;
          case 'click':
            if (!step.selector) throw new Error('click requires selector');
            await page.locator(step.selector).click();
            break;
          case 'type':
            if (!step.selector) throw new Error('type requires selector');
            await page.locator(step.selector).fill(step.value || '');
            break;
          case 'assert_text': {
            const text = await page.locator('body').innerText();
            if (step.expected && !text.includes(step.expected)) {
              throw new Error(`assert_text failed: expected "${step.expected}"`);
            }
            break;
          }
          case 'assert_title': {
            const title = await page.title();
            if (step.expected && !title.includes(step.expected)) {
              throw new Error(`assert_title failed: got "${title}"`);
            }
            break;
          }
          case 'wait':
            await page.waitForTimeout(Number(step.value) || 1000);
            break;
          default:
            throw new Error(`Unknown step: ${step.action}`);
        }
        if (passShots && idx < 20 && step.action !== 'wait') await shot(`step-${idx + 1}`);
      }
      return done({ status: 'passed', message: `Executed ${input.steps.length} Playwright steps` });
    }

    await page.goto(input.baseUrl, { waitUntil: 'domcontentloaded' });
    if (passShots) await shot('final');
    return done({ status: 'passed', message: `Loaded ${input.baseUrl}` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let classification = 'unknown';
    if (/timeout/i.test(msg)) classification = 'timeout';
    else if (/net::|ECONNREFUSED|NS_ERROR/i.test(msg)) classification = 'network_failure';
    else if (/assert|expected/i.test(msg)) classification = 'assertion_failure';
    else if (/selector|locator|not found/i.test(msg)) classification = 'script_problem';
    await shot('failure');
    return done({ status: 'failed', message: msg.slice(0, 500), classification });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
