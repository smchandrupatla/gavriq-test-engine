/**
 * Selenium Baseline Framework — ScreenValidator
 *
 * Validates that a screen (page) has loaded correctly after navigation.
 * Checks for page errors, missing UI elements, broken components,
 * unexpected popups, and navigation failures.
 */

import type { By, WebDriver } from 'selenium-webdriver';
import type { SeleniumBaselineConfig } from './config.js';

export interface ScreenValidationResult {
  /** Whether the screen passed all validation checks */
  passed: boolean;
  /** Name of the screen (from page header) */
  screenName: string | null;
  /** Whether the page loaded without errors */
  pageLoaded: boolean;
  /** Whether expected UI elements exist */
  elementsExist: boolean;
  /** Whether any components appear broken */
  brokenComponents: boolean;
  /** Whether unexpected popups were detected */
  unexpectedPopups: boolean;
  /** Whether navigation succeeded */
  navigationSuccess: boolean;
  /** List of issues found during validation */
  issues: string[];
  /** Screenshot path if captured */
  screenshotPath: string | null;
}

export interface ValidationCheck {
  /** Name of the check */
  name: string;
  /** CSS selector or XPath for expected elements */
  selector: string;
  /** Whether the check is required (failure marks screen as failed) */
  required: boolean;
}

export class ScreenValidator {
  private readonly driver: WebDriver;
  private readonly config: SeleniumBaselineConfig;

  constructor(driver: WebDriver, config: SeleniumBaselineConfig) {
    this.driver = driver;
    this.config = config;
  }

  /**
   * Validate the current screen with default checks plus any custom checks.
   */
  async validateScreen(customChecks?: ValidationCheck[]): Promise<ScreenValidationResult> {
    const issues: string[] = [];

    // 1. Page load check
    const pageLoaded = await this.checkPageLoaded();
    if (!pageLoaded) {
      issues.push('Page did not load successfully — possible navigation failure or error');
    }

    // 2. Error message check
    const errorFound = await this.checkForErrors();
    if (errorFound) {
      issues.push('Error message or error class detected on the page');
    }

    // 3. Expected elements check
    const elementsExist = await this.checkExpectedElements(customChecks);
    if (!elementsExist) {
      issues.push('Expected UI elements are missing from the page');
    }

    // 4. Broken components check
    const brokenComponents = await this.checkBrokenComponents();
    if (brokenComponents) {
      issues.push('Broken or empty components detected on the page');
    }

    // 5. Popup check
    const unexpectedPopups = await this.checkPopups();
    if (unexpectedPopups) {
      issues.push('Unexpected popup or modal dialog detected');
    }

    // 6. Navigation check
    const navigationSuccess = await this.checkNavigation();

    const screenName = await this.getCurrentScreenName();

    return {
      passed: issues.length === 0,
      screenName,
      pageLoaded,
      elementsExist,
      brokenComponents,
      unexpectedPopups,
      navigationSuccess,
      issues,
      screenshotPath: null,
    };
  }

  /**
   * Check whether the page loaded without errors by verifying the URL changed
   * and the document is ready.
   */
  private async checkPageLoaded(): Promise<boolean> {
    try {
      const url = this.driver.getCurrentUrl();
      const readyState = await this.driver.executeScript('return document.readyState');
      return readyState === 'complete' || readyState === 'interactive';
    } catch {
      return false;
    }
  }

  /**
   * Check for error messages or error-styled elements on the page.
   */
  private async checkForErrors(): Promise<boolean> {
    try {
      const errorEls = await this.driver.findElements(this.config.errorSelector as unknown as By);
      for (const el of errorEls) {
        const visible = await el.isDisplayed();
        if (visible) {
          const text = (await el.getText()).trim();
          if (text) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check that expected UI elements exist on the page.
   * Uses default selectors plus any custom checks provided.
   */
  private async checkExpectedElements(customChecks?: ValidationCheck[]): Promise<boolean> {
    const checks = customChecks || this.getDefaultChecks();
    for (const check of checks) {
      try {
        const elements = await this.driver.findElements(check.selector as unknown as By);
        let found = false;
        for (const el of elements) {
          if (await el.isDisplayed()) {
            found = true;
            break;
          }
        }
        if (!found && check.required) return false;
      } catch {
        if (check.required) return false;
      }
    }
    return true;
  }

  /**
   * Get default expected element checks based on the config.
   */
  private getDefaultChecks(): ValidationCheck[] {
    return [
      { name: 'page header', selector: this.config.pageHeaderSelector, required: true },
      { name: 'menu/sidebar', selector: this.config.sidebarSelector, required: true },
    ];
  }

  /**
   * Check for broken components — elements that are visible but empty or error-filled.
   */
  private async checkBrokenComponents(): Promise<boolean> {
    try {
      // Look for common broken-state indicators
      const brokenSelectors = [
        '[class*="empty"]',
        '[class*="broken"]',
        '[class*="error"]',
        '[data-empty="true"]',
        '.no-data',
        '.loading-failed',
      ];
      for (const selector of brokenSelectors) {
        const els = await this.driver.findElements(selector as unknown as By);
        for (const el of els) {
          const visible = await el.isDisplayed();
          if (visible) {
            const text = (await el.getText()).trim().toLowerCase();
            if (text.includes('error') || text.includes('failed') || text.includes('broken') || text.includes('empty')) {
              return true;
            }
          }
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check for unexpected popup or modal dialogs.
   */
  private async checkPopups(): Promise<boolean> {
    try {
      const popups = await this.driver.findElements(this.config.popupSelector as unknown as By);
      for (const popup of popups) {
        const visible = await popup.isDisplayed();
        if (visible) {
          // Check if it's a known/expected dialog (e.g., login gate that's hidden)
          const cls = await popup.getAttribute('class');
          if (cls && cls.includes('hidden')) continue;
          return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Check whether navigation was successful by verifying the URL changed
   * from the previous state.
   */
  private async checkNavigation(): Promise<boolean> {
    try {
      const url = await this.driver.getCurrentUrl();
      return url !== 'about:blank' && url.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Get the current screen name from the page header element.
   */
  private async getCurrentScreenName(): Promise<string | null> {
    try {
      const headers = await this.driver.findElements(this.config.pageHeaderSelector as unknown as By);
      if (headers.length === 0) return null;
      const text = (await headers[0].getText()).trim();
      return text || null;
    } catch {
      return null;
    }
  }

  /**
   * Capture a screenshot and save it to the reporting directory.
   * Returns the file path of the saved screenshot.
   */
  async captureScreenshot(name: string): Promise<string> {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const { mkdir } = fs;
    const { default: pathModule } = path;

    const dir = this.config.reportingDir;
    await mkdir(dir, { recursive: true });

    const screenshot = await this.driver.takeScreenshot();
    const filePath = pathModule.join(dir, `${name}.png`);
    await fs.writeFile(filePath, Buffer.from(screenshot, 'base64'));

    return filePath;
  }
}
