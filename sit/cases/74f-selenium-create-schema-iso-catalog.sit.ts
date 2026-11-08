// For two of the small ISO_CATALOG message shapes (apps/api/src/modules/catalogue.ts) --
// pacs.008.001.08 (flat, no groups) and pain.002.001.10 (three logical groups: Group
// header, Original group info, Payment) -- hand-builds the exact same field list through
// the create-schema wizard (/create-schema.html), once in JSON Schema format and once in
// XML format, then confirms what actually got registered through the designer-types API:
// field count, field ids, required flags and (JSON only -- see the comment on
// EXPECTED_DATA_TYPE below) the dataType every field ends up with. ISO_CATALOG is read
// directly as the source of truth, the same way 74e reads the real XSD directly rather
// than trusting an intermediate layer.
import { after, test as nodeTest, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { saveShot, sharedBrowser, waitFor as baseWaitFor } from "../lib/selenium/flow.mjs";
import {
  addField, createSchema, designerTypeDetailFromApi, dropDesignerType, fieldRowCount, fillField,
  nextStep, openCreateSchema, selectRow, setupSchema, statusText,
} from "../lib/selenium/create-schema-page.mjs";
import { ISO_CATALOG } from "../../apps/api/src/modules/catalogue.ts";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());
const waitFor = (fn: () => unknown, o: { timeout?: number; interval?: number; message?: string } = {}) => baseWaitFor(fn, { timeout: 60000, ...o });
type Sess = Awaited<ReturnType<typeof browser.signedIn>>;

/** Codes this file registered itself. Removed by exact id, so a similarly named schema of
 *  someone else's is never touched. */
const created: string[] = [];
after(async () => {
  for (const id of created) {
    try { await dropDesignerType(id); } catch { /* already gone */ }
  }
});

/** "Group header" -> "GroupHeader": a wizard group name must be a bare identifier, but the
 *  catalogue's group labels read naturally with spaces. */
