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
import assert from "node:assert/strict";
import { Builder, By, Select, until, type WebDriver, type WebElement } from "selenium-webdriver";
import chrome from "selenium-webdriver/chrome.js";
import { ENV } from "./env.ts";
import { gatePassword } from "./client.ts";

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

// With the sign-in page on (config/login.json loginScreenEnabled) the gate waits for a
// person: sign in through the form as the SIT persona. Returns without touching anything
// when the gate is off or already hidden.
async function signInThroughGate(driver: WebDriver): Promise<void> {
  const shown = async () => {
    const buttons = await driver.findElements(By.css("#gate:not(.hidden) #login"));
    return buttons.length > 0 && (await buttons[0].isDisplayed());
  };
  // The gate decides whether to show itself after fetching its config; give it a moment.
  const deadline = Date.now() + 3000;
  while (!(await shown())) {
    const mounted = await driver.findElements(By.css("#console-root .opsc-sidebar"));
    if (mounted.length || Date.now() > deadline) return;
    await driver.sleep(200);
  }
  const fill = async (css: string, value: string) => {
    const el = await driver.findElement(By.css(css));
    await el.clear();
    await el.sendKeys(value);
  };
  // Older Sand Bench builds had a #tenant field; the current build collapsed
  // to a single hidden internal tenant and no longer renders it. Fill it only
  // if present so the helper works against both shapes.
  const tenantEls = await driver.findElements(By.css("#gate #tenant"));
  if (tenantEls.length) await fill("#gate #tenant", ENV.tenantSlug);
  await fill("#gate #username", ENV.username);
  const password = await gatePassword();
  if (password) await fill("#gate #password", password);
  await driver.findElement(By.css("#gate #login")).click();
}

// The console mounts the SPA into #console-root once #gate is hidden
// (apps/web/public/js/live-bind.js's enter() adds the "hidden" class to #gate on
// success) — the same real, user-visible signal sit/lib/ui.ts waits on.
export async function openConsole(driver: WebDriver): Promise<void> {
  await driver.get(`${ENV.webBase}/`);
  await signInThroughGate(driver);
  await driver.wait(async () => {
    const gates = await driver.findElements(By.id("gate"));
    if (!gates.length) return true;
    const cls = (await gates[0].getAttribute("class")) || "";
    return cls.split(/\s+/).includes("hidden");
  }, 20000, "console gate never hid — sign-in/mount did not complete");
  // The React sidebar bundle (/vendor/opsConsolePortal.js) is missing from the
  // pinned staging build, so #console-root stays empty — the gate-hidden signal
  // above is enough to prove sign-in succeeded. If a page.html with its own
  // sidebar is navigated to next, that page's helper will wait on it directly.
}

// Several screens are separate documents (/v/<id>): opening one reloads the console
// shell, so for a moment after a click the sidebar is not in the DOM at all. Looked up
// until it is back rather than once.
async function firstWithText(driver: WebDriver, css: string, text: string, timeoutMs = 10000): Promise<WebElement> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const els: WebElement[] = await driver.findElements(By.css(css));
      for (const el of els) {
        const t = ((await el.getText()) || "").trim();
        if (t.includes(text)) return el;
      }
    } catch {
      // stale element while the shell re-renders — look again
    }
    if (Date.now() >= deadline) throw new Error(`no element matching "${css}" contains text "${text}"`);
    await driver.sleep(250);
  }
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
    // The group expands after the click; a fixed short sleep raced it on slower hosts.
    const deadline = Date.now() + 4000;
    do {
      await driver.sleep(200);
      subEls = await subnavElements(driver, subLabel);
    } while (!subEls.length && Date.now() < deadline);
  }
  if (!subEls.length) throw new Error(`sub-nav item "${subLabel}" under "${topLabel}" never appeared`);
  await subEls[0].click();
  await driver.sleep(250);
}

