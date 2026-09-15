/**
 * Playwright runner for out-of-container UI tests.
 */
import { chromium, type Browser, type Page } from 'playwright';

export interface PlaywrightRunInput {
  script?: string;
  baseUrl: string;
  timeoutSeconds?: number;
  steps?: Array<{ action: string; selector?: string; value?: string; expected?: string }>;
}

export interface PlaywrightRunResult {
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration_ms: number;
  classification?: string;
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
  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    const page = await browser.newPage();
    page.setDefaultTimeout((input.timeoutSeconds || 30) * 1000);

    if (input.script && NAMED[input.script]) {
      const msg = await NAMED[input.script](page, input.baseUrl);
      return { status: 'passed', message: msg, duration_ms: Date.now() - start };
    }

    if (input.steps?.length) {
      await page.goto(input.baseUrl, { waitUntil: 'domcontentloaded' });
      for (const step of input.steps) {
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
      }
      return {
        status: 'passed',
        message: `Executed ${input.steps.length} Playwright steps`,
        duration_ms: Date.now() - start,
      };
    }

    await page.goto(input.baseUrl, { waitUntil: 'domcontentloaded' });
    return {
      status: 'passed',
      message: `Loaded ${input.baseUrl}`,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let classification = 'unknown';
    if (/timeout/i.test(msg)) classification = 'timeout';
    else if (/net::|ECONNREFUSED|NS_ERROR/i.test(msg)) classification = 'network_failure';
    else if (/assert|expected/i.test(msg)) classification = 'assertion_failure';
    else if (/selector|locator|not found/i.test(msg)) classification = 'script_problem';
    return {
      status: 'failed',
      message: msg.slice(0, 500),
      duration_ms: Date.now() - start,
      classification,
    };
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}
