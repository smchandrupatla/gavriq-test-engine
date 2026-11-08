// Business flows for Test runs (TR) and Rule Bench (RB): standalone documents opened after console sign-in.
// Each case is a GUI action followed by an INDEPENDENT API confirmation (/api/v1/runs, /api/v1/rules).
// No Testhub, Kafka or MQ is assumed: the delivery outcome of a run is asserted only as far as the page and
// the API promise it (simulated where the channel is unconfigured, acknowledged where /ready lists it).
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { expectedDeliveryStatus } from "../lib/client.ts";
import { apiJson, captureDownloads, click, count, saveShot, setValue, sharedBrowser, sleep, text, typeInto, value, visible, waitDownload, waitFor } from "../lib/selenium/flow.mjs";
import {
  apiRule, countByName, createRuleViaWizard, ensureRuleFixtureSchema, field, fieldInvalid, fieldMessage, listOf, makeRule, raw,
  ready, refreshScreen, runDeliveries, runsList, rwApplyAdvancedJson, rwBuildCondition, rwConditionInterpretation, rwConditionStatus,
  rwFillDetails, rwNext, rwOpen, rwPickExistingSchema, rwReviewStatus, rwReviewUnmappableText, rwSaveDisabled, rwSaveRule, rwStatus,
  screenFill, screenReady, screenRowFor, screenRows, screenSave, screenStatus, stageRuleApi, startRun, uniqueName, waitByName,
  waitStatus,
} from "../lib/selenium/work-items.mjs";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());

async function gui(name: string, t: { skip: (m?: string) => void }, body: (sess: any) => Promise<void>) {
  if (!(await browser.available(`work-items-runs-rules-${name}`))) { t.skip(browser.reason); return; }
  const sess = await browser.signedIn();
  try { await body(sess); }
  catch (error) { await saveShot(sess, `work-items-runs-rules-${name}`); throw error; }
}

// ==========================================================================================
// TEST RUNS
// ==========================================================================================
const TYPE = "pain.001.001.09";
const DELIVERY = new Set(["acknowledged", "simulated", "failed", "blocked", "sent"]);

/** Starts a run for a channel and checks what the API holds about it, without assuming a live target. */
async function channelRun(sess: any, channel: string, n: number) {
  const { status, run } = await startRun(sess, browser, { type: TYPE, count: String(n), channel, seed: `sit-${channel}` });
  assert.match(status, /Saved\./);
  assert.ok(run, "the API must hold a new run");
  assert.equal(run.channel, channel);
  assert.equal(run.message_type_code, TYPE);
  assert.equal(run.totals.generated, n);
  assert.ok(["completed", "failed"].includes(run.status), `run status ${run.status}`);
  const deliveries = await runDeliveries(run.id);
  assert.equal(deliveries.length, n, "one delivery record per generated message");
  assert.ok(deliveries.every((d: any) => d.channel === channel));
  assert.ok(deliveries.every((d: any) => DELIVERY.has(d.status)), JSON.stringify(deliveries.map((d: any) => d.status)));
  const expected = await expectedDeliveryStatus(channel);
  for (const d of deliveries.filter((x: any) => x.status !== "blocked")) assert.equal(d.status, expected, `${channel} delivery status (${d.detail})`);
  const sum = run.totals.sent + run.totals.simulated + run.totals.blocked + run.totals.failed;
  assert.equal(sum, n, `totals account for every message: ${JSON.stringify(run.totals)}`);
  return run;
}

test("TR1 start a run on the File channel: the API holds it with the chosen channel, count and one delivery per message", async (t) => {
  await gui("tr1", t, async (sess) => { await channelRun(sess, "file", 4); });
});
test("TR2 start a run on the API channel", async (t) => {
  await gui("tr2", t, async (sess) => { await channelRun(sess, "api", 3); });
});
test("TR3 start a run on the Kafka channel (no broker needed: the outcome is what the stack reports for an unconfigured channel)", async (t) => {
  await gui("tr3", t, async (sess) => { await channelRun(sess, "kafka", 3); });
});
test("TR4 start a run on the MQ channel", async (t) => {
  await gui("tr4", t, async (sess) => { await channelRun(sess, "mq", 2); });
});
test("TR5 start a run on the FTP channel", async (t) => {
  await gui("tr5", t, async (sess) => { await channelRun(sess, "ftp", 2); });
});

