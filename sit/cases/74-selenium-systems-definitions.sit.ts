// External systems (/external-systems.html), driven through the browser and confirmed through the API:
// create one of every channel, headers JSON, generated ids, the family tabs, edit a row, delete a row,
// Save integration, dummy send and Test connection, the count line. (Saved definitions are in 74b-*.)
//
// The Test Engine catalogue scans for calls of test with a literal name, so every case name here is a literal.
// A case marked { todo } exposes a product defect: its assertion states what the page should do.
import { after, test as nodeTest, type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  apiJson, saveShot, sharedBrowser, sleep, text, uniqueName, value, visible, waitFor as baseWaitFor,
} from "../lib/selenium/flow.mjs";
import {
  addSystem, allSystems, dropSystem, familyOf, idsInPanel, integration, openExternalSystems, panelActive, rowValues, showTab, systemFromApi,
  updateRow, count,
} from "../lib/selenium/definitions.mjs";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());

/** A busy shared machine makes pages slow, so every wait here allows 30 s unless a case says otherwise. */
const waitFor = (fn: () => unknown, o: { timeout?: number; interval?: number; message?: string } = {}) => baseWaitFor(fn, { timeout: 30000, ...o });

type Sess = Awaited<ReturnType<typeof browser.signedIn>>;
type Body = (sess: Sess, t: TestContext) => Promise<void>;

/** One GUI case: skipped when Selenium is down, screenshotted when it fails. Named test on purpose (see header). */
function test(name: string, a: Body | { todo: string }, b?: Body) {
  const fn = (typeof a === "function" ? a : b) as Body;
  const opts = typeof a === "function" ? {} : a;
  nodeTest(name, opts, async (t) => {
    if (!(await browser.available(`sysdef-${name}`))) { t.skip(browser.reason); return; }
    const sess = await browser.signedIn();
    try { await fn(sess, t); }
    catch (error) { await saveShot(sess, `sysdef-${name}`); throw error; }
  });
}

const created: string[] = [];
after(async () => { for (const id of created) await dropSystem(id); });
function sysId(prefix = "sit_x") { const id = `${prefix}_${uniqueName("").toLowerCase()}`; created.push(id); return id; }

// ==========================================================================================
// EXT  External systems
// ==========================================================================================
test("EXT1 the page opens with five tabs and a count line equal to the API's number of systems", async (sess) => {
  await openExternalSystems(sess, browser);
  const tabs = await sess.exec("return [...document.querySelectorAll('.tabs [role=tab]')].map(b=>b.textContent.trim());");
  assert.deepEqual(tabs, ["External systems", "Queue", "Kafka", "FTP", "API"]);
  const systems = await allSystems();
  assert.equal(await text(sess, "#view-status"), `${systems.length} external system${systems.length === 1 ? "" : "s"}`);
  assert.equal((await idsInPanel(sess, "all")).length, systems.length);
  assert.equal(await text(sess, "#dashboard-status"), `Dashboard loaded for ${systems.length} system${systems.length === 1 ? "" : "s"}`);
});

test("EXT2 create an MQ system: endpoint, queue and headers reach the API and the row appears", async (sess) => {
  await openExternalSystems(sess, browser);
  const id = sysId(), name = `MQ ${id}`;
  const status = await addSystem(sess, { id, name, channel: "mq", endpoint: "/stubs/mq-delivery", dest: "SIT.QUEUE.ONE", headers: '{"x-a":"1","x-b":"two"}' });
  assert.equal(status, `created ${id}`);
  const row = await systemFromApi(id);
  assert.ok(row, "the system must exist");
  assert.deepEqual([row.name, row.channel, row.endpoint, row.queue, row.enabled], [name, "mq", "/stubs/mq-delivery", "SIT.QUEUE.ONE", true]);
  assert.deepEqual(row.headers, { "x-a": "1", "x-b": "two" });
  assert.ok((await idsInPanel(sess, "all")).includes(id), "the new row is listed without a reload");
  const shown = await rowValues(sess, id);
  assert.equal(shown.channel, "mq");
  assert.equal(shown.endpoint, "/stubs/mq-delivery");
  assert.deepEqual(JSON.parse(shown.headers), { "x-a": "1", "x-b": "two" });
});

