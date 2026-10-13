// Drives the deployed web console with a real (headless) browser for the SIT engine's
// UI phase: cases in sit/cases/60-*.sit.ts perform the same clicks a person would,
// instead of calling the app's API directly like the rest of sit/cases/*.sit.ts does.
// Needs Chromium — see sit/Dockerfile (based on mcr.microsoft.com/playwright, which
// bundles a matching browser) rather than the lighter node:22 image the rest of this
// engine's cases run under.
import { chromium, type Browser, type Page } from "playwright";
import { ENV } from "./env.ts";

// Unset in the shipped Docker image (playwright's own browser resolution finds the
// version bundled in the base image); set only for running these cases outside that
// image, e.g. against a pre-installed Chromium during local development.
const CHROMIUM_PATH = process.env.SIT_CHROMIUM_PATH || undefined;

export async function withConsolePage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser: Browser = await chromium.launch({
    headless: true,
    executablePath: CHROMIUM_PATH,
    args: ["--no-sandbox"],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    return await fn(page);
  } finally {
    await browser.close();
  }
}

// apps/web/public/config/login.json decides whether the console auto-authenticates
// (loginScreenEnabled: false) or shows the sign-in gate and waits for a click
// (loginScreenEnabled: true — the default since 2d06753's multi-tenancy/sign-in-page
// work). Either way #gate hides once a session exists — that's the real, user-visible
// signal sign-in and mount succeeded — so this handles both: click Sign in only if the
// gate is still up, using the tenant/username the gate itself pre-fills from login.json.
export async function openConsole(page: Page): Promise<void> {
  await page.goto(`${ENV.webBase}/`, { waitUntil: "networkidle", timeout: 30000 });
  const gate = page.locator("#gate");
  if (await gate.isVisible().catch(() => false)) {
    await page.locator("#login").click();
  }
  await page.waitForSelector("#gate", { state: "hidden", timeout: 20000 });
}

// Navigates the mounted console to the Configuration page by clicking the real sidebar
// nav item (not a direct URL — this is a client-rendered SPA), then waits for the
// Eventing submenu, which owns the delivery controls in the current navigation.
export async function openConfigurationPage(page: Page): Promise<void> {
  await page.locator(".opsc-navitem", { hasText: "Configuration" }).first().click();
  await page.locator('.opsc-subitem', { hasText: /^Eventing$/ }).click();
  await page.waitForSelector("#sbe-eventing-dummy", { timeout: 10000 });
}

// Selects a delivery channel and clicks "Send dummy message" in the Eventing panel,
// returning the status text the console itself reports (e.g. "Testhub captured mq").
export async function sendDummyMessage(page: Page, channel: "mq" | "kafka" | "api"): Promise<string> {
  await page.selectOption("#sbe-ev-channel", channel);
  await page.click("#sbe-eventing-dummy");
  await page.waitForFunction(
    () => {
      const el = document.getElementById("sbe-ev-status");
      return Boolean(el && el.textContent && el.textContent.trim().length > 0);
    },
    { timeout: 10000 }
  );
  return ((await page.textContent("#sbe-ev-status")) || "").trim();
}
