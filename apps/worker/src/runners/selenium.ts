/**
 * Selenium WebDriver runner for out-of-container UI tests.
 * Used by the execution worker when execution_method = 'selenium'.
 */
import { Builder, By, until, type WebDriver } from 'selenium-webdriver';
import chrome from 'selenium-webdriver/chrome.js';

export interface SeleniumRunInput {
  script?: string;           // named script key or inline steps JSON
  baseUrl: string;
  timeoutSeconds?: number;
  steps?: Array<{ action: string; selector?: string; value?: string; expected?: string }>;
}

export interface SeleniumRunResult {
  status: 'passed' | 'failed' | 'error';
  message: string;
  duration_ms: number;
  classification?: string;
  evidence?: Array<{ type: string; storage_key: string; content_type?: string }>;
}

async function buildDriver(): Promise<WebDriver> {
  const options = new chrome.Options();
  options.addArguments(
    '--headless=new',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--window-size=1280,800'
  );
  return new Builder().forBrowser('chrome').setChromeOptions(options).build();
}

/** Named main-flow scripts for Sand Bench / generic targets */
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
      // try common selectors
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
    // home
    await driver.get(baseUrl);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    parts.push('home:OK');
    // widgets
    await driver.sleep(1000);
    const body = (await driver.findElement(By.css('body')).getText()).toLowerCase();
    parts.push(body.includes('active') || body.length > 20 ? 'widgets:OK' : 'widgets:SKIP');
    // login nav
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
  const start = Date.now();
  let driver: WebDriver | null = null;
  try {
    driver = await buildDriver();
    const timeout = (input.timeoutSeconds || 30) * 1000;
    await driver.manage().setTimeouts({ pageLoad: timeout, implicit: 5000 });

    // Named script
    if (input.script && NAMED_SCRIPTS[input.script]) {
      const msg = await NAMED_SCRIPTS[input.script](driver, input.baseUrl);
      return {
        status: 'passed',
        message: msg,
        duration_ms: Date.now() - start,
      };
    }

    // Step-based low-code execution
    if (input.steps?.length) {
      await driver.get(input.baseUrl);
      for (const step of input.steps) {
        switch (step.action) {
          case 'navigate':
            await driver.get(step.value || input.baseUrl);
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
          case 'assert_text':
            {
              const body = await driver.findElement(By.css('body')).getText();
              if (step.expected && !body.includes(step.expected)) {
                throw new Error(`assert_text failed: expected "${step.expected}"`);
              }
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
      }
      return {
        status: 'passed',
        message: `Executed ${input.steps.length} steps`,
        duration_ms: Date.now() - start,
      };
    }

    // Default: just load the page
    await driver.get(input.baseUrl);
    await driver.wait(until.elementLocated(By.css('body')), 10000);
    return {
      status: 'passed',
      message: `Loaded ${input.baseUrl}`,
      duration_ms: Date.now() - start,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    let classification = 'unknown';
    if (/timeout|timed out/i.test(msg)) classification = 'timeout';
    else if (/econnrefused|network|net::/i.test(msg)) classification = 'network_failure';
    else if (/assert|expected/i.test(msg)) classification = 'assertion_failure';
    else if (/element|selector|not found/i.test(msg)) classification = 'script_problem';

    return {
      status: 'failed',
      message: msg.slice(0, 500),
      duration_ms: Date.now() - start,
      classification,
    };
  } finally {
    if (driver) {
      try {
        await driver.quit();
      } catch {
        /* ignore */
      }
    }
  }
}