test("EXT3 create a Kafka system with a topic", async (sess) => {
  await openExternalSystems(sess, browser);
  const id = sysId(), name = `Kafka ${id}`;
  assert.equal(await addSystem(sess, { id, name, channel: "kafka", endpoint: "http://broker:9092", dest: "sit.topic.one" }), `created ${id}`);
  const row = await systemFromApi(id);
  assert.ok(row);
  assert.deepEqual([row.channel, row.topic, row.endpoint, row.family], ["kafka", "sit.topic.one", "http://broker:9092", "kafka"]);
});

test("EXT4 create an API system with no queue or topic", async (sess) => {
  await openExternalSystems(sess, browser);
  const id = sysId(), name = `Api ${id}`;
  assert.equal(await addSystem(sess, { id, name, channel: "api", endpoint: "http://receiver:8080/in" }), `created ${id}`);
  const row = await systemFromApi(id);
  assert.ok(row);
  assert.deepEqual([row.channel, row.endpoint, row.queue, row.topic, row.family], ["api", "http://receiver:8080/in", "", "", "api"]);
});

test("EXT5 create a file (FTP) system: channel file belongs to the ftp family", async (sess) => {
  await openExternalSystems(sess, browser);
  const id = sysId(), name = `File ${id}`;
  assert.equal(await addSystem(sess, { id, name, channel: "file", endpoint: "/drop/inbound", dest: "" }), `created ${id}`);
  const row = await systemFromApi(id);
  assert.ok(row);
  assert.deepEqual([row.channel, row.family, row.endpoint], ["file", "ftp", "/drop/inbound"]);
});

test("EXT6 the headers box starts with the custom target header and that header is saved when nothing is changed", async (sess) => {
  await openExternalSystems(sess, browser);
  assert.equal(await value(sess, "#new-headers"), '{"x-sandbench-target":"custom"}');
  const id = sysId();
  await addSystem(sess, { id, name: `Hdr ${id}`, channel: "api", endpoint: "/x" });
  assert.deepEqual((await systemFromApi(id))?.headers, { "x-sandbench-target": "custom" });
});

test("EXT7 an empty id gets a generated ext_ id and an empty name defaults to that id", async (sess) => {
  await openExternalSystems(sess, browser);
  const before = new Set((await allSystems()).map((s: { id: string }) => s.id));
  const status = await addSystem(sess, { id: "", name: "", channel: "api", endpoint: "/gen" });
  const generated = /^created (ext_\d+)$/.exec(status)?.[1];
  assert.ok(generated, `status was "${status}"`);
  created.push(generated!);
  assert.ok(!before.has(generated!));
  const row = await systemFromApi(generated!);
  assert.ok(row, "the generated system must exist");
  assert.equal(row.name, generated, "with no name the id is the name");
  assert.ok((await idsInPanel(sess, "all")).includes(generated!));
});

test("EXT8 invalid headers JSON is refused and nothing is created", { todo: "external-systems.html swallows the JSON parse error (headers become {}) and still reports 'created'" }, async (sess) => {
  await openExternalSystems(sess, browser);
  const id = sysId();
  const status = await addSystem(sess, { id, name: `Bad ${id}`, channel: "api", endpoint: "/bad", headers: '{"broken":' });
  const row = await systemFromApi(id);
  assert.equal(row, null, `a system with unreadable headers was stored (status: "${status}")`);
  assert.doesNotMatch(status, /^created/);
});

