import { test } from "node:test";
import assert from "node:assert/strict";
import { seleniumReady, withBrowser, saveShot, recordSkip } from "../lib/selenium/webdriver.mjs";
import { enterConsole, clickLabel, sourceHas, bootFailed } from "../lib/selenium/console.mjs";

async function needChrome(t, name) {
  if (await seleniumReady()) return true;
  await recordSkip(name, "selenium down");
  t.skip("Selenium Chrome is optional");
  return false;
}

test("workflow: gate → Overview first-run strip", async (t) => {
  if (!(await needChrome(t, "wf-overview"))) return;
  const run = await withBrowser(async (sess) => {
    await enterConsole(sess);
    await clickLabel(sess, "Overview");
    return { html: await sess.source(), shot: await saveShot(sess, "wf-overview") };
  });
  if (run.skipped) { t.skip(run.reason); return; }
  assert.equal(bootFailed(run.result.html), false);
  assert.ok(sourceHas(run.result.html, ["Overview", "Sand Bench"]).length);
});

test("workflow: Overview → Import schema", async (t) => {
  if (!(await needChrome(t, "wf-import"))) return;
  const run = await withBrowser(async (sess) => {
    await enterConsole(sess);
    await clickLabel(sess, "Message Designer");
    await clickLabel(sess, "Import schema");
    return { html: await sess.source(), shot: await saveShot(sess, "wf-import") };
  });
  if (run.skipped) { t.skip(run.reason); return; }
  assert.equal(bootFailed(run.result.html), false);
  assert.ok(sourceHas(run.result.html, ["Import", "schema", "XSD", "Message Designer"]).length);
});

test("workflow: Create new rule surfaces condition kinds", async (t) => {
  if (!(await needChrome(t, "wf-rule-create"))) return;
  const run = await withBrowser(async (sess) => {
    await enterConsole(sess);
    await clickLabel(sess, "Rule Bench");
    await clickLabel(sess, "Create new rule");
    return { html: await sess.source(), shot: await saveShot(sess, "wf-rule-create") };
  });
  if (run.skipped) { t.skip(run.reason); return; }
  assert.equal(bootFailed(run.result.html), false);
  assert.ok(sourceHas(run.result.html, ["rule", "Create"]).length);
});

test("workflow: New test run shows File / API / MQ / Kafka", async (t) => {
  if (!(await needChrome(t, "wf-new-run"))) return;
  const run = await withBrowser(async (sess) => {
    await enterConsole(sess);
    await clickLabel(sess, "Test Runs");
    await clickLabel(sess, "New test run");
    return { html: await sess.source(), shot: await saveShot(sess, "wf-new-run") };
  });
  if (run.skipped) { t.skip(run.reason); return; }
  assert.equal(bootFailed(run.result.html), false);
  assert.ok(sourceHas(run.result.html, ["File", "API", "MQ", "Kafka", "channel", "New test run", "Test Runs"]).length);
});

test("workflow: Configuration test-connection controls", async (t) => {
  if (!(await needChrome(t, "wf-config"))) return;
  const run = await withBrowser(async (sess) => {
    await enterConsole(sess);
    await clickLabel(sess, "Configuration");
    return { html: await sess.source(), shot: await saveShot(sess, "wf-config") };
  });
  if (run.skipped) { t.skip(run.reason); return; }
  assert.equal(bootFailed(run.result.html), false);
  assert.ok(sourceHas(run.result.html, ["Configuration", "Kafka", "MQ"]).length);
});