test("TR6 performance profile Fixed with a target rate starts a run", async (t) => {
  await gui("tr6", t, async (sess) => {
    const { status, run } = await startRun(sess, browser, { type: TYPE, count: "3", channel: "file", profile: "fixed", rate: "10" });
    assert.match(status, /Saved\./);
    assert.equal(run?.totals.generated, 3);
  });
});
test("TR7 performance profile Ramp starts a run", async (t) => {
  await gui("tr7", t, async (sess) => {
    const { status, run } = await startRun(sess, browser, { type: TYPE, count: "3", channel: "file", profile: "ramp", rate: "10" });
    assert.match(status, /Saved\./);
    assert.equal(run?.totals.generated, 3);
  });
});
test("TR8 performance profile Spike (burst) starts a run", async (t) => {
  await gui("tr8", t, async (sess) => {
    const { status, run } = await startRun(sess, browser, { type: TYPE, count: "3", channel: "file", profile: "spike", rate: "10" });
    assert.match(status, /Saved\./);
    assert.equal(run?.totals.generated, 3);
  });
});
test("TR9 performance profile Soak starts a run", async (t) => {
  await gui("tr9", t, async (sess) => {
    const { status, run } = await startRun(sess, browser, { type: TYPE, count: "3", channel: "file", profile: "soak", rate: "10" });
    assert.match(status, /Saved\./);
    assert.equal(run?.totals.generated, 3);
  });
});

test("TR10 the profile and target rate chosen for a run can be read back from the run", { todo: "POST /api/v1/runs accepts profile/targetRate/seed but executeRun computes plannedRate and drops it: neither the run record (GET /api/v1/runs/:id) nor the 202 report carries the profile or rate, so the choice is not observable anywhere" }, async (t) => {
  await gui("tr10", t, async (sess) => {
    const { run } = await startRun(sess, browser, { type: TYPE, count: "2", channel: "file", profile: "spike", rate: "37" });
    assert.ok(run);
    const one = await apiJson(`/api/v1/runs/${run.id}`);
    const blob = JSON.stringify(one.body).toLowerCase();
    assert.ok(blob.includes("spike"), `the run should record profile spike: ${blob.slice(0, 300)}`);
    assert.ok(blob.includes("37"), "the run should record target rate 37");
  });
});

test("TR11 the same seed reproduces the same generated data, a different seed does not", async (t) => {
  await gui("tr11", t, async (sess) => {
    const key = (rows: any[]) => rows.map((d) => `${d.request_payload.instdAmt}|${d.request_payload.cdtrNm}|${d.request_payload.ccy}`).join(",");
    const seed = uniqueName("seed");
    const a = await startRun(sess, browser, { type: TYPE, count: "4", channel: "file", seed });
    const b = await startRun(sess, browser, { type: TYPE, count: "4", channel: "file", seed });
    const c = await startRun(sess, browser, { type: TYPE, count: "4", channel: "file", seed: `${seed}-other` });
    const [da, db, dc] = await Promise.all([a, b, c].map((r) => runDeliveries(r.run!.id)));
    assert.equal(key(da), key(db), "same seed, same data");
    assert.notEqual(key(da), key(dc), "different seed, different data");
  });
});

test("TR12 the embedded rule at 100% marks every message and sets the target field to the value", async (t) => {
  await gui("tr12", t, async (sess) => {
    const { run } = await startRun(sess, browser, { type: TYPE, count: "5", channel: "file", seed: "sit-inj", rule: { value: "QA-MARKER-42", field: "cdtrNm", percent: 100 } });
    const rows = await runDeliveries(run!.id);
    assert.equal(rows.length, 5);
    assert.ok(rows.every((d: any) => d.is_injected === true && d.injection_value === "QA-MARKER-42" && d.request_payload.cdtrNm === "QA-MARKER-42"), JSON.stringify(rows.map((d: any) => [d.is_injected, d.request_payload.cdtrNm])));
    const injectedOnly = await apiJson(`/api/v1/runs/${run!.id}/deliveries?injected=true`);
    assert.equal(injectedOnly.body.data.length, 5);
  });
});

test("TR13 the embedded rule at 0% injects nothing", async (t) => {
  await gui("tr13", t, async (sess) => {
    const { run } = await startRun(sess, browser, { type: TYPE, count: "5", channel: "file", rule: { value: "QA-NEVER", field: "cdtrNm", percent: 0 } });
    const rows = await runDeliveries(run!.id);
    assert.equal(rows.length, 5);
    assert.ok(rows.every((d: any) => d.is_injected === false && d.request_payload.cdtrNm !== "QA-NEVER"));
  });
});

test("TR14 an embedded rule with no value is ignored: the run has no injected messages", async (t) => {
  await gui("tr14", t, async (sess) => {
    const { run } = await startRun(sess, browser, { type: TYPE, count: "3", channel: "file", rule: { field: "cdtrNm", percent: 100 } });
    const rows = await runDeliveries(run!.id);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((d: any) => d.is_injected === false));
  });
});

test("TR15 an embedded rule with no target field uses the generic injectedMarker field", async (t) => {
  await gui("tr15", t, async (sess) => {
    const { run } = await startRun(sess, browser, { type: TYPE, count: "3", channel: "file", rule: { value: "GENERIC-1", percent: 100 } });
    const rows = await runDeliveries(run!.id);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((d: any) => d.is_injected === true && d.request_payload.injectedMarker === "GENERIC-1"), JSON.stringify(rows[0]?.request_payload));
  });
});

