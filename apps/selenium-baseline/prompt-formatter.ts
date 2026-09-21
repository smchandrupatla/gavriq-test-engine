/**
 * Selenium Baseline Framework — PromptFormatter
 *
 * Formats issues and summaries as structured prompt entries
 * suitable for issue tracking, AI prompt injection, or reporting.
 */

import type { IssueEntry, FailureReport } from './failure-reporter.js';
import type { TestRunSummary } from './test-run-summary.js';

export interface FormattedPrompt {
  /** Header/title of the prompt section */
  title: string;
  /** The formatted prompt content */
  content: string;
  /** Number of items in the prompt */
  itemCount: number;
}

export class PromptFormatter {
  /**
   * Format a single issue entry as a prompt row.
   */
  formatIssuePrompt(issue: IssueEntry, index: number): string {
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

  /**
   * Format all issues from a failure report as prompt rows in list form.
   */
  formatIssueList(report: FailureReport): string[] {
    return report.issues.map((issue, index) => this.formatIssuePrompt(issue, index + 1));
  }

  /**
   * Format the test run summary as a prompt.
   */
  formatSummaryPrompt(summary: TestRunSummary): string {
    const lines: string[] = [];

    lines.push('**Test Run Summary**');
    lines.push('');
    lines.push(`- **Total Menu Items Tested:** ${summary.totalMenuItemsTested}`);
    lines.push(`- **Total Screens Loaded:** ${summary.totalScreensLoaded}`);
    lines.push(`- **Pass Count:** ${summary.passCount}`);
    lines.push(`- **Fail Count:** ${summary.failCount}`);

    if (summary.failedItems.length > 0) {
      lines.push('- **List of Failed Items:**');
      for (const item of summary.failedItems) {
        lines.push(`  - ${item.menuItem} → ${item.failureType}`);
      }
    } else {
      lines.push('- **List of Failed Items:** None');
    }

    lines.push(`- **Overall Stability Rating:** ${summary.overallStability}`);
    lines.push('- **Next Recommended Actions:**');
    for (const action of summary.nextRecommendedActions) {
      lines.push(`  - ${action}`);
    }

    return lines.join('\n');
  }

  /**
   * Format the complete output: issues list followed by summary.
   */
  formatFullReport(report: FailureReport, summary: TestRunSummary): string {
    const parts: string[] = [];

    parts.push('=== SELENIUM BASELINE FRAMEWORK — FAILURE REPORT ===');
    parts.push('');
    parts.push(`Generated: ${report.generatedAt.toISOString()}`);
    parts.push(`Total Menu Items Tested: ${report.totalTested}`);
    parts.push(`Total Failures: ${report.failCount}`);
    parts.push('');

    if (report.issues.length > 0) {
      parts.push('--- ISSUES ---');
      parts.push('');
      for (const row of this.formatIssueList(report)) {
        parts.push(row);
        parts.push('');
      }
    } else {
      parts.push('--- ISSUES ---');
      parts.push('');
      parts.push('No issues found. All screens validated successfully.');
      parts.push('');
    }

    parts.push('--- SUMMARY ---');
    parts.push('');
    parts.push(this.formatSummaryPrompt(summary));

    return parts.join('\n');
  }

  /**
   * Format a failure report as a machine-readable JSON string.
   */
  formatJsonReport(report: FailureReport, summary: TestRunSummary): string {
    return JSON.stringify(
      {
        generatedAt: report.generatedAt.toISOString(),
        totalTested: report.totalTested,
        totalFailures: report.failCount,
        issues: report.issues,
        summary: {
          totalMenuItemsTested: summary.totalMenuItemsTested,
          totalScreensLoaded: summary.totalScreensLoaded,
          passCount: summary.passCount,
          failCount: summary.failCount,
          failedItems: summary.failedItems,
          overallStability: summary.overallStability,
          nextRecommendedActions: summary.nextRecommendedActions,
        },
      },
      null,
      2,
    );
  }
}