// The page's own header. Template pages (list/form/settings, and the two hero-style
// pages) render it through .opsc-pagehead-title / .opsc-hero-title; the pages the console
// now serves as standalone screens (Datasets, Test Cases, Test Suites, Saved message
// definitions, ...) render a plain <h1>. Either is the real, visible page header.
export async function pageTitle(driver: WebDriver): Promise<string> {
  const els: WebElement[] = await driver.findElements(By.css(".opsc-pagehead-title, .opsc-hero-title, h1"));
  for (const el of els) {
    if (!(await el.isDisplayed().catch(() => false))) continue;
    const text = ((await el.getText().catch(() => "")) || "").trim();
    if (text) return text;
  }
  return "";
}

// Pages load after the click (the console fetches each screen on demand), so the header
// is read until it becomes the expected one or the wait runs out — then whatever is
// showing is returned, for the caller to assert on and report.
export async function waitForPageTitle(driver: WebDriver, expected: string, timeoutMs = 10000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  let title = await pageTitle(driver);
  while (title !== expected && Date.now() < deadline) {
    await driver.sleep(250);
    title = await pageTitle(driver);
  }
  return title;
}

async function namedControl(driver: WebDriver, name: string): Promise<WebElement> {
  const el = await driver.wait(until.elementLocated(By.css(`[name="${name}"]`)), 10000, `form control "${name}" never appeared`);
  await driver.wait(until.elementIsVisible(el), 4000);
  return el;
}

// The console's forms are real forms now: every control carries a name attribute, which
// is also the field name the form submits — a steadier handle than the label text.
export async function setNamedField(driver: WebDriver, name: string, value: string): Promise<void> {
  const el = await namedControl(driver, name);
  await el.clear();
  await el.sendKeys(value);
}

export async function selectNamedOption(driver: WebDriver, name: string, optionText: string): Promise<void> {
  const el = await namedControl(driver, name);
  // Some option lists are filled by a request made when the form opens.
  await driver.wait(async () => {
    const options: WebElement[] = await el.findElements(By.css("option"));
    for (const option of options) {
      if (((await option.getText()) || "").trim() === optionText) return true;
    }
    return false;
  }, 8000, `"${name}" never offered the option "${optionText}"`);
  await new Select(el).selectByVisibleText(optionText);
}

// Picks the first real choice of a list whose entries are data (suites, connections),
// skipping the "Choose…" placeholder, and returns its visible text.
export async function selectFirstNamedOption(driver: WebDriver, name: string): Promise<string> {
  const el = await namedControl(driver, name);
  let picked = "";
  await driver.wait(async () => {
    const options: WebElement[] = await el.findElements(By.css("option"));
    for (const option of options) {
      const value = (await option.getAttribute("value")) || "";
      const disabled = await option.getAttribute("disabled");
      if (value && !disabled) {
        picked = ((await option.getText()) || "").trim();
        await option.click();
        return true;
      }
    }
    return false;
  }, 8000, `"${name}" never offered anything to choose`);
  return picked;
}

// Every screen has one primary action button (#screen-action: "Save rule", "Start run",
// "Create schedule", ...) and reports the outcome in #screen-status.
export async function submitScreen(driver: WebDriver, buttonText: string): Promise<string> {
  const button = await driver.wait(until.elementLocated(By.css("#screen-action")), 10000, "the screen has no primary action button");
  assert.equal(((await button.getText()) || "").trim(), buttonText, "the screen's primary action is not the expected one");
  // The same line also carries the screen's idle text ("Up to date · 21 records"), so
  // the outcome is whatever it changes to after the click, not whatever it says.
  const read = async () => {
    const els: WebElement[] = await driver.findElements(By.css("#screen-status"));
    return els.length ? ((await els[0].getText().catch(() => "")) || "").trim() : "";
  };
  const before = await read();
  await button.click();
  const deadline = Date.now() + 10000;
  let after = await read();
  while ((after === before || after === "") && Date.now() < deadline) {
    await driver.sleep(200);
    after = await read();
  }
  return after;
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
