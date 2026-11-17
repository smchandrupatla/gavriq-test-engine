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

test("DFW1 feeder wizard shows one focused step with keyboard and tab navigation", async (t) => {
  await gui("dfw1", t, async (sess: any) => {
    await openNewFeeder(browser);
    await waitFor(async () => (await sess.exec("return document.querySelectorAll('[data-wizard-step]').length;")) === 5, { message: "wizard tabs to render" });
    const initial = await sess.exec(`return {
      visible: [...document.querySelectorAll('[data-wizard-panel]')].filter((p) => !p.hidden).map((p) => p.id),
      active: document.querySelector('[data-wizard-step][aria-current="step"]')?.textContent.trim(),
      next: document.querySelector('#df-wizard-next')?.textContent.trim(),
      advanced: document.querySelectorAll('[data-wizard-panel="4"] .df-advanced').length
    };`);
    assert.deepEqual(initial.visible, ["df-step-1"]);
    assert.match(initial.active, /Basics/);
    assert.equal(initial.next, "Save and continue");
    assert.equal(initial.advanced, 2);
    await sess.exec("document.querySelector('#df-wizard-tab-4').click();");
    await waitFor(async () => (await sess.exec("return document.querySelector('#df-step-4').hidden === false;")) === true, { message: "delivery step to open" });
    const delivery = await sess.exec("return [...document.querySelectorAll('[data-wizard-panel]')].filter((p) => !p.hidden).map((p) => p.id);");
    assert.deepEqual(delivery, ["df-step-4"]);
    await sess.exec("document.querySelector('#df-wizard-tab-5').focus(); document.querySelector('#df-wizard-tab-5').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));");
    await waitFor(async () => (await sess.exec("return document.querySelector('#df-step-4').hidden === false;")) === true, { message: "keyboard navigation to stay focused" });
    await sess.exec("document.querySelector('#df-wizard-tab-5').click();");
    await waitFor(async () => (await sess.exec("return document.querySelector('#df-step-5').hidden === false;")) === true, { message: "review step to open" });
    assert.equal(await sess.exec("return document.querySelector('#df-wizard-next').textContent.trim();"), "Save feeder");
  });
});

test("DFW2 delivery step exposes Run now, Immediate and Run later tabs with common review controls", async (t) => {
  await gui("dfw2", t, async (sess: any) => {
    await openNewFeeder(browser);
    await sess.exec("document.querySelector('#df-wizard-tab-4').click();");
    await waitFor(async () => (await sess.exec("return document.querySelector('#df-step-4').hidden === false;")) === true, { message: "delivery step" });
    assert.deepEqual(await sess.exec("return [...document.querySelectorAll('#df-delivery-tabs [data-delivery-mode]')].map((x) => x.textContent.trim());"), ["Run now", "Immediate", "Run later"]);
    assert.deepEqual(await sess.exec("return { review: !!document.querySelector('#df-review-plan'), pacing: !!document.querySelector('#df-pacing'), spikes: !!document.querySelector('#df-spikes') };"), { review: true, pacing: true, spikes: true });
  });
});

test("DFW3 current and past feeder run pages provide feeder-aware search (status folded into it, not a separate filter)", async (t) => {
  await gui("dfw3", t, async (sess: any) => {
    await browser.open("/data-feeder-current-runs.html");
    await waitFor(async () => (await sess.exec("return !!document.querySelector('#df-runs-search');")) === true, { message: "current runs search" });
    assert.equal(await sess.exec("return !!document.querySelector('#df-runs-status-filter');"), false);
    await browser.open("/data-feeder-past-runs.html?feederId=missing-feeder");
    await waitFor(async () => (await sess.exec("return !!document.querySelector('#df-runs-search');")) === true, { message: "past runs search" });
    assert.equal(await sess.exec("return location.pathname.endsWith('data-feeder-past-runs.html') && location.search.includes('feederId=');"), true);
  });
});

// ------------------------------------------------------------------------------------------
// Several data sets, weights, and the message-count hint
// ------------------------------------------------------------------------------------------
test("DFD1 + Add another dataset adds a second row: both weights become 50 and Remove is enabled", async (t) => {
  await gui("dfd1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await pickDataset(sess, 1, fx.a.name);
    let rows = await datasetRows(sess);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].weight, "100");
    await addDataset(sess);
    rows = await datasetRows(sess);
    assert.deepEqual(rows.map((r: any) => r.weight), ["50", "50"]);
    assert.deepEqual(rows.map((r: any) => r.weightDisabled), [false, false]);
    assert.deepEqual(rows.map((r: any) => r.removeDisabled), [false, false]);
    assert.notEqual(rows[0].value, rows[1].value, "the new row starts on a different dataset");
  });
});

