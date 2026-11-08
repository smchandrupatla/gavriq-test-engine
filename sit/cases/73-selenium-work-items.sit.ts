// Business flows for the data-side work items: Datasets (DS), Schedules (SCH) and Test suites (TS).
// Screens are standalone documents opened after console sign-in. Every case is a GUI action followed by an
// INDEPENDENT API confirmation; a status line on its own is never proof. Names are made unique per run.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { apiJson, click, count, localInputValue, pageText, saveShot, setValue, sharedBrowser, sleep, text, typeInto, value, visible, waitFor } from "../lib/selenium/flow.mjs";
import {
  apiTestCase, browserIso, byName, confirmClick, countByName, datasetMessages, datasetRow, deleteDatasetApi, dsListSearch,
  dsNewFill, dsNewPick, dsNewSubmit, dsOpenList, dsTick, dsVisibleIds, field, fieldInvalid, fieldMessage, listOf, makeDataset,
  makeSuite, makeTestCase, noDialogOpen, raw, ready, screenFill, screenReady, screenRowFor, screenRows, screenSave, screenStatus,
  selectOptionContaining, uniqueName, waitByName, waitStatus,
} from "../lib/selenium/work-items.mjs";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());

async function gui(name: string, t: { skip: (m?: string) => void }, body: (sess: any) => Promise<void>) {
  if (!(await browser.available(`work-items-${name}`))) { t.skip(browser.reason); return; }
  const sess = await browser.signedIn();
  try { await body(sess); }
  catch (error) { await saveShot(sess, `work-items-${name}`); throw error; }
}

const DAY = 24 * 3600 * 1000;
const MIN = 60 * 1000;
const inWindow = (iso: string, expectedMs: number, slackMs = 5 * MIN) => Math.abs(new Date(iso).getTime() - expectedMs) <= slackMs;

// ==========================================================================================
// DATASETS
// ==========================================================================================
async function createEmpty(sess: any, name: string, type?: string) {
  await browser.open("/datasets-new.html");
  await dsNewFill(sess, { name, type });
  await dsNewSubmit(sess);
}

test("DS1 create an empty dataset with a name and message type, then it opens in the detail panel", async (t) => {
  await gui("ds1", t, async (sess) => {
    const name = uniqueName("SitDsEmpty");
    await createEmpty(sess, name, "pain.001.001.09");
    const row = await waitByName("/api/v1/datasets", name);
    assert.equal(row.row_count, 0);
    assert.equal(row.message_type_code, "pain.001.001.09");
    assert.equal(row.status, "active");
    await waitFor(async () => (await sess.url()).includes(`created=${row.id}`), { message: "redirect to Saved datasets" });
    await waitFor(async () => (await raw(sess, "#d-name")) === name, { message: "the new dataset in the detail panel" });
    assert.equal(await raw(sess, "#d-id"), row.id);
    assert.match(await raw(sess, "#d-summary"), /pain\.001\.001\.09/);
    assert.match(await raw(sess, "#d-message-count") + (await raw(sess, "#d-messages")), /No messages have been assembled/);
    await deleteDatasetApi(row.id);
  });
});

test("DS2 create an empty dataset without a message type stores none", async (t) => {
  await gui("ds2", t, async (sess) => {
    const name = uniqueName("SitDsNoType");
    await createEmpty(sess, name);
    const row = await waitByName("/api/v1/datasets", name);
    assert.equal(row.message_type_code, null);
    assert.equal(row.row_count, 0);
    await waitFor(async () => (await raw(sess, "#d-summary")).includes("Not set"), { message: "Message type: Not set" });
    await deleteDatasetApi(row.id);
  });
});

test("DS3 a dataset needs a name: the page says so and creates nothing", async (t) => {
  await gui("ds3", t, async (sess) => {
    const before = (await listOf("/api/v1/datasets")).length;
    await createEmpty(sess, "", "pain.001.001.09");
    await waitFor(async () => (await raw(sess, "#ds-name-error")) === "Name is required.", { message: "the name error" });
    assert.ok((await sess.url()).includes("/datasets-new.html"), "must stay on the form");
    await sleep(500);
    assert.equal((await listOf("/api/v1/datasets")).length, before);
  });
});

test("DS4 a name of only spaces is refused like an empty name", async (t) => {
  await gui("ds4", t, async (sess) => {
    const before = (await listOf("/api/v1/datasets")).length;
    await createEmpty(sess, "     ");
    await waitFor(async () => (await raw(sess, "#ds-name-error")) === "Name is required.", { message: "the name error" });
    assert.equal((await listOf("/api/v1/datasets")).length, before);
  });
});

