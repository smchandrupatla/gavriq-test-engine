// Selenium WebDriver helpers for the SIT engine's comprehensive GUI test suite
// (sit/cases/70-ui-pages.sit.ts, 80-ui-workflows.sit.ts and onward). Added alongside —
// not instead of — the existing Playwright-driven UI phase (sit/lib/ui.ts,
// sit/cases/60-ui-eventing.sit.ts): this framework covers per-page navigation,
// multi-field workflows, and the database-integrity checks that follow them, and is
// deliberately its own thing — it does not import from or depend on sit/lib/ui.ts.
//
// Independence from the main application is architectural, not about the choice of
// browser driver: like every other SIT case, this only ever drives the deployed web
// console through the same DOM a real operator clicks (nav items, form fields, buttons
// identified by their visible label/aria-label) and confirms effects through the
// public API or the db viewer. The application has no idea Selenium is involved.
import { Builder, By, Select, until, type WebDriver, type WebElement } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { ENV } from "./env.ts";

// Unset in the shipped Docker image — sit/Dockerfile installs a version-matched
// chromium/chromium-driver pair from the base image's own package repository and
// points these at it. Overridable for running these cases outside that image (e.g.
// against a manually matched pair during local development).
const CHROME_BINARY = process.env.SIT_CHROME_BINARY || undefined;
const CHROMEDRIVER_PATH = process.env.SIT_CHROMEDRIVER_PATH || undefined;

function buildChromeOptions() {
  const options = new chrome.Options();
  options.addArguments(
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--window-size=1280,1000"
  );
  if (CHROME_BINARY) options.setChromeBinaryPath(CHROME_BINARY);
  if (process.env.BASELINE_CONTAINER === '1') options.addArguments('--host-resolver-rules=MAP unpkg.com ~NOTFOUND');
  return options;
}

export async function newDriver(): Promise<WebDriver> {
  let builder = new Builder().forBrowser("chrome").setChromeOptions(buildChromeOptions());
  if (CHROMEDRIVER_PATH) builder = builder.setChromeService(new chrome.ServiceBuilder(CHROMEDRIVER_PATH));
  return builder.build();
}

export async function withDriver<T>(fn: (driver: WebDriver) => Promise<T>): Promise<T> {
  const driver = await newDriver();
  try {
    return await fn(driver);
  } finally {
    await driver.quit();
  }
}

// The console auto-authenticates on load and mounts the SPA into #console-root once
// #gate is hidden (apps/web/public/js/live-bind.js's enter() adds the "hidden" class
// to #gate on success) — the same real, user-visible signal sit/lib/ui.ts waits on.
export async function openConsole(driver: WebDriver): Promise<void> {
  await driver.get(`${ENV.webBase}/`);
  await driver.wait(async () => {
    const gates = await driver.findElements(By.id("gate"));
    if (!gates.length) return true;
    const cls = (await gates[0].getAttribute("class")) || "";
    return cls.split(/\s+/).includes("hidden");
  }, 20000, "console gate never hid — sign-in/mount did not complete");
  await driver.wait(until.elementLocated(By.css('#console-root .opsc-sidebar')), 20000, 'console sidebar did not mount');
}

async function firstWithText(driver: WebDriver, css: string, text: string): Promise<WebElement> {
  const els: WebElement[] = await driver.findElements(By.css(css));
  for (const el of els) {
    const t = ((await el.getText()) || "").trim();
    if (t.includes(text)) return el;
  }
  throw new Error(`no element matching "${css}" contains text "${text}"`);
}

async function subnavElements(driver: WebDriver, text: string): Promise<WebElement[]> {
  const els: WebElement[] = await driver.findElements(By.css(".opsc-subnav div, .opsc-subnav a"));
  const matches: WebElement[] = [];
  for (const el of els) {
    if (((await el.getText()) || "").trim() === text) matches.push(el);
  }
  return matches;
}