test("TR16 a run needs a message type: the field is flagged and no run is created", async (t) => {
  await gui("tr16", t, async (sess) => {
    const before = (await runsList()).length;
    const r = await startRun(sess, browser, { type: "", count: "2", expectRefusal: true });
    assert.match(r.status, /1 field needs attention/);
    assert.equal(await fieldInvalid(sess, "messageTypeCode"), true);
    assert.ok((await fieldMessage(sess, "messageTypeCode")).length > 0);
    await sleep(500);
    assert.equal((await runsList()).length, before);
  });
});

test("TR17 a count below 1 is refused by the page and no run is created", async (t) => {
  await gui("tr17", t, async (sess) => {
    const before = (await runsList()).length;
    const r = await startRun(sess, browser, { type: TYPE, count: "0", expectRefusal: true });
    assert.match(r.status, /1 field needs attention/);
    assert.equal(await fieldInvalid(sess, "count"), true);
    await sleep(500);
    assert.equal((await runsList()).length, before);
  });
});

test("TR18 a count above the 10,000 limit is refused by the page and no run is created", async (t) => {
  await gui("tr18", t, async (sess) => {
    const before = (await runsList()).length;
    const r = await startRun(sess, browser, { type: TYPE, count: "10001", expectRefusal: true });
    assert.match(r.status, /1 field needs attention/);
    assert.equal(await fieldInvalid(sess, "count"), true);
    await sleep(500);
    assert.equal((await runsList()).length, before);
  });
});

test("TR19 an unknown message type is refused by the API with a message on the page and no run is created", async (t) => {
  await gui("tr19", t, async (sess) => {
    const before = (await runsList()).length;
    const r = await startRun(sess, browser, { type: "no.such.type.99", count: "2", expectRefusal: true });
    assert.match(r.status, /Message type not found/);
    await sleep(500);
    assert.equal((await runsList()).length, before);
  });
});

test("TR20 the untouched form starts a 5-message File run with the Fixed profile", async (t) => {
  await gui("tr20", t, async (sess) => {
    const { status, run } = await startRun(sess, browser, { type: TYPE });
    assert.match(status, /Saved\./);
    assert.equal(run?.channel, "file");
    assert.equal(run?.totals.generated, 5);
  });
});

test("TR21 an emptied count starts a run of one message", async (t) => {
  await gui("tr21", t, async (sess) => {
    const { status, run } = await startRun(sess, browser, { type: TYPE, count: "" });
    assert.match(status, /Saved\./);
    assert.equal(run?.totals.generated, 1);
  });
});

test("TR22 the Connection dropdown offers the enabled saved connections of the chosen channel", async (t) => {
  await gui("tr22", t, async (sess) => {
    await browser.open("/test-runs-new.html");
    await screenReady(sess);
    for (const channel of ["kafka", "mq", "file"]) {
      await screenFill(sess, "channel", channel);
      const expected = (await listOf(`/api/v1/external-systems?channel=${channel}`)).filter((r: any) => r.enabled !== false).map((r: any) => r.id).sort();
      await waitFor(async () => {
        const got = await sess.exec("return [...document.getElementById('connection-select').options].map(o=>o.value).filter(Boolean).sort();");
        return JSON.stringify(got) === JSON.stringify(expected);
      }, { message: `connections for ${channel}: ${expected.join(",")}` });
    }
  });
});

test("TR23 a started run is listed in All test runs with its id and channel", async (t) => {
  await gui("tr23", t, async (sess) => {
    const { run } = await startRun(sess, browser, { type: TYPE, count: "2", channel: "mq" });
    await browser.open("/test-runs-all.html");
    const line = await screenRowFor(sess, run!.id);
    assert.match(line, /mq/);
    assert.ok(line.includes(TYPE));
    assert.match(line, /Simulated — not delivered|Acknowledged|Failed|Completed/i);
  });
});

test("TR24 All test runs marks a simulated delivery as 'not delivered' rather than as a success", async (t) => {
  await gui("tr24", t, async (sess) => {
    const expected = await expectedDeliveryStatus("kafka");
    const { run } = await startRun(sess, browser, { type: TYPE, count: "2", channel: "kafka", seed: "sit-kafka" });
    await browser.open("/test-runs-all.html");
    const line = await screenRowFor(sess, run!.id);
    if (expected === "simulated") assert.match(line, /Simulated — not delivered/);
    else assert.ok(!/Simulated — not delivered/.test(line), line);
  });
});