test("DS5 typing in the name clears the error, and the dataset can then be created", async (t) => {
  await gui("ds5", t, async (sess) => {
    const name = uniqueName("SitDsRetry");
    await createEmpty(sess, "");
    await waitFor(async () => (await raw(sess, "#ds-name-error")).length > 0, { message: "the name error" });
    await typeInto(sess, "#ds-name", name);
    assert.equal(await raw(sess, "#ds-name-error"), "", "the error clears while typing");
    await dsNewSubmit(sess);
    const row = await waitByName("/api/v1/datasets", name);
    assert.equal(row.row_count, 0);
    await deleteDatasetApi(row.id);
  });
});

test("DS6 creating a second dataset with the same name is accepted and yields two distinct datasets", async (t) => {
  await gui("ds6", t, async (sess) => {
    const name = uniqueName("SitDsTwin");
    await createEmpty(sess, name, "pain.001.001.09");
    await waitByName("/api/v1/datasets", name);
    await createEmpty(sess, name, "pain.001.001.09");
    await waitFor(async () => (await countByName("/api/v1/datasets", name)) === 2, { message: "two datasets with the same name" });
    const rows = (await listOf("/api/v1/datasets")).filter((d: any) => d.name === name);
    assert.notEqual(rows[0].id, rows[1].id);
    for (const r of rows) await deleteDatasetApi(r.id);
  });
});

test("DS7 build a dataset from two existing datasets: rows, messages and message type are copied in order", async (t) => {
  await gui("ds7", t, async (sess) => {
    const a = await makeDataset(uniqueName("SitDsSrcA"), 3);
    const b = await makeDataset(uniqueName("SitDsSrcB"), 2);
    const name = uniqueName("SitDsMix");
    await browser.open("/datasets-new.html");
    await dsNewFill(sess, { name, mix: true });
    await dsNewPick(sess, a.id);
    await dsNewPick(sess, b.id);
    await waitFor(async () => (await raw(sess, "#mix-preview")).includes("5"), { message: "mix preview showing 5 rows" });
    assert.match(await raw(sess, "#mix-preview"), /5 rows|5\s*rows/);
    assert.match(await raw(sess, "#screen-action"), /Create mixed dataset/);
    await dsNewSubmit(sess);
    const row = await waitByName("/api/v1/datasets", name);
    assert.equal(row.row_count, 5);
    assert.equal(row.message_type_code, "pain.001.001.09", "inherited because both sources share it");
    const mixed = await datasetMessages(row.id);
    const srcA = await datasetMessages(a.id);
    const srcB = await datasetMessages(b.id);
    assert.equal(mixed.status, 200);
    assert.equal(mixed.rows.length, 5);
    assert.deepEqual(mixed.rows.map((m: any) => JSON.stringify(m.payload)), [...srcA.rows, ...srcB.rows].map((m: any) => JSON.stringify(m.payload)));
    for (const id of [row.id, a.id, b.id]) await deleteDatasetApi(id);
  });
});

test("DS8 the mix order arrows reverse which source is copied first", async (t) => {
  await gui("ds8", t, async (sess) => {
    const a = await makeDataset(uniqueName("SitDsOrdA"), 2);
    const b = await makeDataset(uniqueName("SitDsOrdB"), 2);
    const name = uniqueName("SitDsOrder");
    await browser.open("/datasets-new.html");
    await dsNewFill(sess, { name, mix: true });
    await dsNewPick(sess, a.id);
    await dsNewPick(sess, b.id);
    await click(sess, `#mix-order button[data-move="-1"][data-id="${b.id}"]`);
    await waitFor(async () => (await sess.exec("return document.querySelector('#mix-order li .cn').textContent;")) === b.name, { message: "source B listed first" });
    await dsNewSubmit(sess);
    const row = await waitByName("/api/v1/datasets", name);
    const mixed = await datasetMessages(row.id);
    const srcA = await datasetMessages(a.id);
    const srcB = await datasetMessages(b.id);
    assert.deepEqual(mixed.rows.map((m: any) => JSON.stringify(m.payload)), [...srcB.rows, ...srcA.rows].map((m: any) => JSON.stringify(m.payload)));
    for (const id of [row.id, a.id, b.id]) await deleteDatasetApi(id);
  });
});

test("DS9 removing a source from the mix order leaves only the other one", async (t) => {
  await gui("ds9", t, async (sess) => {
    const a = await makeDataset(uniqueName("SitDsRmA"), 2);
    const b = await makeDataset(uniqueName("SitDsRmB"), 4);
    const name = uniqueName("SitDsRemove");
    await browser.open("/datasets-new.html");
    await dsNewFill(sess, { name, mix: true });
    await dsNewPick(sess, a.id);
    await dsNewPick(sess, b.id);
    await click(sess, `#mix-order button[data-remove="${a.id}"]`);
    await waitFor(async () => (await count(sess, "#mix-order li")) === 1, { message: "one source left" });
    assert.match(await raw(sess, "#source-count"), /1 selected/);
    await dsNewSubmit(sess);
    const row = await waitByName("/api/v1/datasets", name);
    assert.equal(row.row_count, 4);
    assert.equal((await datasetMessages(row.id)).rows.length, 4);
    for (const id of [row.id, a.id, b.id]) await deleteDatasetApi(id);
  });
});

