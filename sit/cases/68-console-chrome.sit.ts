import { test } from "node:test";
import assert from "node:assert/strict";
import { ENV } from "../lib/env.ts";

// Guards against overlayBrandFooter (the fixed-position "Help / About / Not production /
// BYO XSD / Mask demo / N-2 demo / MQ-API-Kafka Desk" link bar) coming back into
// live-bind-parts/part-05.js. It was demo scaffolding that got injected into every page
// of the real console and was removed; see tests/gui/console-chrome.spec.ts for the
// browser-level version of this check.
test("brand footer overlay is not served on the console host", async () => {
  const res = await fetch(`${ENV.webBase}/js/live-bind-parts/part-05.js`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200, "live-bind-parts/part-05.js missing on web");
  const src = await res.text();
  assert.doesNotMatch(src, /overlayBrandFooter/, "overlayBrandFooter must stay removed");
  assert.doesNotMatch(src, /sbe-brand-foot/, "the demo footer bar id must stay removed");
});

// Guards against attachWorkbench() losing the page-change reset that clears the shared
// #sbe-workbench overlay box (and the standalone #sbe-schema-register banner). Without
// it, a page with no overlay of its own kept showing whichever earlier page's overlay
// last populated the box -- e.g. "Delivery channel" (New test run) still visible on
// Test Runs / Test Cases. See tests/gui/console-chrome.spec.ts GUI-CHROME-03.
test("attachWorkbench resets the shared overlay box on page change", async () => {
  const res = await fetch(`${ENV.webBase}/js/live-bind-parts/part-05.js`, { signal: AbortSignal.timeout(5000) });
  assert.equal(res.status, 200, "live-bind-parts/part-05.js missing on web");
  const src = await res.text();
  assert.match(src, /__sbeWorkbenchPage/, "attachWorkbench must gate the workbench reset on the page actually changing");
  assert.match(src, /staleWorkbench\.remove\(\)/, "attachWorkbench must remove the stale #sbe-workbench box on page change");
});
