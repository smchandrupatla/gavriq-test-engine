// Scratch probe (not part of the suite): which elements make the signed-in console wider
// than a 390px phone viewport?
import { chromium } from "playwright";
import { ENV } from "../sit/lib/env.ts";

const shot = process.argv[2];
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(`${ENV.webBase}/`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill("#gate #tenant", ENV.tenantSlug);
  await page.fill("#gate #username", ENV.username);
  await page.click("#gate #login");
  await page.waitForSelector("#gate", { state: "hidden", timeout: 20000 });
  await page.waitForTimeout(2500);
  const report = await page.evaluate(`(() => {
    var vw = window.innerWidth;
    var root = document.scrollingElement || document.documentElement;
    var wide = [];
    document.querySelectorAll("body *").forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.right > vw + 1) {
        wide.push({
          el: el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : ""),
          left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
          text: (el.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 40),
        });
      }
    });
    wide.sort(function (a, b) { return b.right - a.right; });
    return { viewport: vw, scrollWidth: root.scrollWidth, overflowPx: root.scrollWidth - vw, offenders: wide.slice(0, 14) };
  })()`);
  console.log(JSON.stringify(report, null, 1));
  if (shot) await page.screenshot({ path: shot, fullPage: false });
} finally {
  await browser.close();
}
