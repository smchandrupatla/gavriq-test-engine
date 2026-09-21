/**
 * Selenium Baseline Framework — Configuration
 *
 * Loads and validates runtime settings for the GUI automation framework.
 * All values are sourced from environment variables with sensible defaults.
 */

export type LocatorStrategy = 'xpath' | 'css' | 'id' | 'name' | 'link-text' | 'partial-link-text';

export interface SeleniumBaselineConfig {
  /** Base URL of the application under test */
  baseUrl: string;
  /** Implicit/wait timeout in milliseconds */
  timeoutMs: number;
  /** Default locator strategy for element lookups */
  locatorStrategy: LocatorStrategy;
  /** Directory for screenshots and evidence output */
  reportingDir: string;
  /** Browser to launch (chrome, firefox, edge) */
  browser: string;
  /** Run in headless mode */
  headless: boolean;
  /** Window width for the browser */
  windowWidth: number;
  /** Window height for the browser */
  windowHeight: number;
  /** CSS selector for the main navigation menu container */
  menuContainerSelector: string;
  /** CSS selector for individual menu items within the container */
  menuItemSelector: string;
  /** CSS selector for sub-navigation items (children) */
  subNavSelector: string;
  /** CSS selector for the page header/title element to validate screen load */
  pageHeaderSelector: string;
  /** CSS selector for error/banner elements that indicate a failed load */
  errorSelector: string;
  /** CSS selector for popup/modal/dialog elements */
  popupSelector: string;
  /** CSS selector for the sidebar/nav element to validate menu structure */
  sidebarSelector: string;
  /** Wait time between menu clicks (ms) for SPA transitions */
  navigationDelayMs: number;
  /** Maximum number of screenshots to keep in reporting dir */
  maxScreenshots: number;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) return fallback;
  return parsed;
}

function boolEnv(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (!raw) return fallback;
  return raw.toLowerCase() === 'true' || raw.toLowerCase() === '1';
}

export function loadConfig(): SeleniumBaselineConfig {
  return {
    baseUrl: process.env.TARGET_BASE_URL || process.env.BASE_URL || 'http://localhost:8001',
    timeoutMs: parseIntEnv('SELENIUM_TIMEOUT_MS', 15000),
    locatorStrategy: (process.env.LOCATOR_STRATEGY as LocatorStrategy) || 'css',
    reportingDir: process.env.REPORTING_DIR || './evidence/selenium-baseline',
    browser: (process.env.SELENIUM_BROWSER as 'chrome' | 'firefox' | 'edge') || 'chrome',
    headless: boolEnv('SELENIUM_HEADLESS', true),
    windowWidth: parseIntEnv('SELENIUM_WINDOW_WIDTH', 1440),
    windowHeight: parseIntEnv('SELENIUM_WINDOW_HEIGHT', 900),
    menuContainerSelector: process.env.MENU_CONTAINER_SELECTOR || '.opsc-nav',
    menuItemSelector: process.env.MENU_ITEM_SELECTOR || '.opsc-navitem',
    subNavSelector: process.env.SUB_NAV_SELECTOR || '.opsc-subnav',
    pageHeaderSelector: process.env.PAGE_HEADER_SELECTOR || 'h1, h2, [role="heading"]',
    errorSelector: process.env.ERROR_SELECTOR || '.error-message, .alert-danger, [class*="error"]',
    popupSelector: process.env.POPUP_SELECTOR || '.modal, .popup, .dialog, [role="dialog"]',
    sidebarSelector: process.env.SIDEBAR_SELECTOR || '.opsc-nav, aside, [role="navigation"]',
    navigationDelayMs: parseIntEnv('NAVIGATION_DELAY_MS', 500),
    maxScreenshots: parseIntEnv('MAX_SCREENSHOTS', 200),
  };
}
