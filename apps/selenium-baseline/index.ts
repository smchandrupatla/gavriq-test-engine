/**
 * Selenium Baseline Framework — Programmatic API
 *
 * Import this module to use the framework programmatically
 * within other test scripts or automation pipelines.
 */

export { loadConfig, type SeleniumBaselineConfig, type LocatorStrategy } from './config.js';
export { createDriver, withDriver, type DriverFactoryOptions } from './driver.js';
export { MenuNavigator, type MenuItem, type MenuState, type NavigationResult } from './menu-navigator.js';
export { ScreenValidator, type ScreenValidationResult, type ValidationCheck } from './screen-validator.js';
export { FailureReporter, type IssueEntry, type FailureReport, type FailureType } from './failure-reporter.js';
export { TestRunSummaryGenerator, type TestRunSummary, type StabilityRating, type RunMetrics } from './test-run-summary.js';
export { PromptFormatter, type FormattedPrompt } from './prompt-formatter.js';
export { runBaseline, type BaselineRunOptions, type BaselineRunResult } from './run.js';
