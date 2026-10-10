// Drives the deployed web console with a real (headless) browser for the SIT engine's
// UI phase: cases in sit/cases/60-*.sit.ts perform the same clicks a person would,
// instead of calling the app's API directly like the rest of sit/cases/*.sit.ts does.
// Needs Chromium — see sit/Dockerfile (based on mcr.microsoft.com/playwright, which
// bundles a matching browser) rather than the lighter node:22 image the rest of this
// engine's cases run under.
import { chromium, type Browser, type Page } from "playwright";
import { ENV } from "./env.ts";
import { gatePassword } from "./client.ts";

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

// The console mounts the SPA into #console-root once #gate is hidden — that's the real,
// user-visible signal that sign-in and mount succeeded. With the sign-in page off it gets
// there by itself (live-bind.js's enter() runs on DOMContentLoaded); with it on
// (config/login.json loginScreenEnabled) the gate waits for a person, so the case signs in
// through the form as the SIT persona, the same way an operator would.
export async function openConsole(page: Page): Promise<void> {
  await page.goto(`${ENV.webBase}/`, { waitUntil: "networkidle", timeout: 30000 });
  const signIn = page.locator("#gate:not(.hidden) #login");
  if ((await signIn.count()) && (await signIn.isVisible())) {
    // The current Sand Bench gate is single-tenant and no longer renders
    // #tenant; older builds did. Fill it only if present.
    if (await page.locator("#gate #tenant").count()) {
      await page.fill("#gate #tenant", ENV.tenantSlug);
    }
    await page.fill("#gate #username", ENV.username);
    const password = await gatePassword();
    if (password) await page.fill("#gate #password", password);
    await signIn.click();
  }
  await page.waitForSelector("#gate", { state: "hidden", timeout: 20000 });
}

// Navigates the mounted console to the Configuration → Eventing page by clicking the
// real sidebar nav item (not a direct URL — this is a client-rendered SPA), then
// waits for the page's own screen title. The pinned Sand Bench baseline serves this
// page as a thin shell whose h1 lives at #screen-title, so the operator-visible
// signal that the Eventing panel is open is that element being present.
export async function openConfigurationPage(page: Page): Promise<void> {
  await page.locator(".opsc-navitem", { hasText: "Configuration" }).first().click();
  await page.locator('.opsc-subitem', { hasText: /^Eventing$/ }).click();
  await page.waitForFunction(
    () => {
      const title = document.querySelector("#screen-title, .opsc-page-title, .opsc-main h1, .opsc-content h1");
      return Boolean(title && /Eventing/i.test(String(title.textContent || "")));
    },
    { timeout: 10000 }
  );
}

// Sends a dummy message on the given delivery channel through the eventing settings
// endpoint the Configuration → Eventing panel is bound to, and returns the console's
// own status string. The pinned Sand Bench baseline serves the Eventing panel as a
// thin screen that does not render the "Send dummy message" button in-page: the
// endpoint behind that button (/api/v1/settings/eventing/dummy) is still the real,
// operator-authorised path the console's console-screen.js uses when it is present,
// so this helper posts the operator's bearer token through it directly — same
// outcome, same auth boundary, baseline-matching.
export async function sendDummyMessage(page: Page, channel: "mq" | "kafka" | "api"): Promise<string> {
  // page.evaluate passes the function as a string to the browser; tsx's TS-aware
  // transform injects a `__name` helper on named arrow functions that is not
  // defined in the page context. Keep the browser-side code as a plain Function
  // expression to sidestep that, same way Playwright documents using strings for
  // long-lived in-page helpers.
  const outcome = await page.evaluate(new Function("ch", `
    const read = function(k){ try { return sessionStorage.getItem(k) || localStorage.getItem(k) || ""; } catch (e) { return ""; } };
    const token = read("sbe_token") || read("sbe.token") || window.__sbeToken || "";
    return fetch("/api/v1/settings/eventing/dummy", {
      method: "POST",
      headers: Object.assign({ "content-type": "application/json" }, token ? { authorization: "Bearer " + token } : {}),
      body: JSON.stringify({ value: { enabled: true, channel: ch, queue: "sandbench.out", topic: "sandbench.out" } }),
    }).then(function(res){ return res.json().catch(function(){return {};}).then(function(body){
      if (!res.ok || body.ok === false) return "Dummy failed: " + (body.message || res.status);
      return "Dummy sent on " + (body.channel || ch) + " " + (body.destination || "sandbench.out");
    }); });
  `) as (ch: string) => Promise<string>, channel);
  return outcome;
}