test("EXT9 creating with an id that already exists must not silently replace that system", { todo: "Create is a PUT upsert: a second Create on the same id overwrites the endpoint with no warning" }, async (sess) => {
  await openExternalSystems(sess, browser);
  const id = sysId();
  await addSystem(sess, { id, name: "First", channel: "api", endpoint: "/first" });
  await addSystem(sess, { id, name: "Second", channel: "api", endpoint: "/second" });
  assert.equal((await systemFromApi(id))?.endpoint, "/first", "the second Create replaced the first system");
});

test("EXT10 a system name with markup is shown as text and stored as typed", async (sess) => {
  await openExternalSystems(sess, browser);
  const id = sysId(), name = `<i id="sit-inj">x</i> & 'q' "d"`;
  await addSystem(sess, { id, name, channel: "api", endpoint: "/esc" });
  assert.equal((await systemFromApi(id))?.name, name);
  assert.equal(await count(sess, "#sit-inj"), 0, "the markup must not become elements");
  const shown = await sess.exec("const r=[...document.querySelectorAll('#view-rows tr')].find(t=>t.querySelector('[data-save]')&&t.querySelector('[data-save]').getAttribute('data-save')===arguments[0]);return r?r.cells[0].textContent:null;", [id]);
  assert.ok(String(shown).includes(name), `row text was ${shown}`);
});

test("EXT11 the External systems tab lists every system and shows only its own panel", async (sess) => {
  await openExternalSystems(sess, browser);
  assert.deepEqual(await panelActive(sess), ["panel-all"]);
  const ids = (await allSystems()).map((s: { id: string }) => s.id).sort();
  assert.deepEqual((await idsInPanel(sess, "all")).sort(), ids);
  await showTab(sess, "kafka");
  assert.deepEqual(await panelActive(sess), ["panel-kafka"]);
  await showTab(sess, "all");
  assert.deepEqual(await panelActive(sess), ["panel-all"]);
});

/** Creates one system of a channel, opens the tab and checks the panel lists exactly the API rows of that family. */
async function familyTab(sess: Sess, tab: "mq" | "kafka" | "ftp" | "api", channel: string, dest: string) {
  const id = sysId();
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name: `Tab ${id}`, channel, endpoint: "/tab", dest });
  await showTab(sess, tab);
  const expected = (await allSystems()).filter((s: { id: string }) => familyOf(s as never) === tab).map((s: { id: string }) => s.id).sort();
  assert.ok(expected.includes(id));
  assert.deepEqual((await idsInPanel(sess, tab)).sort(), expected);
  for (const other of ["mq", "kafka", "ftp", "api"].filter((x) => x !== tab)) {
    assert.ok(!(await idsInPanel(sess, other)).includes(id), `${id} leaked into the ${other} panel`);
  }
  assert.ok((await panelActive(sess)).includes(`panel-${tab}`));
}
test("EXT12 the Queue tab lists the MQ systems", async (sess) => { await familyTab(sess, "mq", "mq", "SIT.Q"); });
test("EXT13 the Kafka tab lists the Kafka systems", async (sess) => { await familyTab(sess, "kafka", "kafka", "sit.t"); });
test("EXT14 the FTP tab lists the file systems", async (sess) => { await familyTab(sess, "ftp", "file", ""); });
test("EXT15 the API tab lists the API systems", async (sess) => { await familyTab(sess, "api", "api", ""); });

test("EXT16 a family panel shows the queue, topic or endpoint of each row", async (sess) => {
  const id = sysId();
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name: `Col ${id}`, channel: "mq", endpoint: "/e", dest: "SIT.SHOWN" });
  await showTab(sess, "mq");
  const cell = await sess.exec("const r=[...document.querySelectorAll('#rows-mq tr')].find(t=>t.textContent.includes(arguments[0]));return r?r.cells[1].textContent.trim():null;", [id]);
  assert.equal(cell, "SIT.SHOWN");
});

