// (part 2 of 3: spikes, chart, Reshuffle, plan table, CSV)
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
// Spikes
// ------------------------------------------------------------------------------------------
test("SPK1 with no spike the section says the feed trickles evenly, and the API stores spikes []", async (t) => {
  await gui("spk1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    assert.equal(await text(sess, "#df-spike-rows"), "No spikes: the feed trickles evenly across the window.");
    await fillBasic(sess, fx.a);
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).spikes, []);
  });
});

test("SPK2 + Add a spike adds one row at 55% of a 24 h window, one hour long, x5, with an empty label; it is stored in minutes after the start", async (t) => {
  await gui("spk2", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { start: WIN_START, end: WIN_END_24H });
    await addSpike(sess);
    assert.deepEqual(await spikeRows(sess), [{ from: "2031-03-10T22:12", to: "2031-03-10T23:12", mult: "5", label: "" }]);
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).spikes, [{ startMinute: 792, endMinute: 852, multiplier: 5 }]);
    await openSavedFeeder(browser, id, name);
    assert.deepEqual(await spikeRows(sess), [{ from: "2031-03-10T22:12", to: "2031-03-10T23:12", mult: "5", label: "" }]);
  });
});

test("SPK3 several spikes are kept, listed as Spike 1..3 and stored ordered by start time", async (t) => {
  await gui("spk3", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { start: WIN_START, end: WIN_END_24H });
    await addSpike(sess); await addSpike(sess); await addSpike(sess);
    assert.equal((await spikeRows(sess)).length, 3);
    await setSpike(sess, 1, "from", "2031-03-10T20:00"); await setSpike(sess, 1, "to", "2031-03-10T21:00");
    await setSpike(sess, 2, "from", "2031-03-10T10:00"); await setSpike(sess, 2, "to", "2031-03-10T11:00");
    await setSpike(sess, 3, "from", "2031-03-10T15:00"); await setSpike(sess, 3, "to", "2031-03-10T16:00");
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).spikes.map((s: any) => s.startMinute), [60, 360, 660]);
  });
});

test("SPK4 Remove spike N removes just that row and the API keeps the others", async (t) => {
  await gui("spk4", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { start: WIN_START, end: WIN_END_24H });
    await addSpike(sess); await addSpike(sess);
    await setSpike(sess, 1, "label", "keep me");
    await setSpike(sess, 2, "label", "drop me");
    await click(sess, 'button[aria-label="Remove spike 2"]');
    await waitFor(async () => (await spikeRows(sess)).length === 1, { message: "one spike left" });
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).spikes.map((s: any) => s.label), ["keep me"]);
  });
});

test("SPK5 a spike's rate and label are stored, and the plan names it: tile 'Spike ×2.5 · Lunch peak' and a shaded band on the chart", async (t) => {
  await gui("spk5", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 1000, start: WIN_START, end: WIN_END_24H });
    await addSpike(sess);
    await setSpike(sess, 1, "mult", "2.5");
    await setSpike(sess, 1, "label", "Lunch peak");
    await waitFor(async () => (await tiles(sess)).some((x: any) => x.label === "Spike ×2.5 · Lunch peak"), { message: "the spike tile" });
    await waitFor(async () => (await text(sess, "#df-chart text.band-text")) === "×2.5 Lunch peak", { message: "the band label on the chart" });
    assert.equal(await count(sess, "#df-chart rect.band"), 1);
    const id = await saveNew(sess);
    assert.deepEqual((await getFeeder(id)).spikes, [{ startMinute: 792, endMinute: 852, multiplier: 2.5, label: "Lunch peak" }]);
  });
});

test("SPK6 a x5 spike over 2 of 24 hours carries 312 of 1000 evenly paced messages, and the tile matches the API plan", async (t) => {
  await gui("spk6", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 1000, start: WIN_START, end: WIN_END_24H });
    await choosePacing(sess, "fixed");
    await addSpike(sess);
    await setSpike(sess, 1, "from", "2031-03-10T12:00"); await setSpike(sess, 1, "to", "2031-03-10T14:00");
    await setSpike(sess, 1, "label", "Peak");
    const shown = await waitFor(async () => {
      const tile = (await tiles(sess)).find((x: any) => x.label === "Spike ×5 · Peak");
      return tile && tile.value !== "0 msgs" ? Number(tile.value.replace(/\D/g, "")) : null;
    }, { message: "the spike tile" });
    assert.ok(shown >= 311 && shown <= 314, `expected ~312 (10 of 32 rate units), got ${shown}`);
    const id = await saveNew(sess);
    assert.equal((await planFor(id)).summary.spikes[0].messages, shown);
  });
});

