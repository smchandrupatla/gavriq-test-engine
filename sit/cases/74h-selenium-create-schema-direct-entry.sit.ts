// Builds the Australian Direct Entry (BECS) batch payment format -- one fixed-width file,
// three record types (Header/Detail/Trailer) told apart by a one-byte record type field at
// position 1, each exactly 120 bytes -- through the create-schema wizard's multi-record
// mode (shipped for exactly this reason). Field layout cross-verified from BOQ's Direct
// Entry File Specification and AusPayNet's NPP mapping document. "Blank"/reserved byte
// ranges are modeled as real fields too: the wizard has no "skip N bytes" concept, so every
// byte must be accounted for by some named field for the positions to land correctly.
// Generate -> create -> reload is asserted at each stage: the registered envelope's exact
// field widths/positions/match values (read from the stored file itself, not the lossier
// ImportJob.fields shape -- see rawFileFromApi()'s doc comment), then a second, fresh
// wizard session loading that schema back as a source and showing the same three record
// types with the same field counts.
import { after, test as nodeTest, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { saveShot, sharedBrowser, waitFor as baseWaitFor } from "../lib/selenium/flow.mjs";
import {
  addField, addRecord, createSchema, dropDesignerType, fieldRowCount, fillField, loadExistingSource,
  nextStep, openCreateSchema, rawFileFromApi, recordRows, recordTabNames, selectExistingSource,
  setRecordMatchValueAt, setRecordMode, setRecordNameAt, setRecordTypeField, setSourceMode, setupSchema,
  statusText, switchToRecord, waitForSourceList,
} from "../lib/selenium/create-schema-page.mjs";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());
const waitFor = (fn: () => unknown, o: { timeout?: number; interval?: number; message?: string } = {}) => baseWaitFor(fn, { timeout: 60000, ...o });

type FieldDef = { name: string; width: number; required: boolean };
type RecordDef = { name: string; matchValue: string; fields: FieldDef[] };

const DIRECT_ENTRY: { recordTypeField: { position: number; width: number }; records: RecordDef[] } = {
  recordTypeField: { position: 1, width: 1 },
  records: [
    { name: "Header", matchValue: "0", fields: [
      { name: "RecordType", width: 1, required: true },
      { name: "Blank1", width: 17, required: false },
      { name: "SequenceNumber", width: 2, required: true },
      { name: "FIAbbreviation", width: 3, required: true },
      { name: "Blank2", width: 7, required: false },
      { name: "UserName", width: 26, required: true },
      { name: "UserID", width: 6, required: true },
      { name: "Description", width: 12, required: true },
      { name: "ProcessingDate", width: 6, required: true },
      { name: "Blank3", width: 40, required: false },
    ] },
    { name: "Detail", matchValue: "1", fields: [
      { name: "RecordType", width: 1, required: true },
      { name: "Bsb", width: 7, required: true },
      { name: "AccountNumber", width: 9, required: true },
      { name: "Indicator", width: 1, required: false },
      { name: "TransactionCode", width: 2, required: true },
      { name: "AmountCents", width: 10, required: true },
      { name: "AccountTitle", width: 32, required: true },
      { name: "LodgementReference", width: 18, required: false },
      { name: "TraceBsb", width: 7, required: true },
      { name: "TraceAccount", width: 9, required: true },
      { name: "RemitterName", width: 16, required: false },
      { name: "WithholdingTaxCents", width: 8, required: false },
    ] },
    { name: "Trailer", matchValue: "7", fields: [
      { name: "RecordType", width: 1, required: true },
      { name: "BsbFiller", width: 7, required: true },
      { name: "Blank1", width: 12, required: false },
      { name: "NetTotalCents", width: 10, required: true },
      { name: "CreditTotalCents", width: 10, required: true },
      { name: "DebitTotalCents", width: 10, required: true },
      { name: "Blank2", width: 24, required: false },
      { name: "DetailRecordCount", width: 6, required: true },
      { name: "Blank3", width: 40, required: false },
    ] },
  ],
};

const created: string[] = [];
after(async () => {
  for (const id of created) {
    try { await dropDesignerType(id); } catch { /* already gone */ }
  }
});

nodeTest("the Direct Entry field layout above sums to exactly 120 bytes per record type (fix the fixture, not the test, if this fails)", () => {
  for (const record of DIRECT_ENTRY.records) {
    const total = record.fields.reduce((sum, f) => sum + f.width, 0);
    assert.equal(total, 120, `DIRECT_ENTRY.${record.name} sums to ${total} bytes, not 120`);
  }
});

