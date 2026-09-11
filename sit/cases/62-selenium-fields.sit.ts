import { test } from "node:test";
import assert from "node:assert/strict";
import { officialPageIds, contractFor } from "../lib/selenium/screens.mjs";
import { seleniumReady, withBrowser, saveShot, recordSkip } from "../lib/selenium/webdriver.mjs";
import { enterConsole, clickLabel, sourceHas, bootFailed } from "../lib/selenium/console.mjs";

test("every official page has a field or control contract", () => {
  assert.deepEqual(officialPageIds().filter((id) => !(contractFor(id).texts || []).length), []);
});

for (const pageId of officialPageIds()) {
  test(`Selenium fields on ${pageId}`, async (t) => {
    if (!(await seleniumReady())) { await recordSkip(`fields-${pageId}`, "selenium down"); t.skip("Selenium Chrome is optional"); return; }
    const contract = contractFor(pageId);
    const run = await withBrowser(async (sess) => {
      await enterConsole(sess);
      await clickLabel(sess, contract.family);
      if (contract.texts?.[0]) await clickLabel(sess, contract.texts[0]);
      const html = await sess.source();
      const present = [];
      for (const label of [...(contract.fields || []), ...(contract.controls || [])]) {
        const el = await sess.find("xpath", `//*[contains(translate(., 'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'), '${String(label).toLowerCase()}')]`);
        if (el) present.push(label);
      }
      return { html, present, shot: await saveShot(sess, `fields-${pageId}`) };
    });
    if (run.skipped) { t.skip(run.reason); return; }
    assert.equal(bootFailed(run.result.html), false);
    assert.ok(run.result.present.length > 0 || sourceHas(run.result.html, [contract.family, ...(contract.texts || [])]).length);
  });
}
