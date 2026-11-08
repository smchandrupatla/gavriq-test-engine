// (part 3 of 3: target, text and count limits, round trip)
// Data Feeder form: every variation of the form, driven through the browser and confirmed through the API.
//
// 72-selenium-business-e2e.sit.ts already walks the base journey (import -> definition -> data set ->
// feeder -> target), one save with a few options, reopen + edit, the list filter/duplicate/archive with
// its confirmation, and the three basic validation messages. This file adds the VARIATIONS of
// /data-feeder-form.html: several data sets with weights, send order, every window preset, every pacing
// choice, spikes, the chart's rate units and table, Reshuffle, the plan table, the plan CSV, fit mode
// ("Stretch to fit"), every target, text and count limits, and the saved/reopened round trip.
// Each case is GUI action -> independent API check -> (where it matters) reopen and read the GUI back.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { captureDownloads, saveShot, sharedBrowser, typeInto, waitDownload } from "../lib/selenium/flow.mjs";
import {
  FEEDER_URL, WIN_END_1H, WIN_END_24H, WIN_START, addDataset, addSpike, apiJson, chartBarCount, chartTable, chooseSystem, choosePacing,
  click, count, createDataset, datasetRows, downloadCsvText, feederBody, feederCountNamed, feederNamed, fieldErrors, formState, gapChips,
  gapChipsDisabled, getFeeder, isoOf, makeFeeder, openNewFeeder, openSavedFeeder, pickDataset, planFor, planMessages, planShown, plusHours,
  postFeeder, pressed, previewPlan, removeDataset, rowsOf, sampleHeaders, sampleTable, saveEdit, saveNew, saveRefused, setCount, setOnlyGaps,
  setOrder, setSpike, setValue, setWeight, setWindow, sleep, spikeRows, statusLine, text, tileValue, tiles, toggleGap, typeCustomGap, uniqueName,
  value, waitFor, warnings, feederRig,
} from "../lib/selenium/feeder-nav.mjs";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());

const { gui, fillBasic } = feederRig(browser, saveShot, typeInto);

const ids = (f: any) => f.datasets.map((d: any) => d.datasetId);

// ------------------------------------------------------------------------------------------
// Target: the External system drop-down
// ------------------------------------------------------------------------------------------
const sendButton = (sess: any) => sess.exec("const b=document.querySelector('#df-send-actions button');return b?{text:b.textContent.trim(),disabled:b.disabled}:null;");
const sendHint = (sess: any) => text(sess, "#df-send-body .df-hint");

test("SYS1 the External system drop-down starts with 'Not chosen yet' and lists every external system as 'name · CHANNEL'", async (t) => {
  await gui("sys1", t, async (sess: any) => {
    const before = rowsOf((await apiJson("/api/v1/external-systems")).body);
    await openNewFeeder(browser);
    const after = rowsOf((await apiJson("/api/v1/external-systems")).body);
    const options = await sess.exec("return [...document.getElementById('df-system').options].map(o=>({text:o.text,value:o.value}));");
    assert.deepEqual(options[0], { text: "Not chosen yet", value: "" });
    const label = (s: any) => `${s.name} · ${String(s.channel || "").toUpperCase()}${s.enabled === false ? " (disabled)" : ""}`;
    const shown = new Map<string, string>(options.slice(1).map((o: any) => [o.value, o.text]));
    for (const s of before) assert.equal(shown.get(s.id), label(s), `option for ${s.id}`);
    for (const [id] of shown) assert.ok(after.some((s: any) => s.id === id), `option ${id} is a real system`);
    for (const id of ["ext_sanctions", "ext_core", "ext_fraud", "ext_reporting", "ext_registry", "ext_ftp", "ext_kafka_desk"]) assert.ok(shown.has(id), `${id} is offered`);
  });
});