test("TR25 Active runs lists only runs that are still in progress", { todo: "test-runs-active.html reads /api/v1/runs unfiltered, so a run that has just completed is listed as an active run" }, async (t) => {
  await gui("tr25", t, async (sess) => {
    const { run } = await startRun(sess, browser, { type: TYPE, count: "2", channel: "file", seed: "sit-active" });
    assert.ok(["completed", "failed"].includes(run!.status));
    await browser.open("/test-runs-active.html");
    await waitFor(async () => (await screenRows(sess)).length > 0, { message: "rows" });
    assert.ok(!(await screenRows(sess)).some((r: string) => r.includes(run!.id)), `finished run ${run!.id} must not be under Active runs`);
  });
});

test("TR26 the New test run button on All test runs opens the run form", { todo: "test-runs-all.html wires 'New test run' to POST /api/v1/runs with an empty body: it only shows 'messageTypeCode is required' instead of opening the form" }, async (t) => {
  await gui("tr26", t, async (sess) => {
    const before = (await runsList()).length;
    await browser.open("/test-runs-all.html");
    await screenReady(sess);
    await click(sess, "#screen-action");
    await sleep(1500);
    assert.equal((await runsList()).length, before);
    assert.ok((await sess.url()).includes("/test-runs-new.html") || (await visible(sess, field("messageTypeCode"))), `expected the form, got ${await sess.url()} (${await screenStatus(sess)})`);
  });
});

test("TR27 after Start run the page shows the outcome of that run", { todo: "test-runs-new.html reloads its message-type list after saving and only says 'Saved.': the run id, status and delivery outcome returned by POST /api/v1/runs are never shown" }, async (t) => {
  await gui("tr27", t, async (sess) => {
    const { run } = await startRun(sess, browser, { type: TYPE, count: "2", channel: "file" });
    assert.ok(run);
    const shown = await text(sess, "body");
    assert.ok(shown.includes(run.id) || /simulated|delivered|completed|failed/i.test(shown.replace(/Failed to/gi, "")), "the page should report the run it just started");
  });
});

// ==========================================================================================
// RULE BENCH
// ==========================================================================================
// IMP-RBW005 part 3/4: rewritten against the 5-step create wizard (rule-bench-create.html),
// which replaced the old single flat form + template buttons + raw-condition-JSON textarea.
// Every condition below is built through the real Conditions-step UI (schema tree pick ->
// typed operator/value) against a tiny fixture JSON Schema registered once per process
// (ensureRuleFixtureSchema()) -- there is no more "hand-type the server's payload shape"
// path, so RB22 (unknown condition kind) and RB36 ('not' with two children) -- both only
// ever reachable by bypassing the UI with raw JSON matching the OLD form's textarea -- are
// retired from this GUI suite; their server messages are now asserted directly in
// tests/condition-tree.test.ts instead of going untested.
async function savedRule(sess: any, o: any) {
  const { status, row } = await createRuleViaWizard(sess, browser, o);
  assert.match(status, /saved/i, `expected Save to succeed; status was: ${status}`);
  assert.ok(row);
  return row;
}
const DEFAULT_COND = { kind: "amount_gte", field: "amount", value: 10000 };
const TEMPLATES: Record<string, unknown> = {
  amount_gte: { kind: "amount_gte", field: "amount", value: 10000 },
  country_in: { kind: "country_in", field: "country", values: ["IR", "KP", "SY", "CU"] },
  field_equals: { kind: "field_equals", field: "status", value: "blocked" },
  all: { kind: "all", conditions: [{ kind: "amount_gte", field: "amount", value: 10000 }, { kind: "country_in", field: "country", values: ["IR", "KP", "SY", "CU"] }] },
  any: { kind: "any", conditions: [{ kind: "amount_gte", field: "amount", value: 50000 }, { kind: "field_equals", field: "status", value: "blocked" }] },
};