test("SPK7 a spike that starts after the window ends says 'A spike starts after the window ends.' and the API answers 422", async (t) => {
  await gui("spk7", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await addSpike(sess);
    await setSpike(sess, 1, "from", "2031-03-11T12:00"); await setSpike(sess, 1, "to", "2031-03-11T13:00");
    const refused = await saveRefused(sess);
    assert.equal(refused.errors["err-spikes"], "A spike starts after the window ends.");
    assert.equal(await feederCountNamed(name), 0);
    const api = await postFeeder(feederBody(fx.a.id, { spikes: [{ startMinute: 90, endMinute: 100, multiplier: 2 }] }));
    assert.deepEqual([api.status, api.body.error.fields.spikes], [422, "spike_starts_after_window"]);
  });
});

test("SPK8 a spike that ends before it starts says 'Each spike must end after it starts.'", async (t) => {
  await gui("spk8", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await addSpike(sess);
    await setSpike(sess, 1, "from", "2031-03-10T09:40"); await setSpike(sess, 1, "to", "2031-03-10T09:20");
    const refused = await saveRefused(sess);
    assert.equal(refused.errors["err-spikes"], "Each spike must end after it starts.");
    assert.equal(await feederCountNamed(name), 0);
  });
});

test("SPK9 a rate of 0.05 or 51 says 'Rates must be between ×0.1 and ×50.'; 0.1 and 50 are accepted", async (t) => {
  await gui("spk9", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a);
    await addSpike(sess);
    for (const bad of ["0.05", "51"]) {
      await setSpike(sess, 1, "mult", bad);
      const refused = await saveRefused(sess);
      assert.equal(refused.errors["err-spikes"], "Rates must be between ×0.1 and ×50.", `rate ${bad}`);
    }
    assert.equal(await feederCountNamed(name), 0);
    for (const ok of [0.1, 50]) {
      const res = await postFeeder(feederBody(fx.a.id, { spikes: [{ startMinute: 10, endMinute: 20, multiplier: ok }] }));
      assert.equal(res.status, 201, `rate ${ok}`);
    }
    await setSpike(sess, 1, "mult", "0.1");
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).spikes[0].multiplier, 0.1);
  });
});

test("SPK10 the API accepts 20 spikes and refuses 21 (max_20_spikes); a label is cut to 80 characters", async (t) => {
  await gui("spk10", t, async (_sess: any, fx: any) => {
    const spike = (i: number) => ({ startMinute: i, endMinute: i + 1, multiplier: 2, label: "L".repeat(100) });
    const ok = await postFeeder(feederBody(fx.a.id, { spikes: Array.from({ length: 20 }, (_v, i) => spike(i)) }));
    assert.equal(ok.status, 201);
    assert.equal(ok.body.spikes[0].label.length, 80);
    const over = await postFeeder(feederBody(fx.a.id, { spikes: Array.from({ length: 21 }, (_v, i) => spike(i)) }));
    assert.deepEqual([over.status, over.body.error.fields.spikes], [422, "max_20_spikes"]);
  });
});

test("SPK11 a spike running past the window end is allowed and the plan warns that only the inside part is used", async (t) => {
  await gui("spk11", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a);
    await addSpike(sess);
    await setSpike(sess, 1, "from", "2031-03-10T09:50"); await setSpike(sess, 1, "to", "2031-03-10T10:30");
    await waitFor(async () => (await warnings(sess)).includes("A spike runs past the end of the window; only the part inside the window is used."), { message: "the spike warning" });
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).spikes[0].endMinute, 90);
  });
});