test("EXT17 edit a row's endpoint, destination and headers and click Update: the API holds the new values", async (sess) => {
  const id = sysId();
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name: `Edit ${id}`, channel: "mq", endpoint: "/old", dest: "OLD.Q", headers: '{"h":"old"}' });
  const status = await updateRow(sess, id, { endpoint: "/new", dest: "NEW.Q", headers: '{"h":"new","k":"v"}' });
  assert.equal(status, `updated ${id}`);
  const row = await systemFromApi(id);
  assert.deepEqual([row?.endpoint, row?.queue, row?.topic, row?.channel], ["/new", "NEW.Q", "NEW.Q", "mq"]);
  assert.deepEqual(row?.headers, { h: "new", k: "v" });
  await openExternalSystems(sess, browser);
  const shown = await rowValues(sess, id);
  assert.equal(shown.endpoint, "/new");
  assert.equal(shown.dest, "NEW.Q");
  assert.deepEqual(JSON.parse(shown.headers), { h: "new", k: "v" });
});

test("EXT18 editing a row does not rename the system", async (sess) => {
  const id = sysId(), name = `Keep ${id}`;
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name, channel: "api", endpoint: "/a" });
  await updateRow(sess, id, { endpoint: "/b" });
  assert.equal((await systemFromApi(id))?.name, name);
});

test("EXT19 changing a row's channel and clicking Update stores the new channel", async (sess) => {
  const id = sysId();
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name: `Chan ${id}`, channel: "mq", endpoint: "/c", dest: "SIT.C" });
  await updateRow(sess, id, { channel: "api" });
  assert.equal((await systemFromApi(id))?.channel, "api");
});

test("EXT20 after Update changes a Queue system to Kafka it is listed under the Kafka tab", { todo: "PUT keeps the stored explicit family, so a system whose channel was edited stays in its old family tab" }, async (sess) => {
  const id = sysId();
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name: `Move ${id}`, channel: "mq", endpoint: "/m", dest: "SIT.M" });
  await updateRow(sess, id, { channel: "kafka" });
  await showTab(sess, "kafka");
  assert.ok((await idsInPanel(sess, "kafka")).includes(id), "not in the Kafka panel after the channel became kafka");
  assert.ok(!(await idsInPanel(sess, "mq")).includes(id), "still in the Queue panel");
});

test("EXT21 unreadable headers in a row are refused on Update and the old headers stay", { todo: "the Update handler swallows the JSON error and stores headers {}" }, async (sess) => {
  const id = sysId();
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name: `Hd ${id}`, channel: "api", endpoint: "/h", headers: '{"keep":"me"}' });
  await updateRow(sess, id, { headers: "{not json" });
  assert.deepEqual((await systemFromApi(id))?.headers, { keep: "me" }, "the good headers were wiped");
});

test("EXT22 Delete removes the row at once and the API no longer lists it", async (sess) => {
  const id = sysId();
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name: `Del ${id}`, channel: "api", endpoint: "/d" });
  const total = (await allSystems()).length;
  await sess.exec("document.getElementById('status').textContent='';document.querySelector(\"#view-rows [data-del='\"+arguments[0]+\"']\").click();", [id]);
  await waitFor(async () => (await text(sess, "#status")) === `deleted ${id}`, { message: "the deleted status" });
  assert.equal(await systemFromApi(id), null);
  assert.equal((await allSystems()).length, total - 1);
  await waitFor(async () => !(await idsInPanel(sess, "all")).includes(id), { message: "the row to go" });
  assert.equal(await text(sess, "#view-status"), `${total - 1} external system${total - 1 === 1 ? "" : "s"}`);
});

test("EXT23 Delete asks for confirmation and declining keeps the system", { todo: "Delete removes a system immediately; there is no confirmation dialog (Import, Archive and Delete elsewhere all confirm)" }, async (sess) => {
  const id = sysId();
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name: `Ask ${id}`, channel: "api", endpoint: "/d" });
  await sess.exec("document.querySelector(\"#view-rows [data-del='\"+arguments[0]+\"']\").click();", [id]);
  await sleep(600);
  let prompt = "";
  try { prompt = await sess.alertText(); await sess.dismissAlert(); } catch { /* no dialog */ }
  assert.ok(prompt, "no confirmation dialog appeared");
  assert.ok(await systemFromApi(id), "declining must keep the system");
});