test("RB1 create a Sanctions rule: it is stored with its category, in review, with the default condition", async (t) => {
  await gui("rb1", t, async (sess) => {
    const name = uniqueName("SitRuleSanctions");
    const row = await savedRule(sess, { name, category: "sanctions", severity: "high" });
    assert.deepEqual([row.category, row.severity, row.status, row.source], ["sanctions", "high", "in_review", "Payments Gateway"]);
    assert.deepEqual(row.condition_json, DEFAULT_COND);
  });
});
test("RB2 create a Fraud rule", async (t) => {
  await gui("rb2", t, async (sess) => {
    const name = uniqueName("SitRuleFraud");
    const row = await savedRule(sess, { name, category: "fraud", severity: "medium" });
    assert.deepEqual([row.category, row.severity, row.status], ["fraud", "medium", "in_review"]);
  });
});
test("RB3 create an AML rule", async (t) => {
  await gui("rb3", t, async (sess) => {
    const name = uniqueName("SitRuleAml");
    const row = await savedRule(sess, { name, category: "aml", severity: "low" });
    assert.deepEqual([row.category, row.severity, row.status], ["aml", "low", "in_review"]);
  });
});
test("RB4 severity Low is stored", async (t) => {
  await gui("rb4", t, async (sess) => { assert.equal((await savedRule(sess, { name: uniqueName("SitRuleLow"), category: "fraud", severity: "low" })).severity, "low"); });
});
test("RB5 severity Medium is stored", async (t) => {
  await gui("rb5", t, async (sess) => { assert.equal((await savedRule(sess, { name: uniqueName("SitRuleMed"), category: "fraud", severity: "medium" })).severity, "medium"); });
});
test("RB6 severity High is stored", async (t) => {
  await gui("rb6", t, async (sess) => { assert.equal((await savedRule(sess, { name: uniqueName("SitRuleHigh"), category: "aml", severity: "high" })).severity, "high"); });
});
test("RB7 severity Critical is stored", async (t) => {
  await gui("rb7", t, async (sess) => { assert.equal((await savedRule(sess, { name: uniqueName("SitRuleCrit"), category: "sanctions", severity: "critical" })).severity, "critical"); });
});

test("RB8 an amount >= threshold condition is built from the field tree and the stored condition matches", async (t) => {
  await gui("rb8", t, async (sess) => {
    const name = uniqueName("SitRuleAmount");
    const row = await savedRule(sess, { name, category: "aml", severity: "medium", condition: { field: "amount", operator: "gte", value: 10000 } });
    assert.deepEqual(row.condition_json, TEMPLATES.amount_gte);
  });
});
test("RB9 an 'is one of' condition over a country list is built and the stored condition matches", async (t) => {
  await gui("rb9", t, async (sess) => {
    const name = uniqueName("SitRuleCountry");
    const row = await savedRule(sess, { name, category: "sanctions", severity: "high", condition: { field: "country", operator: "in_list", value: ["IR", "KP", "SY", "CU"] } });
    assert.deepEqual(row.condition_json, TEMPLATES.country_in);
  });
});
test("RB10 an 'equals' condition is built and the stored condition matches", async (t) => {
  await gui("rb10", t, async (sess) => {
    const name = uniqueName("SitRuleEquals");
    const row = await savedRule(sess, { name, category: "fraud", severity: "low", condition: { field: "status", operator: "equals", value: "blocked" } });
    assert.deepEqual(row.condition_json, TEMPLATES.field_equals);
  });
});
test("RB11 a Match ALL of group with two leaves is built and stored intact", async (t) => {
  await gui("rb11", t, async (sess) => {
    const name = uniqueName("SitRuleAll");
    const row = await savedRule(sess, {
      name, category: "aml", severity: "critical",
      condition: { all: [{ field: "amount", operator: "gte", value: 10000 }, { field: "country", operator: "in_list", value: ["IR", "KP", "SY", "CU"] }] },
    });
    assert.deepEqual(row.condition_json, TEMPLATES.all);
    assert.equal(row.condition_json.conditions.length, 2);
  });
});
test("RB12 a Match ANY of group with two leaves is built and stored intact", async (t) => {
  await gui("rb12", t, async (sess) => {
    const name = uniqueName("SitRuleAny");
    const row = await savedRule(sess, {
      name, category: "fraud", severity: "high",
      condition: { any: [{ field: "amount", operator: "gte", value: 50000 }, { field: "status", operator: "equals", value: "blocked" }] },
    });
    assert.deepEqual(row.condition_json, TEMPLATES.any);
  });
});

test("RB13 an 'is not one of' condition is built and stored exactly as built", async (t) => {
  await gui("rb13", t, async (sess) => {
    const name = uniqueName("SitRuleFree");
    const row = await savedRule(sess, { name, category: "sanctions", severity: "medium", condition: { field: "cdtrCtry", operator: "not_in_list", value: ["US", "GB"] } });
    assert.deepEqual(row.condition_json, { kind: "country_not_in", field: "cdtrCtry", values: ["US", "GB"] });
  });
});
test("RB14 a NOT group wrapping exactly one condition is built and stored", async (t) => {
  await gui("rb14", t, async (sess) => {
    const name = uniqueName("SitRuleNot");
    const row = await savedRule(sess, { name, category: "fraud", severity: "low", condition: { not: { field: "ccy", operator: "equals", value: "EUR" } } });
    assert.deepEqual(row.condition_json, { kind: "not", conditions: [{ kind: "field_equals", field: "ccy", value: "EUR" }] });
  });
});

test("RB15 data source and description are stored with the rule", async (t) => {
  await gui("rb15", t, async (sess) => {
    const name = uniqueName("SitRuleSource");
    const row = await savedRule(sess, { name, category: "sanctions", severity: "high", source: "Sanctions Core", description: "Flags corridor payments over the limit" });
    assert.equal(row.source, "Sanctions Core");
    assert.equal(row.description, "Flags corridor payments over the limit");
  });
});

