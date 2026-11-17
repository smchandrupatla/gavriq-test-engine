// End-to-end business journeys, driven through the browser and confirmed through the API.
//
// The purpose of Sand Bench is to turn a message schema into scheduled, realistic test traffic
// for a target system. The journeys below walk that whole line the way an operator does:
//
//   Import a schema  ->  create a message definition from it  ->  publish (this creates the
//   message data set)  ->  build a data feeder from the data set  ->  schedule that feeder
//   (a window, a message count, a pacing pattern) to a target system.
//
// Each step waits for the page's own evidence that it finished, and then asks the API whether the
// thing really exists with the values the operator typed. A toast on its own never passes a step.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { ORDER_XSD, CUSTOMER_JSD } from "../lib/selenium/converter-fixtures.mjs";
import { apiJson, pageText, rowsOf, saveShot, sharedBrowser, text, uniqueName, value, waitFor } from "../lib/selenium/flow.mjs";
import {
  confirmImport, createExternalSystem, datasetByName, definitionByName, externalSystem, feederFromApi, fillFeeder,
  importOutcome, importSchema, publishDefinition, saveFeeder, storedImports,
} from "../lib/selenium/flows.mjs";
import { convertNow, loadSource, openConverter, setOptions } from "../lib/selenium/converter-page.mjs";
import { click, clickText, count, selectOption, setValue as setValueLocal, sleep, typeInto, waitVisible } from "../lib/selenium/flow.mjs";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());

const HOUR = 3600 * 1000;
function windowFromNow(startInHours = 1, lengthHours = 1) {
  const start = new Date(Math.ceil((Date.now() + startInHours * HOUR) / 60000) * 60000);
  return { start, end: new Date(start.getTime() + lengthHours * HOUR) };
}

/** What a datetime-local value means in the browser's own zone, as the ISO string the API stores. */
async function browserIso(sess: any, local: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const v = `${local.getFullYear()}-${pad(local.getMonth() + 1)}-${pad(local.getDate())}T${pad(local.getHours())}:${pad(local.getMinutes())}`;
  return sess.exec("return new Date(arguments[0]).toISOString();", [v]);
}

function xsdFor(root: string) {
  return ORDER_XSD.replace('name="Order"', `name="${root}"`);
}
function jsonSchemaFor(title: string) {
  return JSON.stringify({ ...JSON.parse(CUSTOMER_JSD), title }, null, 2);
}

