// Scratch probe (not part of the suite): fills and submits one console form and reports
// what the console says afterwards (toast / status / navigation / API calls).
//   tsx .tmp/probe-submit.mts rule|run|schedule <screenshot.png>
import { withConsolePage, openConsole } from "../sit/lib/ui.ts";

const [kind, shot] = process.argv.slice(2);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const exact = (s: string) => new RegExp(`^\\s*${esc(s)}\\s*$`);
const stamp = `sit-probe-${kind}-${Date.now()}`;

const FORMS: Record<string, { top: string; sub: string; fill: (page: import("playwright").Page) => Promise<void> }> = {
  rule: {
    top: "Rule Bench", sub: "Create new rule",
    fill: async (page) => {
      await page.fill("[name=name]", stamp);
      const cats = await page.locator("[name=category] option").allInnerTexts();
      const sevs = await page.locator("[name=severity] option").allInnerTexts();
      console.log("category options:", JSON.stringify(cats), "severity options:", JSON.stringify(sevs));
      await page.selectOption("[name=category]", { label: "Fraud" });
      await page.selectOption("[name=severity]", { label: "Critical" });
      await page.locator("button", { hasText: exact("Amount threshold") }).click();
      await page.waitForTimeout(300);
      console.log("condition after template click:", JSON.stringify(await page.inputValue("[name=condition]")));
    },
  },
  run: {
    top: "Test Runs", sub: "New test run",
    fill: async (page) => {
      console.log("defaults:", JSON.stringify({
        messageTypeCode: await page.inputValue("[name=messageTypeCode]"),
        count: await page.inputValue("[name=count]"),
        channel: await page.inputValue("[name=channel]"),
      }));
      await page.fill("[name=messageTypeCode]", "pain.001.001.09");
      await page.fill("[name=count]", "1");
      await page.selectOption("[name=channel]", "file");
      await page.fill("[name=seed]", stamp);
    },
  },
  schedule: {
    top: "Schedules", sub: "New schedule",
    fill: async (page) => {
      await page.fill("[name=name]", stamp);
      const targets = await page.locator("[name=targetId] option").allInnerTexts();
      const cadences = await page.locator("[name=cadence] option").evaluateAll((os) => os.map((o) => `${(o as HTMLOptionElement).value}=${o.textContent}`));
      console.log("targets:", targets.length, JSON.stringify(targets.slice(0, 4)), "cadences:", JSON.stringify(cadences));
      await page.selectOption("[name=targetId]", { index: 1 });
      await page.selectOption("[name=cadence]", { label: "Weekly" });
    },
  },
};

const form = FORMS[kind];
if (!form) throw new Error("kind must be rule|run|schedule");

await withConsolePage(async (page) => {
  const calls: string[] = [];
  await openConsole(page);
  page.on("response", async (r) => {
    const m = r.request().method();
    if (m === "GET") return;
    let body = "";
    try { body = (await r.text()).slice(0, 260); } catch { /* ignore */ }
    calls.push(`${r.status()} ${m} ${r.url().replace(/^https?:\/\/[^/]+/, "")} -> ${body}`);
  });
  await page.locator(".opsc-navitem", { hasText: exact(form.top) }).first().click();
  await page.waitForTimeout(800);
  await page.locator(".opsc-subitem", { hasText: exact(form.sub) }).first().click();
  await page.waitForSelector("#screen-action", { timeout: 15000 });
  await form.fill(page);
  await page.click("#screen-action");
  await page.waitForTimeout(4000);
  const after = await page.evaluate(`(() => {
    function visible(e) { return e.offsetParent !== null; }
    function text(e) { return (e.textContent || "").trim().replace(/\\s+/g, " ").slice(0, 160); }
    var sel = ".opsc-toast, [role=status], [role=alert], [aria-live], .toast, .status, .notice, .banner, [class*=toast], [class*=status], [class*=message], [class*=result]";
    return {
      url: location.href,
      h1: Array.from(document.querySelectorAll("h1")).filter(visible).map(text),
      signals: Array.from(document.querySelectorAll(sel)).filter(visible).map(function (e) { return e.tagName.toLowerCase() + "." + String(e.className).slice(0, 40) + "#" + e.id + ": " + text(e); }).filter(function (s) { return !/: $/.test(s); }).slice(0, 12),
    };
  })()`);
  console.log("STAMP:", stamp);
  console.log(JSON.stringify(after, null, 1));
  console.log("WRITE CALLS:", JSON.stringify(calls, null, 1));
  if (shot) await page.screenshot({ path: shot });
});