// The Details step's aggregate status is one fixed sentence regardless of how many fields
// are missing (the old "N field(s) need attention" count is gone) -- RB16-19 check the
// per-field aria-invalid/message instead, which is what actually tells the fields apart.
const DETAILS_BLOCKED = "Complete the required rule details before continuing.";
test("RB16 a rule needs a name: the field is flagged and nothing is stored", async (t) => {
  await gui("rb16", t, async (sess) => {
    const before = (await listOf("/api/v1/rules")).length;
    const { status } = await createRuleViaWizard(sess, browser, { category: "aml", severity: "low", detailsOnly: true });
    assert.equal(status, DETAILS_BLOCKED);
    assert.equal(await fieldInvalid(sess, "name"), true);
    assert.match(await fieldMessage(sess, "name"), /Enter a rule name/);
    await sleep(500);
    assert.equal((await listOf("/api/v1/rules")).length, before);
  });
});
test("RB17 a rule needs a category: the field is flagged and nothing is stored", async (t) => {
  await gui("rb17", t, async (sess) => {
    const name = uniqueName("SitRuleNoCat");
    const { status } = await createRuleViaWizard(sess, browser, { name, severity: "low", detailsOnly: true });
    assert.equal(status, DETAILS_BLOCKED);
    assert.equal(await fieldInvalid(sess, "category"), true);
    assert.match(await fieldMessage(sess, "category"), /Choose the category/);
    await sleep(500);
    assert.equal(await countByName("/api/v1/rules", name), 0);
  });
});
test("RB18 a rule needs a severity: the field is flagged and nothing is stored", async (t) => {
  await gui("rb18", t, async (sess) => {
    const name = uniqueName("SitRuleNoSev");
    const { status } = await createRuleViaWizard(sess, browser, { name, category: "fraud", detailsOnly: true });
    assert.equal(status, DETAILS_BLOCKED);
    assert.equal(await fieldInvalid(sess, "severity"), true);
    assert.match(await fieldMessage(sess, "severity"), /Choose how serious/);
    await sleep(500);
    assert.equal(await countByName("/api/v1/rules", name), 0);
  });
});
test("RB19 an empty form flags name, category and severity together, and each clears when fixed", async (t) => {
  await gui("rb19", t, async (sess) => {
    const { status } = await createRuleViaWizard(sess, browser, { detailsOnly: true });
    assert.equal(status, DETAILS_BLOCKED);
    for (const f of ["name", "category", "severity"]) assert.equal(await fieldInvalid(sess, f), true, `${f} flagged`);
    await rwFillDetails(sess, { category: "aml" });
    assert.equal(await fieldInvalid(sess, "category"), false);
    assert.equal(await fieldInvalid(sess, "severity"), true);
  });
});
test("RB20 pasting malformed JSON into the advanced condition editor is rejected without discarding the condition already built", async (t) => {
  await gui("rb20", t, async (sess) => {
    const rootTitle = await ensureRuleFixtureSchema();
    await rwOpen(browser);
    await rwFillDetails(sess, { name: uniqueName("SitRuleBadJson"), category: "aml", severity: "low" });
    await rwNext(sess); // Details -> Schema
    await rwPickExistingSchema(sess, rootTitle);
    await rwNext(sess); // Schema -> Conditions
    await rwBuildCondition(sess, rootTitle, { field: "amount", operator: "gte", value: 10000 });
    const before = await rwConditionInterpretation(sess);
    assert.match(before, /amount >= 10000/);
    await rwApplyAdvancedJson(sess, '{"kind":"compare",');
    assert.match(await rwConditionStatus(sess), /Invalid JSON/);
    assert.equal(await rwConditionInterpretation(sess), before, "the working tree must survive a malformed edit");
  });
});
test("RB21 an empty condition tree blocks Save with a specific reason, and nothing is stored", async (t) => {
  await gui("rb21", t, async (sess) => {
    const name = uniqueName("SitRuleNoCond");
    const { status } = await createRuleViaWizard(sess, browser, { name, category: "aml", severity: "low", condition: false });
    assert.equal(await rwSaveDisabled(sess), true);
    assert.match(await rwReviewUnmappableText(sess), /No condition has been built yet/);
    assert.doesNotMatch(status, /saved/i);
    await sleep(500);
    assert.equal(await countByName("/api/v1/rules", name), 0);
  });
});
test("RB23 a second rule with the same name is refused and only one is stored", async (t) => {
  await gui("rb23", t, async (sess) => {
    const name = uniqueName("SitRuleTwin");
    await savedRule(sess, { name, category: "aml", severity: "low" });
    const { status } = await createRuleViaWizard(sess, browser, { name, category: "fraud", severity: "high" });
    assert.match(status, /already exists/);
    assert.equal(await countByName("/api/v1/rules", name), 1);
    assert.equal((await byNameLocal(name)).category, "aml", "the first rule is unchanged");
  });
});
async function byNameLocal(name: string) { return (await listOf("/api/v1/rules")).find((r: any) => r.name === name); }

