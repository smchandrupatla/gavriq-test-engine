/**
 * Selenium Baseline Framework — TestRunSummary
 *
 * Generates the final test run summary in prompt-style format after
 * all menu items have been tested.
 */

import type { IssueEntry, FailureReport } from './failure-reporter.js';
import type { NavigationResult } from './menu-navigator.js';
import type { ScreenValidationResult } from './screen-validator.js';

export type StabilityRating = 'Stable' | 'Partially Stable' | 'Unstable';

export interface TestRunSummary {
  /** Total menu items tested */
  totalMenuItemsTested: number;
  /** Total screens loaded (successful navigations) */
  totalScreensLoaded: number;
  /** Number of passing tests */
  passCount: number;
  /** Number of failing tests */
  failCount: number;
  /** List of failed items with their failure types */
  failedItems: Array<{ menuItem: string; failureType: string }>;
  /** Overall stability rating */
  overallStability: StabilityRating;
  /** Recommended next actions */
  nextRecommendedActions: string[];
  /** Timestamp of the summary */
  generatedAt: Date;
}

export interface RunMetrics {
  totalTested: number;
  passed: number;
  failed: number;
  navigationResults: NavigationResult[];
  validationResults: Array<{ menuItem: string; result: ScreenValidationResult }>;
}

export class TestRunSummaryGenerator {
  private readonly navigationResults: NavigationResult[] = [];
  private readonly validationResults: Array<{ menuItem: string; result: ScreenValidationResult }> = [];

  /**
   * Record a navigation result.
   */
  recordNavigation(result: NavigationResult): void {
    this.navigationResults.push(result);
  }

  /**
   * Record a screen validation result.
   */
  recordValidation(menuItem: string, result: ScreenValidationResult): void {
    this.validationResults.push({ menuItem, result });
  }

  /**
   * Generate the test run summary from recorded metrics.
   */
  generate(): TestRunSummary {
    const allResults = [
      ...this.navigationResults.map((r) => ({ item: r.item.label, success: r.success, error: r.error })),
      ...this.validationResults.map((v) => ({ item: v.menuItem, success: v.result.passed, error: v.result.issues.join('; ') })),
    ];

    const totalTested = allResults.length;
    const passed = allResults.filter((r) => r.success).length;
    const failed = allResults.filter((r) => !r.success).length;

    const failedItems = allResults
      .filter((r) => !r.success)
      .map((r) => ({
        menuItem: r.item,
        failureType: this.classifyFailure(r.error || ''),
      }));

    const totalScreensLoaded = this.navigationResults.filter((r) => r.success && r.screenName).length;

    return {
      totalMenuItemsTested: totalTested,
      totalScreensLoaded,
      passCount: passed,
      failCount: failed,
      failedItems,
      overallStability: this.determineStability(failed, totalTested),
      nextRecommendedActions: this.generateRecommendations(failedItems, failed),
      generatedAt: new Date(),
    };
  }

  /**
   * Generate the summary as prompt-style text.
   */
  toPrompt(): string {
    const summary = this.generate();
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
   * Also generate as a structured object (for programmatic use).
   */
  toJSON(): TestRunSummary {
    return this.generate();
  }

  private classifyFailure(error: string): string {
    const lower = error.toLowerCase();
    if (lower.includes('navigation') || lower.includes('navigate') || lower.includes('not found')) {
      return 'Navigation';
    }
    if (lower.includes('menu') || lower.includes('structure') || lower.includes('changed')) {
      return 'Menu Changed';
    }
    if (lower.includes('missing') || lower.includes('element') || lower.includes('not clickable')) {
      return 'UI Missing';
    }
    return 'Error Message';
  }

  private determineStability(failed: number, total: number): StabilityRating {
    if (total === 0) return 'Unstable';
    const failRate = failed / total;
    if (failRate === 0) return 'Stable';
    if (failRate <= 0.2) return 'Partially Stable';
    return 'Unstable';
  }

  private generateRecommendations(
    failedItems: Array<{ menuItem: string; failureType: string }>,
    failedCount: number,
  ): string[] {
    const recommendations: string[] = [];

    if (failedCount === 0) {
      recommendations.push('All screens passed — proceed to next test cycle');
      recommendations.push('Schedule regular baseline runs to detect regressions early');
      return recommendations;
    }

    const byType = new Map<string, string[]>();
    for (const item of failedItems) {
      const items = byType.get(item.failureType) || [];
      items.push(item.menuItem);
      byType.set(item.failureType, items);
    }

    if (byType.has('Navigation')) {
      recommendations.push(`Fix navigation for: ${byType.get('Navigation')!.join(', ')} — check routes and SPA router`);
    }
    if (byType.has('UI Missing')) {
      recommendations.push(`Restore missing UI elements for: ${byType.get('UI Missing')!.join(', ')} — verify component rendering`);
    }
    if (byType.has('Menu Changed')) {
      recommendations.push(`Stabilize menu structure for: ${byType.get('Menu Changed')!.join(', ')} — audit dynamic menu logic`);
    }
    if (byType.has('Error Message')) {
      recommendations.push(`Resolve errors on: ${byType.get('Error Message')!.join(', ')} — check server logs and console`);
    }

    recommendations.push(`Review ${failedCount} failing screen(s) and re-run baseline after fixes`);

    return recommendations;
  }
}