test("DS10 building from existing datasets needs at least one source and creates nothing without one", async (t) => {
  await gui("ds10", t, async (sess) => {
    const name = uniqueName("SitDsNoSrc");
    await browser.open("/datasets-new.html");
    await dsNewFill(sess, { name, mix: true });
    await dsNewSubmit(sess);
    await waitFor(async () => (await raw(sess, "#source-error")).includes("Pick at least one dataset"), { message: "the source error" });
    await sleep(400);
    assert.equal(await countByName("/api/v1/datasets", name), 0);
  });
});

test("DS11 the source filter narrows the pick list and clearing it brings the full list back", async (t) => {
  await gui("ds11", t, async (sess) => {
    const a = await makeDataset(uniqueName("SitDsFiltA"), 1);
    await makeDataset(uniqueName("SitDsFiltB"), 1).then((b: any) => b);
    await browser.open("/datasets-new.html");
    await dsNewFill(sess, { name: "x", mix: true });
    await waitFor(async () => (await count(sess, ".source")) > 2, { message: "sources listed" });
    const all = await count(sess, ".source");
    await typeInto(sess, "#source-filter", a.name);
    await waitFor(async () => (await count(sess, ".source")) === 1, { message: "filtered to one source" });
    assert.equal(await sess.exec("return document.querySelector('.source').value;"), a.id);
    await typeInto(sess, "#source-filter", "no-such-dataset-zzz");
    await waitFor(async () => (await raw(sess, "#source-pick")).includes("No datasets match the filter"), { message: "empty filter message" });
    await setValue(sess, "#source-filter", "");
    await waitFor(async () => (await count(sess, ".source")) >= all, { message: "the full list is back" });
  });
});

test("DS12 sources with different message types produce a warning and no inherited message type", async (t) => {
  await gui("ds12", t, async (sess) => {
    const a = await makeDataset(uniqueName("SitDsTypeA"), 1, "pain.001.001.09");
    const b = await makeDataset(uniqueName("SitDsTypeB"), 1, "pacs.008.001.08");
    const name = uniqueName("SitDsMixed");
    await browser.open("/datasets-new.html");
    await dsNewFill(sess, { name, mix: true });
    await dsNewPick(sess, a.id);
    await dsNewPick(sess, b.id);
    await waitFor(async () => (await raw(sess, "#mix-preview")).includes("different message types"), { message: "the type warning" });
    await dsNewSubmit(sess);
    const row = await waitByName("/api/v1/datasets", name);
    assert.equal(row.message_type_code, null);
    assert.equal(row.row_count, 2);
    for (const id of [row.id, a.id, b.id]) await deleteDatasetApi(id);
  });
});

test("DS13 an explicit message type on a mixed dataset wins over the inherited one", async (t) => {
  await gui("ds13", t, async (sess) => {
    const a = await makeDataset(uniqueName("SitDsExpA"), 1);
    const name = uniqueName("SitDsExplicit");
    await browser.open("/datasets-new.html");
    await dsNewFill(sess, { name, type: "custom.type.1", mix: true });
    await dsNewPick(sess, a.id);
    await dsNewSubmit(sess);
    const row = await waitByName("/api/v1/datasets", name);
    assert.equal(row.message_type_code, "custom.type.1");
    for (const id of [row.id, a.id]) await deleteDatasetApi(id);
  });
});

test("DS14 Saved datasets lists a new dataset with its rows and message type", async (t) => {
  await gui("ds14", t, async (sess) => {
    const d = await makeDataset(uniqueName("SitDsList"), 4);
    await dsOpenList(browser, sess);
    await waitFor(async () => (await dsVisibleIds(sess)).includes(d.id), { message: "the dataset in the list" });
    const rowText = await text(sess, `#dataset-rows tr[data-id="${d.id}"]`);
    assert.ok(rowText.includes(d.name));
    assert.ok(rowText.includes("pain.001.001.09"));
    assert.ok(/\b4\b/.test(rowText), rowText);
    assert.equal((await datasetRow(d.id)).row_count, 4);
    await deleteDatasetApi(d.id);
  });
});