test("DFD2 with one dataset the weight box and the Remove button are disabled", async (t) => {
  await gui("dfd2", t, async (sess: any) => {
    await openNewFeeder(browser);
    const [row] = await datasetRows(sess);
    assert.equal(row.weightDisabled, true);
    assert.equal(row.removeDisabled, true);
  });
});

test("DFD3 two datasets with weights 30 and 70 are stored in datasets[] in order and come back on reopen", async (t) => {
  await gui("dfd3", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { count: 10 });
    await addDataset(sess);
    await pickDataset(sess, 2, fx.b.name);
    await setWeight(sess, 1, 30);
    await setWeight(sess, 2, 70);
    const id = await saveNew(sess);
    const feeder = await getFeeder(id);
    assert.deepEqual(feeder.datasets, [{ datasetId: fx.a.id, weight: 30 }, { datasetId: fx.b.id, weight: 70 }]);
    await openSavedFeeder(browser, id, name);
    const rows = await datasetRows(sess);
    assert.deepEqual(rows.map((r: any) => r.value), [fx.a.id, fx.b.id]);
    assert.deepEqual(rows.map((r: any) => r.weight), ["30", "70"]);
  });
});

test("DFD4 three datasets: removing the middle one leaves the other two and the API agrees after Save", async (t) => {
  await gui("dfd4", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { count: 10 });
    await addDataset(sess); await pickDataset(sess, 2, fx.b.name);
    await addDataset(sess); await pickDataset(sess, 3, fx.c.name);
    assert.equal((await datasetRows(sess)).length, 3);
    await removeDataset(sess, 2);
    assert.deepEqual((await datasetRows(sess)).map((r: any) => r.value), [fx.a.id, fx.c.id]);
    const id = await saveNew(sess);
    assert.deepEqual(ids(await getFeeder(id)), [fx.a.id, fx.c.id]);
    assert.equal((await getFeeder(id)).name, name);
  });
});

test("DFD5 removing back to one dataset restores a 100% weight, whatever the other weight held", async (t) => {
  await gui("dfd5", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a);
    await addDataset(sess); await pickDataset(sess, 2, fx.b.name);
    await setWeight(sess, 1, 30);
    await removeDataset(sess, 2);
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).datasets, [{ datasetId: fx.a.id, weight: 100 }]);
  });
});

test("DFD6 a dataset already chosen in one row is disabled in the other rows' drop-downs", async (t) => {
  await gui("dfd6", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await pickDataset(sess, 1, fx.a.name);
    await addDataset(sess);
    await pickDataset(sess, 2, fx.b.name);
    const [r1, r2] = await datasetRows(sess);
    assert.equal(r2.options.find((o: any) => o.value === fx.a.id).disabled, true);
    assert.equal(r1.options.find((o: any) => o.value === fx.b.id).disabled, true);
    assert.equal(r1.options.find((o: any) => o.value === fx.a.id).disabled, false, "its own choice stays selectable");
  });
});

test("DFD7 percentage weights 1 and 99 are accepted and stored as typed", async (t) => {
  await gui("dfd7", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a);
    await addDataset(sess); await pickDataset(sess, 2, fx.b.name);
    await setWeight(sess, 1, 1);
    await setWeight(sess, 2, 99);
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).datasets.map((d: any) => d.weight), [1, 99]);
  });
});

test("DFD8 percentages 0, 101 and a blank weight are refused and nothing is created", async (t) => {
  await gui("dfd8", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await addDataset(sess); await pickDataset(sess, 2, fx.b.name);
    for (const bad of ["0", "101", ""]) {
      await setWeight(sess, 2, bad);
      const refused = await saveRefused(sess);
      assert.equal(refused.errors["err-datasets"], "Percentages must be between 0 and 100.", `weight "${bad}"`);
      assert.match(refused.status, /Some settings need attention/);
    }
    assert.equal(await feederCountNamed(name), 0);
    const api = await postFeeder(feederBody(fx.a.id, { datasets: [{ datasetId: fx.a.id, weight: 1 }, { datasetId: fx.b.id, weight: 101 }] }));
    assert.equal(api.status, 422);
    assert.equal(api.body.error.fields.datasets, "percentage_between_0_and_100");
  });
});