test("RB24 a name of only spaces is not accepted as a rule name", async (t) => {
  await gui("rb24", t, async (sess) => {
    const before = (await listOf("/api/v1/rules")).length;
    const { status } = await createRuleViaWizard(sess, browser, { name: "     ", category: "aml", severity: "low", detailsOnly: true });
    assert.equal(status, DETAILS_BLOCKED);
    assert.equal(await fieldInvalid(sess, "name"), true);
    await sleep(500);
    assert.equal((await listOf("/api/v1/rules")).length, before);
  });
});

test("RB25 a new rule appears in Existing rules with its category, severity and In review status", async (t) => {
  await gui("rb25", t, async (sess) => {
    const name = uniqueName("SitRuleListed");
    const row = await savedRule(sess, { name, category: "fraud", severity: "critical" });
    await browser.open("/rule-bench-existing.html");
    const line = await screenRowFor(sess, name);
    assert.ok(line.includes(row.id));
    assert.match(line, /fraud/);
    assert.match(line, /Critical/);
    assert.match(line, /In review/);
  });
});

test("RB26 the New rule link on Existing rules opens the create wizard, which still blocks an empty Details step", async (t) => {
  await gui("rb26", t, async (sess) => {
    const before = (await listOf("/api/v1/rules")).length;
    await browser.open("/rule-bench-existing.html");
    await ready(sess, "a[href='/rule-bench-create.html']");
    await click(sess, "a[href='/rule-bench-create.html']");
    await ready(sess, "#rw-next");
    await rwNext(sess);
    assert.equal(await rwStatus(sess), DETAILS_BLOCKED);
    await sleep(400);
    assert.equal((await listOf("/api/v1/rules")).length, before);
  });
});

test("RB27 Stage rules lists the rules that are staged, and a rule appears there once it has been staged", async (t) => {
  await gui("rb27", t, async (sess) => {
    const rule = await makeRule(uniqueName("SitRuleToStage"));
    await browser.open("/rule-bench-stage.html");
    await waitFor(async () => (await screenRows(sess)).length > 0, { message: "staged rows" });
    assert.ok(!(await screenRows(sess)).some((r: string) => r.includes(rule.name)), "an in-review rule is not on the staged list");
    const staged = await stageRuleApi(rule);
    assert.equal(staged.status, "staged");
    await refreshScreen(sess);
    const line = await screenRowFor(sess, rule.name);
    assert.match(line, /Staged/);
  });
});

test("RB28 Stage selected on Stage rules moves the chosen rule to staged", { todo: "rule-bench-stage.html sends a PUT (console-screen.js picks PUT whenever the endpoint has :id) to POST-only /api/v1/rules/:id/stage, and never sends the required If-Match: the click answers 'Not Found' and the rule stays in review" }, async (t) => {
  await gui("rb28", t, async (sess) => {
    const rule = await makeRule(uniqueName("SitRuleStageClick"));
    await browser.open(`/rule-bench-stage.html?id=${rule.id}`);
    await screenReady(sess);
    await screenSave(sess);
    await sleep(1500);
    const now = await apiRule(rule.id);
    assert.equal(now?.status, "staged", `page said: ${await screenStatus(sess)}`);
  });
});

test("RB29 Validate rules lists every rule including a new one with its severity and coverage", async (t) => {
  await gui("rb29", t, async (sess) => {
    const rule = await makeRule(uniqueName("SitRuleToValidate"), { severity: "high", category: "sanctions" });
    await browser.open("/rule-bench-validate.html");
    const line = await screenRowFor(sess, rule.name);
    assert.ok(line.includes(rule.id));
    assert.match(line, /High/);
    assert.match(line, /sanctions/);
  });
});

test("RB30 Validate selected on Validate rules runs the rule against sample data and records the result", { todo: "rule-bench-validate.html sends PUT to POST-only /api/v1/rules/:id/validate (console-screen.js picks PUT whenever the endpoint has :id): the click answers 'Not Found' and last_validated_at stays empty" }, async (t) => {
  await gui("rb30", t, async (sess) => {
    const rule = await makeRule(uniqueName("SitRuleValidateClick"));
    await browser.open(`/rule-bench-validate.html?id=${rule.id}`);
    await screenReady(sess);
    await screenSave(sess);
    await sleep(1500);
    const now = await apiRule(rule.id);
    assert.ok(now?.last_validated_at, `page said: ${await screenStatus(sess)}`);
  });
});