test("DS15 search narrows Saved datasets to the match, matches by message type, and clearing restores the list", async (t) => {
  await gui("ds15", t, async (sess) => {
    const d = await makeDataset(uniqueName("SitDsSearch"), 1, "camt.053.001.08");
    await dsOpenList(browser, sess);
    const all = (await dsVisibleIds(sess)).length;
    await dsListSearch(sess, d.name);
    await waitFor(async () => JSON.stringify(await dsVisibleIds(sess)) === JSON.stringify([d.id]), { message: "only the match" });
    await dsListSearch(sess, "camt.053.001.08");
    await waitFor(async () => (await dsVisibleIds(sess)).includes(d.id), { message: "match by message type" });
    await dsListSearch(sess, "no-such-dataset-zzz-999");
    await waitFor(async () => (await dsVisibleIds(sess)).length === 0 && (await visible(sess, "#empty-state")), { message: "empty state" });
    await dsListSearch(sess, "");
    await waitFor(async () => (await dsVisibleIds(sess)).length === all, { message: "the full list is back" });
    await deleteDatasetApi(d.id);
  });
});

test("DS16 View opens the detail with the dataset's name, id, row count and message count", async (t) => {
  await gui("ds16", t, async (sess) => {
    const d = await makeDataset(uniqueName("SitDsView"), 3);
    await dsOpenList(browser, sess);
    await dsListSearch(sess, d.name);
    await click(sess, `#dataset-rows button[data-act=open][data-id="${d.id}"]`);
    await waitFor(async () => (await raw(sess, "#d-name")) === d.name, { message: "detail name" });
    assert.equal(await raw(sess, "#d-id"), d.id);
    assert.match(await raw(sess, "#d-summary"), /Rows\s*3/);
    await waitFor(async () => (await raw(sess, "#d-message-count")) === "(3)", { message: "message count (3)" });
    assert.equal(await count(sess, "#d-messages details.msg"), 3);
    assert.equal((await datasetMessages(d.id)).rows.length, 3);
    await click(sess, "#d-close");
    await waitFor(async () => !(await visible(sess, "#detail")), { message: "detail closed" });
    await deleteDatasetApi(d.id);
  });
});

test("DS17 select two datasets and Mix into new dataset opens the form pre-filled, and creating it copies both", async (t) => {
  await gui("ds17", t, async (sess) => {
    const tok = uniqueName("SitDsPick");
    const a = await makeDataset(`${tok}A`, 2);
    const b = await makeDataset(`${tok}B`, 3);
    await dsOpenList(browser, sess);
    await dsListSearch(sess, tok);
    await waitFor(async () => (await dsVisibleIds(sess)).length >= 2, { message: "both sources listed" });
    await dsTick(sess, a.id);
    await dsTick(sess, b.id);
    assert.equal(await raw(sess, "#sel-count"), "02 SELECTED");
    await click(sess, "#mix-selected");
    await waitFor(async () => (await sess.url()).includes("/datasets-new.html?from="), { message: "the new-dataset form" });
    await ready(sess, "#ds-name");
    await waitFor(async () => (await value(sess, "#ds-name")).startsWith("Mix of "), { message: "pre-filled name" });
    assert.equal(await sess.exec("return document.querySelector('input[name=mode][value=mix]').checked;"), true);
    assert.equal(await count(sess, "#mix-order li"), 2);
    const name = uniqueName("SitDsPickMix");
    await typeInto(sess, "#ds-name", name);
    await dsNewSubmit(sess);
    const row = await waitByName("/api/v1/datasets", name);
    assert.equal(row.row_count, 5);
    assert.equal((await datasetMessages(row.id)).rows.length, 5);
    for (const id of [row.id, a.id, b.id]) await deleteDatasetApi(id);
  });
});

test("DS18 selection count, Clear selection and Select all work on the visible datasets", async (t) => {
  await gui("ds18", t, async (sess) => {
    const tok = uniqueName("SitDsSel");
    const a = await makeDataset(`${tok}A`, 0);
    const b = await makeDataset(`${tok}B`, 0);
    await dsOpenList(browser, sess);
    await dsListSearch(sess, tok);
    await waitFor(async () => (await dsVisibleIds(sess)).length === 2, { message: "two visible" });
    assert.equal(await raw(sess, "#sel-count"), "00 SELECTED");
    assert.equal(await sess.exec("return document.getElementById('delete-selected').disabled;"), true);
    await click(sess, "#select-all");
    await waitFor(async () => (await raw(sess, "#sel-count")) === "02 SELECTED", { message: "02 selected" });
    assert.equal(await sess.exec("return document.getElementById('delete-selected').disabled;"), false);
    await click(sess, "#clear-all");
    await waitFor(async () => (await raw(sess, "#sel-count")) === "00 SELECTED", { message: "00 selected" });
    await deleteDatasetApi(a.id); await deleteDatasetApi(b.id);
  });
});