test("SYS2 'Not chosen yet' saves as a draft with no target, and the page says a target is still needed before sending", async (t) => {
  await gui("sys2", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    assert.equal(await text(sess, "#df-system-hint"), "Optional while planning; needed before the feeder can send.");
    assert.equal(await value(sess, "#df-system"), "");
    await fillBasic(sess, fx.a);
    const id = await saveNew(sess);
    await waitFor(async () => (await statusLine(sess)) === "Feeder created. You can duplicate it later to reuse these settings.", { message: "the created message" });
    const f = await getFeeder(id);
    assert.equal(f.externalSystemId, null);
    assert.equal(f.status, "draft");
    assert.equal(await text(sess, "#df-state"), "Draft");
    await waitFor(async () => (await sendButton(sess))?.disabled === true, { message: "Start sending to be disabled" });
    assert.equal(await sendHint(sess), "Choose an external system under Target and save.");
    const run = await apiJson(`/api/v1/data-feeders/${id}/runs`, { method: "POST", body: JSON.stringify({ startMode: "now" }) });
    assert.deepEqual([run.status, (run.body as any).error.fields.externalSystemId], [422, "required_to_send"]);
  });
});

async function targetCase(sess: any, fx: any, systemId: string, channel: string) {
  await openNewFeeder(browser);
  const name = await fillBasic(sess, fx.a, { count: 15 });
  await chooseSystem(sess, systemId);
  const id = await saveNew(sess);
  assert.equal((await getFeeder(id)).externalSystemId, systemId);
  await openSavedFeeder(browser, id, name);
  assert.equal(await value(sess, "#df-system"), systemId);
  const shown = await sess.exec("const e=document.getElementById('df-system');return e.options[e.selectedIndex].text;");
  assert.ok(shown.endsWith(` · ${channel}`), shown);
  await waitFor(async () => (await sendButton(sess))?.disabled === false, { message: "Start sending to be enabled" });
  assert.equal((await sendButton(sess)).text, "Start sending");
  assert.equal(await sendHint(sess), `Sends 15 messages to ${shown}. Results appear here and under Test Runs.`);
}

test("SYS3 target 'Dummy sanctions list · API': saved, reopened, and Start sending becomes available", async (t) => {
  await gui("sys3", t, async (sess: any, fx: any) => targetCase(sess, fx, "ext_sanctions", "API"));
});
test("SYS4 target 'Dummy core banking · MQ': saved, reopened, and Start sending becomes available", async (t) => {
  await gui("sys4", t, async (sess: any, fx: any) => targetCase(sess, fx, "ext_core", "MQ"));
});
test("SYS5 target 'Dummy fraud stream · KAFKA': saved, reopened, and Start sending becomes available", async (t) => {
  await gui("sys5", t, async (sess: any, fx: any) => targetCase(sess, fx, "ext_fraud", "KAFKA"));
});
test("SYS6 target 'Dummy FTP drop · FILE': saved, reopened, and Start sending becomes available", async (t) => {
  await gui("sys6", t, async (sess: any, fx: any) => targetCase(sess, fx, "ext_ftp", "FILE"));
});
test("SYS7 the remaining targets (reporting hub, scheme registry, Kafka Desk) each save and reopen with their own id", async (t) => {
  await gui("sys7", t, async (sess: any, fx: any) => {
    for (const [systemId, channel] of [["ext_reporting", "API"], ["ext_registry", "API"], ["ext_kafka_desk", "KAFKA"]] as Array<[string, string]>) await targetCase(sess, fx, systemId, channel);
  });
});

test("SYS8 unsaved edits switch Start sending off with 'Save your changes first', and saving switches it back on", async (t) => {
  await gui("sys8", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id, { externalSystemId: "ext_core", messageCount: 10 });
    await openSavedFeeder(browser, f.id, f.name);
    await waitFor(async () => (await sendButton(sess))?.disabled === false, { message: "Start sending enabled" });
    await setCount(sess, 11);
    await waitFor(async () => (await sendButton(sess))?.disabled === true, { message: "Start sending disabled by the edit" });
    assert.match(await sendHint(sess), /Save your changes first — a run uses the saved settings\./);
    await saveEdit(sess);
    await waitFor(async () => (await sendButton(sess))?.disabled === false, { message: "Start sending enabled again" });
    assert.match(await sendHint(sess), /^Sends 11 messages to /);
  });
});