nodeTest("the Direct Entry (ABA) format builds in the wizard's multi-record mode, registers as one 3-record envelope with every width intact, and reloads the same shape", async (t: TestContext) => {
  if (!(await browser.available("create-schema-direct-entry"))) { t.skip(browser.reason); return; }
  const sess = await browser.signedIn();
  let id: string | null = null;
  try {
    const name = `SIT Direct Entry ${Date.now().toString(36)}`;

    // --- Build and generate -------------------------------------------------------------
    await openCreateSchema(sess, browser);
    await setupSchema(sess, { name, format: "flat" });
    await setRecordMode(sess, "multi");
    await nextStep(sess, 1); // Layout: the record type field and the record list

    await addRecord(sess); // the default two (Header/Detail) plus this one makes three
    await setRecordTypeField(sess, DIRECT_ENTRY.recordTypeField);
    for (const [index, record] of DIRECT_ENTRY.records.entries()) {
      await setRecordNameAt(sess, index, record.name);
      await setRecordMatchValueAt(sess, index, record.matchValue);
    }
    assert.deepEqual(
      await recordRows(sess),
      DIRECT_ENTRY.records.map((r) => ({ name: r.name, matchValue: r.matchValue })),
      "the record list does not show the three record types as set"
    );

    await nextStep(sess, 2); // Fields
    for (const [index, record] of DIRECT_ENTRY.records.entries()) {
      if (index > 0) await switchToRecord(sess, record.name);
      for (const field of record.fields) {
        await addField(sess);
        await fillField(sess, { name: field.name, required: field.required, width: field.width });
      }
      assert.equal(await fieldRowCount(sess), record.fields.length, `record ${record.name} should show ${record.fields.length} field rows`);
    }

    await nextStep(sess, 3); // Review and create
    const result = await createSchema(sess);
    assert.ok(result.id, `create-schema did not report a registered id: ${await statusText(sess)}`);
    id = result.id;
    created.push(id!);

    // --- Generated + created: the exact widths/positions/match values ------------------
    const envelope = JSON.parse((await rawFileFromApi(id)) || "null");
    assert.ok(envelope, "the registered envelope could not be read back from the API");
    assert.equal(envelope.kind, "sand-bench-flat-schema");
    assert.deepEqual(envelope.recordTypeField, DIRECT_ENTRY.recordTypeField);
    assert.equal(envelope.records.length, DIRECT_ENTRY.records.length);
    for (const [index, record] of DIRECT_ENTRY.records.entries()) {
      const stored = envelope.records[index];
      assert.equal(stored.name, record.name);
      assert.equal(stored.matchValue, record.matchValue);
      assert.equal(stored.recordLength, 120, `record ${record.name} should be exactly 120 bytes`);
      assert.deepEqual(
        stored.fields.map((f: any) => ({ name: f.name, width: f.width, required: f.required })),
        record.fields,
        `record ${record.name}'s fields do not match the Direct Entry layout exactly`
      );
    }

    // --- Reload: a fresh wizard session loads it back as a source ----------------------
    await openCreateSchema(sess, browser);
    await setupSchema(sess, { name: `${name} reload`, format: "flat" });
    await setSourceMode(sess, "existing");
    await waitForSourceList(sess);
    await selectExistingSource(sess, name);
    const loadedStatus = await loadExistingSource(sess);
    assert.match(loadedStatus, /Loaded an editable copy/, `expected a successful reload; got: ${loadedStatus}`);
    assert.equal(
      await sess.exec("return document.getElementById('record-mode').value;"),
      "multi",
      "reloading a multi-record file should switch the wizard into multi-record mode"
    );
    assert.deepEqual(
      await recordRows(sess),
      DIRECT_ENTRY.records.map((r) => ({ name: r.name, matchValue: r.matchValue })),
      "the reloaded record list does not match what was registered"
    );
    assert.deepEqual(await recordTabNames(sess), DIRECT_ENTRY.records.map((r) => r.name));

    await nextStep(sess, 1);
    await nextStep(sess, 2); // Fields: each reloaded record keeps its own field count
    for (const [index, record] of DIRECT_ENTRY.records.entries()) {
      if (index > 0) await switchToRecord(sess, record.name);
      assert.equal(await fieldRowCount(sess), record.fields.length, `reloaded record ${record.name} should still show ${record.fields.length} fields`);
    }
  } catch (error) {
    await saveShot(sess, "create-schema-direct-entry");
    throw error;
  }
});