test("EXT24 deleting a system from the Queue tab removes it from every tab", async (sess) => {
  const id = sysId();
  await openExternalSystems(sess, browser);
  await addSystem(sess, { id, name: `Q ${id}`, channel: "mq", endpoint: "/q", dest: "SIT.Q2" });
  await showTab(sess, "mq");
  await sess.exec("document.querySelector(\"#rows-mq [data-del='\"+arguments[0]+\"']\").click();", [id]);
  await waitFor(async () => (await systemFromApi(id)) === null, { message: "the system to be deleted" });
  for (const tab of ["all", "mq", "kafka", "ftp", "api"]) await waitFor(async () => !(await idsInPanel(sess, tab)).includes(id), { message: `${tab} panel to drop the row` });
});

test("EXT25 Save integration stores the Testhub and app bases and a reload shows them", async (sess) => {
  await openExternalSystems(sess, browser);
  const original = await integration();
  try {
    const tag = uniqueName("h");
    await waitFor(async () => (await value(sess, "#int-testhub")) === original.testhubBase, { message: "the current Testhub base" });
    await sess.exec("const set=(id,v)=>{const e=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,v);};set('int-testhub',arguments[0]);set('int-app',arguments[1]);", [`http://${tag}:8091`, `http://${tag}:8787`]);
    await sess.exec("document.getElementById('status').textContent='';document.getElementById('int-save').click();");
    await waitFor(async () => (await text(sess, "#status")) === "integration saved", { message: "the saved notice" });
    await waitFor(async () => (await integration()).testhubBase === `http://${tag}:8091`, { message: "the API to hold the Testhub base" });
    assert.equal((await integration()).appBase, `http://${tag}:8787`);
    await openExternalSystems(sess, browser);
    await waitFor(async () => (await value(sess, "#int-testhub")) === `http://${tag}:8091`, { message: "the reloaded Testhub base" });
    assert.equal(await value(sess, "#int-app"), `http://${tag}:8787`);
  } finally {
    await apiJson("/api/v1/settings/integration", { method: "PATCH", body: JSON.stringify({ value: { testhubBase: original.testhubBase, appBase: original.appBase } }) });
  }
  assert.equal((await integration()).testhubBase, original.testhubBase);
});

test("EXT26 Send dummy on a row reaches an API route that exists", { todo: "the page POSTs /api/v1/external-systems/:id/send but registerExternalSystemRoutes() is never called, so the route answers 404 (the working route is /:id/dummy)" }, async (sess) => {
  await openExternalSystems(sess, browser);
  const res = await apiJson("/api/v1/external-systems/ext_ftp/send", { method: "POST" });
  assert.notEqual(res.status, 404, `POST /send answered ${res.status}`);
});

test("EXT27 after Send dummy the status line does not claim it fired when the call failed", { todo: "the handler writes 'dummy fired for <id>' without looking at the response, which is a 404 here" }, async (sess) => {
  await openExternalSystems(sess, browser);
  await sess.exec("document.getElementById('status').textContent='';document.querySelector(\"#view-rows [data-dummy='ext_ftp']\").click();");
  await waitFor(async () => (await text(sess, "#status")) !== "", { message: "a status line" });
  const res = await apiJson("/api/v1/external-systems/ext_ftp/send", { method: "POST" });
  const claimed = /dummy fired/.test(await text(sess, "#status"));
  assert.ok(!claimed || res.status < 400, `the page says the dummy fired but the API answers ${res.status}`);
});

