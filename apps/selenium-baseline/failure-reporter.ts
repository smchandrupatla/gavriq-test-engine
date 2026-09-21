/**
 * Selenium Baseline Framework — FailureReporter
 *
 * Generates structured, prompt-style issue entries for every failure
 * encountered during the baseline test run.
 */

import type { MenuState } from './menu-navigator.js';
import type { ScreenValidationResult } from './screen-validator.js';
import type { NavigationResult } from './menu-navigator.js';

export type FailureType = 'Navigation' | 'UI Missing' | 'Menu Changed' | 'Error Message';

export interface IssueEntry {
  /** Menu item that triggered the failure */
  menuItem: string;
  /** Expected screen name */
  expectedScreen: string;
  /** What was actually observed */
  observedBehavior: string;
  /** Category of failure */
  failureType: FailureType;
  /** Path to the screenshot (if any) */
  screenshot: string;
  /** Recommendation for fixing the issue */
  suggestedFix: string;
}

export interface FailureReport {
  /** All issue entries collected */
  issues: IssueEntry[];
  /** Total number of menu items tested */
  totalTested: number;
  /** Number of failures */
  failCount: number;
  /** Timestamp of the report */
  generatedAt: Date;
}

const FAILURE_TYPE_SUGGESTIONS: Record<FailureType, string> = {
  Navigation: 'Investigate the navigation path for this menu item. Check for broken links, missing routes, or client-side errors in the browser console. Verify the SPA router handles this path correctly.',
  'UI Missing': 'Check that the screen renders all expected UI elements. Verify the component is not conditionally hidden, the data is loaded, and no JavaScript errors prevent rendering.',
  'Menu Changed': 'Audit the menu/sidebar rendering logic. Ensure menu items are not dynamically added/removed based on user state, and that the menu structure is stable across navigations.',
  'Error Message': 'Review the error message displayed on the page. Check server logs, API responses, and browser console for the root cause. Fix the underlying error before re-testing.',
};

export class FailureReporter {
  private readonly issues: IssueEntry[] = [];

  /**
   * Record a failure from a navigation result.
   */
  recordNavigationFailure(result: NavigationResult, screenshotPath: string = ''): void {
    const menuItem = result.item.label;
    const expectedScreen = result.item.children.length > 0
      ? `${result.item.label} (with sub-items)`
      : result.item.label;

    let failureType: FailureType = 'Navigation';
    let observedBehavior = '';
    let suggestedFix = '';

    if (result.error) {
      observedBehavior = `Navigation failed: ${result.error}`;
      if (result.error.toLowerCase().includes('not found')) {
        failureType = 'UI Missing';
      }
    } else if (result.menuChanged) {
      failureType = 'Menu Changed';
      observedBehavior = `Menu structure changed after navigating to "${menuItem}". Items before: ${result.menuBefore?.totalCount ?? 0}, after: ${result.menuAfter?.totalCount ?? 0}`;
    } else if (!result.success) {
      observedBehavior = `Menu item "${menuItem}" was not clickable or did not navigate`;
    } else {
      observedBehavior = `Navigated to "${result.screenName ?? 'unknown screen'}" but menu structure changed`;
      failureType = 'Menu Changed';
    }

    suggestedFix = FAILURE_TYPE_SUGGESTIONS[failureType];

    this.issues.push({
      menuItem,
      expectedScreen,
      observedBehavior,
      failureType,
      screenshot: screenshotPath,
      suggestedFix,
    });
  }

  /**
   * Record a failure from a screen validation result.
   */
  recordValidationFailure(
    menuItem: string,
    screenName: string,
    result: ScreenValidationResult,
    screenshotPath: string = '',
  ): void {
    for (const issue of result.issues) {
      let failureType: FailureType = 'Error Message';
      let observedBehavior = issue;

      if (issue.toLowerCase().includes('navigation') || issue.toLowerCase().includes('navigate')) {
        failureType = 'Navigation';
      } else if (issue.toLowerCase().includes('missing') || issue.toLowerCase().includes('element')) {
        failureType = 'UI Missing';
      } else if (issue.toLowerCase().includes('menu') || issue.toLowerCase().includes('structure')) {
        failureType = 'Menu Changed';
      } else if (issue.toLowerCase().includes('error') || issue.toLowerCase().includes('broken')) {
        failureType = 'Error Message';
      }

      this.issues.push({
        menuItem,
        expectedScreen: screenName || 'Unknown screen',
        observedBehavior,
        failureType,
        screenshot: screenshotPath,
        suggestedFix: FAILURE_TYPE_SUGGESTIONS[failureType],
      });
    }
  }

  /**
   * Record a failure from a menu structure mismatch.
   */
  recordMenuStructureChange(
    menuItem: string,
    screenName: string,
    before: MenuState,
    after: MenuState,
    screenshotPath: string = '',
  ): void {
    this.issues.push({
      menuItem,
      expectedScreen: screenName || 'Unknown screen',
      observedBehavior: `Menu structure changed after navigation. Before: ${before.totalCount} items, After: ${after.totalCount} items. Before items: [${before.items.map((i) => i.label).join(', ')}]. After items: [${after.items.map((i) => i.label).join(', ')}]`,
      failureType: 'Menu Changed',
      screenshot: screenshotPath,
      suggestedFix: FAILURE_TYPE_SUGGESTIONS['Menu Changed'],
    });
  }

  /**
   * Get the full failure report.
   */
  getReport(totalTested: number): FailureReport {
    return {
      issues: [...this.issues],
      totalTested,
      failCount: this.issues.length,
      generatedAt: new Date(),
    };
  }

  /**
   * Get issues formatted as prompt-style rows (one row per issue).
   */
  getPromptRows(): string[] {
    return this.issues.map((issue, index) => this.formatIssueRow(issue, index + 1));
  }

  /**
   * Format a single issue as a prompt-style row.
   */
  private formatIssueRow(issue: IssueEntry, index: number): string {
    return [
      `Issue #${index}:`,
      `  **Menu Item:** ${issue.menuItem}`,
      `  **Expected Screen:** ${issue.expectedScreen}`,
      `  **Observed Behavior:** ${issue.observedBehavior}`,
      `  **Failure Type:** ${issue.failureType}`,
      `  **Screenshot:** ${issue.screenshot || 'N/A'}`,
      `  **Suggested Fix:** ${issue.suggestedFix}`,
    ].join('\n');
  }
}