test("SYS9 changing the target back to 'Not chosen yet' and saving clears externalSystemId", async (t) => {
  await gui("sys9", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id, { externalSystemId: "ext_fraud" });
    await openSavedFeeder(browser, f.id, f.name);
    assert.equal(await value(sess, "#df-system"), "ext_fraud");
    await chooseSystem(sess, "Not chosen yet");
    await saveEdit(sess);
    assert.equal((await getFeeder(f.id)).externalSystemId, null);
  });
});

test("SYS10 an unknown external system is refused by the API (external_system_not_found); a disabled one is labelled '(disabled)' and cannot start a run", async (t) => {
  await gui("sys10", t, async (sess: any, fx: any) => {
    const unknown = await postFeeder(feederBody(fx.a.id, { externalSystemId: "ext_nope" }));
    assert.deepEqual([unknown.status, unknown.body.error.fields.externalSystemId], [422, "external_system_not_found"]);
    const sysId = `sit_${uniqueName("dis").toLowerCase()}`;
    const put = await apiJson(`/api/v1/external-systems/${sysId}`, { method: "PUT", body: JSON.stringify({ name: `Off ${sysId}`, channel: "api", endpoint: "http://testhub:8091/stub", enabled: false }) });
    assert.equal(put.status, 200);
    try {
      await openNewFeeder(browser);
      const label = await sess.exec("const o=[...document.getElementById('df-system').options].find(x=>x.value===arguments[0]);return o?o.text:null;", [sysId]);
      assert.equal(label, `Off ${sysId} · API (disabled)`);
      const f = await makeFeeder(fx.a.id, { externalSystemId: sysId });
      const run = await apiJson(`/api/v1/data-feeders/${f.id}/runs`, { method: "POST", body: JSON.stringify({ startMode: "now" }) });
      assert.deepEqual([run.status, (run.body as any).error.fields.externalSystemId], [422, "external_system_disabled"]);
    } finally {
      await apiJson(`/api/v1/external-systems/${sysId}`, { method: "DELETE" });
    }
  });
});

// ------------------------------------------------------------------------------------------
// Name and description limits
// ------------------------------------------------------------------------------------------
test("TXT1 a 120-character name is accepted; the Name box stops at 120 when 130 are typed", async (t) => {
  await gui("txt1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { name: "N" });
    const long = `${uniqueName("L")}${"n".repeat(130)}`.slice(0, 130);
    await typeInto(sess, "#df-name", long);
    assert.equal((await value(sess, "#df-name")).length, 120, "typing is capped by maxlength=120");
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).name, long.slice(0, 120));
  });
});

test("TXT2 the API refuses a 121-character name (max_120_characters) and cuts a 2500-character description to 2000", async (t) => {
  await gui("txt2", t, async (_sess: any, fx: any) => {
    const refused = await postFeeder(feederBody(fx.a.id, { name: "x".repeat(121) }));
    assert.deepEqual([refused.status, refused.body.error.fields.name], [422, "max_120_characters"]);
    assert.equal(refused.body.error.message, "Check the feeder settings: name (max_120_characters)");
    const ok = await postFeeder(feederBody(fx.a.id, { name: "y".repeat(120), description: "d".repeat(2500) }));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.description.length, 2000);
  });
});

test("TXT3 a name of only spaces is treated as empty: 'This is required.' and nothing is created", async (t) => {
  await gui("txt3", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { name: "placeholder" });
    await setValue(sess, "#df-name", "     ");
    const refused = await saveRefused(sess);
    assert.equal(refused.errors["err-name"], "This is required.");
    assert.equal(await sess.exec("return document.getElementById('df-name').getAttribute('aria-invalid');"), "true");
    const api = await postFeeder(feederBody(fx.a.id, { name: "   " }));
    assert.deepEqual([api.status, api.body.error.fields.name], [422, "required"]);
  });
});

test("TXT4 leading and trailing spaces are trimmed from the name and description on save", async (t) => {
  await gui("txt4", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const bare = uniqueName("Trim");
    await fillBasic(sess, fx.a, { name: "x" });
    await setValue(sess, "#df-name", `   ${bare}   `);
    await setValue(sess, "#df-description", "  about this  ");
    const id = await saveNew(sess);
    const f = await getFeeder(id);
    assert.equal(f.name, bare);
    assert.equal(f.description, "about this");
  });
});

