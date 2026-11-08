// This case was originally planned as "load the full, real pacs.008.001.14.xsd through
// the create-schema wizard's Upload path and verify every element round-trips." That is
// not achievable: the wizard's source loader (schemaConverter.ts's fromXsd()/portable())
// deliberately accepts only losslessly round-trippable XSD constructs, and the real file
// uses <xs:choice> 54 times -- a construct portable() has no JSON Schema equivalent for
// and rejects on purpose (the same restriction schema-converter.test.ts already covers
// with a minimal fixture). Operator decision (2026-10-20): test that rejection itself,
// against the real file, rather than a reduced extract or a backend change to support
// choice -- the wizard's job here is to refuse clearly, not to silently misconvert a
// message it cannot losslessly represent. apps/api/src/modules/registerIsoCatalog.ts's
// Import Scheme path (sit/cases/74e) uses a separate, more lenient XSD reader
// (isoCatalog.ts's parseIsoSource) built for cataloguing real ISO files as-is; that is
// still the way to bring a message like this one into Sand Bench, and 74e already proves
// it for this exact file.
import { after, test as nodeTest, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { click, saveShot, sharedBrowser, waitFor as baseWaitFor } from "../lib/selenium/flow.mjs";
import { openCreateSchema, setSourceMode, setupSchema, statusText, uploadSource } from "../lib/selenium/create-schema-page.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const FIXTURE = process.env.SBE_PACS008_FIXTURE || join(here, "../../tests/fixtures/iso20022/pacs.008.001.14.xsd");

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());
const waitFor = (fn: () => unknown, o: { timeout?: number; interval?: number; message?: string } = {}) => baseWaitFor(fn, { timeout: 60000, ...o });

nodeTest("the real pacs.008.001.14.xsd is available and really does use xs:choice (otherwise this case is testing nothing)", () => {
  assert.ok(existsSync(FIXTURE), `${FIXTURE} is missing; set SBE_PACS008_FIXTURE to the real ISO 20022 pacs.008.001.14 schema`);
  const xsd = readFileSync(FIXTURE, "utf8");
  assert.match(xsd, /<xs:choice\b/, "the fixture no longer uses xs:choice; this case's premise (and the rejection it tests) may no longer hold");
});

nodeTest("create-schema's Upload path refuses the real pacs.008.001.14.xsd with a clear, actionable reason, not a silent misconversion", async (t: TestContext) => {
  if (!existsSync(FIXTURE)) { t.skip(`${FIXTURE} is missing`); return; }
  if (!(await browser.available("create-schema-pacs008-choice"))) { t.skip(browser.reason); return; }
  const xsd = readFileSync(FIXTURE, "utf8").replace(/^﻿/, "");
  const sess = await browser.signedIn();
  try {
    await openCreateSchema(sess, browser);
    await setupSchema(sess, { name: "SIT pacs.008.001.14 upload", format: "xml" });
    await setSourceMode(sess, "upload");
    await uploadSource(sess, "pacs.008.001.14.xsd", xsd, "application/xml");
    const message = await waitFor(async () => {
      const t2 = await statusText(sess);
      return t2 && !/^Loading definition/i.test(t2) ? t2 : null;
    }, { message: "a status message after the upload is rejected" });
    assert.match(message, /choice/i, `expected the refusal to name "choice"; got: ${message}`);
    // Refused, not silently accepted: loadSource() never set loadedSource, so Setup's own
    // Next button must still refuse to advance -- actually attempting the transition, not
    // just checking the current step, so a future regression that silently marks the load
    // "successful" (while still showing the choice message) would still be caught here.
    await click(sess, "#schema-next");
    assert.equal(await sess.exec("return document.querySelector('[data-step=\"0\"]').hidden;"), false, "the wizard must stay on Setup after a refused upload");
    assert.match(await statusText(sess), /Load the chosen source/i, "Next should refuse to advance past an unloaded source");
  } catch (error) {
    await saveShot(sess, "create-schema-pacs008-choice");
    throw error;
  }
});