test("DFD9 the API accepts decimal percentages, refuses a negative one and refuses the same dataset twice", async (t) => {
  await gui("dfd9", t, async (_sess: any, fx: any) => {
    const ok = await postFeeder(feederBody(fx.a.id, { datasets: [{ datasetId: fx.a.id, weight: 2.5 }, { datasetId: fx.b.id, weight: 97.5 }] }));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.datasets[0].weight, 2.5);
    const neg = await postFeeder(feederBody(fx.a.id, { datasets: [{ datasetId: fx.a.id, weight: -1 }] }));
    assert.equal(neg.status, 422);
    assert.equal(neg.body.error.fields.datasets, "percentage_between_0_and_100");
    const dup = await postFeeder(feederBody(fx.a.id, { datasets: [{ datasetId: fx.a.id, weight: 50 }, { datasetId: fx.a.id, weight: 50 }] }));
    assert.equal(dup.status, 422);
    assert.equal(dup.body.error.fields.datasets, "duplicate_dataset");
  });
});

test("DFD10 the API refuses no datasets, a blank dataset id, an unknown dataset and more than 10 datasets", async (t) => {
  await gui("dfd10", t, async (_sess: any, fx: any) => {
    const cases: Array<[string, any[], string]> = [
      ["none", [], "at_least_one_dataset"],
      ["blank id", [{ datasetId: "", weight: 1 }], "dataset_required"],
      ["unknown", [{ datasetId: "ds_does_not_exist", weight: 1 }], "dataset_not_found"],
      ["eleven", Array.from({ length: 11 }, (_v, i) => ({ datasetId: `ds_fake_${i}`, weight: 1 })), "max_10_datasets"],
    ];
    for (const [label, datasets, code] of cases) {
      const res = await postFeeder(feederBody(fx.a.id, { datasets }));
      assert.equal(res.status, 422, label);
      assert.equal(res.body.error.fields.datasets, code, label);
      const preview = await previewPlan(feederBody(fx.a.id, { datasets }));
      assert.equal(preview.status, 422, `${label} (plan preview)`);
    }
  });
});

test("DFD11 the plan splits messages by percentage: 99 to 1 sends almost everything to the first dataset, and the API plan agrees", async (t) => {
  await gui("dfd11", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 20 });
    await addDataset(sess); await pickDataset(sess, 2, fx.b.name);
    await setWeight(sess, 1, 99);
    await setWeight(sess, 2, 1);
    await planMessages(sess, 160);
    const note = await waitFor(async () => {
      const n = (await tiles(sess)).find((x: any) => x.label === "Messages")?.note || "";
      return n.includes(fx.a.name) && n.includes(fx.b.name) ? n : null;
    }, { message: "the per-dataset split in the Messages tile" });
    const [na, nb] = [Number(new RegExp(`${fx.a.name} (\\d+)`).exec(note)![1]), Number(new RegExp(`${fx.b.name} (\\d+)`).exec(note)![1])];
    assert.equal(na + nb, 160);
    assert.ok(na >= 150, `first dataset should get nearly all of 160, got ${na}`);
    const id = await saveNew(sess);
    const plan = await planFor(id);
    assert.deepEqual(plan.summary.datasets.map((d: any) => d.messages), [na, nb]);
  });
});

test("DFD12 the hint under the count says how many records the chosen datasets hold and how often each is re-sent", async (t) => {
  await gui("dfd12", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await pickDataset(sess, 1, fx.a.name);
    await setCount(sess, 5);
    assert.equal(await text(sess, "#df-count-hint"), "The chosen datasets hold 5 records. At 5 repeats, the plan uses approximately 25 records.");
    await setCount(sess, 12);
    assert.equal(await text(sess, "#df-count-hint"), "The chosen datasets hold 5 records. At 12 repeats, the plan uses approximately 60 records.");
    await addDataset(sess); await pickDataset(sess, 2, fx.b.name);
    assert.equal(await text(sess, "#df-count-hint"), "The chosen datasets hold 8 records. At 12 repeats, the plan uses approximately 96 records.");
  });
});

test("DFD13 the plan warns when messages outnumber the records, and stops warning when they fit", async (t) => {
  await gui("dfd13", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await pickDataset(sess, 1, fx.a.name);
    await setCount(sess, 12);
    await waitFor(async () => (await warnings(sess)).includes("The selected datasets hold 5 records, so each record is sent about 12.0 times."), { message: "the re-send warning" });
    await setCount(sess, 4);
    await planMessages(sess, 20);
    await waitFor(async () => (await warnings(sess)).length === 0, { message: "the warning to clear" });
  });
});

test("DFD14 an empty dataset can be chosen: no count hint, a 'has no records yet' warning, and the feeder still saves as a draft", async (t) => {
  await gui("dfd14", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.empty);
    await waitFor(async () => (await warnings(sess)).some((w: string) => /has no records yet/.test(w)), { message: "the empty-dataset warning" });
    assert.equal(await text(sess, "#df-count-hint"), "");
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).status, "draft");
    assert.deepEqual(ids(await getFeeder(id)), [fx.empty.id]);
    assert.equal((await getFeeder(id)).name, name);
  });
});

