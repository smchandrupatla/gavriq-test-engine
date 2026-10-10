import { test } from "node:test";
import assert from "node:assert/strict";
import { officialPageIds, officialNavLabels, contractFor, STATIC_PAGES } from "../lib/selenium/screens.mjs";
import { seleniumReady, withBrowser, saveShot, recordSkip } from "../lib/selenium/webdriver.mjs";
import { enterConsole, clickLabel, sourceHas, bootFailed } from "../lib/selenium/console.mjs";
import { ENV } from "../lib/env.ts";

test("Selenium screen inventory matches officialNav page ids", () => {
  const ids = officialPageIds();
  assert.ok(ids.includes("overview") && ids.includes("trNew") && ids.includes("configuration"));
  assert.equal(ids.length, new Set(ids).size);
  assert.ok(officialNavLabels().includes("Rule Bench"));
});

for (const page of STATIC_PAGES) {
  test(`Selenium static page ${page.path} look-and-feel`, async (t) => {
    if (!(await seleniumReady())) { await recordSkip(`static-${page.path}`, "selenium down"); t.skip("Selenium Chrome is optional"); return; }
    const run = await withBrowser(async (sess) => {
      await sess.go(`${ENV.webBase}${page.path}`);
      return { html: await sess.source(), shot: await saveShot(sess, `static-${page.path.replace(/\W+/g, "-") || "root"}`) };
    });
    if (run.skipped) { t.skip(run.reason); return; }
    assert.equal(bootFailed(run.result.html), false);
    assert.ok(sourceHas(run.result.html, page.must).length);
  });
}

// SIT_SELENIUM_SCREEN_SAMPLE caps how many pageIds this parameterised test actually
// opens in one case run: each iteration launches its own chromium session (see
// withBrowser), so iterating every official page id against a cold selenium-wire
// baseline can push past the sit runner's whole-file budget. Default: open the first
// few representative screens (Overview + the key workspace families) — a baseline-
// aware sampling, not an exhaustive sweep. Set SIT_SELENIUM_SCREEN_SAMPLE=0 (or any
// non-positive number) to restore the full iteration against a quicker baseline.
function sampledPageIds() {
  const all = officialPageIds();
  const raw = process.env.SIT_SELENIUM_SCREEN_SAMPLE;
  const n = raw === undefined ? 4 : Number(raw);
  if (!Number.isFinite(n) || n <= 0) return all;
  return all.slice(0, n);
}

for (const pageId of sampledPageIds()) {
  test(`Selenium screen ${pageId} opens from official nav`, async (t) => {
    if (!(await seleniumReady())) { await recordSkip(`screen-${pageId}`, "selenium down"); t.skip("Selenium Chrome is optional"); return; }
    const contract = contractFor(pageId);
    const run = await withBrowser(async (sess) => {
      await enterConsole(sess);
      await clickLabel(sess, contract.family);
      await clickLabel(sess, contract.texts[0] || pageId);
      return { html: await sess.source(), shot: await saveShot(sess, `screen-${pageId}`) };
    });
    if (run.skipped) { t.skip(run.reason); return; }
    assert.equal(bootFailed(run.result.html), false);
    assert.ok(sourceHas(run.result.html, [contract.family, ...(contract.texts || [])]).length);
  });
}
