import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { WebDriver } from "selenium-webdriver";
import { newDriver, openConsole, openNav } from "../lib/selenium.ts";

// Selenium-driven menu structure stability: navigates every leaf page
// and verifies the sidebar menu structure is unchanged after each click.
// A drifting menu (items added/removed/reordered) is a real regression
// — it means the app's nav rendering is stateful or buggy.

let driver: WebDriver;

before(async () => {
  driver = await newDriver();
  await openConsole(driver);
});

after(async () => {
  if (driver) await driver.quit();
});

async function menuSnapshot(driver: WebDriver): Promise<Array<{ label: string; children: string[] }>> {
  const items = await driver.findElements(".opsc-navitem");
  const snapshot: Array<{ label: string; children: string[] }> = [];
  for (const item of items) {
    const text = (await item.getText()).trim();
    const subEls = await item.findElements(".opsc-subnav div, .opsc-subnav a");
    const children: string[] = [];
    for (const sub of subEls) {
      const subText = (await sub.getText()).trim();
      if (subText) children.push(subText);
    }
    if (text) snapshot.push({ label: text, children });
  }
  return snapshot;
}

function menusEqual(a: Array<{ label: string; children: string[] }>, b: Array<{ label: string; children: string[] }>): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].label !== b[i].label) return false;
    if (a[i].children.length !== b[i].children.length) return false;
    for (let j = 0; j < a[i].children.length; j++) {
      if (a[i].children[j] !== b[i].children[j]) return false;
    }
  }
  return true;
}

// Every leaf page in the sidebar — same list as sit/cases/70-ui-pages.sit.ts
const PAGES = [
  ["Overview", undefined],
  ["Rule Bench", "Existing rules"],
  ["Rule Bench", "Create new rule"],
  ["Rule Bench", "Stage rules"],
  ["Rule Bench", "Validate rules"],
  ["Rule Bench", "Export rules"],
  ["Message Designer", "Create message definition"],
  ["Message Designer", "View saved definitions"],
  ["Message Designer", "Import schema"],
  ["Message Designer", "Export template"],
  ["Datasets", undefined],
  ["Test Cases", undefined],
  ["Test Suites", undefined],
  ["Test Runs", "Active runs"],
  ["Test Runs", "All test runs"],
  ["Test Runs", "Run history"],
  ["Test Runs", "New test run"],
  ["Schedules", "Upcoming schedules"],
  ["Schedules", "All schedules"],
  ["Schedules", "New schedule"],
  ["Reports", "All reports"],
  ["Reports", "Coverage reports"],
  ["Reports", "Compliance reports"],
  ["Reports", "Scheduled exports"],
  ["Configuration", undefined],
  ["Configuration", "Environment defaults"],
  ["Configuration", "Notifications"],
  ["Configuration", "API access"],
  ["Configuration", "Data retention"],
  ["Configuration", "User roles"],
  ["Configuration", "Eventing"],
  ["Configuration", "App configs"],
  ["Configuration", "Functional access"],
  ["Naming conventions", undefined],
  ["Configuration", "External systems"],
  ["Configuration", "Use-case templates"],
  ["Configuration", "Feature IDs"],
  ["Configuration", "Use-case review"],
  ["Configuration", "Application Events"],
] as const;

for (const [top, sub] of PAGES) {
  const label = sub ? `${top} → ${sub}` : top;
  test(`menu structure stable after ${label}`, async () => {
    const before = await menuSnapshot(driver);
    await openNav(driver, top, sub);
    const after = await menuSnapshot(driver);
    assert.ok(
      menusEqual(before, after),
      `menu structure changed after navigating to "${label}": before=${JSON.stringify(before.map((i) => i.label))} after=${JSON.stringify(after.map((i) => i.label))}`,
    );
  });
}