test("DFD15 the dataset drop-down lists datasets as 'name · records' and a feeder can mix two datasets", async (t) => {
  await gui("dfd15", t, async (sess: any, fx: any) => {
    const velocity = fx.a;
    const sanctions = fx.b;
    await openNewFeeder(browser);
    const rows = await datasetRows(sess);
    const opt = rows[0].options.find((o: any) => o.value === velocity.id);
    const expected = `Velocity breach set${velocity.message_type_code ? ` · ${velocity.message_type_code}` : ""} · ${velocity.row_count} records`;
    assert.equal(opt.text, expected);
    const name = await fillBasic(sess, velocity, { count: 30 });
    await addDataset(sess); await pickDataset(sess, 2, sanctions.name);
    await setWeight(sess, 1, 60); await setWeight(sess, 2, 40);
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).datasets, [{ datasetId: velocity.id, weight: 60 }, { datasetId: sanctions.id, weight: 40 }]);
    assert.equal((await getFeeder(id)).name, name);
  });
});

test("DFD16 a deleted dataset is no longer offered in the drop-down", async (t) => {
  await gui("dfd16", t, async (sess: any) => {
    const gone = await createDataset("DfxGone", 2);
    const fresh = (await apiJson(`/api/v1/datasets/${gone.id}`)).body as any;
    const del = await apiJson(`/api/v1/datasets/${gone.id}`, { method: "DELETE", headers: { "if-match": fresh.etag } });
    assert.equal(del.status, 200);
    await openNewFeeder(browser);
    const [row] = await datasetRows(sess);
    assert.equal(row.options.some((o: any) => o.value === gone.id), false);
    const refused = await postFeeder(feederBody(gone.id));
    assert.equal(refused.status, 422);
    assert.equal(refused.body.error.fields.datasets, "dataset_not_found");
  });
});

test("DFD17 an archived dataset is no longer offered in the drop-down", { todo: "POST /api/v1/datasets/:id/archive answers 200 'archived' (softDeleteResult stub in specComplete.ts) but never archives: the dataset stays active in GET /api/v1/datasets" }, async (t) => {
  await gui("dfd17", t, async (sess: any) => {
    const gone = await createDataset("DfxArch", 2);
    const arch = await apiJson(`/api/v1/datasets/${gone.id}/archive`, { method: "POST", body: "{}" });
    assert.equal(arch.status, 200);
    await openNewFeeder(browser);
    const [row] = await datasetRows(sess);
    assert.equal(row.options.some((o: any) => o.value === gone.id), false, "an archived dataset must not be offered");
  });
});

// ------------------------------------------------------------------------------------------
// Send order: Random or In order
// ------------------------------------------------------------------------------------------
test("ORD1 Random is the default send order and is stored as 'random'", async (t) => {
  await gui("ord1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    assert.deepEqual(await pressed(sess, "[data-order]"), [["Random", "true"], ["In order", "false"]]);
    await fillBasic(sess, fx.a);
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).sendOrder, "random");
  });
});

test("ORD2 In order is stored as 'sequential', and the reopened form shows In order pressed", async (t) => {
  await gui("ord2", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await setOrder(sess, "sequential");
    assert.deepEqual(await pressed(sess, "[data-order]"), [["Random", "false"], ["In order", "true"]]);
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).sendOrder, "sequential");
    await openSavedFeeder(browser, id, name);
    assert.deepEqual(await pressed(sess, "[data-order]"), [["Random", "false"], ["In order", "true"]]);
    await setOrder(sess, "random");
    await saveEdit(sess);
    assert.equal((await getFeeder(id)).sendOrder, "random");
  });
});

test("ORD3 In order walks a 5-record dataset top to bottom and starts again: records 1,2,3,4,5,1,2,3,4,5,1,2", async (t) => {
  await gui("ord3", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 12 });
    await setOrder(sess, "sequential");
    await planMessages(sess, 12);
    await waitFor(async () => (await sampleTable(sess)).length === 12, { message: "12 sample rows" });
    await waitFor(async () => (await sampleTable(sess)).map((r: string[]) => r[4]).join(",") === "1,2,3,4,5,1,2,3,4,5,1,2", { message: "sequential record numbers" });
  });
});

