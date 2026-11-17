// One GUI case per ISO 20022 message schema: import the XSD through Import Scheme, read the schema file
// itself, check on the Scheme definitions screen that every element and attribute of it is shown in the
// Tree (expanded), the List and the Diagram, then delete the scheme from its details page and confirm it
// is gone.
//
// The schemas come from SBE_ISO_FILES: one or more folders (separated like PATH), searched recursively,
// default tests/fixtures/iso20022. Each *.xsd found becomes its own test, named by its message identifier,
// e.g. "ISO pacs.008.001.14 ...". When a message id is in several folders the first folder wins, so list
// the official files before a mirror. Nothing is read from the database: what is verified is what the
// screen renders. A scheme somebody already imported is never re-imported or deleted; that case is skipped.
// Everything this file imports is also removed in the after hook, also when a step fails.
// SBE_ISO_SHARD=k/n runs every n-th message (k = 1..n) to split the catalogue over runners.
//
// What the expectations are (all of it cross-checked against the product's own parser in
// tests/iso-xsd-tree.test.ts, and against 764 ISO 20022 schemas offline):
//   Tree     "N elements" in the summary; every element and @attribute is a row whose data-path is its path;
//            each element's occurrence reads "1", "0..1" or "1..∞". The tree is virtualised, so the case
//            scrolls it from top to bottom and collects the rows it draws.
//   List     a row per group and per field with its full Path; a field's Occurs reads "1..1", "0..n"...
//   Diagram  a card per group and per field (its tooltip starts with the path); the root card counts
//            "N fields", N being the leaf elements plus the attributes.
//   Message card on the family page: FIELDS = N.
import { after, test as nodeTest, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { apiJson, exists, pageText, saveShot, sharedBrowser, waitFor as baseWaitFor } from "../lib/selenium/flow.mjs";
import { importOutcome, importSchema } from "../lib/selenium/flows.mjs";
import { answerAlert, clickDetail, mainText, openFamily, openSchemeDefinitions, uploadByCode } from "../lib/selenium/definitions.mjs";
import { occurrenceOf, treeOccurrenceOf, xsdAttributes, xsdCounts, xsdElements } from "../lib/iso-xsd-tree.mjs";

type El = { path: string; name: string; depth: number; min: number; max: number; leaf: boolean };
type Attr = { path: string; name: string; required: boolean };
const here = dirname(fileURLToPath(import.meta.url));
const DIRS = (process.env.SBE_ISO_FILES || join(here, "../../tests/fixtures/iso20022")).split(delimiter).filter(Boolean);

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());

/** Big messages draw tens of thousands of rows, so every wait here allows a minute. */
const waitFor = (fn: () => unknown, o: { timeout?: number; interval?: number; message?: string } = {}) => baseWaitFor(fn, { timeout: 60000, ...o });
type Sess = Awaited<ReturnType<typeof browser.signedIn>>;

function xsdFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? xsdFiles(p) : /\.xsd$/i.test(name) ? [p] : [];
  }).sort();
}

/** Codes this file stored itself. Removed by exact code, so a similarly named scheme of someone else is never touched. */
const created: string[] = [];
after(async () => {
  for (const code of created) {
    const row = await uploadByCode(code);
    if (row) await apiJson(`/api/v1/catalog/designer-types/${encodeURIComponent(row.id)}`, { method: "DELETE" });
  }
});

/** Opens the family page of an imported scheme and returns its message card's text; with open, goes on to the details. */
async function openCard(sess: Sess, code: string, open: boolean): Promise<string> {
  const family = (await uploadByCode(code))?.family || code;
  await openSchemeDefinitions(sess, browser);
  await openFamily(sess, family);
  const card = await waitFor(async () => sess.exec("const c=document.querySelector(\".opsc-msgtype-card[data-scheme-code='\"+arguments[0]+\"']\");return c?c.innerText.replace(/\\n+/g,' | '):null;", [code]), { message: `message card ${code}` }) as string;
  if (open) {
    await sess.exec("document.querySelector(\".opsc-msgtype-card[data-scheme-code='\"+arguments[0]+\"']\").click();", [code]);
    await waitFor(() => exists(sess, ".opsc-viewtoggle"), { message: "the details" });
    await waitFor(async () => /\d+ nodes/.test(await mainText(sess)), { message: "the tree summary" });
  }
  return card;
}

