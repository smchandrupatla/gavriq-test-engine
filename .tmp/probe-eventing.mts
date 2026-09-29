// Scratch probe (not part of the suite): why does Configuration > Eventing show no controls?
import { withConsolePage, openConsole } from "../sit/lib/ui.ts";

await withConsolePage(async (page) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 200)}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 200)}`); });
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`); });

  await openConsole(page);
  await page.locator(".opsc-navitem", { hasText: "Configuration" }).first().click();
  await page.locator(".opsc-subitem", { hasText: /^Eventing$/ }).click();
  await page.waitForTimeout(8000);

  const state = await page.evaluate(() => ({
    title: document.title,
    workbench: !!document.getElementById("sbe-workbench"),
    dummy: !!document.getElementById("sbe-eventing-dummy"),
    save: !!document.getElementById("sbe-eventing-save"),
    pageTitleEls: [...document.querySelectorAll(".opsc-pagetitle, .opsc-title, h1, h2")].map((e) => `${e.tagName}.${e.className}: ${(e.textContent || "").trim().slice(0, 60)}`),
    scripts: [...document.scripts].map((s) => s.src.replace(/^https?:\/\/[^/]+/, "")).filter(Boolean),
    main: (document.querySelector("#console-root main, #console-root .opsc-main, #console-root")?.textContent || "").trim().replace(/\s+/g, " ").slice(0, 700),
  }));
  console.log(JSON.stringify(state, null, 1));
  console.log("ERRORS:", JSON.stringify(errors.slice(0, 12), null, 1));
  console.log("FAILED REQUESTS:", JSON.stringify([...new Set(failed)].slice(0, 20), null, 1));
  await page.screenshot({ path: process.argv[2] || "eventing.png", fullPage: false });
});