test("ORD4 Random order is repeatable for one seed, differs from In order, and every record number is inside the dataset", async (t) => {
  await gui("ord4", t, async (_sess: any, fx: any) => {
    const body = feederBody(fx.a.id, { messageCount: 40, seed: 777 });
    const one = (await previewPlan(body)).body.plan.sample.map((r: any) => r.record);
    const two = (await previewPlan(body)).body.plan.sample.map((r: any) => r.record);
    assert.deepEqual(one, two, "same seed, same records");
    assert.ok(one.every((r: number) => r >= 1 && r <= 5));
    const seq = (await previewPlan({ ...body, sendOrder: "sequential" })).body.plan.sample.map((r: any) => r.record);
    assert.deepEqual(seq.slice(0, 6), [1, 2, 3, 4, 5, 1]);
    assert.notDeepEqual(one, seq);
  });
});

test("ORD5 In order with two datasets cycles each dataset separately", async (t) => {
  await gui("ord5", t, async (_sess: any, fx: any) => {
    const body = feederBody(fx.a.id, { messageCount: 60, sendOrder: "sequential", datasets: [{ datasetId: fx.a.id, weight: 1 }, { datasetId: fx.b.id, weight: 1 }] });
    const sample = (await previewPlan(body)).body.plan.sample;
    for (const [ds, rows] of [[fx.a.id, 5], [fx.b.id, 3]] as Array<[string, number]>) {
      const mine = sample.filter((r: any) => r.datasetId === ds).map((r: any) => r.record);
      assert.ok(mine.length >= 5, `dataset ${ds} was picked at least 5 times`);
      mine.forEach((rec: number, i: number) => assert.equal(rec, (i % rows) + 1, `record ${i} of ${ds}`));
    }
  });
});

// ------------------------------------------------------------------------------------------
// Window: presets and manual dates
// ------------------------------------------------------------------------------------------
async function presetCase(sess: any, fx: any, button: string, hours: number, hint: string) {
  await openNewFeeder(browser);
  const name = await fillBasic(sess, fx.a, { count: 10, start: WIN_START, end: WIN_START });
  await click(sess, `[data-hours="${button}"]`);
  const expectedEnd = await plusHours(sess, WIN_START, hours);
  assert.equal(await value(sess, "#df-end"), expectedEnd);
  assert.equal(await text(sess, "#df-window-hint"), `Runs for ${hint}.`);
  const id = await saveNew(sess);
  const f = await getFeeder(id);
  assert.equal(f.windowStart, await isoOf(sess, WIN_START));
  assert.equal(f.windowEnd, await isoOf(sess, expectedEnd));
  assert.equal(Date.parse(f.windowEnd) - Date.parse(f.windowStart), hours * 3600e3);
  await openSavedFeeder(browser, id, name);
  assert.equal(await value(sess, "#df-end"), expectedEnd);
}

test("WIN1 the '1 h' quick length sets the end one hour after the start", async (t) => {
  await gui("win1", t, async (sess: any, fx: any) => presetCase(sess, fx, "1", 1, "1h"));
});
test("WIN2 the '12 h' quick length sets the end twelve hours after the start", async (t) => {
  await gui("win2", t, async (sess: any, fx: any) => presetCase(sess, fx, "12", 12, "12h"));
});
test("WIN3 the '24 h' quick length sets the end a day after the start", async (t) => {
  await gui("win3", t, async (sess: any, fx: any) => presetCase(sess, fx, "24", 24, "1d"));
});
test("WIN4 the '7 days' quick length sets the end a week after the start", async (t) => {
  await gui("win4", t, async (sess: any, fx: any) => presetCase(sess, fx, "168", 168, "7d"));
});

test("WIN5 a manual start and end are stored exactly and shown again on reopen, with the 'Runs for' hint", async (t) => {
  await gui("win5", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { start: "2031-05-04T13:15", end: "2031-05-04T13:45" });
    assert.equal(await text(sess, "#df-window-hint"), "Runs for 30m.");
    const id = await saveNew(sess);
    const f = await getFeeder(id);
    assert.equal(f.windowStart, await isoOf(sess, "2031-05-04T13:15"));
    assert.equal(f.windowEnd, await isoOf(sess, "2031-05-04T13:45"));
    await openSavedFeeder(browser, id, name);
    assert.equal(await value(sess, "#df-start"), "2031-05-04T13:15");
    assert.equal(await value(sess, "#df-end"), "2031-05-04T13:45");
  });
});

test("WIN6 a new feeder starts on the next full hour, for 24 hours, with 1000 messages", async (t) => {
  await gui("win6", t, async (sess: any) => {
    await openNewFeeder(browser);
    const f = await formState(sess);
    assert.equal(f.count, "1000");
    assert.match(f.start, /T\d\d:00$/, "starts on the hour");
    assert.ok(Date.parse(f.start) > Date.now() - 3600e3, "starts within the next hour, not in the past");
    assert.equal(f.end, await plusHours(sess, f.start, 24));
  });
});