// --- Tree: scroll the virtual list and collect the rows it draws ---------------------------------------
const TREE_INIT = "const s=document.querySelector('.sbe-st-scroll');const sp=s.querySelector('.sbe-st-spacer');window.__isoRows=new Map();return {height:parseInt(sp.style.height,10)||0,view:s.clientHeight||600};";
const TREE_CHUNK = `const s=document.querySelector('.sbe-st-scroll');const m=window.__isoRows;const step=arguments[2];
for(let k=arguments[0];k<arguments[1];k++){s.scrollTop=k*step;s.dispatchEvent(new Event('scroll'));
for(const r of s.querySelectorAll('.sbe-st-row[data-path]')){if(r.classList.contains('is-comp'))continue;const p=r.getAttribute('data-path');if(!m.has(p)){const o=r.querySelector('.sbe-st-occ');m.set(p,o?o.textContent.trim():'');}}}
return m.size;`;
async function treeRows(sess: Sess): Promise<Map<string, string>> {
  const { height, view } = (await sess.exec(TREE_INIT)) as { height: number; view: number };
  const step = Math.max(300, view - 120);
  const steps = Math.ceil(height / step) + 1;
  for (let k = 0; k < steps; k += 250) await sess.exec(TREE_CHUNK, [k, Math.min(steps, k + 250), step]);
  return new Map((await sess.exec("return [...window.__isoRows.entries()];")) as Array<[string, string]>);
}

/** The details page's rows of the List view: [path, occurs, mandatory]. */
const listRows = (sess: Sess) => sess.exec("return [...document.querySelectorAll('.sbe-flist tbody tr')].map(tr=>[tr.children[2]?.textContent.trim()||'',tr.children[4]?.textContent.trim()||'',tr.children[5]?.textContent.trim()||'']);") as Promise<string[][]>;
/** The Diagram's cards: the first line of each tooltip is the path. */
const diagramPaths = (sess: Sess) => sess.exec("return [...document.querySelectorAll('.sbe-fdiag-card')].map(c=>(c.getAttribute('title')||'').split('\\n')[0]);") as Promise<string[]>;

const missing = (expected: Iterable<string>, shown: Set<string>) => [...expected].filter((p) => !shown.has(p));

// Two files with the same name in different folders are one message: keep the first.
// SBE_ISO_SHARD=k/n runs every n-th message (k = 1..n), so the full catalogue can be split over several runners.
const [shardK, shardN] = (process.env.SBE_ISO_SHARD || "1/1").split("/").map(Number) as [number, number];
const files = DIRS.flatMap(xsdFiles).filter((f, i, all) => all.findIndex((o) => o.split("/").pop() === f.split("/").pop()) === i)
  .filter((_f, i) => i % shardN === shardK - 1);
if (!files.length) {
  nodeTest("ISO 20022 schema catalog: at least one XSD is available", () => {
    assert.fail(`no .xsd files under ${DIRS.join(", ")}; set SBE_ISO_FILES to the folder holding the ISO 20022 message schemas`);
  });
}