test("TXT5 a long description round-trips: a multi-line text keeps its line break, and the box advertises a 2000 limit", async (t) => {
  await gui("txt5", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    assert.equal(await sess.exec("return document.getElementById('df-description').maxLength;"), 2000);
    assert.equal(await sess.exec("return document.getElementById('df-name').maxLength;"), 120);
    const name = await fillBasic(sess, fx.a);
    const desc = `line one\nline two ${"z".repeat(1900)}`;
    await setValue(sess, "#df-description", desc);
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).description, desc);
    await openSavedFeeder(browser, id, name);
    assert.equal(await value(sess, "#df-description"), desc);
  });
});

test("TXT6 a name with HTML in it is stored verbatim and shown as plain text, never as markup", async (t) => {
  await gui("txt6", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const evil = `<img src=x onerror="window.__xss=1"> & "q" 'x' ${uniqueName("h")}`;
    await fillBasic(sess, fx.a, { name: "x" });
    await setValue(sess, "#df-name", evil);
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).name, evil);
    await openSavedFeeder(browser, id, evil);
    assert.equal(await text(sess, "#screen-title"), evil);
    assert.equal(await count(sess, "#screen-title img"), 0);
    assert.equal(await sess.exec("return window.__xss||null;"), null);
    assert.equal((await formState(sess)).docTitle, evil);
    await browser.open("/data-feeders.html");
    await waitFor(async () => (await sess.exec("return document.body.textContent.includes(arguments[0]);", [evil])), { message: "the name in the list" });
    assert.equal(await count(sess, "tbody img"), 0);
  });
});

test("TXT7 the page title is 'New data feeder' while new and becomes the feeder's name once saved", async (t) => {
  await gui("txt7", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    let f = await formState(sess);
    assert.deepEqual([f.title, f.docTitle], ["New data feeder", "New feeder"]);
    const name = await fillBasic(sess, fx.a);
    await saveNew(sess);
    f = await formState(sess);
    assert.deepEqual([f.title, f.docTitle], [name, name]);
    assert.equal(await text(sess, "#df-state"), "Draft");
  });
});

// ------------------------------------------------------------------------------------------
// Message count bounds: inline message and API 422
// ------------------------------------------------------------------------------------------
const COUNT_MSG = "Enter a whole number from 1 to 500,000.";
async function refusedCount(sess: any, fx: any, typed: string, apiValue: unknown) {
  await openNewFeeder(browser);
  const name = await fillBasic(sess, fx.a);
  await setCount(sess, typed);
  const refused = await saveRefused(sess);
  assert.equal(refused.errors["err-messageCount"], COUNT_MSG, `typed "${typed}"`);
  assert.equal(await sess.exec("return document.getElementById('df-count').getAttribute('aria-invalid');"), "true");
  assert.equal(await feederCountNamed(name), 0, "nothing was created");
  const api = await postFeeder(feederBody(fx.a.id, { messageCount: apiValue }));
  assert.equal(api.status, 422, `API ${JSON.stringify(apiValue)}`);
  assert.equal(api.body.error.fields.messageCount, "whole_number_1_to_500000");
  assert.equal(api.body.error.message, "Check the feeder settings: messageCount (whole_number_1_to_500000)");
}

test("CNT1 a blank message count is refused: inline 'Enter a whole number from 1 to 500,000.' and API 422", async (t) => {
  await gui("cnt1", t, async (sess: any, fx: any) => refusedCount(sess, fx, "", ""));
});
test("CNT2 a message count of 0 is refused: inline message and API 422", async (t) => {
  await gui("cnt2", t, async (sess: any, fx: any) => refusedCount(sess, fx, "0", 0));
});
test("CNT3 a message count of 500001 is refused: inline message and API 422", async (t) => {
  await gui("cnt3", t, async (sess: any, fx: any) => refusedCount(sess, fx, "500001", 500001));
});
test("CNT4 a decimal message count (2.5) and a negative one (-3) are refused: inline message and API 422", async (t) => {
  await gui("cnt4", t, async (sess: any, fx: any) => { await refusedCount(sess, fx, "2.5", 2.5); await refusedCount(sess, fx, "-3", -3); });
});

