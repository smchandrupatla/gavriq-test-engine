// Scratch probe (not part of the suite): opens one console form page and lists the
// fields and buttons it actually renders.
//   tsx .tmp/probe-form.mts "<Top>" "<Sub>" <screenshot.png>
import { withConsolePage, openConsole } from "../sit/lib/ui.ts";

const [top, sub, shot] = process.argv.slice(2);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (s: string) => new RegExp(`^\\s*${esc(s)}\\s*$`);

// Passed as source text: tsx wraps named functions in a helper the page does not have.
const IN_PAGE = `(() => {
  function visible(e) { return e.offsetParent !== null; }
  function text(e) { return ((e && e.textContent) || "").trim().replace(/\\s+/g, " ").slice(0, 60); }
  return {
    url: location.href,
    h1: Array.from(document.querySelectorAll("h1")).filter(visible).map(text),
    opscFields: Array.from(document.querySelectorAll(".opsc-field")).filter(visible).map(function (f) {
      return {
        label: text(f.querySelector(".opsc-field-label")),
        control: Array.from(f.querySelectorAll("input,textarea,select")).map(function (c) { return c.tagName.toLowerCase(); }).join(","),
      };
    }),
    labels: Array.from(document.querySelectorAll("label")).filter(visible).map(function (l) {
      var c = l.querySelector("input,textarea,select") || (l.getAttribute("for") ? document.getElementById(l.getAttribute("for")) : null);
      return text(l) + " -> " + (c ? c.tagName.toLowerCase() + "#" + c.id + "[name=" + (c.getAttribute("name") || "") + "]" : "?");
    }).slice(0, 30),
    inputs: Array.from(document.querySelectorAll("input,textarea,select")).filter(visible).map(function (c) {
      return c.tagName.toLowerCase() + "#" + c.id + "[name=" + (c.getAttribute("name") || "") + "][aria=" + (c.getAttribute("aria-label") || "") + "][ph=" + (c.placeholder || "") + "]";
    }).slice(0, 30),
    buttons: Array.from(document.querySelectorAll("button,[role='button']")).filter(visible).map(function (b) {
      return b.tagName.toLowerCase() + "#" + b.id + "[aria=" + (b.getAttribute("aria-label") || "") + "] " + text(b);
    }).slice(0, 40),
  };
})()`;

await withConsolePage(async (page) => {
  await openConsole(page);
  await page.locator(".opsc-navitem", { hasText: exact(top) }).first().click();
  await page.waitForTimeout(800);
  if (sub) await page.locator(".opsc-subitem", { hasText: exact(sub) }).first().click();
  await page.waitForTimeout(4000);
  console.log(JSON.stringify(await page.evaluate(IN_PAGE), null, 1));
  if (shot) await page.screenshot({ path: shot });
});
