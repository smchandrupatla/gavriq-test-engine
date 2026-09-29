// Scratch probe (not part of the suite): opens one console page and reports what it
// renders — headers, errors, failed requests — plus a screenshot.
//   tsx .tmp/probe-page.mts "<Top>" "<Sub>" <screenshot.png>
import { withConsolePage, openConsole } from "../sit/lib/ui.ts";

const [top, sub, shot] = process.argv.slice(2);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (s: string) => new RegExp(`^\\s*${esc(s)}\\s*$`);

await withConsolePage(async (page) => {
  const errors: string[] = [];
  const failed: string[] = [];
  await openConsole(page);
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message.slice(0, 300)}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`console: ${m.text().slice(0, 300)}`); });
  page.on("response", (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.request().method()} ${r.url().replace(/^https?:\/\/[^/]+/, "")}`); });

  await page.locator(".opsc-navitem", { hasText: exact(top) }).first().click();
  await page.waitForTimeout(800);
  if (sub) await page.locator(".opsc-subitem", { hasText: exact(sub) }).first().click();
  await page.waitForTimeout(5000);

  const state = await page.evaluate(() => ({
    url: location.href,
    navItems: document.querySelectorAll(".opsc-navitem").length,
    headers: [...document.querySelectorAll("h1,h2,h3,[class*='title']")]
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}: ${(e.textContent || "").trim().slice(0, 70)}`)
      .slice(0, 14),
    bodyText: (document.querySelector(".opsc-content, .opsc-main, #console-root")?.textContent || document.body.textContent || "")
      .replace(/\.opsc[^}]*\}/g, "").trim().replace(/\s+/g, " ").slice(0, 400),
  }));
  console.log(JSON.stringify(state, null, 1));
  console.log("ERRORS:", JSON.stringify([...new Set(errors)].slice(0, 8), null, 1));
  console.log("FAILED REQUESTS:", JSON.stringify([...new Set(failed)].slice(0, 12), null, 1));
  if (shot) await page.screenshot({ path: shot });
});
