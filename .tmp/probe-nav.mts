// Scratch probe (not part of the suite): maps the deployed console's navigation —
// every top item, its sub-items, and the page header each one renders. One fresh
// page load per top item so one menu's state cannot leak into the next.
import { withConsolePage, openConsole } from "../sit/lib/ui.ts";
import type { Page } from "playwright";

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (s: string) => new RegExp(`^\\s*${esc(s)}\\s*$`);

async function title(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.querySelector(".opsc-pagehead-title, .opsc-hero-title");
    return el ? (el.textContent || "").trim() : "";
  });
}

async function settledTitle(page: Page, previous: string): Promise<string> {
  const deadline = Date.now() + 6000;
  let current = await title(page);
  while (Date.now() < deadline && (current === previous || current === "")) {
    await page.waitForTimeout(250);
    current = await title(page);
  }
  return current;
}

const only = process.argv.slice(2);

await withConsolePage(async (page) => {
  await openConsole(page);
  const tops = (await page.locator(".opsc-navitem").allInnerTexts()).map((t) => t.trim().replace(/\s+/g, " "));
  const out: Record<string, unknown> = {};
  for (const top of tops) {
    if (only.length && !only.includes(top)) continue;
    await openConsole(page);
    const home = await title(page);
    await page.locator(".opsc-navitem", { hasText: exact(top) }).first().click();
    await page.waitForTimeout(1200);
    const topTitle = await title(page);
    const subs = (await page.locator(".opsc-subitem").allInnerTexts()).map((t) => t.trim());
    const subTitles: Record<string, string> = {};
    let previous = topTitle;
    for (const sub of subs) {
      const item = page.locator(".opsc-subitem", { hasText: exact(sub) }).first();
      if (!(await item.count())) { subTitles[sub] = "(sub-item vanished)"; continue; }
      await item.click();
      previous = await settledTitle(page, previous);
      subTitles[sub] = previous;
    }
    const navStill = (await page.locator(".opsc-navitem").allInnerTexts()).length;
    out[top] = { home, titleAfterTopClick: topTitle, subs: subTitles, navItemsAfter: navStill };
  }
  console.log(JSON.stringify(out, null, 1));
});
