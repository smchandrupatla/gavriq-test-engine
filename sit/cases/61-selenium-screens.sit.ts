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

for (const pageId of officialPageIds()) {
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