test("DS19 Delete selected: declining the confirmation keeps every dataset", async (t) => {
  await gui("ds19", t, async (sess) => {
    const tok = uniqueName("SitDsKeep");
    const a = await makeDataset(`${tok}A`, 1);
    const b = await makeDataset(`${tok}B`, 1);
    await dsOpenList(browser, sess);
    await dsListSearch(sess, tok);
    await waitFor(async () => (await dsVisibleIds(sess)).length === 2, { message: "two visible" });
    await dsTick(sess, a.id); await dsTick(sess, b.id);
    const prompt = await confirmClick(sess, "#delete-selected", { accept: false });
    assert.match(prompt, /Delete 2 selected dataset\(s\)\?/);
    await sleep(800);
    assert.ok(await datasetRow(a.id), "A must still exist");
    assert.ok(await datasetRow(b.id), "B must still exist");
    assert.equal((await dsVisibleIds(sess)).length, 2);
    for (const id of [a.id, b.id]) await deleteDatasetApi(id);
  });
});

test("DS20 Delete selected: accepting the confirmation deletes exactly the ticked datasets", async (t) => {
  await gui("ds20", t, async (sess) => {
    const tok = uniqueName("SitDsDel");
    const a = await makeDataset(`${tok}A`, 1);
    const b = await makeDataset(`${tok}B`, 1);
    const keep = await makeDataset(`${tok}Keep`, 1);
    await dsOpenList(browser, sess);
    await dsListSearch(sess, tok);
    await waitFor(async () => (await dsVisibleIds(sess)).length === 3, { message: "three visible" });
    await dsTick(sess, a.id); await dsTick(sess, b.id);
    const prompt = await confirmClick(sess, "#delete-selected", { accept: true });
    assert.match(prompt, /Delete 2 selected dataset/);
    await waitFor(async () => !(await datasetRow(a.id)) && !(await datasetRow(b.id)), { message: "A and B deleted in the API" });
    assert.ok(await datasetRow(keep.id), "the unticked dataset survives");
    assert.equal((await apiJson(`/api/v1/datasets/${a.id}`)).status, 404);
    await deleteDatasetApi(keep.id);
  });
});

test("DS21 the detail Delete button asks first: decline keeps it, accept deletes it", async (t) => {
  await gui("ds21", t, async (sess) => {
    const d = await makeDataset(uniqueName("SitDsOne"), 1);
    await dsOpenList(browser, sess);
    await dsListSearch(sess, d.name);
    await click(sess, `#dataset-rows button[data-act=open][data-id="${d.id}"]`);
    await waitFor(async () => (await raw(sess, "#d-name")) === d.name, { message: "detail" });
    assert.match(await confirmClick(sess, "#d-delete", { accept: false }), /Delete this dataset\?/);
    await sleep(600);
    assert.ok(await datasetRow(d.id));
    await confirmClick(sess, "#d-delete", { accept: true });
    await waitFor(async () => !(await datasetRow(d.id)), { message: "deleted in the API" });
    await waitFor(async () => !(await visible(sess, "#detail")), { message: "detail closes" });
  });
});

test("DS22 the dataset page keeps element ids unique", { todo: "datasets.html renders two elements with id d-mix in the detail panel (duplicate 'Use in new dataset' link)" }, async (t) => {
  await gui("ds22", t, async (sess) => {
    await browser.open("/datasets.html");
    await ready(sess, "#search");
    const dupes = await sess.exec("const seen={},d=[];document.querySelectorAll('[id]').forEach(e=>{seen[e.id]=(seen[e.id]||0)+1;});for(const k in seen)if(seen[k]>1)d.push(k);return d;");
    assert.deepEqual(dupes, []);
  });
});

test("DS23 a dataset mixed from others shows where it was built from", { todo: "'Built from' is derived only from item tags, so mixing datasets without items shows 'Created directly, not mixed from other datasets' and the 'Mixed from others' stat stays 0" }, async (t) => {
  await gui("ds23", t, async (sess) => {
    const a = await makeDataset(uniqueName("SitDsLinA"), 2);
    const name = uniqueName("SitDsLinMix");
    await browser.open("/datasets-new.html");
    await dsNewFill(sess, { name, mix: true });
    await dsNewPick(sess, a.id);
    await dsNewSubmit(sess);
    const row = await waitByName("/api/v1/datasets", name);
    await waitFor(async () => (await raw(sess, "#d-name")) === name, { message: "detail of the mixed dataset" });
    assert.ok((await raw(sess, "#d-sources")).includes(a.name), `'Built from' should list ${a.name}: ${await raw(sess, "#d-sources")}`);
    await deleteDatasetApi(row.id); await deleteDatasetApi(a.id);
  });
});