test("SPK12 spikes are stored as minutes after the start: moving the window moves the spike with it and keeps its offsets", async (t) => {
  await gui("spk12", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { start: WIN_START, end: WIN_END_24H });
    await addSpike(sess);
    const id = await saveNew(sess);
    const before = (await getFeeder(id)).spikes[0];
    await openSavedFeeder(browser, id, name);
    await setWindow(sess, "2031-04-01T09:00", "2031-04-02T09:00");
    assert.deepEqual((await spikeRows(sess))[0].from, "2031-04-01T22:12", "the spike followed the window on screen");
    await saveEdit(sess);
    const after = await getFeeder(id);
    assert.deepEqual([after.spikes[0].startMinute, after.spikes[0].endMinute], [before.startMinute, before.endMinute]);
    assert.equal(after.windowStart, await isoOf(sess, "2031-04-01T09:00"));
  });
});

// ------------------------------------------------------------------------------------------
// Chart: rate units (Per minute / Per hour / Per day) and the "Show chart as a table" toggle
// ------------------------------------------------------------------------------------------
async function granularityCase(sess: any, fx: any, o: { end: string; press: string; auto: string; min: number; max: number }) {
  await openNewFeeder(browser);
  await fillBasic(sess, fx.a, { count: 200, start: WIN_START, end: o.end });
  await planMessages(sess, 200);
  await waitFor(async () => (await pressed(sess, "[data-granularity]")).find((p: string[]) => p[1] === "true")?.[0] === o.auto, { message: `${o.auto} pressed automatically` });
  await click(sess, `[data-granularity="${o.press}"]`);
  const label = { minute: "Per minute", hour: "Per hour", day: "Per day" }[o.press];
  await waitFor(async () => (await pressed(sess, "[data-granularity]")).find((p: string[]) => p[1] === "true")?.[0] === label, { message: `${label} pressed` });
  await waitFor(async () => { const n = await chartBarCount(sess); return n >= o.min && n <= o.max ? n : null; }, { message: `${o.min}-${o.max} bars` });
  await click(sess, "#df-chart-table-toggle");
  await waitFor(async () => (await chartTable(sess)).length === (await chartBarCount(sess)), { message: "table rows = bars" });
  const sum = (await chartTable(sess)).reduce((a: number, r: string[]) => a + Number(String(r[1]).replace(/,/g, "")), 0);
  assert.equal(sum, 200, "the table's Messages column adds up to the message count");
}

test("GRN1 a 2 h window opens on Per minute; Per hour draws 2-3 bars and the table adds up to 200", async (t) => {
  await gui("grn1", t, async (sess: any, fx: any) => granularityCase(sess, fx, { end: "2031-03-10T11:00", press: "hour", auto: "Per minute", min: 2, max: 3 }));
});
test("GRN2 a 24 h window opens on Per hour; Per minute draws 1440 bars and the table adds up to 200", async (t) => {
  await gui("grn2", t, async (sess: any, fx: any) => granularityCase(sess, fx, { end: WIN_END_24H, press: "minute", auto: "Per hour", min: 1440, max: 1441 }));
});
test("GRN3 a 7 day window opens on Per day; Per day draws 7-8 bars and the table adds up to 200", async (t) => {
  await gui("grn3", t, async (sess: any, fx: any) => granularityCase(sess, fx, { end: "2031-03-17T09:00", press: "day", auto: "Per day", min: 7, max: 8 }));
});

test("GRN4 'Show chart as a table' opens a From / Messages / Spike table, the button reads 'Hide table', and clicking again hides it", async (t) => {
  await gui("grn4", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 30 });
    await planMessages(sess, 30);
    assert.equal(await text(sess, "#df-chart-table-toggle"), "Show chart as a table");
    assert.equal(await sess.exec("return document.getElementById('df-chart-table').hidden;"), true);
    await click(sess, "#df-chart-table-toggle");
    await waitFor(async () => (await chartTable(sess)).length > 0, { message: "table rows" });
    assert.equal(await text(sess, "#df-chart-table-toggle"), "Hide table");
    assert.equal(await sess.exec("return document.getElementById('df-chart-table-toggle').getAttribute('aria-expanded');"), "true");
    assert.deepEqual(await sess.exec("return [...document.querySelectorAll('#df-chart-table thead th')].map(c=>c.textContent);"), ["From", "Messages", "Spike"]);
    await click(sess, "#df-chart-table-toggle");
    assert.equal(await sess.exec("return document.getElementById('df-chart-table').hidden;"), true);
    assert.equal(await text(sess, "#df-chart-table-toggle"), "Show chart as a table");
  });
});