test("WIN7 a quick length with no start date focuses the Start box and leaves the end alone", async (t) => {
  await gui("win7", t, async (sess: any) => {
    await openNewFeeder(browser);
    const endBefore = await value(sess, "#df-end");
    await setValue(sess, "#df-start", "");
    await click(sess, '[data-hours="12"]');
    assert.equal(await sess.exec("return document.activeElement&&document.activeElement.id;"), "df-start");
    assert.equal(await value(sess, "#df-end"), endBefore);
  });
});

test("WIN8 an end before or equal to the start says 'The end must be after the start.', blocks Save, and the API answers 422", async (t) => {
  await gui("win8", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { start: "2031-01-01T10:00", end: "2031-01-01T09:00" });
    await waitFor(async () => (await fieldErrors(sess))["err-windowEnd"] === "The end must be after the start.", { message: "the live window message" });
    assert.match(await text(sess, "#df-plan-status"), /Fix the highlighted settings/);
    for (const end of ["2031-01-01T09:00", "2031-01-01T10:00"]) {
      await setValue(sess, "#df-end", end);
      const refused = await saveRefused(sess);
      assert.equal(refused.errors["err-windowEnd"], "The end must be after the start.", end);
    }
    assert.equal(await feederCountNamed(name), 0);
    const api = await postFeeder(feederBody(fx.a.id, { windowStart: "2031-01-01T10:00:00Z", windowEnd: "2031-01-01T10:00:00Z" }));
    assert.equal(api.status, 422);
    assert.equal(api.body.error.fields.windowEnd, "must_be_after_start");
  });
});

test("WIN9 a window over 31 days is refused with 'The window can be at most 31 days.'; exactly 31 days is accepted", async (t) => {
  await gui("win9", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { start: "2031-01-01T00:00", end: "2031-02-02T00:00" });
    const refused = await saveRefused(sess);
    assert.equal(refused.errors["err-windowEnd"], "The window can be at most 31 days.");
    assert.equal(await feederCountNamed(name), 0);
    const over = await postFeeder(feederBody(fx.a.id, { windowStart: "2031-01-01T00:00:00Z", windowEnd: "2031-02-02T00:00:00Z" }));
    assert.equal(over.body.error.fields.windowEnd, "max_31_days");
    await setValue(sess, "#df-end", "2031-02-01T00:00");
    const id = await saveNew(sess);
    assert.equal(Date.parse((await getFeeder(id)).windowEnd) - Date.parse((await getFeeder(id)).windowStart), 31 * 86400e3);
  });
});

test("WIN10 a blank start or end says 'Enter a date and time.' and nothing is created", async (t) => {
  await gui("win10", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await setValue(sess, "#df-start", "");
    let refused = await saveRefused(sess);
    assert.equal(refused.errors["err-windowStart"], "Enter a date and time.");
    await setValue(sess, "#df-start", WIN_START);
    await setValue(sess, "#df-end", "");
    refused = await saveRefused(sess);
    assert.equal(refused.errors["err-windowEnd"], "Enter a date and time.");
    assert.equal(await feederCountNamed(name), 0);
    const api = await postFeeder(feederBody(fx.a.id, { windowStart: "", windowEnd: "not a date" }));
    assert.deepEqual([api.status, api.body.error.fields.windowStart, api.body.error.fields.windowEnd], [422, "valid_date_time_required", "valid_date_time_required"]);
  });
});

// ------------------------------------------------------------------------------------------
// Pacing: Random gap (each gap on/off, custom gap) and Fixed interval; fit mode
// ------------------------------------------------------------------------------------------
const PRESET_GAPS = ["0.5 s", "1 s", "2 s", "3 s", "5 s", "10 s", "30 s", "60 s"];

test("PAC1 Random gap is the default with 1, 2, 3 and 5 s switched on, and that is what the API stores", async (t) => {
  await gui("pac1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    assert.equal((await formState(sess)).mode, "random-gaps");
    const chips = await gapChips(sess);
    assert.deepEqual(Object.keys(chips), PRESET_GAPS);
    assert.deepEqual(Object.entries(chips).filter(([, on]) => on).map(([k]) => k), ["1 s", "2 s", "3 s", "5 s"]);
    await fillBasic(sess, fx.a);
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).pacing, { mode: "random-gaps", gapsSeconds: [1, 2, 3, 5] });
  });
});