test("CNT5 the lower bound 1 is accepted and stored", async (t) => {
  await gui("cnt5", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 1 });
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).messageCount, 1);
  });
});

test("CNT6 the upper bound 500000 is accepted: stored, the plan still lists 200 rows, and the table says so", async (t) => {
  await gui("cnt6", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 500000 });
    await planMessages(sess, 500000);
    await waitFor(async () => /^Showing the first 200 of 500,000\./.test(await text(sess, "#df-sample p")), { message: "the 200 of 500,000 note" });
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).messageCount, 500000);
    assert.equal((await planFor(id)).sample.length, 200);
  });
});

test("CNT7 '10.0' counts as 10; the API also accepts the numeric strings '12' and '1e3' but refuses 'abc' and null", async (t) => {
  await gui("cnt7", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 5 });
    await setCount(sess, "10.0");
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).messageCount, 10);
    for (const [given, stored] of [["12", 12], ["1e3", 1000]] as Array<[string, number]>) {
      const ok = await postFeeder(feederBody(fx.a.id, { messageCount: given }));
      assert.deepEqual([ok.status, ok.body.messageCount], [201, stored]);
    }
    for (const bad of ["abc", null]) assert.equal((await postFeeder(feederBody(fx.a.id, { messageCount: bad }))).status, 422);
  });
});

// ------------------------------------------------------------------------------------------
// The saved / reopened round trip, edit, duplicate, archive, conflicts
// ------------------------------------------------------------------------------------------
test("RT1 a feeder using every option round-trips GUI -> API -> reopen -> edit -> API", async (t) => {
  await gui("rt1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { count: 40, start: WIN_START, end: WIN_START });
    await setValue(sess, "#df-description", "kitchen sink");
    await addDataset(sess); await pickDataset(sess, 2, fx.b.name);
    await setWeight(sess, 1, 30); await setWeight(sess, 2, 70);
    await setOrder(sess, "sequential");
    await chooseSystem(sess, "ext_core");
    await click(sess, '[data-hours="168"]');
    await setOnlyGaps(sess, ["0.5 s", "10 s"]);
    await typeCustomGap(sess, "7");
    await addSpike(sess); await addSpike(sess);
    await setSpike(sess, 1, "label", "first"); await setSpike(sess, 1, "mult", "3");
    await setSpike(sess, 2, "from", "2031-03-12T10:00"); await setSpike(sess, 2, "to", "2031-03-12T12:00"); await setSpike(sess, 2, "label", "second");
    const id = await saveNew(sess);
    const f = await getFeeder(id);
    assert.deepEqual(
      { n: f.name, d: f.description, ds: f.datasets, c: f.messageCount, o: f.sendOrder, s: f.externalSystemId, p: f.pacing, fit: f.fitMode, sp: f.spikes.map((s: any) => [s.startMinute, s.endMinute, s.multiplier, s.label]) },
      { n: name, d: "kitchen sink", ds: [{ datasetId: fx.a.id, weight: 30 }, { datasetId: fx.b.id, weight: 70 }], c: 40, o: "sequential", s: "ext_core", p: { mode: "random-gaps", gapsSeconds: [0.5, 7, 10] }, fit: "stretch", sp: [[2940, 3060, 5, "second"], [5544, 5604, 3, "first"]] },
    );
    assert.equal(Date.parse(f.windowEnd) - Date.parse(f.windowStart), 7 * 86400e3);
    await openSavedFeeder(browser, id, name);
    const form = await formState(sess);
    assert.deepEqual([form.description, form.count, form.order, form.system, form.mode], ["kitchen sink", "40", "sequential", "ext_core", "random-gaps"]);
    assert.deepEqual(Object.entries(await gapChips(sess)).filter(([, on]) => on).map(([k]) => k), ["0.5 s", "7 s", "10 s"]);
    assert.deepEqual((await datasetRows(sess)).map((r: any) => [r.value, r.weight]), [[fx.a.id, "30"], [fx.b.id, "70"]]);
    assert.deepEqual((await spikeRows(sess)).map((s: any) => s.label).sort(), ["first", "second"]);
    await setCount(sess, 55);
    await choosePacing(sess, "fixed");
    await setValue(sess, "#df-interval", "4");
    await click(sess, 'button[aria-label="Remove spike 2"]');
    await saveEdit(sess);
    const g = await getFeeder(id);
    assert.deepEqual([g.messageCount, g.pacing, g.spikes.length, g.id, g.name], [55, { mode: "fixed", intervalSeconds: 4 }, 1, id, name]);
    assert.notEqual(g.etag, f.etag);
  });
});

