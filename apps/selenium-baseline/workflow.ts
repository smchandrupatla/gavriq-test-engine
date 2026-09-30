/**
 * Selenium Baseline Framework — Workflow Checks
 *
 * DB-persistence workflow checks for the baseline framework.
 * Each workflow drives a real UI form, reads the success toast,
 * then independently confirms the row landed in the database
 * via the db viewer API — same principle as the SIT workflow
 * cases (sit/cases/80-ui-workflows.sit.ts) but packaged for
 * the baseline framework's run loop.
 *
 * Usage:
 *   import { workflowChecks } from './workflow.js';
 *   await runBaseline({ workflowChecks: [...] });
 */

import { By, until } from 'selenium-webdriver';
import type { WebDriver } from 'selenium-webdriver';
import type { SeleniumBaselineConfig } from './config.js';
import { MenuNavigator } from './menu-navigator.js';
import { ScreenValidator } from './screen-validator.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface WorkflowStep {
  /** Top-level menu label */
  topMenu: string;
  /** Sub-menu label (optional) */
  subMenu?: string;
  /** Form fields to fill: label → value */
  fields: Record<string, string>;
  /** Select dropdowns: label → option text */
  selects?: Record<string, string>;
  /** Button label to click to submit */
  submitButton: string;
  /** Expected success toast text */
  expectedToast: string;
  /** DB viewer path to poll, e.g. /api/rows?table=detection_rules&page_size=100 */
  dbCheckPath: string;
  /** Row field that should match the submitted value */
  dbRowMatchField: string;
  /** Optional: fixed field values the live-bind handler always posts */
  dbFixedFields?: Record<string, string>;
}

export interface WorkflowResult {
  /** Workflow name (derived from submitButton) */
  name: string;
  /** Whether the toast matched */
  toastOk: boolean;
  /** Whether the DB row appeared */
  dbOk: boolean;
  /** Whether fixed fields match (if dbFixedFields provided) */
  fixedFieldsOk: boolean;
  /** Error message if any */
  error: string | null;
  /** Screenshot path */
  screenshotPath: string;
}

export interface WorkflowCheckOptions {
  /** Workflows to run */
  workflows: WorkflowStep[];
  /** Base URL for the db viewer (defaults to ENV or localhost) */
  dbViewerBase?: string;
  /** Poll timeout per workflow (ms) */
  pollTimeoutMs?: number;
}

// ── Helpers ──────────────────────────────────────────────────────────────

async function enterConsole(driver: WebDriver, config: SeleniumBaselineConfig): Promise<void> {
  const navigator = new MenuNavigator(driver, config);
  await driver.get(config.baseUrl);
  await new Promise((resolve) => setTimeout(resolve, config.navigationDelayMs));
  // Wait for sidebar
  await driver.wait(
    async () => {
      try {
        const els = await driver.findElements('.opsc-sidebar');
        return els.length > 0;
      } catch {
        return false;
      }
    },
    20000,
    'console sidebar did not mount',
  );
}

async function clickSubItem(driver: WebDriver, topLabel: string, subLabel?: string): Promise<void> {
  // Click top-level item
  const topItems = await driver.findElements('.opsc-navitem');
  let found = false;
  for (const el of topItems) {
    const text = (await el.getText()).trim();
    if (text === topLabel) {
      await el.click();
      found = true;
      break;
    }
  }
  if (!found) throw new Error(`Top menu item "${topLabel}" not found`);

  if (subLabel) {
    await new Promise((resolve) => setTimeout(resolve, 400));
    const subEls = await driver.findElements('.opsc-subnav div, .opsc-subnav a');
    let subFound = false;
    for (const el of subEls) {
      const text = (await el.getText()).trim();
      if (text === subLabel) {
        await el.click();
        subFound = true;
        break;
      }
    }
    if (!subFound) throw new Error(`Sub-menu item "${subLabel}" under "${topLabel}" not found`);
  }

  await new Promise((resolve) => setTimeout(resolve, 400));
}

async function setField(driver: WebDriver, label: string, value: string): Promise<void> {
  const fields = await driver.findElements('.opsc-field');
  for (const field of fields) {
    const labelEls = await field.findElements('.opsc-field-label');
    if (labelEls.length && (await labelEls[0].getText()).trim() === label) {
      const inputs = await field.findElements('input, textarea');
      if (inputs.length) {
        await inputs[0].clear();
        await inputs[0].sendKeys(value);
        return;
      }
    }
  }
  throw new Error(`Field "${label}" not found`);
}