test("PAC2 every gap chip (0.5 s to 60 s) switches on and off when clicked", async (t) => {
  await gui("pac2", t, async (sess: any) => {
    await openNewFeeder(browser);
    for (const label of PRESET_GAPS) {
      const before = (await gapChips(sess))[label];
      await toggleGap(sess, label);
      assert.equal((await gapChips(sess))[label], !before, `${label} flips`);
      await toggleGap(sess, label);
      assert.equal((await gapChips(sess))[label], before, `${label} flips back`);
    }
  });
});

test("PAC3 with only 0.5 s on, the API stores gapsSeconds [0.5] and the plan's gaps come out of that one rhythm", async (t) => {
  await gui("pac3", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await setOnlyGaps(sess, ["0.5 s"]);
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).pacing.gapsSeconds, [0.5]);
    await openSavedFeeder(browser, id, name);
    assert.deepEqual(Object.entries(await gapChips(sess)).filter(([, on]) => on).map(([k]) => k), ["0.5 s"]);
  });
});

test("PAC4 30 s and 60 s only: stored sorted and shown pressed on reopen", async (t) => {
  await gui("pac4", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await setOnlyGaps(sess, ["60 s", "30 s"]);
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).pacing.gapsSeconds, [30, 60]);
    await openSavedFeeder(browser, id, name);
    assert.deepEqual(Object.entries(await gapChips(sess)).filter(([, on]) => on).map(([k]) => k), ["30 s", "60 s"]);
  });
});

test("PAC5 with every gap switched off Save says 'Pick at least one gap.' and the API answers choose_at_least_one_gap", async (t) => {
  await gui("pac5", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await setOnlyGaps(sess, []);
    const refused = await saveRefused(sess);
    assert.equal(refused.errors["err-pacing"], "Pick at least one gap.");
    assert.equal(await feederCountNamed(name), 0);
    const api = await postFeeder(feederBody(fx.a.id, { pacing: { mode: "random-gaps", gapsSeconds: [] } }));
    assert.deepEqual([api.status, api.body.error.fields.pacing], [422, "choose_at_least_one_gap"]);
  });
});

test("PAC6 a custom gap typed with Enter becomes a pressed chip, is stored with the presets, and is still a chip after reopen", async (t) => {
  await gui("pac6", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await typeCustomGap(sess, "7.5");
    await waitFor(async () => (await gapChips(sess))["7.5 s"] === true, { message: "the 7.5 s chip" });
    assert.ok(Object.keys(await gapChips(sess)).indexOf("7.5 s") > Object.keys(await gapChips(sess)).indexOf("5 s"), "chips stay sorted by size");
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).pacing.gapsSeconds, [1, 2, 3, 5, 7.5]);
    await openSavedFeeder(browser, id, name);
    assert.equal((await gapChips(sess))["7.5 s"], true);
  });
});

test("PAC7 a custom gap of 0 or a negative number is ignored (no chip appears)", async (t) => {
  await gui("pac7", t, async (sess: any) => {
    await openNewFeeder(browser);
    const before = Object.keys(await gapChips(sess)).length;
    await typeCustomGap(sess, "0");
    await typeCustomGap(sess, "-4");
    await sleep(400);
    assert.equal(Object.keys(await gapChips(sess)).length, before);
  });
});

test("PAC8 custom gaps at the limits: 0.01 s is accepted, more than 24 h says 'Gaps must be between 0.01 s and 24 h.'", async (t) => {
  await gui("pac8", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await typeCustomGap(sess, "100000");
    await waitFor(async () => (await gapChips(sess))["100000 s"] === true, { message: "the 100000 s chip" });
    const refused = await saveRefused(sess);
    assert.equal(refused.errors["err-pacing"], "Gaps must be between 0.01 s and 24 h.");
    assert.equal(await feederCountNamed(name), 0);
    await toggleGap(sess, "100000 s");
    await typeCustomGap(sess, "0.01");
    await waitFor(async () => (await gapChips(sess))["0.01 s"] === true, { message: "the 0.01 s chip" });
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).pacing.gapsSeconds, [0.01, 1, 2, 3, 5]);
    const api = await postFeeder(feederBody(fx.a.id, { pacing: { mode: "random-gaps", gapsSeconds: [86400] } }));
    assert.equal(api.status, 201, "24 h exactly is the upper limit");
  });
});

test("PAC9 more than ten gap choices says 'Use at most 10 gaps.' and the API answers max_10_gaps", async (t) => {
  await gui("pac9", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await setOnlyGaps(sess, PRESET_GAPS);
    for (const g of ["7", "11", "13"]) await typeCustomGap(sess, g);
    await waitFor(async () => Object.values(await gapChips(sess)).filter(Boolean).length === 11, { message: "eleven gaps on" });
    const refused = await saveRefused(sess);
    assert.equal(refused.errors["err-pacing"], "Use at most 10 gaps.");
    assert.equal(await feederCountNamed(name), 0);
    const api = await postFeeder(feederBody(fx.a.id, { pacing: { mode: "random-gaps", gapsSeconds: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] } }));
    assert.equal(api.body.error.fields.pacing, "max_10_gaps");
  });
});