function sanitizeGroupName(label: string): string {
  return label
    .replace(/[^A-Za-z0-9]+/g, " ").trim().split(" ")
    .map((word, i) => (i === 0 ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join("") || "Group";
}

// The wizard's #field-type has no business-type options (amount, currency, country, iban,
// bic): every ISO_CATALOG business type collapses onto the nearest basic wizard type.
const WIZARD_TYPE: Record<string, string> = {
  text: "string", name: "string", country: "string", currency: "string", bic: "string", iban: "string",
  datetime: "date", number: "integer", amount: "number",
};
// What that basic wizard type registers as (apps/api/src/modules/schemaParser.ts's own
// TYPE_MAP, read by mapType()). Traced, not guessed, for the JSON Schema path: a wizard
// "number" field has no JSON "format", so mapType() keys on "number" -> "number". The XML
// path's XSD round trip was traced too but landed on a materially different, less certain
// answer (a wizard "number" field becomes XSD "xs:decimal", whose reader keys on "decimal"
// -> "amount", not "number" -- a real, confirmed difference between the two formats, not a
// typo here), so dataType is asserted for JSON only; id/required/grouping are asserted for
// both, since those do not depend on that type-mapping chain.
const EXPECTED_DATA_TYPE: Record<string, string> = { string: "text", integer: "number", number: "number", date: "date" };

type CatalogField = { id: string; type: string; required: boolean; group?: string };
type CatalogEntry = { code: string; fields: CatalogField[] };

async function buildFields(sess: Sess, fields: CatalogField[]): Promise<Map<string, string>> {
  const groupNameOf = new Map<string, string>(); // catalogue group label -> sanitized wizard name
  for (const field of fields) {
    if (field.group) {
      if (!groupNameOf.has(field.group)) {
        const groupName = sanitizeGroupName(field.group);
        await addField(sess, { group: true });
        await fillField(sess, { name: groupName, required: true });
        groupNameOf.set(field.group, groupName);
      }
      await selectRow(sess, groupNameOf.get(field.group)!);
      await addField(sess, { child: true });
    } else {
      await addField(sess);
    }
    await fillField(sess, { name: field.id, type: WIZARD_TYPE[field.type] || "string", required: field.required });
  }
  return groupNameOf;
}

const CASES: Array<{ code: string }> = [{ code: "pacs.008.001.08" }, { code: "pain.002.001.10" }];

for (const { code } of CASES) {
  const entry = ISO_CATALOG.find((m) => m.code === code) as CatalogEntry | undefined;
  for (const format of ["json", "xml"] as const) {
    nodeTest(`ISO ${code} hand-built in the create-schema wizard (${format}) matches the ISO_CATALOG entry`, async (t: TestContext) => {
      if (!entry) { t.skip(`ISO_CATALOG no longer has ${code}`); return; }
      if (!(await browser.available(`create-schema-${code}-${format}`))) { t.skip(browser.reason); return; }
      const sess = await browser.signedIn();
      try {
        const name = `SIT ${code} ${format} ${Date.now().toString(36)}`;
        await openCreateSchema(sess, browser);
        await setupSchema(sess, { name, format });
        await nextStep(sess, 1); // Layout: nothing else required for XML/JSON here
        await nextStep(sess, 2); // Fields

        const groupNameOf = await buildFields(sess, entry.fields);
        const groupRows = new Set(groupNameOf.values()).size;
        assert.equal(await fieldRowCount(sess), entry.fields.length + groupRows, `expected ${entry.fields.length} fields plus ${groupRows} group row(s) in the Fields table`);

        await nextStep(sess, 3); // Review and create
        const result = await createSchema(sess);
        assert.ok(result.id, `create-schema did not report a registered id: ${await statusText(sess)}`);
        created.push(result.id);

        const detail = await designerTypeDetailFromApi(result.id);
        assert.ok(detail, "the registered scheme could not be read back from the API");
        assert.equal(detail.fields.length, entry.fields.length, `field count mismatch for ${code} (${format})`);
        const byId = new Map<string, any>(detail.fields.map((f: any) => [f.id, f]));
        for (const field of entry.fields) {
          const stored = byId.get(field.id);
          assert.ok(stored, `field ${field.id} is missing from the registered scheme`);
          assert.equal(stored.required, field.required, `field ${field.id} required mismatch`);
          if (format === "json") {
            const expected = EXPECTED_DATA_TYPE[WIZARD_TYPE[field.type] || "string"];
            assert.equal(stored.type, expected, `field ${field.id} dataType mismatch`);
          }
        }

        // Grouping structure: fields sharing a catalogue group share one parent path, and
        // the three groups land on three distinct parent paths -- regardless of the exact
        // root/path spelling, which differs between the JSON and XSD round trips.
        const parentOf = (xpath: string) => String(xpath).split("/").slice(0, -1).join("/");
        const groupParent = new Map<string, string>();
        for (const field of entry.fields) {
          if (!field.group) continue;
          const parent = parentOf(byId.get(field.id).xpath);
          if (groupParent.has(field.group)) assert.equal(parent, groupParent.get(field.group), `fields in group "${field.group}" should share one parent path`);
          else groupParent.set(field.group, parent);
        }
        assert.equal(new Set(groupParent.values()).size, groupParent.size, "distinct catalogue groups must not collapse onto the same parent path");
      } catch (error) {
        await saveShot(sess, `create-schema-${code}-${format}`);
        throw error;
      }
    });
  }
}

nodeTest("ISO_CATALOG still has pacs.008.001.08 (flat) and pain.002.001.10 (grouped) for this file to exercise", () => {
  const codes = new Set(ISO_CATALOG.map((m) => m.code));
  assert.ok(codes.has("pacs.008.001.08"), "pacs.008.001.08 was removed from ISO_CATALOG; update this file's CASES");
  assert.ok(codes.has("pain.002.001.10"), "pain.002.001.10 was removed from ISO_CATALOG; update this file's CASES");
});