test("GRN5 the table follows the rate unit while it is open and marks spike periods with 'Yes'", async (t) => {
  await gui("grn5", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 300, start: WIN_START, end: WIN_END_24H });
    await addSpike(sess);
    await setSpike(sess, 1, "from", "2031-03-10T12:00"); await setSpike(sess, 1, "to", "2031-03-10T14:00");
    await planMessages(sess, 300);
    await click(sess, "#df-chart-table-toggle");
    await waitFor(async () => (await chartTable(sess)).filter((r: string[]) => r[2] === "Yes").length === 2, { message: "two spike hours marked Yes" });
    const hourRows = (await chartTable(sess)).length;
    await click(sess, '[data-granularity="day"]');
    await waitFor(async () => { const n = (await chartTable(sess)).length; return n > 0 && n < hourRows ? n : null; }, { message: "fewer rows per day" });
  });
});

// ------------------------------------------------------------------------------------------
// Reshuffle
// ------------------------------------------------------------------------------------------
test("SHF1 Reshuffle changes the plan's send times and Save stores a new seed that reproduces exactly that plan", async (t) => {
  await gui("shf1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { count: 12 });
    const id = await saveNew(sess);
    const seedBefore = (await getFeeder(id)).seed;
    await openSavedFeeder(browser, id, name);
    await planMessages(sess, 12);
    const times = async () => (await sampleTable(sess)).map((r: string[]) => `${r[1]}|${r[3]}|${r[4]}`).join(";");
    const before = await times();
    await click(sess, "#df-reshuffle");
    await waitFor(async () => (await times()) !== before, { message: "the plan to change after Reshuffle" });
    const shown = await times();
    await saveEdit(sess);
    const saved = await getFeeder(id);
    assert.notEqual(saved.seed, seedBefore);
    const plan = await planFor(id);
    assert.equal(plan.sample.length, 12);
    await openSavedFeeder(browser, id, name);
    assert.equal(await times(), shown, "the reopened page shows the plan that was on screen when saved");
  });
});

test("SHF2 saving without Reshuffle keeps the seed and the plan, even when other settings change", async (t) => {
  await gui("shf2", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id, { messageCount: 12, seed: 4242 });
    const planBefore = await planFor(f.id);
    await openSavedFeeder(browser, f.id, f.name);
    await typeInto(sess, "#df-description", "edited, not reshuffled");
    await saveEdit(sess);
    const after = await getFeeder(f.id);
    assert.equal(after.seed, 4242);
    assert.deepEqual((await planFor(f.id)).sample, planBefore.sample);
  });
});

test("SHF3 one seed always gives one plan, another seed another; seeds 0 and 4294967295 are kept, an invalid seed is replaced", async (t) => {
  await gui("shf3", t, async (_sess: any, fx: any) => {
    const base = feederBody(fx.a.id, { messageCount: 30, seed: 1 });
    const plan = async (seed: number) => JSON.stringify((await previewPlan({ ...base, seed })).body.plan.sample);
    assert.equal(await plan(1), await plan(1));
    assert.notEqual(await plan(1), await plan(2));
    for (const seed of [0, 4294967295]) assert.equal((await makeFeeder(fx.a.id, { seed })).seed, seed);
    for (const bad of [-1, 1.5, 4294967296, "x"]) {
      const made = await makeFeeder(fx.a.id, { seed: bad });
      assert.ok(Number.isInteger(made.seed) && made.seed >= 0 && made.seed <= 4294967295, `seed ${bad} replaced by ${made.seed}`);
    }
  });
});

test("SHF4 Duplicate gets a fresh seed unless keepSeed is asked for", async (t) => {
  await gui("shf4", t, async (_sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id, { seed: 99 });
    const fresh = await apiJson(`/api/v1/data-feeders/${f.id}/duplicate`, { method: "POST", body: "{}" });
    assert.equal(fresh.status, 201);
    assert.notEqual(fresh.body.seed, 99);
    const kept = await apiJson(`/api/v1/data-feeders/${f.id}/duplicate`, { method: "POST", body: JSON.stringify({ keepSeed: true }) });
    assert.equal(kept.body.seed, 99);
    assert.equal(kept.body.sourceFeederId, f.id);
    assert.equal(kept.body.name, `Copy of ${f.name}`);
  });
});