for (const file of files) {
  const fileName = file.split("/").pop()!;
  const messageId = fileName.replace(/\.xsd$/i, "");
  nodeTest(`ISO ${messageId} imports, shows every element in Tree, List and Diagram, and deletes`, { timeout: 30 * 60_000 }, async (t: TestContext) => {
    if (!(await browser.available(`iso-${messageId}`))) { t.skip(browser.reason); return; }
    const xsd = readFileSync(file, "utf8").replace(/^﻿/, "");
    const elements: El[] = xsdElements(xsd);
    const attributes: Attr[] = xsdAttributes(xsd);
    const counts = xsdCounts(elements, attributes);
    const root = elements[0]!.path;
    const fieldPaths = [...elements.filter((e) => e.leaf).map((e) => e.path), ...attributes.map((a) => a.path)];
    const groupPaths = elements.filter((e) => !e.leaf && e.path !== root).map((e) => e.path);
    const sess = await browser.signedIn();
    let code = "";
    try {
      // 1. Import through the screen. A scheme that is already stored belongs to someone else: leave it.
      await importSchema(sess, browser, { format: "XSD", fileName, content: xsd });
      const outcome = await importOutcome(sess);
      if (!outcome.stored && /already|duplicate/i.test(outcome.text)) { t.skip(`${messageId} is already imported; not touched`); return; }
      assert.equal(outcome.stored, true, outcome.text);
      assert.ok(outcome.code, `the import result names no scheme code: ${outcome.text}`);
      code = outcome.code;
      created.push(code);
      assert.equal(outcome.fieldCount, counts.fields, "the import result's field count");

      // 2. Message card: the field count of the whole message.
      const card = await openCard(sess, code, false);
      assert.match(card, new RegExp(`FIELDS \\| ${counts.fields}(?!\\d)`), `the message card should show ${counts.fields} fields: ${card}`);

      // 3. Tree, expanded: every element and attribute by path, every element with its occurrence.
      await openCard(sess, code, true);
      const summary = (await sess.exec("const s=document.querySelector('[data-testid=structure-summary]');return s?s.innerText:'';")) as string;
      assert.match(summary, new RegExp(`(?<![\\d,])${counts.nodes} elements`), `the tree summary should count ${counts.nodes} elements: ${summary}`);
      if (counts.attributes) assert.match(summary, new RegExp(`(?<![\\d,])${counts.attributes} attributes`), `the tree summary should count ${counts.attributes} attributes: ${summary}`);
      await clickDetail(sess, "Expand all");
      const rows = await treeRows(sess);
      const inTree = new Set(rows.keys());
      const notInTree = missing([...elements.map((e) => e.path), ...attributes.map((a) => a.path)], inTree);
      assert.deepEqual(notInTree.slice(0, 20), [], `${notInTree.length} of ${elements.length + attributes.length} elements/attributes are missing from the expanded tree`);
      const wrongOccurs = elements.filter((e) => e.depth > 0 && rows.get(e.path) !== treeOccurrenceOf(e)).map((e) => `${e.path}: shows "${rows.get(e.path)}", schema says "${treeOccurrenceOf(e)}"`);
      assert.deepEqual(wrongOccurs.slice(0, 20), [], `${wrongOccurs.length} elements show the wrong occurrence in the tree`);

      // 4. List: a row per group and field with its full path; a field's occurrence is its element's.
      await clickDetail(sess, "List");
      await waitFor(async () => /FIELD\s+PATH\s+TYPE\s+OCCURS\s+MANDATORY/.test(await mainText(sess)), { message: "the list header" });
      await clickDetail(sess, "Expand all");
      await waitFor(async () => (await sess.exec("return document.querySelectorAll('.sbe-flist tbody tr').length;")) as number >= fieldPaths.length + groupPaths.length, { message: `the list to show ${fieldPaths.length + groupPaths.length} rows` });
      const list = await listRows(sess);
      const listPaths = new Set(list.map((r) => r[0]!));
      const notInList = missing([...fieldPaths, ...groupPaths], listPaths);
      assert.deepEqual(notInList.slice(0, 20), [], `${notInList.length} paths are missing from the list view`);
      const listOccurs = new Map(list.map((r) => [r[0]!, r[1]!]));
      const wrongListOccurs = elements.filter((e) => e.leaf && listOccurs.get(e.path) !== occurrenceOf(e)).map((e) => `${e.path}: shows "${listOccurs.get(e.path)}", schema says "${occurrenceOf(e)}"`);
      assert.deepEqual(wrongListOccurs.slice(0, 20), [], `${wrongListOccurs.length} fields show the wrong occurrence in the list`);
      const listRoot = list.find((r) => r[0] === root)?.[2];

      // 5. Diagram: a card per group and field; the root card counts every field.
      await clickDetail(sess, "Diagram");
      await waitFor(async () => /\d+ fields/.test(await mainText(sess)), { message: "the diagram" });
      await clickDetail(sess, "Expand all");
      await waitFor(async () => (await sess.exec("return document.querySelectorAll('.sbe-fdiag-card').length;")) as number >= fieldPaths.length + groupPaths.length, { message: "every diagram card to be drawn" });
      const cards = new Set(await diagramPaths(sess));
      const notInDiagram = missing([...fieldPaths, ...groupPaths], cards);
      assert.deepEqual(notInDiagram.slice(0, 20), [], `${notInDiagram.length} paths are missing from the diagram`);
      const rootText = (await sess.exec("const c=[...document.querySelectorAll('.sbe-fdiag-card')].find(c=>(c.getAttribute('title')||'').split('\\n')[0]===arguments[0]);const n=c&&c.querySelector('.sbe-ftree-count');return n?n.textContent.trim():null;", [root])) as string | null;
      const rootCount = /^(\d+) fields?(?: · (\d+) mandatory)?$/.exec(rootText || "");
      assert.ok(rootCount, `the diagram's root card should count its fields, it reads: ${rootText}`);
      assert.equal(Number(rootCount[1]), counts.fields, "the diagram's root card field count");
      // The List and the Diagram agree on how many of those are mandatory ("M/N" in the List's root row).
      assert.equal(listRoot, `${rootCount[2] ?? 0}/${counts.fields}`, "mandatory count: List root row vs Diagram root card");

      // 6. Delete from the details page, then confirm on screen that the scheme is gone.
      await openCard(sess, code, true);
      await clickDetail(sess, "Delete schema");
      assert.match(await answerAlert(sess, true), new RegExp(`^Delete schema ${code.replace(/\./g, "\\.")}\\?`));
      await waitFor(async () => (await pageText(sess)).includes(`Deleted ${code}`) || !(await exists(sess, `.opsc-msgtype-card[data-scheme-code='${code}']`)), { message: "the card to leave the screen" });
      await openSchemeDefinitions(sess, browser);
      await waitFor(() => exists(sess, ".opsc-family-card, .opsc-empty, .opsc-main"), { message: "the Scheme definitions screen" });
      const stillListed = await sess.exec("return document.body.innerText.includes(arguments[0]);", [code]);
      assert.equal(stillListed, false, `${code} must not be listed after the delete`);
      created.splice(created.indexOf(code), 1);
    } catch (error) {
      await saveShot(sess, `iso-${messageId}`);
      throw error;
    }
  });
}