async function selectOption(driver: WebDriver, label: string, optionText: string): Promise<void> {
  const fields = await driver.findElements('.opsc-field');
  for (const field of fields) {
    const labelEls = await field.findElements('.opsc-field-label');
    if (labelEls.length && (await labelEls[0].getText()).trim() === label) {
      const selects = await field.findElements('select');
      if (selects.length) {
        await selects[0].click();
        await new Promise((resolve) => setTimeout(resolve, 200));
        const opts = await selects[0].findElements('option');
        for (const opt of opts) {
          if ((await opt.getText()).trim() === optionText) {
            await opt.click();
            return;
          }
        }
        throw new Error(`Option "${optionText}" not found in select "${label}"`);
      }
    }
  }
  throw new Error(`Select field "${label}" not found`);
}

async function clickButton(driver: WebDriver, label: string): Promise<void> {
  const buttons = await driver.findElements(`[role="button"][aria-label="${label}"]`);
  if (buttons.length) {
    await buttons[0].click();
    return;
  }
  // Fallback: text-based button
  const all = await driver.findElements('button');
  for (const btn of all) {
    const text = (await btn.getText()).trim();
    if (text === label) {
      await btn.click();
      return;
    }
  }
  throw new Error(`Button "${label}" not found`);
}

async function waitForToast(driver: WebDriver, timeoutMs = 8000): Promise<string> {
  const el = await driver.wait(
    until.elementLocated(By.css('.opsc-toast')),
    timeoutMs,
    'no success toast appeared',
  );
  return (await el.getText()).trim();
}

async function pollDb(
  dbViewerBase: string,
  path: string,
  predicate: (body: unknown) => boolean,
  timeoutMs: number,
): Promise<unknown> {
  const start = Date.now();
  for (;;) {
    try {
      const res = await fetch(`${dbViewerBase}${path}`, { signal: AbortSignal.timeout(5000) });
      const body = (await res.json().catch(() => ({}))) as { data?: unknown[] };
      if (predicate(body) || Date.now() - start >= timeoutMs) return body;
    } catch (err) {
      if (Date.now() - start >= timeoutMs) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
}

// ── Main ─────────────────────────────────────────────────────────────────

/**
 * Run workflow checks against the running app.
 * Returns per-workflow results for inclusion in the baseline report.
 */
export async function runWorkflowChecks(
  driver: WebDriver,
  config: SeleniumBaselineConfig,
  options: WorkflowCheckOptions,
): Promise<WorkflowResult[]> {
  const results: WorkflowResult[] = [];
  const dbViewerBase = options.dbViewerBase || process.env.DBVIEWER_BASE || 'http://localhost:8001';
  const pollTimeout = options.pollTimeoutMs || 8000;

  for (const wf of options.workflows) {
    const name = wf.submitButton.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 60);
    console.log(`  Workflow: ${wf.topMenu}${wf.subMenu ? ' → ' + wf.subMenu : ''} (${wf.submitButton})`);

    try {
      await enterConsole(driver, config);
      await clickSubItem(driver, wf.topMenu, wf.subMenu);

      // Fill fields
      for (const [label, value] of Object.entries(wf.fields)) {
        await setField(driver, label, value);
      }
      // Fill selects
      if (wf.selects) {
        for (const [label, option] of Object.entries(wf.selects)) {
          await selectOption(driver, label, option);
        }
      }
      // Submit
      await clickButton(driver, wf.submitButton);

      // Read toast
      let toastText = '';
      try {
        toastText = await waitForToast(driver, 8000);
      } catch {
        toastText = '(no toast)';
      }
      const toastOk = toastText === wf.expectedToast;

      // DB check
      let dbOk = false;
      let fixedFieldsOk = true;
      try {
        const body = (await pollDb(
          dbViewerBase,
          wf.dbCheckPath,
          (b: unknown) =>
            Boolean((b as { data?: Array<Record<string, unknown>> }).data?.some((row) => row[wf.dbRowMatchField] !== undefined)),
          pollTimeout,
        )) as { data?: Array<Record<string, unknown>> };
        dbOk = Boolean(body.data?.some((row) => row[wf.dbRowMatchField] !== undefined));

        if (dbOk && wf.dbFixedFields) {
          const row = body.data?.find((r) => r[wf.dbRowMatchField] !== undefined);
          fixedFieldsOk = Object.entries(wf.dbFixedFields).every(([k, v]) => row?.[k] === v);
        }
      } catch {
        dbOk = false;
      }

      const screenshotPath = await new ScreenValidator(driver, config).captureScreenshot(`workflow-${name}`).catch(() => '');

      results.push({
        name,
        toastOk,
        dbOk,
        fixedFieldsOk,
        error: toastOk && dbOk && fixedFieldsOk ? null : `toast=${toastText} db=${dbOk} fixed=${fixedFieldsOk}`,
        screenshotPath,
      });
    } catch (err) {
      results.push({
        name,
        toastOk: false,
        dbOk: false,
        fixedFieldsOk: false,
        error: (err as Error).message,
        screenshotPath: '',
      });
    }
  }

  return results;
}