test("RT2 an archived feeder opens read-only: Save and Archive hidden, fields disabled, 'Archived' pill, and the API refuses edits with 409", async (t) => {
  await gui("rt2", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id, { spikes: [{ startMinute: 5, endMinute: 10, multiplier: 2 }] });
    const arch = await apiJson(`/api/v1/data-feeders/${f.id}/archive`, { method: "POST", body: "{}", headers: { "if-match": f.etag } });
    assert.equal(arch.status, 200);
    await openSavedFeeder(browser, f.id, f.name);
    assert.equal(await text(sess, "#df-state"), "Archived");
    assert.deepEqual(await sess.exec("return [document.getElementById('df-save').hidden,document.getElementById('df-archive').hidden,document.getElementById('df-duplicate').hidden];"), [true, true, false]);
    assert.match(await text(sess, "#df-intro"), /^This feeder is archived and read-only\./);
    assert.equal(await sess.exec("return [...document.querySelectorAll('#df-form input,#df-form select,#df-form textarea')].every(e=>e.disabled);"), true);
    await waitFor(async () => (await sendHint(sess)) === "Archived feeders cannot be sent. Duplicate it to send again.", { message: "the archived send note" });
    const put = await apiJson(`/api/v1/data-feeders/${f.id}`, { method: "PUT", body: JSON.stringify(feederBody(fx.a.id, { name: f.name })), headers: { "if-match": (arch.body as any).etag } });
    assert.equal(put.status, 409);
  });
});

test("RT3 Duplicate on the form opens a new draft 'Copy of ...' with the same settings, its own id, a fresh seed and the 'new copy' notice", async (t) => {
  await gui("rt3", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id, { messageCount: 33, seed: 5150, externalSystemId: "ext_sanctions" });
    await openSavedFeeder(browser, f.id, f.name);
    await click(sess, "#df-duplicate");
    const copyId = await waitFor(async () => /[?&]id=(dfd_\w+)/.exec(String(await sess.url()))?.[1] !== f.id ? /[?&]id=(dfd_\w+)/.exec(String(await sess.url()))?.[1] : null, { message: "the copy's address" });
    assert.match(String(await sess.url()), /copied=1/);
    await waitFor(async () => (await statusLine(sess)) === "This is a new copy. Rename it, swap datasets or move the window, then save.", { message: "the copy notice" });
    const copy = await getFeeder(copyId);
    assert.deepEqual([copy.name, copy.messageCount, copy.externalSystemId, copy.sourceFeederId, copy.status], [`Copy of ${f.name}`, 33, "ext_sanctions", f.id, "draft"]);
    assert.notEqual(copy.seed, 5150);
    assert.deepEqual(copy.datasets, f.datasets);
    assert.equal((await getFeeder(f.id)).name, f.name, "the original is untouched");
  });
});