// ------------------------------------------------------------------------------------------
// The plan table and the plan CSV
// ------------------------------------------------------------------------------------------
test("PLN1 'First messages' has one row per message (30), columns # / Send time / Gap / Dataset / Record, and the first gap is a dash", async (t) => {
  await gui("pln1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 30 });
    await planMessages(sess, 30);
    await waitFor(async () => (await sampleTable(sess)).length === 30, { message: "30 rows" });
    assert.deepEqual(await sampleHeaders(sess), ["#", "Send time", "Gap", "Dataset", "Record"]);
    const rows = await sampleTable(sess);
    assert.deepEqual(rows.map((r: string[]) => r[0]), Array.from({ length: 30 }, (_v, i) => String(i + 1)));
    assert.equal(rows[0][2], "—");
    assert.ok(rows.every((r: string[]) => r[3] === fx.a.name && Number(r[4]) >= 1 && Number(r[4]) <= 5));
  });
});

test("PLN2 with 500 messages the table shows the first 200 and says so; only after Save does it point at the CSV download", async (t) => {
  await gui("pln2", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    const name = await fillBasic(sess, fx.a, { count: 500 });
    await planMessages(sess, 500);
    await waitFor(async () => (await sampleTable(sess)).length === 200, { message: "200 rows" });
    assert.equal(await text(sess, "#df-sample p"), "Showing the first 200 of 500. Save the feeder to download the full plan as CSV.");
    assert.equal(await sess.exec("return document.getElementById('df-csv').hidden;"), true, "no CSV link on an unsaved feeder");
    const id = await saveNew(sess);
    await openSavedFeeder(browser, id, name);
    await waitFor(async () => (await text(sess, "#df-sample p")) === "Showing the first 200 of 500. Download the full plan as CSV for every send time.", { message: "the saved wording" });
  });
});

test("PLN3 the plan tiles report the messages, the window and a busiest minute, and the status line names the window", async (t) => {
  await gui("pln3", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 50 });
    await planMessages(sess, 50);
    assert.equal(await tileValue(sess, "Window"), "1h");
    assert.match(await tileValue(sess, "Busiest minute") ?? "", /^\d+ msgs$/);
    assert.match(await text(sess, "#df-plan-status"), /^50 messages from .+ to .+\.$/);
  });
});

test("PLN4 editing the count redraws the plan at once: tile, table rows and status follow", async (t) => {
  await gui("pln4", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 10 });
    await planMessages(sess, 10);
    await setCount(sess, 4);
    await planMessages(sess, 4);
    await waitFor(async () => (await sampleTable(sess)).length === 4, { message: "4 rows" });
    assert.match(await text(sess, "#df-plan-status"), /^4 messages from/);
  });
});

test("PLN5 a single message plan works: one row, gap and average shown as a dash, and it saves", async (t) => {
  await gui("pln5", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { count: 1 });
    await planMessages(sess, 1);
    await waitFor(async () => (await sampleTable(sess)).length === 1, { message: "one row" });
    assert.equal((await sampleTable(sess))[0][2], "—");
    assert.equal(await tileValue(sess, "Average gap"), "—");
    const id = await saveNew(sess);
    assert.equal((await getFeeder(id)).messageCount, 1);
    assert.equal((await planFor(id)).sample[0].at, (await getFeeder(id)).windowStart);
  });
});

test("PLN6 when the settings are invalid the plan says 'Fix the highlighted settings to see the plan.'", async (t) => {
  await gui("pln6", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    await fillBasic(sess, fx.a, { start: "2031-01-01T10:00", end: "2031-01-01T09:00" });
    await waitFor(async () => (await text(sess, "#df-plan-status")) === "Fix the highlighted settings to see the plan.", { message: "the plan hint" });
    await setValue(sess, "#df-end", "2031-01-01T11:00");
    await waitFor(async () => /^20 messages from/.test(await text(sess, "#df-plan-status")), { message: "the plan to come back" });
  });
});

