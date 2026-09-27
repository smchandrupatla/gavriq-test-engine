/**
 * Selenium Baseline Framework — Main Test Runner
 *
 * Orchestrates the full baseline test: discover menu items,
 * navigate through each one, validate screens, report failures,
 * and produce a final summary.
 *
 * Usage:
 *   npx tsx apps/selenium-baseline/run.ts
 *
 * Environment variables (with defaults):
 *   TARGET_BASE_URL       URL of the app under test
 *   SELENIUM_TIMEOUT_MS   Timeout for operations (default: 15000)
 *   SELENIUM_BROWSER      Browser to use (default: chrome)
 *   SELENIUM_HEADLESS     Run headless (default: true)
 *   REPORTING_DIR         Directory for screenshots (default: ./evidence/selenium-baseline)
 *   LOCATOR_STRATEGY      Default locator strategy (default: css)
 */

import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadConfig, type SeleniumBaselineConfig } from './config.js';
import { createDriver, withDriver } from './driver.js';
import { MenuNavigator, type NavigationResult } from './menu-navigator.js';
import { ScreenValidator } from './screen-validator.js';
import { FailureReporter, type IssueEntry } from './failure-reporter.js';
import { TestRunSummaryGenerator } from './test-run-summary.js';
import { PromptFormatter } from './prompt-formatter.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface BaselineRunOptions {
  /** Override config values */
  config?: Partial<SeleniumBaselineConfig>;
  /** Only test these menu items (if set, discovers all then filters) */
  menuFilter?: string[];
  /** Custom validation checks per screen */
  customChecks?: Record<string, { selector: string; required: boolean }[]>;
}

export interface BaselineRunResult {
  /** Full prompt-style report */
  report: string;
  /** JSON-formatted report */
  jsonReport: string;
  /** All issue entries */
  issues: IssueEntry[];
  /** Test run summary */
  summary: ReturnType<TestRunSummaryGenerator['generate']>;
  /** Whether the run passed (no failures) */
  passed: boolean;
}

export async function runBaseline(options?: BaselineRunOptions): Promise<BaselineRunResult> {
  const config = loadConfig();
  const reporter = new FailureReporter();
  const summaryGen = new TestRunSummaryGenerator();
  let totalTested = 0;

  console.log('=== Selenium Baseline Framework ===');
  console.log(`Target URL: ${config.baseUrl}`);
  console.log(`Browser: ${config.browser} (headless: ${config.headless})`);
  console.log(`Reporting dir: ${config.reportingDir}`);
  console.log('');

  // Ensure reporting directory exists
  await mkdir(config.reportingDir, { recursive: true });

  await withDriver(async (driver) => {
    const navigator = new MenuNavigator(driver, config);
    const validator = new ScreenValidator(driver, config);

    // 1. Launch application and discover menu structure
    console.log('Launching application...');
    await driver.get(config.baseUrl);
    await new Promise((resolve) => setTimeout(resolve, config.navigationDelayMs));

    console.log('Discovering menu structure...');
    const menuState = await navigator.discoverMenu();
    console.log(`Found ${menuState.items.length} top-level menu items (${menuState.totalCount} total including children)`);

    let itemsToTest = menuState.items;
    if (options?.menuFilter && options.menuFilter.length > 0) {
      itemsToTest = menuState.items.filter((item) => options.menuFilter!.includes(item.label));
      console.log(`Filtered to ${itemsToTest.length} menu items`);
    }

    // 2. For each menu item: navigate, validate, capture, log
    for (const item of itemsToTest) {
      totalTested++;
      const safeName = item.label.replace(/[^a-z0-9._-]+/gi, '-').slice(0, 80);
      console.log(`\n[${totalTested}/${itemsToTest.length}] Testing: "${item.label}"`);

      // Navigate and validate menu structure
      const navResult = await navigator.navigateAndValidate(item.label);
      summaryGen.recordNavigation(navResult);

      // Capture screenshot
      let screenshotPath = '';
      try {
        screenshotPath = await validator.captureScreenshot(`baseline-${safeName}`);
      } catch (err) {
        console.warn(`  Screenshot failed: ${(err as Error).message}`);
      }

      // Validate the screen that loaded
      const validation = await validator.validateScreen();
      summaryGen.recordValidation(item.label, validation);

      if (validation.passed) {
        console.log(`  ✓ PASS — Screen: ${validation.screenName ?? 'unknown'}`);
      } else {
        console.log(`  ✗ FAIL — ${validation.issues.length} issue(s):`);
        for (const issue of validation.issues) {
          console.log(`    - ${issue}`);
        }
        reporter.recordValidationFailure(item.label, validation.screenName ?? item.label, validation, screenshotPath);
      }

      // Check for menu structure changes
      if (navResult.menuChanged) {
        console.log(`  ⚠ Menu structure changed after navigation`);
        reporter.recordMenuStructureChange(
          item.label,
          navResult.screenName ?? item.label,
          navResult.menuBefore!,
          navResult.menuAfter!,
          screenshotPath,
        );
      }
    }

    // 3. Return to home to verify menu is intact
    console.log('\nReturning to home page for final verification...');
    await driver.get(config.baseUrl);
    await new Promise((resolve) => setTimeout(resolve, config.navigationDelayMs));
    const finalMenu = await navigator.discoverMenu();
    const homeValidation = await validator.validateScreen();
    if (!homeValidation.passed) {
      reporter.recordValidationFailure('Home', 'Home page', homeValidation, '');
    }
  });

  // 4. Generate reports
  const report = reporter.getReport(totalTested);
  const summary = summaryGen.generate();
  const formatter = new PromptFormatter();

  const fullReport = formatter.formatFullReport(report, summary);
  const jsonReport = formatter.formatJsonReport(report, summary);

  // Print the report
  console.log('\n');
  console.log(fullReport);

  return {
    report: fullReport,
    jsonReport,
    issues: report.issues,
    summary,
    passed: report.failCount === 0,
  };
}

// CLI entry point
async function main(): Promise<void> {
  const options: BaselineRunOptions = {
    config: {},
  };

  try {
    const result = await runBaseline(options);
    process.exit(result.passed ? 0 : 1);
  } catch (err) {
    console.error('Baseline run failed with fatal error:', err);
    process.exit(2);
  }
}

main();
