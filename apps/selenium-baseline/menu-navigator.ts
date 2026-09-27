/**
 * Selenium Baseline Framework — MenuNavigator
 *
 * Discovers, navigates, and validates the application's menu structure.
 * Tracks menu state before and after each navigation to detect structural changes.
 */

import type { By, WebDriver, WebElement } from 'selenium-webdriver';
import type { SeleniumBaselineConfig } from './config.js';

export interface MenuItem {
  /** Display text of the menu item */
  label: string;
  /** Locator used to find this item */
  locator: string;
  /** Whether this item has sub-items (children) */
  hasChildren: boolean;
  /** Child labels (if discovered) */
  children: string[];
  /** Whether the item was clicked during the test run */
  clicked: boolean;
}

export interface MenuState {
  /** Timestamp of the snapshot */
  timestamp: Date;
  /** All top-level menu items found */
  items: MenuItem[];
  /** Total item count including children */
  totalCount: number;
}

export interface NavigationResult {
  /** Whether navigation succeeded */
  success: boolean;
  /** The menu item that was targeted */
  item: MenuItem;
  /** Screen that loaded after clicking */
  screenName: string | null;
  /** Error message if navigation failed */
  error: string | null;
  /** Whether the menu structure changed after navigation */
  menuChanged: boolean;
  /** Menu state before the click */
  menuBefore: MenuState | null;
  /** Menu state after the click */
  menuAfter: MenuState | null;
}

export class MenuNavigator {
  private readonly driver: WebDriver;
  private readonly config: SeleniumBaselineConfig;

  constructor(driver: WebDriver, config: SeleniumBaselineConfig) {
    this.driver = driver;
    this.config = config;
  }

  /**
   * Discover all menu items from the DOM by querying the menu container.
   * Returns a snapshot of the current menu structure.
   */
  async discoverMenu(): Promise<MenuState> {
    const container = await this.driver.findElement(this.config.menuContainerSelector as unknown as By);
    const itemElements = await container.findElements(this.config.menuItemSelector as unknown as By);

    const items: MenuItem[] = [];
    for (const el of itemElements) {
      const text = (await el.getText()).trim();
      const hasChildren = await this.hasSubNav(el);
      let children: string[] = [];
      if (hasChildren) {
        children = await this.discoverChildren(el);
      }
      items.push({
        label: text,
        locator: `text=${text}`,
        hasChildren,
        children,
        clicked: false,
      });
    }

    return {
      timestamp: new Date(),
      items,
      totalCount: items.reduce((sum, item) => sum + 1 + item.children.length, 0),
    };
  }

  /**
   * Check whether a menu item has a sub-navigation panel.
   */
  private async hasSubNav(itemElement: WebElement): Promise<boolean> {
    try {
      const subNav = await itemElement.findElement(this.config.subNavSelector as unknown as By);
      const visible = await subNav.isDisplayed();
      return visible;
    } catch {
      return false;
    }
  }

  /**
   * Discover child labels within a menu item's sub-navigation.
   */
  private async discoverChildren(itemElement: WebElement): Promise<string[]> {
    try {
      const subNav = await itemElement.findElement(this.config.subNavSelector as unknown as By);
      const childElements = await subNav.findElements('css selector', 'a, div, span');
      const labels: string[] = [];
      for (const el of childElements) {
        const text = (await el.getText()).trim();
        if (text) labels.push(text);
      }
      return labels;
    } catch {
      return [];
    }
  }

  /**
   * Click a menu item by its label. If the item has children and a subLabel
   * is provided, clicks the child instead.
   */
  async clickMenuItem(topLabel: string, subLabel?: string): Promise<boolean> {
    if (!subLabel) {
      const item = await this.findItemByLabel(topLabel);
      if (!item) return false;
      await item.click();
      await this.waitForNavigation();
      return true;
    }

    // For nested items: first expand the parent if needed, then click child
    const parent = await this.findItemByLabel(topLabel);
    if (!parent) return false;

    // Check if children are already visible
    const children = await this.discoverChildren(parent);
    if (!children.includes(subLabel)) {
      await parent.click();
      await this.waitForNavigation();
    }

    const child = await this.findSubItemByLabel(topLabel, subLabel);
    if (!child) return false;
    await child.click();
    await this.waitForNavigation();
    return true;
  }

  /**
   * Find a top-level menu item element by its display label.
   */
  private async findItemByLabel(label: string): Promise<WebElement | null> {
    const items = await this.driver.findElements(this.config.menuItemSelector as unknown as By);
    for (const el of items) {
      const text = (await el.getText()).trim();
      if (text === label) return el;
    }
    return null;
  }

  /**
   * Find a sub-item within a parent menu item by its display label.
   */
  private async findSubItemByLabel(parentLabel: string, subLabel: string): Promise<WebElement | null> {
    const parent = await this.findItemByLabel(parentLabel);
    if (!parent) return null;
    try {
      const subNav = await parent.findElement(this.config.subNavSelector as unknown as By);
      const children = await subNav.findElements('css selector', 'a, div, span');
      for (const el of children) {
        const text = (await el.getText()).trim();
        if (text === subLabel) return el;
      }
    } catch {
      /* no sub-nav found */
    }
    return null;
  }

  /**
   * Wait for SPA navigation to settle after a menu click.
   */
  private async waitForNavigation(): Promise<void> {
    const delay = this.config.navigationDelayMs;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  /**
   * Compare two menu states for structural equality.
   * Returns true if the structures match (same items, same order, same children).
   */
  compareMenuStates(before: MenuState, after: MenuState): boolean {
    if (before.items.length !== after.items.length) return false;
    if (before.totalCount !== after.totalCount) return false;

    for (let i = 0; i < before.items.length; i++) {
      const bItem = before.items[i];
      const aItem = after.items[i];
      if (!bItem || !aItem) return false;

      if (bItem.label !== aItem.label) return false;
      if (bItem.hasChildren !== aItem.hasChildren) return false;
      if (bItem.children.length !== aItem.children.length) return false;

      for (let j = 0; j < bItem.children.length; j++) {
        if (bItem.children[j] !== aItem.children[j]) return false;
      }
    }

    return true;
  }

  /**
   * Get the current page's apparent screen name from the page header.
   */
  async getCurrentScreenName(): Promise<string | null> {
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
   * Navigate to a menu item and return the full navigation result.
   */
  async navigateAndValidate(topLabel: string, subLabel?: string): Promise<NavigationResult> {
    const menuBefore = await this.discoverMenu();
    const item = menuBefore.items.find((m) => m.label === topLabel) ?? {
      label: topLabel,
      locator: `text=${topLabel}`,
      hasChildren: false,
      children: [],
      clicked: false,
    };

    let success = true;
    let screenName: string | null = null;
    let error: string | null = null;

    try {
      const clicked = await this.clickMenuItem(topLabel, subLabel);
      if (!clicked) {
        success = false;
        error = `Menu item "${topLabel}" not found or not clickable`;
      } else {
        screenName = await this.getCurrentScreenName();
      }
    } catch (err) {
      success = false;
      error = (err as Error).message;
    }

    const menuAfter = await this.discoverMenu();
    const menuChanged = !this.compareMenuStates(menuBefore, menuAfter);

    return {
      success,
      item,
      screenName,
      error,
      menuChanged,
      menuBefore,
      menuAfter,
    };
  }

  /**
   * Get all top-level menu labels as an ordered list.
   */
  async getMenuLabels(): Promise<string[]> {
    const state = await this.discoverMenu();
    return state.items.map((i) => i.label);
  }
}