test("EXT28 Test connection on a row reports up or down from a real probe", { todo: "the page POSTs /api/v1/external-systems/:id/probe, a route that is never registered (404), so every row reads 'down'" }, async (sess) => {
  await openExternalSystems(sess, browser);
  const res = await apiJson("/api/v1/external-systems/ext_ftp/probe", { method: "POST" });
  assert.notEqual(res.status, 404, `POST /probe answered ${res.status}`);
});

test("EXT29 Test connection on a row shows a visible up or down result", async (sess) => {
  await openExternalSystems(sess, browser);
  await sess.exec("document.getElementById('status').textContent='';document.querySelector(\"#view-rows [data-probe='ext_ftp']\").click();");
  await waitFor(async () => /^(up|down) ext_ftp$/.test(await text(sess, "#status")), { message: "an up/down line" });
});

test("EXT30 the Kafka tab has an application, a default topic and three connection buttons", async (sess) => {
  await openExternalSystems(sess, browser);
  await showTab(sess, "kafka");
  assert.equal(await value(sess, "#kafka-topic"), "sandbench.out");
  assert.deepEqual(await sess.exec("return [...document.querySelectorAll('#kafka-app option')].map(o=>o.value);"), ["sand-bench-enterprise"]);
  for (const id of ["kafka-probe", "kafka-dummy", "kafka-check"]) assert.ok(await visible(sess, `#${id}`), `#${id} not visible`);
});

test("EXT31 Check broker connectivity without a broker shows why nothing was produced", async (sess) => {
  await openExternalSystems(sess, browser);
  await showTab(sess, "kafka");
  await sess.exec("document.getElementById('kafka-status').textContent='';document.getElementById('kafka-check').click();");
  const shown = await waitFor(async () => (await text(sess, "#kafka-status")) || null, { message: "the connectivity status" });
  const api = (await apiJson("/api/v1/external-systems/kafka/connectivity-check", { method: "POST" })).body as { produced?: boolean; reason?: string };
  if (api.produced) assert.match(shown, /^produced /);
  else assert.ok(shown.includes(api.reason || "not produced"), `page said "${shown}", API reason "${api.reason}"`);
});

test("EXT32 Send dummy and Test connection on the Kafka tab give a visible result", { todo: "the Kafka tab Send dummy and Test connection call the unregistered /send and /probe routes and print the raw 404 routing error" }, async (sess) => {
  await openExternalSystems(sess, browser);
  await showTab(sess, "kafka");
  await sess.exec("document.getElementById('kafka-status').textContent='';document.getElementById('kafka-dummy').click();");
  const dummy = await waitFor(async () => (await text(sess, "#kafka-status")) || null, { message: "the dummy status" });
  assert.ok(dummy.length > 0);
  await sess.exec("document.getElementById('kafka-status').textContent='';document.getElementById('kafka-probe').click();");
  const probe = await waitFor(async () => (await text(sess, "#kafka-status")) || null, { message: "the probe status" });
  assert.ok(probe.length > 0);
  assert.doesNotMatch(dummy, /not found|Route POST/i, `the Kafka dummy shows a raw routing error: ${dummy}`);
});

test("EXT33 the dashboard lists every system with its channel and health", async (sess) => {
  await openExternalSystems(sess, browser);
  const systems = await allSystems();
  const rows = await sess.exec("return [...document.querySelectorAll('#dashboard-rows tr')].map(r=>[...r.cells].map(c=>c.textContent.trim()));");
  assert.equal(rows.length, systems.length);
  for (const s of systems) assert.ok(rows.some((r: string[]) => r[0] === s.name && r[1] === s.channel), `${s.name} missing from the dashboard`);
  assert.ok(rows.every((r: string[]) => r[3] !== ""), "every row has a health value");
});

test("EXT34 the Received-from-Testhub box holds a JSON list", async (sess) => {
  await openExternalSystems(sess, browser);
  const shown = await waitFor(async () => (await text(sess, "#inbound")) || null, { message: "the inbound box" });
  assert.ok(Array.isArray(JSON.parse(shown)));
});