test("RB31 validating a rule through the API is reflected on the Validate rules list after a refresh (status and result)", async (t) => {
  await gui("rb31", t, async (sess) => {
    const rule = await makeRule(uniqueName("SitRuleValidatedApi"));
    const res = await apiJson(`/api/v1/rules/${rule.id}/validate`, { method: "POST", body: JSON.stringify({}) });
    assert.equal(res.status, 200);
    const now = await apiRule(rule.id);
    assert.ok(now?.last_validated_at);
    await browser.open("/rule-bench-validate.html");
    assert.ok(await screenRowFor(sess, rule.name));
    assert.equal(now?.status, "in_review", "validating does not by itself stage a rule");
  });
});

test("RB32 Export rules shows the rule export including a new rule, and matches the API export count", async (t) => {
  await gui("rb32", t, async (sess) => {
    const rule = await makeRule(uniqueName("SitRuleExported"), { category: "fraud", severity: "high" });
    await browser.open("/rule-bench-export.html");
    await waitFor(async () => (await text(sess, "#screen-status")).startsWith("Up to date"), { message: "export loaded" });
    const shown = JSON.parse(await raw(sess, "#screen-output"));
    const api = (await apiJson("/api/v1/rules/export")).body as any;
    assert.equal(shown.count, api.count);
    const mine = shown.rules.find((r: any) => r.name === rule.name);
    assert.ok(mine, "the new rule is in the export");
    assert.deepEqual([mine.category, mine.severity, mine.status], ["fraud", "high", "in_review"]);
    assert.deepEqual(mine.condition, { kind: "amount_gte", field: "amount", value: 1 });
  });
});

test("RB33 the Export button downloads a dated JSON file with every rule", async (t) => {
  await gui("rb33", t, async (sess) => {
    const rule = await makeRule(uniqueName("SitRuleDownload"));
    await browser.open("/rule-bench-export.html");
    await waitFor(async () => (await raw(sess, "#screen-output")).includes(rule.name), { message: "export loaded with the rule" });
    await captureDownloads(sess);
    await click(sess, "#screen-action");
    const file = await waitDownload(sess);
    assert.match(file.name, /^rule-bench-export-\d{4}-\d{2}-\d{2}\.json$/);
    assert.equal(file.type, "application/json");
    const body = JSON.parse(file.text);
    assert.ok(body.rules.some((r: any) => r.name === rule.name));
    assert.equal(body.count, body.rules.length);
    assert.equal(await raw(sess, "#screen-status"), "Downloaded.");
  });
});

test("RB34 Refresh on Export rules picks up a rule created after the page was opened", async (t) => {
  await gui("rb34", t, async (sess) => {
    await browser.open("/rule-bench-export.html");
    await waitFor(async () => (await text(sess, "#screen-status")).startsWith("Up to date"), { message: "export loaded" });
    const rule = await makeRule(uniqueName("SitRuleLate"));
    assert.ok(!(await raw(sess, "#screen-output")).includes(rule.name));
    await refreshScreen(sess);
    await waitFor(async () => (await raw(sess, "#screen-output")).includes(rule.name), { message: "the late rule after Refresh" });
  });
});

test("RB35 a rule saved from the wizard keeps its values when the API is asked for it by id", async (t) => {
  await gui("rb35", t, async (sess) => {
    const name = uniqueName("SitRuleById");
    const row = await savedRule(sess, {
      name, category: "aml", severity: "critical", source: "Fraud Engine", description: "by id",
      condition: { any: [{ field: "amount", operator: "gte", value: 50000 }, { field: "status", operator: "equals", value: "blocked" }] },
    });
    const one = await apiJson(`/api/v1/rules/${row.id}`);
    assert.equal(one.status, 200);
    assert.deepEqual([one.body.data.name, one.body.data.category, one.body.data.severity, one.body.data.source, one.body.data.description], [name, "aml", "critical", "Fraud Engine", "by id"]);
    assert.deepEqual(one.body.data.condition_json, TEMPLATES.any);
  });
});

// RB36 ("a 'not' condition with two children is refused by the server") is retired from
// this GUI suite: the wizard can never build that shape through its own UI (renderGroup()
// only offers "Add condition"/"Add group" on a NOT node while it still has zero children,
// and the advanced JSON editor validates against rule-condition-model.js's validateTree()
// -- which already flags '"NOT" needs exactly 1 condition.' -- before ever touching
// conditionTree, so a 2-child NOT is rejected in the browser and never reaches POST
// /api/v1/rules at all). The server-side message this used to exercise
// ("not requires exactly one child condition", conditionTree.ts's parseCondition) had no
// other coverage anywhere in the repo, so it is now asserted directly in
// tests/condition-tree.test.ts, alongside RB22's retired "condition.kind must be ..."
// message (also unreachable from the wizard, for the same reason: toLegacyCondition() only
// ever emits the 4 known kinds).