test("PAC10 Fixed interval: the seconds box turns on and the gap chips turn off; it saves as mode fixed and reopens as Fixed", async (t) => {
  await gui("pac10", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    assert.equal(await sess.exec("return document.getElementById('df-interval').disabled;"), true, "the interval box is off in Random gap mode");
    await choosePacing(sess, "fixed");
    assert.equal(await sess.exec("return document.getElementById('df-interval').disabled;"), false);
    assert.ok((await gapChipsDisabled(sess)).every(Boolean), "every chip and the custom box are off in Fixed mode");
    assert.equal(await value(sess, "#df-interval"), "2");
    await setValue(sess, "#df-interval", "7.5");
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).pacing, { mode: "fixed", intervalSeconds: 7.5 });
    await openSavedFeeder(browser, id, name);
    const f = await formState(sess);
    assert.equal(f.mode, "fixed");
    assert.equal(f.interval, "7.5");
  });
});

test("PAC11 Fixed interval limits: 0 and 86401 say 'The interval must be between 0.01 s and 24 h.'; 0.01 and 86400 are accepted", async (t) => {
  await gui("pac11", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await choosePacing(sess, "fixed");
    for (const bad of ["0", "86401", ""]) {
      await setValue(sess, "#df-interval", bad);
      const refused = await saveRefused(sess);
      assert.equal(refused.errors["err-pacing"], "The interval must be between 0.01 s and 24 h.", `interval "${bad}"`);
    }
    assert.equal(await feederCountNamed(name), 0);
    for (const ok of [0.01, 86400]) {
      const res = await postFeeder(feederBody(fx.a.id, { pacing: { mode: "fixed", intervalSeconds: ok } }));
      assert.equal(res.status, 201, `interval ${ok}`);
    }
    await setValue(sess, "#df-interval", "0.01");
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).pacing.intervalSeconds, 0.01);
  });
});

test("PAC12 switching back from Fixed to Random gap keeps the gap chips as they were and saves random-gaps", async (t) => {
  await gui("pac12", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a);
    await setOnlyGaps(sess, ["10 s", "30 s"]);
    await choosePacing(sess, "fixed");
    await choosePacing(sess, "random-gaps");
    assert.deepEqual(Object.entries(await gapChips(sess)).filter(([, on]) => on).map(([k]) => k), ["10 s", "30 s"]);
    assert.ok((await gapChipsDisabled(sess)).every((d: boolean) => !d));
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).pacing, { mode: "random-gaps", gapsSeconds: [10, 30] });
  });
});

test("FIT1 fit mode is 'stretch': the API reports it and the plan says 'Stretch to fit' with the natural pace", async (t) => {
  await gui("fit1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 11, start: WIN_START, end: WIN_END_1H });
    await choosePacing(sess, "fixed");
    await setValue(sess, "#df-interval", "10");
    // 11 messages at a fixed 10 s take 100 s naturally; one hour stretches that x36.
    await waitFor(async () => (await tileValue(sess, "Stretch to fit")) === "×36", { message: "the ×36 stretch tile" });
    const note = (await tiles(sess)).find((x: any) => x.label === "Stretch to fit").note;
    assert.equal(note, "natural pace would take 1m", "100 s is shown as 1m: the page drops the seconds once a duration passes a minute");
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).fitMode, "stretch");
    const plan = await planFor(id);
    assert.equal(plan.summary.stretchFactor, 36);
    assert.equal(plan.summary.naturalDurationSeconds, 100);
  });
});

test("FIT2 stretching fills the whole window: the first message goes at the start and the last at the end", async (t) => {
  await gui("fit2", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id, { messageCount: 25, windowStart: "2031-03-10T09:00:00.000Z", windowEnd: "2031-03-10T10:30:00.000Z" });
    const plan = await planFor(f.id);
    assert.equal(plan.sample[0].at, "2031-03-10T09:00:00.000Z");
    assert.equal(plan.sample[24].at, "2031-03-10T10:30:00.000Z");
    assert.equal(plan.sample[0].gapSeconds, null);
    const csv = await downloadCsvText(f.id);
    const rows = csv.text.trim().split("\n");
    assert.equal(rows.length, 26);
    assert.equal(rows[1].split(",")[1], "2031-03-10T09:00:00.000Z");
    assert.equal(rows[25].split(",")[1], "2031-03-10T10:30:00.000Z");
  });
});