// ==========================================================================================
// SCHEDULES
// ==========================================================================================
let fixturePromise: Promise<{ suite: { id: string; name: string }; testCase: { id: string; name: string } }> | null = null;
function fixtures() {
  fixturePromise ||= (async () => {
    const testCase = await makeTestCase(uniqueName("SitSchCase"));
    const suite = await makeSuite(uniqueName("SitSchSuite"), [testCase.id]);
    return { suite, testCase };
  })();
  return fixturePromise;
}

async function schedule(sess: any, o: { name?: string; type?: "suite" | "test_case"; target?: string; cadence?: string; first?: Date | null }) {
  await browser.open("/schedules-new.html");
  await screenReady(sess);
  if (o.name !== undefined) await screenFill(sess, "name", o.name);
  if (o.type) await screenFill(sess, "targetType", o.type);
  if (o.target) {
    await waitFor(async () => (await sess.exec("return document.querySelector('[data-field=targetId]').options.length;")) > 1, { message: "targets loaded" });
    await selectOptionContaining(sess, field("targetId"), `(${o.target})`);
  }
  if (o.cadence) await screenFill(sess, "cadence", o.cadence);
  if (o.first) await screenFill(sess, "startsAt", localInputValue(o.first));
  await screenSave(sess);
}
async function expectSaved(sess: any, name: string) {
  await waitStatus(sess, /Saved\./);
  return waitByName("/api/v1/schedules", name);
}
const firstRun = (days = 2) => new Date(Math.ceil((Date.now() + days * DAY) / MIN) * MIN);

test("SCH1 schedule a test suite Once without a first run: it persists type, target, cadence and runs now", async (t) => {
  await gui("sch1", t, async (sess) => {
    const { suite } = await fixtures();
    const name = uniqueName("SitSchSuiteOnce");
    await schedule(sess, { name, type: "suite", target: suite.id, cadence: "once" });
    const row = await expectSaved(sess, name);
    assert.deepEqual([row.cadence, row.target_type, row.target_id, row.enabled, row.status], ["once", "suite", suite.id, true, "scheduled"]);
    assert.ok(inWindow(row.next_run_at, Date.now()), `next run ${row.next_run_at} should be about now`);
  });
});

test("SCH2 schedule a test suite Hourly with a first run: the first run instant is kept", async (t) => {
  await gui("sch2", t, async (sess) => {
    const { suite } = await fixtures();
    const name = uniqueName("SitSchSuiteHourly");
    const first = firstRun(2);
    await schedule(sess, { name, type: "suite", target: suite.id, cadence: "hourly", first });
    const row = await expectSaved(sess, name);
    assert.deepEqual([row.cadence, row.target_type, row.target_id], ["hourly", "suite", suite.id]);
    assert.equal(row.next_run_at, await browserIso(sess, localInputValue(first)));
  });
});

test("SCH3 schedule a test suite Daily without a first run: the next run is a day away", async (t) => {
  await gui("sch3", t, async (sess) => {
    const { suite } = await fixtures();
    const name = uniqueName("SitSchSuiteDaily");
    await schedule(sess, { name, type: "suite", target: suite.id, cadence: "daily" });
    const row = await expectSaved(sess, name);
    assert.deepEqual([row.cadence, row.target_type, row.target_id], ["daily", "suite", suite.id]);
    assert.ok(inWindow(row.next_run_at, Date.now() + DAY), row.next_run_at);
  });
});

test("SCH4 schedule a test suite Weekly with a first run", async (t) => {
  await gui("sch4", t, async (sess) => {
    const { suite } = await fixtures();
    const name = uniqueName("SitSchSuiteWeekly");
    const first = firstRun(3);
    await schedule(sess, { name, type: "suite", target: suite.id, cadence: "weekly", first });
    const row = await expectSaved(sess, name);
    assert.deepEqual([row.cadence, row.target_type, row.target_id], ["weekly", "suite", suite.id]);
    assert.equal(row.next_run_at, await browserIso(sess, localInputValue(first)));
  });
});

test("SCH5 schedule a single test case Once with a first run", async (t) => {
  await gui("sch5", t, async (sess) => {
    const { testCase } = await fixtures();
    const name = uniqueName("SitSchCaseOnce");
    const first = firstRun(1);
    await schedule(sess, { name, type: "test_case", target: testCase.id, cadence: "once", first });
    const row = await expectSaved(sess, name);
    assert.deepEqual([row.cadence, row.target_type, row.target_id], ["once", "test_case", testCase.id]);
    assert.equal(row.next_run_at, await browserIso(sess, localInputValue(first)));
  });
});

