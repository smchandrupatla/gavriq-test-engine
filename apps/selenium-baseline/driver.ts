/**
 * Selenium Baseline Framework — WebDriver Factory
 *
 * Creates and manages a Selenium WebDriver instance configured for the
 * baseline GUI test framework. Supports Chrome, Firefox, and Edge.
 */

import { Builder, type WebDriver } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import firefox from "selenium-webdriver/firefox.js";
import edge from "selenium-webdriver/edge.js";
import type { SeleniumBaselineConfig } from "./config.js";

export interface DriverFactoryOptions {
  /** Override config for this driver instance */
  config?: Partial<SeleniumBaselineConfig>;
}

function buildChromeOptions(config: SeleniumBaselineConfig): InstanceType<typeof chrome.Options> {
  const options = new chrome.Options();
  if (config.headless) {
    options.addArguments('--headless=new');
  }
  options.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--window-size=${config.windowWidth},${config.windowHeight}`,
    '--disable-software-rasterizer',
  );
  return options;
}

function buildFirefoxOptions(config: SeleniumBaselineConfig): InstanceType<typeof firefox.Options> {
  const options = new firefox.Options();
  if (config.headless) {
    options.addArguments('-headless');
  }
  options.setWindowSize(config.windowWidth, config.windowHeight);
  return options;
}

function buildEdgeOptions(config: SeleniumBaselineConfig): InstanceType<typeof edge.Options> {
  const options = new edge.Options();
  if (config.headless) {
    options.addArguments('--headless=new');
  }
  options.addArguments(
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    `--window-size=${config.windowWidth},${config.windowHeight}`,
  );
  return options;
}

/**
 * Create a new WebDriver instance based on the framework configuration.
 */
export async function createDriver(options?: DriverFactoryOptions): Promise<WebDriver> {
  const config = options?.config;
  const browser = config?.browser || process.env.SELENIUM_BROWSER || 'chrome';
  const headless = config?.headless ?? (process.env.SELENIUM_HEADLESS !== 'false');
  const windowWidth = config?.windowWidth || parseInt(process.env.SELENIUM_WINDOW_WIDTH || '1440', 10);
  const windowHeight = config?.windowHeight || parseInt(process.env.SELENIUM_WINDOW_HEIGHT || '900', 10);

  const baseConfig: SeleniumBaselineConfig = {
    baseUrl: process.env.TARGET_BASE_URL || 'http://localhost:8001',
    timeoutMs: 15000,
    locatorStrategy: 'css',
    reportingDir: './evidence/selenium-baseline',
    browser,
    headless,
    windowWidth,
    windowHeight,
    menuContainerSelector: '.opsc-nav',
    menuItemSelector: '.opsc-navitem',
    subNavSelector: '.opsc-subnav',
    pageHeaderSelector: 'h1, h2, [role="heading"]',
    errorSelector: '.error-message, .alert-danger, [class*="error"]',
    popupSelector: '.modal, .popup, .dialog, [role="dialog"]',
    sidebarSelector: '.opsc-nav, aside, [role="navigation"]',
    navigationDelayMs: 500,
    maxScreenshots: 200,
    ...config,
  };

  let builder: Builder;
  switch (browser.toLowerCase()) {
    case 'firefox': {
      builder = new Builder().forBrowser('firefox').setFirefoxOptions(buildFirefoxOptions(baseConfig));
      break;
    }
    case 'edge': {
      builder = new Builder().forBrowser('MicrosoftEdge').setEdgeOptions(buildEdgeOptions(baseConfig));
      break;
    }
    case 'chrome':
    default: {
      builder = new Builder().forBrowser('chrome').setChromeOptions(buildChromeOptions(baseConfig));
      break;
    }
  }

  const driver = await builder.build();
  await driver.manage().setTimeouts({
    implicit: 0,
    pageLoad: baseConfig.timeoutMs,
    script: baseConfig.timeoutMs,
  });

  return driver;
}

/**
 * Run a function with a fresh WebDriver, quitting it afterwards regardless of outcome.
 */
export async function withDriver<T>(fn: (driver: WebDriver) => Promise<T>): Promise<T> {
  const driver = await createDriver();
  try {
    return await fn(driver);
  } finally {
    try {
      await driver.quit();
    } catch {
      /* driver already quit or unavailable */
    }
  }
}