test("CSV1 the CSV link is absent on a new feeder; on a saved one it downloads <name>-plan.csv with a header and one row per message", async (t) => {
  await gui("csv1", t, async (sess: any, fx: any) => {
    await openNewFeeder(browser);
    assert.equal(await sess.exec("return document.getElementById('df-csv').hidden;"), true);
    const name = await fillBasic(sess, fx.a, { count: 25 });
    const id = await saveNew(sess);
    await openSavedFeeder(browser, id, name);
    await captureDownloads(sess);
    assert.equal(await sess.exec("return document.getElementById('df-csv').hidden;"), false);
    assert.equal(await text(sess, "#df-csv"), "Download full plan (CSV)");
    await click(sess, "#df-csv");
    const file = await waitDownload(sess);
    assert.equal(file.name, `${name}-plan.csv`);
    const lines = file.text.trim().split("\n");
    assert.equal(lines[0], "seq,send_at_utc,gap_seconds,dataset_id,dataset_name,record");
    assert.equal(lines.length, 26);
    const feeder = await getFeeder(id);
    assert.equal(lines[1].split(",")[1], feeder.windowStart);
    assert.equal(lines[25].split(",")[1], feeder.windowEnd);
  });
});

test("CSV2 the plan.csv API is text/csv with an attachment name, needs a session (401 without), and matches the plan's send times", async (t) => {
  await gui("csv2", t, async (_sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id, { messageCount: 15, sendOrder: "sequential", name: "Csv two.feeder" });
    const csv = await downloadCsvText(f.id);
    assert.equal(csv.status, 200);
    assert.match(csv.type ?? "", /^text\/csv/);
    assert.equal(csv.disposition, 'attachment; filename="Csv-two.feeder-plan.csv"');
    const plan = await planFor(f.id);
    const lines = csv.text.trim().split("\n").slice(1).map((l: string) => l.split(","));
    assert.equal(lines.length, 15);
    plan.sample.forEach((row: any, i: number) => {
      assert.equal(lines[i][1], row.at);
      assert.equal(lines[i][3], row.datasetId);
      assert.equal(Number(lines[i][5]), row.record);
    });
    assert.deepEqual(lines.slice(0, 6).map((l: string[]) => Number(l[5])), [1, 2, 3, 4, 5, 1], "in-order records cycle through the 5-record dataset");
    const anon = await fetch(`${process.env.SIT_API_BASE}/api/v1/data-feeders/${f.id}/plan.csv`);
    assert.equal(anon.status, 401);
    assert.equal((await apiJson("/api/v1/data-feeders/dfd_missing/plan.csv")).status, 404);
  });
});

test("CSV3 asking for the CSV with unsaved edits says the CSV is the saved plan and to save first", async (t) => {
  await gui("csv3", t, async (sess: any, fx: any) => {
    const f = await makeFeeder(fx.a.id);
    await openSavedFeeder(browser, f.id, f.name);
    await captureDownloads(sess);
    await typeInto(sess, "#df-name", `${f.name}x`);
    await click(sess, "#df-csv");
    await waitFor(async () => (await statusLine(sess)) === "The CSV is the saved plan. Save first to include your latest changes.", { message: "the save-first notice" });
  });
});

test("CSV4 a dataset whose name starts with = is written to the CSV with a leading ' so a spreadsheet will not run it", async (t) => {
  await gui("csv4", t, async (_sess: any, fx: any) => {
    const made = await apiJson("/api/v1/datasets", { method: "POST", body: JSON.stringify({ name: `=SUM(A1)${uniqueName("q")}`, messageTypeCode: "pain.001.001.09" }) });
    assert.equal(made.status, 200);
    const id = (made.body as any).id;
    await apiJson(`/api/v1/datasets/${id}/messages`, { method: "POST", body: JSON.stringify({ messages: [{ name: "one", format: "json", content: "{}" }] }) });
    const f = await makeFeeder(id, { messageCount: 2 });
    const csv = await downloadCsvText(f.id);
    const row = csv.text.trim().split("\n")[1];
    assert.match(row, /,'=SUM\(A1\)/);
  });
});