test("SCH6 schedule a single test case Hourly without a first run: the next run is an hour away", async (t) => {
  await gui("sch6", t, async (sess) => {
    const { testCase } = await fixtures();
    const name = uniqueName("SitSchCaseHourly");
    await schedule(sess, { name, type: "test_case", target: testCase.id, cadence: "hourly" });
    const row = await expectSaved(sess, name);
    assert.deepEqual([row.cadence, row.target_type, row.target_id], ["hourly", "test_case", testCase.id]);
    assert.ok(inWindow(row.next_run_at, Date.now() + 3600 * 1000), row.next_run_at);
  });
});

test("SCH7 schedule a single test case Daily with a first run", async (t) => {
  await gui("sch7", t, async (sess) => {
    const { testCase } = await fixtures();
    const name = uniqueName("SitSchCaseDaily");
    const first = firstRun(4);
    await schedule(sess, { name, type: "test_case", target: testCase.id, cadence: "daily", first });
    const row = await expectSaved(sess, name);
    assert.deepEqual([row.cadence, row.target_type, row.target_id], ["daily", "test_case", testCase.id]);
    assert.equal(row.next_run_at, await browserIso(sess, localInputValue(first)));
  });
});

test("SCH8 schedule a single test case Weekly without a first run: the next run is a week away", async (t) => {
  await gui("sch8", t, async (sess) => {
    const { testCase } = await fixtures();
    const name = uniqueName("SitSchCaseWeekly");
    await schedule(sess, { name, type: "test_case", target: testCase.id, cadence: "weekly" });
    const row = await expectSaved(sess, name);
    assert.deepEqual([row.cadence, row.target_type, row.target_id], ["weekly", "test_case", testCase.id]);
    assert.ok(inWindow(row.next_run_at, Date.now() + 7 * DAY), row.next_run_at);
  });
});

test("SCH9 the Runs dropdown reloads the target list: suites for a suite, test cases for a test case", async (t) => {
  await gui("sch9", t, async (sess) => {
    const { suite, testCase } = await fixtures();
    await browser.open("/schedules-new.html");
    await screenReady(sess);
    const options = async () => sess.exec("return [...document.querySelector('[data-field=targetId]').options].map(o=>o.value);");
    await waitFor(async () => (await options()).includes(suite.id), { message: "suite listed" });
    assert.ok(!(await options()).includes(testCase.id), "a test case is not offered while Runs = suite");
    await screenFill(sess, "targetType", "test_case");
    await waitFor(async () => (await options()).includes(testCase.id), { message: "test case listed after switching" });
    assert.ok(!(await options()).includes(suite.id));
    assert.equal((await options())[0], "", "the placeholder comes first");
    await screenFill(sess, "targetType", "suite");
    await waitFor(async () => (await options()).includes(suite.id), { message: "suite listed again" });
  });
});

test("SCH10 a schedule needs a name: the field is flagged and nothing is saved", async (t) => {
  await gui("sch10", t, async (sess) => {
    const { suite } = await fixtures();
    const before = (await listOf("/api/v1/schedules")).length;
    await schedule(sess, { type: "suite", target: suite.id, cadence: "daily" });
    await waitStatus(sess, /need.* attention/);
    assert.equal(await fieldInvalid(sess, "name"), true);
    assert.ok((await fieldMessage(sess, "name")).length > 0, "a message sits under Name");
    assert.equal(await fieldInvalid(sess, "cadence"), false);
    await sleep(400);
    assert.equal((await listOf("/api/v1/schedules")).length, before);
  });
});

test("SCH11 a schedule needs a suite or test case target: the field is flagged and nothing is saved", async (t) => {
  await gui("sch11", t, async (sess) => {
    const name = uniqueName("SitSchNoTarget");
    await schedule(sess, { name, type: "suite", cadence: "daily" });
    await waitStatus(sess, /need.* attention/);
    assert.equal(await fieldInvalid(sess, "targetId"), true);
    assert.ok((await fieldMessage(sess, "targetId")).length > 0);
    await sleep(400);
    assert.equal(await countByName("/api/v1/schedules", name), 0);
  });
});

test("SCH12 a schedule needs a cadence: the field is flagged and nothing is saved", async (t) => {
  await gui("sch12", t, async (sess) => {
    const { suite } = await fixtures();
    const name = uniqueName("SitSchNoCadence");
    await schedule(sess, { name, type: "suite", target: suite.id });
    await waitStatus(sess, /need.* attention/);
    assert.equal(await fieldInvalid(sess, "cadence"), true);
    assert.ok((await fieldMessage(sess, "cadence")).length > 0);
    await sleep(400);
    assert.equal(await countByName("/api/v1/schedules", name), 0);
  });
});