// Navigates the mounted console the way a person would: click the sidebar's real nav
// item, and for a nested page, the real sub-item under it. The sidebar is an accordion
// that stays expanded once opened (apps/web/public/js/ops-console-preview.js's
// Sidebar component never auto-collapses a group), so this only clicks the parent when
// the child isn't already visible — clicking an already-expanded parent again would
// toggle it shut and take the child with it.
export async function openNav(driver: WebDriver, topLabel: string, subLabel?: string): Promise<void> {
  if (!subLabel) {
    const item = await firstWithText(driver, ".opsc-navitem", topLabel);
    await item.click();
    await driver.sleep(250);
    return;
  }
  let subEls = await subnavElements(driver, subLabel);
  if (!subEls.length) {
    const parent = await firstWithText(driver, ".opsc-navitem", topLabel);
    await parent.click();
    await driver.sleep(300);
    subEls = await subnavElements(driver, subLabel);
  }
  if (!subEls.length) throw new Error(`sub-nav item "${subLabel}" under "${topLabel}" never appeared`);
  await subEls[0].click();
  await driver.sleep(250);
}

// Every leaf page (list/form/settings templates and the two hero-style pages) renders
// its real title through one of these two classes — see PageHeader and the Overview /
// Message Designer hero markup in ops-console-preview.js.
export async function pageTitle(driver: WebDriver): Promise<string> {
  const els = await driver.findElements(By.css(".opsc-pagehead-title, .opsc-hero-title"));
  if (!els.length) return "";
  return ((await els[0].getText()) || "").trim();
}

async function fieldContainer(driver: WebDriver, label: string): Promise<WebElement> {
  const fields: WebElement[] = await driver.findElements(By.css(".opsc-field"));
  for (const field of fields) {
    const labelEls = await field.findElements(By.css(".opsc-field-label"));
    if (labelEls.length && ((await labelEls[0].getText()) || "").trim() === label) return field;
  }
  throw new Error(`form field not found: "${label}"`);
}

// Sets a text/textarea field by its visible label (FormField in ops-console-preview.js
// renders no id/name/htmlFor to bind to — the label text is the only stable handle).
export async function setFieldText(driver: WebDriver, label: string, value: string): Promise<void> {
  const field = await fieldContainer(driver, label);
  const inputs: WebElement[] = await field.findElements(By.css("input, textarea"));
  if (!inputs.length) throw new Error(`field "${label}" is not a text input or textarea`);
  await inputs[0].clear();
  await inputs[0].sendKeys(value);
}

export async function selectFieldOption(driver: WebDriver, label: string, optionText: string): Promise<void> {
  const field = await fieldContainer(driver, label);
  const selects: WebElement[] = await field.findElements(By.css("select"));
  if (!selects.length) throw new Error(`field "${label}" is not a select`);
  await new Select(selects[0]).selectByVisibleText(optionText);
}

// Most buttons in the console (IconButton) render icon-only with no visible text — the
// label only ever lands in aria-label/data-tooltip. Clicking by that attribute is the
// one selector that works for every button, whether or not it happens to also show a
// text span.
export async function clickButtonByLabel(driver: WebDriver, label: string): Promise<void> {
  const el = await driver.wait(
    until.elementLocated(By.css(`[role="button"][aria-label="${label}"]`)),
    8000,
    `button "${label}" never appeared`
  );
  await driver.wait(until.elementIsVisible(el), 4000);
  await el.click();
}

// Clicks the first element matching css whose text contains the given text — used for
// the Message Designer wizard's family/message-type tiles, which are plain clickable
// divs (not IconButtons) identified by their visible name.
export async function clickTileByText(driver: WebDriver, css: string, text: string): Promise<void> {
  const el = await firstWithText(driver, css, text);
  await el.click();
}

// Waits for the console's success toast (rendered on every FormPageTemplate submit and
// on the Message Designer wizard's "Create message(s)") and returns its text so the
// caller can assert on it — the toast text is the UI's own claim of success, always
// checked here alongside an independent check that the write actually landed.
export async function waitForToast(driver: WebDriver, timeoutMs = 8000): Promise<string> {
  const el = await driver.wait(until.elementLocated(By.css(".opsc-toast")), timeoutMs, "no success toast appeared");
  return ((await el.getText()) || "").trim();
}