test("RT4 Duplicate with unsaved edits asks first: Cancel stays on the feeder and creates nothing, OK duplicates the saved version", async (t) => {
  await gui("rt4", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id);
    const copies = async () => rowsOf((await apiJson("/api/v1/data-feeders")).body).filter((x: any) => x.sourceFeederId === f.id).length;
    await openSavedFeeder(browser, f.id, f.name);
    await typeInto(sess, "#df-name", `${f.name} edited`);
    await click(sess, "#df-duplicate");
    const prompt = await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { message: "the unsaved-changes dialog" });
    assert.equal(prompt, "You have unsaved changes. Duplicate the saved version anyway?");
    await sess.dismissAlert();
    await sleep(700);
    assert.equal(await copies(), 0);
    assert.match(String(await sess.url()), new RegExp(`id=${f.id}`));
    await click(sess, "#df-duplicate");
    await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { message: "the dialog again" });
    await sess.acceptAlert();
    await waitFor(async () => (await copies()) === 1, { message: "the copy to exist" });
    assert.equal(rowsOf((await apiJson("/api/v1/data-feeders")).body).find((x: any) => x.sourceFeederId === f.id).name, `Copy of ${f.name}`, "the saved name, not the unsaved edit");
  });
});

test("RT5 Archive on the form: Cancel keeps the draft, OK archives it, the form turns read-only and says 'Archived.'", async (t) => {
  await gui("rt5", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id);
    await openSavedFeeder(browser, f.id, f.name);
    await click(sess, "#df-archive");
    const prompt = await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { message: "the archive dialog" });
    assert.equal(prompt, "Archive this feeder? It becomes read-only; you can still duplicate it.");
    await sess.dismissAlert();
    await sleep(600);
    assert.equal((await getFeeder(f.id)).status, "draft");
    await click(sess, "#df-archive");
    await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { message: "the archive dialog again" });
    await sess.acceptAlert();
    await waitFor(async () => (await getFeeder(f.id)).status === "archived", { message: "the API to show archived" });
    await waitFor(async () => (await statusLine(sess)) === "Archived.", { message: "the Archived. notice" });
    assert.equal(await text(sess, "#df-state"), "Archived");
    assert.equal(await sess.exec("return document.getElementById('df-save').hidden;"), true);
  });
});

test("RT6 a stale or missing If-Match is refused (412) and a change made elsewhere shows 'Someone else changed this feeder' on Save", async (t) => {
  await gui("rt6", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id);
    const put = (etag: string | undefined, over = {}) => apiJson(`/api/v1/data-feeders/${f.id}`, { method: "PUT", body: JSON.stringify(feederBody(fx.a.id, { name: f.name, ...over })), headers: etag === undefined ? {} : { "if-match": etag } });
    assert.equal((await put("\"stale\"")).status, 412);
    assert.equal((await put(undefined)).status, 412);
    await openSavedFeeder(browser, f.id, f.name);
    assert.equal((await put(f.etag, { messageCount: 77 })).status, 200);
    await typeInto(sess, "#df-description", "mine");
    await click(sess, "#df-save");
    await waitFor(async () => (await statusLine(sess)) === "Someone else changed this feeder since you opened it. Reload to see their changes.", { message: "the conflict notice" });
    assert.equal((await getFeeder(f.id)).messageCount, 77);
    assert.equal((await getFeeder(f.id)).description, "");
  });
});

test("RT7 an unknown feeder id says 'This feeder does not exist' and the API answers 404", async (t) => {
  await gui("rt7", t, async (sess: any) => {
    await browser.open(`${FEEDER_URL}?id=dfd_doesnotexist`);
    await waitFor(async () => (await statusLine(sess)) === "This feeder does not exist (it may be another tenant’s).", { message: "the not-found notice" });
    assert.equal((await apiJson("/api/v1/data-feeders/dfd_doesnotexist")).status, 404);
  });
});

test("RT8 pressing Enter in the Name box saves the form, and the next save says 'Saved.'", { todo: "the form has a submit listener but no submit button (Save is type=button outside <form>), so browsers block implicit submission: Enter in a text box does nothing" }, async (t) => {
  await gui("rt8", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    const box = await sess.find("css selector", "#df-name");
    await sess.type(box, "");
    const id = await waitFor(async () => /[?&]id=(dfd_\w+)/.exec(String(await sess.url()))?.[1], { message: "the address to gain the id" });
    assert.equal((await getFeeder(id)).name, name);
    await setCount(sess, 21);
    assert.equal(await saveEdit(sess), "Saved.");
    assert.equal((await getFeeder(id)).messageCount, 21);
  });
});