test("SCH13 an empty form reports all three required fields at once, and each message clears when its field is fixed", async (t) => {
  await gui("sch13", t, async (sess) => {
    await schedule(sess, {});
    await waitStatus(sess, /3 fields need attention/);
    for (const f of ["name", "targetId", "cadence"]) assert.equal(await fieldInvalid(sess, f), true, `${f} flagged`);
    await screenFill(sess, "cadence", "weekly");
    assert.equal(await fieldInvalid(sess, "cadence"), false, "fixing Cadence clears its message");
    await typeInto(sess, field("name"), "x");
    assert.equal(await fieldInvalid(sess, "name"), false);
    assert.equal(await fieldInvalid(sess, "targetId"), true, "the untouched field stays flagged");
  });
});

test("SCH14 a new schedule appears in All schedules with its name, cadence and target", async (t) => {
  await gui("sch14", t, async (sess) => {
    const { suite } = await fixtures();
    const name = uniqueName("SitSchListed");
    await schedule(sess, { name, type: "suite", target: suite.id, cadence: "daily", first: firstRun(2) });
    const row = await expectSaved(sess, name);
    await browser.open("/schedules-all.html");
    const line = await screenRowFor(sess, name);
    assert.match(line, /daily/i);
    assert.ok(line.includes(row.id), line);
    assert.ok(line.includes(suite.id), line);
  });
});

test("SCH15 a schedule whose first run is in the future appears in Upcoming schedules", async (t) => {
  await gui("sch15", t, async (sess) => {
    const { testCase } = await fixtures();
    const name = uniqueName("SitSchUpcoming");
    await schedule(sess, { name, type: "test_case", target: testCase.id, cadence: "once", first: firstRun(2) });
    const row = await expectSaved(sess, name);
    await browser.open("/schedules-upcoming.html");
    const line = await screenRowFor(sess, name);
    assert.ok(line.includes(row.id));
  });
});

test("SCH16 Upcoming schedules does not list a schedule whose next run is already in the past", { todo: "schedules-upcoming.html reads /api/v1/schedules unfiltered, so a once-schedule dated in the past (and the seeded August ones) is listed as upcoming" }, async (t) => {
  await gui("sch16", t, async (sess) => {
    const { suite } = await fixtures();
    const name = uniqueName("SitSchPast");
    const made = await apiJson("/api/v1/schedules", { method: "POST", body: JSON.stringify({ name, targetType: "suite", targetId: suite.id, cadence: "once", startsAt: "2020-01-01T10:00" }) });
    assert.equal(made.status, 201);
    await browser.open("/schedules-upcoming.html");
    await waitFor(async () => (await screenRows(sess)).length > 0, { message: "rows" });
    const rows = await screenRows(sess);
    assert.ok(!rows.some((r: string) => r.includes(name)), "a schedule due in 2020 is not upcoming");
  });
});

test("SCH17 the New schedule button on Upcoming schedules leads to the schedule form", { todo: "schedules-upcoming.html wires 'New schedule' to POST /api/v1/schedules with an empty body, so it only shows a validation error instead of opening the form" }, async (t) => {
  await gui("sch17", t, async (sess) => {
    const before = (await listOf("/api/v1/schedules")).length;
    await browser.open("/schedules-upcoming.html");
    await screenReady(sess);
    await click(sess, "#screen-action");
    await sleep(1500);
    assert.equal((await listOf("/api/v1/schedules")).length, before, "no empty schedule is created");
    assert.ok((await sess.url()).includes("/schedules-new.html") || (await visible(sess, field("name"))), `expected the form, got ${await sess.url()} with status "${await screenStatus(sess)}"`);
  });
});

test("SCH18 a suite created in the GUI is offered to a new schedule and can be scheduled end to end", async (t) => {
  await gui("sch18", t, async (sess) => {
    const c = await makeTestCase(uniqueName("SitSchE2eCase"));
    const suiteName = uniqueName("SitSchE2eSuite");
    await browser.open("/test-suite-form.html");
    await ready(sess, "#f-name");
    await typeInto(sess, "#f-name", suiteName);
    await typeInto(sess, "#case-filter", c.id);
    await waitFor(async () => (await count(sess, ".member-case")) === 1, { message: "one filtered case" });
    await click(sess, `.member-case[value="${c.id}"]`);
    await click(sess, "#create-btn");
    const suite = await waitByName("/api/v1/test-suites", suiteName);
    assert.deepEqual(suite.case_ids, [c.id]);
    const name = uniqueName("SitSchE2e");
    await schedule(sess, { name, type: "suite", target: suite.id, cadence: "daily" });
    const row = await expectSaved(sess, name);
    assert.equal(row.target_id, suite.id);
    assert.equal(row.target_type, "suite");
  });
});