/** Runs named steps so a failure says which step of the journey broke, with a screenshot. */
async function journey(name: string, body: (step: <T>(label: string, fn: () => Promise<T>) => Promise<T>) => Promise<void>, t: { skip: (m?: string) => void }) {
  if (!(await browser.available(`e2e-${name}`))) { t.skip(browser.reason); return; }
  const sess = await browser.signedIn();
  let current = "start";
  const step = async <T,>(label: string, fn: () => Promise<T>): Promise<T> => {
    current = label;
    try { return await fn(); }
    catch (error) {
      await saveShot(sess, `e2e-${name}-${label.replace(/\W+/g, "-")}`);
      (error as Error).message = `[step: ${label}] ${(error as Error).message}`;
      throw error;
    }
  };
  try { await body(step); }
  catch (error) { if (!/\[step:/.test((error as Error).message)) (error as Error).message = `[step: ${current}] ${(error as Error).message}`; throw error; }
}

// ------------------------------------------------------------------------------------------
// The journey the business exists for: import a schema, define a message, make a data set,
// build a feeder, schedule it to a target.
// ------------------------------------------------------------------------------------------
test("E2E-J1 import an XSD, define a message, publish a data set, build a feeder and schedule it to a new target system", async (t) => {
  await journey("j1", async (step) => {
    const sess = await browser.signedIn();
    const root = uniqueName("SitOrder");
    const definitionName = `Definition ${root}`;
    const targetId = `sit_${root.toLowerCase()}`;
    const feederName = `Feeder ${root}`;

    // 1. Import the schema.
    const imported = await step("import the XSD", async () => {
      await importSchema(sess, browser, { format: "XSD", fileName: `${root}.xsd`, content: xsdFor(root) });
      const outcome = await importOutcome(sess);
      assert.equal(outcome.stored, true, outcome.text);
      assert.equal(outcome.code, root);
      assert.equal(outcome.fieldCount, 5, "Order has 5 fields: OrderId, Customer, Line (Sku, Qty) and Note");
      return outcome;
    });
    await step("the API lists the stored schema", async () => {
      const row = (await storedImports()).find((r: { code: string }) => r.code === root);
      assert.ok(row, "the import must be listed by the API");
      assert.equal(row.status, "stored");
      assert.equal(row.fieldCount, imported.fieldCount);
      assert.equal(row.mandatoryCount, 4);
    });

    // 2. Create a message definition from the imported schema and publish it: 5 messages.
    const published = await step("define and publish a message from the imported schema", async () => {
      const result = await publishDefinition(sess, browser, { tile: root, name: definitionName, messages: 5 });
      assert.equal(result.held, 5);
      return result;
    });
    const definition = await step("the API lists the published definition", async () => {
      const d = await definitionByName(definitionName);
      assert.ok(d, "the definition must exist");
      assert.equal(d.status, "active");
      return d;
    });
    const dataset = await step("the message data set exists with 5 messages, linked to the definition", async () => {
      const ds = await datasetByName(published.datasetName);
      assert.ok(ds, `dataset ${published.datasetName} must exist`);
      assert.equal(ds.definition_id, definition.id);
      const messages = await apiJson(`/api/v1/datasets/${ds.id}/messages`);
      assert.equal(messages.status, 200);
      assert.equal(rowsOf(messages.body).length, 5);
      return ds;
    });

    // 3. The target system.
    await step("create the target system (an MQ receiver)", async () => {
      await createExternalSystem(sess, browser, { id: targetId, name: `Target ${root}`, channel: "mq", destination: `SIT.${root}` });
      const target = await externalSystem(targetId);
      assert.ok(target, "the external system must exist");
      assert.equal(target.channel, "mq");
      assert.equal(target.queue, `SIT.${root}`);
    });

    // 4. The feeder: 40 messages drawn from the data set, sent to the target across a one-hour window.
    const { start, end } = windowFromNow(1, 1);
    const feederId = await step("build the feeder from the data set and schedule it to the target", async () => {
      await browser.open("/data-feeder-form.html");
      const { fillFeeder: fill } = await import("../lib/selenium/flows.mjs");
      await fill(sess, { name: feederName, description: "journey J1", dataset: published.datasetName, count: 40, system: `Target ${root}`, start, end, gaps: ["10 s"] });
      return saveFeeder(sess);
    });
    await step("the API holds the feeder with exactly what was chosen", async () => {
      const feeder = await feederFromApi(feederId);
      assert.ok(feeder, "the feeder must exist");
      assert.equal(feeder.name, feederName);
      assert.equal(feeder.description, "journey J1");
      assert.equal(feeder.messageCount, 40);
      assert.equal(feeder.externalSystemId, targetId);
      assert.deepEqual(feeder.datasets.map((d: { datasetId: string }) => d.datasetId), [dataset.id]);
      assert.equal(feeder.windowStart, await browserIso(sess, start));
      assert.equal(feeder.windowEnd, await browserIso(sess, end));
      assert.equal(feeder.pacing.mode, "random-gaps");
      assert.deepEqual(feeder.pacing.gapsSeconds, [1, 2, 3, 5, 10], "the defaults plus the 10 s gap the operator added");
    });
    await step("the feeder's plan spreads 40 messages across the window", async () => {
      const plan = await apiJson(`/api/v1/data-feeders/${feederId}/plan`);
      assert.equal(plan.status, 200);
      const summary = ((plan.body as any).data?.plan || (plan.body as any).plan || (plan.body as any).data || plan.body).summary;
      assert.equal(summary.messageCount, 40);
      assert.equal(summary.durationSeconds, 3600);
    });
    await step("the feeder page shows the plan for those 40 messages", async () => {
      await waitFor(async () => (await pageText(sess)).includes(published.datasetName), { message: "plan table naming the data set" });
      assert.match(await pageText(sess), /40/);
    });
    await step("All feeders lists it", async () => {
      await browser.open("/data-feeders.html");
      await waitFor(async () => (await pageText(sess)).includes(feederName), { message: "the feeder in All feeders" });
    });
  }, t);
});

// ------------------------------------------------------------------------------------------
// A JSON Schema import: stored, listed, and offered as a starting point in the designer.
// ------------------------------------------------------------------------------------------
test("E2E-J2 a JSON Schema imports, is listed with its fields and is offered in the Message Designer", async (t) => {
  await journey("j2", async (step) => {
    const sess = await browser.signedIn();
    const root = uniqueName("SitJson");
    await step("import the JSON Schema", async () => {
      await importSchema(sess, browser, { format: "JSON Schema", fileName: `${root}.json`, content: jsonSchemaFor(root), mime: "application/json" });
      const outcome = await importOutcome(sess);
      assert.equal(outcome.stored, true, outcome.text);
      assert.equal(outcome.code, root);
      assert.equal(outcome.fieldCount, 5);
    });
    await step("the API lists it with its field count", async () => {
      const row = (await storedImports()).find((r: { code: string }) => r.code === root);
      assert.ok(row);
      assert.equal(row.fieldCount, 5);
    });
    await step("the Message Designer offers it as a starting point", async () => {
      await browser.open("/?page=messageDesigner");
      await waitVisible(sess, ".sbe-studio-msg", { timeout: 20000 });
      const tiles: string[] = await sess.exec("return [...document.querySelectorAll('.sbe-studio-msg')].map(e=>e.innerText);");
      assert.ok(tiles.some((tile) => tile.includes(root) && /Imported/.test(tile)), `no Imported tile for ${root}`);
    });
  }, t);
});

// Known gap, kept visible: an imported JSON Schema loses its `required` list (the tile reads
// "0 required"), the studio then reports "0 tags" and Publish never enables, so no message
// definition, and therefore no data set or feeder, can be built from it. XSD imports work (J1).
// This case runs the intended journey; it stays a TODO until the importer keeps required fields
// and builds the studio's tag tree from a JSON Schema. Remove `todo` when it passes.
test("E2E-J2b a JSON Schema import can be published as a message definition with its required fields", { todo: "Imported JSON Schema drops required fields and yields 0 tags in the designer (isoImport.ts stores it as kind xsd; the studio tree is XSD-only)" }, async (t) => {
  await journey("j2b", async (step) => {
    const sess = await browser.signedIn();
    const root = uniqueName("SitJsonPub");
    await step("import the JSON Schema", async () => {
      await importSchema(sess, browser, { format: "JSON Schema", fileName: `${root}.json`, content: jsonSchemaFor(root), mime: "application/json" });
      assert.equal((await importOutcome(sess)).stored, true);
    });
    await step("the import keeps the schema's two required fields", async () => {
      const row = (await storedImports()).find((r: { code: string }) => r.code === root);
      assert.equal(row.mandatoryCount, 2, "Id and Orders are required in the source schema");
    });
    await step("a definition can be published from it", async () => {
      const result = await publishDefinition(sess, browser, { tile: root, name: `Definition ${root}`, messages: 1 });
      assert.equal(result.held, 1);
    });
  }, t);
});

// ------------------------------------------------------------------------------------------
// Starting from a standard message type (no import), many messages, a Kafka target.
// ------------------------------------------------------------------------------------------
test("E2E-J3 start from a standard ISO message type, publish ten messages and feed a Kafka target", async (t) => {
  await journey("j3", async (step) => {
    const sess = await browser.signedIn();
    const token = uniqueName("Std");
    const definitionName = `Definition ${token}`;
    const published = await step("publish ten pain.001 messages", async () => {
      const result = await publishDefinition(sess, browser, { tile: "pain.001.001.09", name: definitionName, messages: 10 });
      assert.equal(result.held, 10);
      return result;
    });
    const dataset = await step("the data set records its message type", async () => {
      const ds = await datasetByName(published.datasetName);
      assert.ok(ds);
      assert.equal(ds.message_type_code, "pain.001.001.09");
      return ds;
    });
    const feederId = await step("build the feeder against the Kafka system", async () => {
      await browser.open("/data-feeder-form.html");
      const { start, end } = windowFromNow(1, 24);
      await fillFeeder(sess, { name: `Feeder ${token}`, dataset: published.datasetName, count: 100, system: "KAFKA", start, end, order: "in-order" });
      return saveFeeder(sess);
    });
    await step("the API shows an in-order feeder to Kafka", async () => {
      const feeder = await feederFromApi(feederId);
      assert.equal(feeder.externalSystemId, "ext_fraud");
      assert.equal(feeder.sendOrder, "sequential");
      assert.equal(feeder.datasets[0].datasetId, dataset.id);
    });
  }, t);
});

// ------------------------------------------------------------------------------------------
// Fixed-interval pacing to an existing API system, from a standard message type.
// ------------------------------------------------------------------------------------------
test("E2E-J4 publish one pacs.008 message and feed the existing API system at a fixed interval", async (t) => {
  await journey("j4", async (step) => {
    const sess = await browser.signedIn();
    const token = uniqueName("Fix");
    const published = await step("publish one pacs.008 message", async () => {
      const result = await publishDefinition(sess, browser, { tile: "pacs.008.001.08", name: `Definition ${token}`, messages: 1 });
      assert.equal(result.held, 1);
      return result;
    });
    const feederId = await step("build the feeder with a fixed 30 s interval", async () => {
      await browser.open("/data-feeder-form.html");
      const { start, end } = windowFromNow(2, 2);
      await fillFeeder(sess, { name: `Feeder ${token}`, dataset: published.datasetName, count: 12, system: "Dummy sanctions list", start, end, interval: 30 });
      return saveFeeder(sess);
    });
    await step("the API shows fixed pacing to the existing system", async () => {
      const feeder = await feederFromApi(feederId);
      assert.equal(feeder.externalSystemId, "ext_sanctions");
      assert.equal(feeder.messageCount, 12);
      assert.equal(feeder.pacing.mode, "fixed");
      assert.equal(feeder.pacing.intervalSeconds, 30);
    });
  }, t);
});

// ------------------------------------------------------------------------------------------
// The Schema Converter feeds the same line: convert, hand off to Import Scheme, store, publish.
// ------------------------------------------------------------------------------------------
test("E2E-J5 convert a JSON Schema to XSD, import the result and publish messages from it", async (t) => {
  await journey("j5", async (step) => {
    const sess = await browser.signedIn();
    const root = uniqueName("SitConv");
    await step("convert the JSON Schema to an XSD in the Schema Converter", async () => {
      await openConverter(browser);
      await loadSource(sess, "jsd", jsonSchemaFor(root));
      // Mandatory: the designer builds from required tags, so an all-optional XSD has nothing to publish.
      await setOptions(sess, { target: "xsd", requiredness: "mandatory" });
      const result = await convertNow(sess);
      assert.ok(result.ok, result.message);
    });
    await step("Continue to Import Scheme opens the import screen with the XSD chosen", async () => {
      await click(sess, "#open-import");
      await waitFor(async () => /page=msgImportSchema/.test(String(await sess.url())), { message: "the import screen" });
      await waitFor(async () => (await pageText(sess)).includes(`Chosen: ${root}.xsd`), { timeout: 20000, message: "the converted XSD to be chosen" });
    });
    await step("confirm the upload and see it stored", async () => {
      await confirmImport(sess);
      const outcome = await importOutcome(sess);
      assert.equal(outcome.stored, true, outcome.text);
      assert.equal(outcome.code, root);
    });
    await step("the imported scheme publishes as a message data set", async () => {
      const result = await publishDefinition(sess, browser, { tile: root, name: `Definition ${root}`, messages: 3 });
      assert.equal(result.held, 3);
      const ds = await datasetByName(result.datasetName);
      assert.ok(ds);
    });
  }, t);
});

// ------------------------------------------------------------------------------------------
// Things that must be refused, and must leave nothing behind.
// ------------------------------------------------------------------------------------------
test("E2E-N1 importing the same schema twice is refused and stores nothing new", async (t) => {
  await journey("n1", async (step) => {
    const sess = await browser.signedIn();
    const root = uniqueName("SitDup");
    await step("import once", async () => {
      await importSchema(sess, browser, { fileName: `${root}.xsd`, content: xsdFor(root) });
      assert.equal((await importOutcome(sess)).stored, true);
    });
    const before = (await storedImports()).filter((r: { code: string }) => r.code === root).length;
    await step("import the identical file again", async () => {
      await importSchema(sess, browser, { fileName: `${root}.xsd`, content: xsdFor(root) });
      const outcome = await importOutcome(sess);
      assert.equal(outcome.stored, false);
      assert.match(outcome.text, /Duplicate|already stored/i);
    });
    await step("the API still holds exactly one", async () => {
      assert.equal((await storedImports()).filter((r: { code: string }) => r.code === root).length, before);
    });
  }, t);
});

test("E2E-N2 declining the store confirmation imports nothing", async (t) => {
  await journey("n2", async (step) => {
    const sess = await browser.signedIn();
    const root = uniqueName("SitDecl");
    await step("choose the file and answer Cancel to the confirmation", async () => {
      const { prompt } = await importSchema(sess, browser, { fileName: `${root}.xsd`, content: xsdFor(root), accept: false });
      assert.match(prompt, /Are you sure you want to store this schema\?/);
    });
    await step("nothing was stored", async () => {
      await sleep(800);
      assert.equal((await storedImports()).some((r: { code: string }) => r.code === root), false);
    });
  }, t);
});

// Known gap, kept visible: text that is not a schema is stored as "imported.xsd · 0 fields" and
// reported as a success. Remove `todo` when the import refuses an unreadable XSD.
test("E2E-N3 an unreadable XSD is refused with a reason and stores nothing", { todo: "Import Scheme stores malformed XSD text as a 0-field scheme and reports success" }, async (t) => {
  await journey("n3", async (step) => {
    const sess = await browser.signedIn();
    const root = uniqueName("SitBad");
    await step("try to import text that is not a schema", async () => {
      await importSchema(sess, browser, { fileName: `${root}.xsd`, content: `<not-a-schema ${root}` });
      const outcome = await importOutcome(sess);
      assert.equal(outcome.stored, false, `expected a refusal, got: ${outcome.text}`);
    });
    await step("nothing was stored", async () => {
      assert.equal((await storedImports()).some((r: { code: string }) => r.code.includes(root)), false);
    });
  }, t);
});

test("E2E-N4 a feeder cannot be saved without a name, or with a window that ends before it starts, and nothing is created", async (t) => {
  await journey("n4", async (step) => {
    const sess = await browser.signedIn();
    const before = rowsOf((await apiJson("/api/v1/data-feeders")).body).length;
    await step("Save with an empty form shows the missing name", async () => {
      await browser.open("/data-feeder-form.html");
      await waitVisible(sess, "#df-save");
      await click(sess, "#df-save");
      await waitFor(async () => (await pageText(sess)).includes("This is required."), { message: "the required-field message" });
    });
    await step("an end before the start is called out", async () => {
      await typeInto(sess, "#df-name", "Should not save");
      await setValueLocal(sess, "#df-start", "2031-01-01T10:00");
      await setValueLocal(sess, "#df-end", "2031-01-01T09:00");
      await waitFor(async () => (await pageText(sess)).includes("The end must be after the start."), { message: "the window message" });
    });
    await step("a message count of zero is refused by the API and the address bar stays on a new feeder", async () => {
      await setValueLocal(sess, "#df-count", "0");
      await click(sess, "#df-save");
      await sleep(1200);
      assert.doesNotMatch(String(await sess.url()), /[?&]id=dfd_/);
    });
    await step("no feeder was created", async () => {
      assert.equal(rowsOf((await apiJson("/api/v1/data-feeders")).body).length, before);
    });
  }, t);
});

// ------------------------------------------------------------------------------------------
// After the feeder exists: reopen it, change it, list it, copy it, archive it.
// ------------------------------------------------------------------------------------------
test("E2E-F1 reopen a saved feeder, change its count and target, and see the change in the API", async (t) => {
  await journey("f1", async (step) => {
    const sess = await browser.signedIn();
    const token = uniqueName("Edit");
    const published = await step("publish a data set", async () => (await publishDefinition(sess, browser, { tile: "pain.001.001.09", name: `Definition ${token}`, messages: 4 })));
    const feederId = await step("save a feeder of 10 messages to Dummy core banking", async () => {
      await browser.open("/data-feeder-form.html");
      const { start, end } = windowFromNow(1, 1);
      await fillFeeder(sess, { name: `Feeder ${token}`, dataset: published.datasetName, count: 10, system: "Dummy core banking", start, end });
      return saveFeeder(sess);
    });
    await step("reopen it: the fields hold what was saved", async () => {
      await browser.open(`/data-feeder-form.html?id=${feederId}`);
      await waitFor(async () => (await value(sess, "#df-name")) === `Feeder ${token}`, { message: "the saved name to load" });
      assert.equal(await value(sess, "#df-count"), "10");
      assert.equal(await value(sess, "#df-system"), "ext_core");
    });
    await step("change the count and the target and save again", async () => {
      await setValueLocal(sess, "#df-count", "25");
      await selectOption(sess, "#df-system", "ext_reporting");
      await click(sess, "#df-save");
      await waitFor(async () => (await feederFromApi(feederId)).messageCount === 25, { message: "the API to hold the new count" });
    });
    await step("the API holds the change and it is still the same feeder", async () => {
      const feeder = await feederFromApi(feederId);
      assert.equal(feeder.messageCount, 25);
      assert.equal(feeder.externalSystemId, "ext_reporting");
      assert.equal(feeder.name, `Feeder ${token}`);
    });
  }, t);
});

test("E2E-F2 All feeders filters, copies and archives a feeder, and Show archived brings it back", async (t) => {
  await journey("f2", async (step) => {
    const sess = await browser.signedIn();
    const token = uniqueName("List");
    const published = await step("publish a data set", async () => (await publishDefinition(sess, browser, { tile: "pain.001.001.09", name: `Definition ${token}`, messages: 2 })));
    const feederId = await step("save a feeder", async () => {
      await browser.open("/data-feeder-form.html");
      const { start, end } = windowFromNow(1, 1);
      await fillFeeder(sess, { name: `Feeder ${token}`, dataset: published.datasetName, count: 5, system: "Dummy core banking", start, end });
      return saveFeeder(sess);
    });
    await step("All feeders lists it and the filter narrows to it", async () => {
      await browser.open("/data-feeders.html");
      await waitFor(async () => (await pageText(sess)).includes(`Feeder ${token}`), { message: "the feeder in the list" });
      await typeInto(sess, "#df-search", token);
      await waitFor(async () => (await count(sess, "tbody tr")) >= 1, { message: "a filtered row" });
      await typeInto(sess, "#df-search", "zzz-no-such-feeder");
      await waitFor(async () => !(await pageText(sess)).includes(`Feeder ${token}`), { message: "the row to be filtered out" });
      await typeInto(sess, "#df-search", token);
    });
    await step("Duplicate makes a second feeder", async () => {
      await click(sess, `button[aria-label="Duplicate Feeder ${token}"]`);
      await waitFor(async () => rowsOf((await apiJson("/api/v1/data-feeders")).body).filter((f: { name: string }) => f.name.includes(token)).length === 2, { message: "the copy to exist" });
    });
    await step("declining the Archive confirmation leaves the feeder as it was", async () => {
      await browser.open("/data-feeders.html");
      await typeInto(sess, "#df-search", token);
      await click(sess, `button[aria-label="Archive Feeder ${token}"]`);
      const prompt = await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { message: "the archive confirmation" });
      assert.match(prompt, new RegExp(`Archive "Feeder ${token}"`));
      await sess.dismissAlert();
      await sleep(600);
      assert.equal((await feederFromApi(feederId)).status, "draft");
    });
    await step("accepting the Archive confirmation archives it and hides it from the list", async () => {
      await click(sess, `button[aria-label="Archive Feeder ${token}"]`);
      await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { message: "the archive confirmation" });
      await sess.acceptAlert();
      await waitFor(async () => (await feederFromApi(feederId)).status === "archived", { message: "the API to show it archived" });
      await waitFor(async () => (await count(sess, `button[aria-label="Archive Feeder ${token}"]`)) === 0, { message: "its Archive button to leave the list" });
    });
    await step("Show archived brings the archived feeder back into view", async () => {
      await click(sess, "#df-archived");
      await waitFor(async () => (await pageText(sess)).includes(`Feeder ${token}`), { message: "the archived feeder to reappear" });
    });
  }, t);
});
