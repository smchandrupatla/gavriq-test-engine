// Scratch probe (not part of the suite): signs in as the SIT persona and reports what the
// deployed console actually renders, so stale selectors can be corrected against reality.
import { withConsolePage, openConsole } from "../sit/lib/ui.ts";

const target = process.argv[2] || "Configuration";
const sub = process.argv[3];

await withConsolePage(async (page) => {
  await openConsole(page);
  const nav = await page.locator(".opsc-navitem").allInnerTexts();
  console.log("NAV:", JSON.stringify(nav.map((t) => t.trim().replace(/\s+/g, " "))));
  await page.locator(".opsc-navitem", { hasText: target }).first().click();
  await page.waitForTimeout(1500);
  const subs = await page.locator(".opsc-subitem").allInnerTexts();
  console.log("SUBITEMS:", JSON.stringify(subs.map((t) => t.trim())));
  if (sub) {
    await page.locator(".opsc-subitem", { hasText: new RegExp(`^${sub}$`) }).first().click();
    await page.waitForTimeout(2500);
  }
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll("[id]")]
      .map((e) => e.id)
      .filter((id) => /^sbe-|eventing|ev-/.test(id))
      .slice(0, 80)
  );
  console.log("SBE IDS:", JSON.stringify(ids));
  const buttons = await page.evaluate(() =>
    [...document.querySelectorAll("button, select, input")]
      .filter((e) => (e as HTMLElement).offsetParent !== null)
      .map((e) => `${e.tagName.toLowerCase()}#${e.id || ""}[${(e.textContent || (e as HTMLInputElement).placeholder || "").trim().slice(0, 40)}]`)
      .slice(0, 80)
  );
  console.log("VISIBLE CONTROLS:", JSON.stringify(buttons));
  const heading = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3")].map((e) => (e.textContent || "").trim()).slice(0, 12));
  console.log("HEADINGS:", JSON.stringify(heading));
});
