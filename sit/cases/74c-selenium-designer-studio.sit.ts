// Message Designer studio (/?page=messageDesigner), driven through the browser and confirmed through the API.
//
//   MD*  Choose (type vs saved definition, family chips, search, guided filters), Build (tags, filters,
//        tree/list, undo/redo, changes, glossary, technical details), Generate (one vs many, counts, names,
//        XML/JSON, downloads, datasets, systems) and Publish (gating, v1/v2 datasets).
//
// The E2E journeys in 72-* already publish a definition and feed a dataset; these cases cover the variations.
// Case names are literal strings (the Test Engine scans for them). { todo } marks a product defect with the truthful assertion.
import { after, test as nodeTest, type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  apiJson, captureDownloads, click, clickText, count, exists, saveShot, selectOption, setValue, sharedBrowser, sleep, text, typeInto,
  uniqueName, value, visible, waitDownload, waitFor as baseWaitFor, waitVisible,
  pageText,
} from "../lib/selenium/flow.mjs";
import {
  chipLabels, chooseMode, chooseTile, closePanel, datasetsLinkedTo, definitionFull, definitionRow, goTab, messageCountText, nameDefinition,
  openHelper, openMore, openStudio, panelText, preview, publishState, rowsOf, sampleNames, savedDefinition, savedFromApi, saveStatusText,
  setBatchCount, studioAttr, tileCodes, waitPublished,
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
    if (!(await browser.available(`studio-${name}`))) { t.skip(browser.reason); return; }
    const sess = await browser.signedIn();
    try { await fn(sess, t); }
    catch (error) { await saveShot(sess, `studio-${name}`); throw error; }
  });
}

const PAIN = "pain.001.001.09"; // 13 tags, 12 required, 1 optional (BICFI)
const CAMT = "camt.053.001.08"; // 7 tags, all required
const PACS = "pacs.008.001.08";

/** Opens a blank studio, chooses a tile and one/many messages; optionally names it and waits for the first save. */
async function start(sess: Sess, o: { tile?: string; many?: number; name?: string } = {}) {
  await openStudio(sess, browser);
  await chooseTile(sess, o.tile ?? PAIN);
  await chooseMode(sess, o.many !== undefined, { count: o.many });
  if (o.name) {
    await nameDefinition(sess, o.name);
    return savedDefinition(o.name);
  }
  return null;
}
const tiles = (sess: Sess) => tileCodes(sess) as Promise<string[]>;
const generateHint = (sess: Sess) => sess.exec("return document.getElementById('sbe-studio-tab-generate').textContent;") as Promise<string>;
const problemText = (sess: Sess) => sess.exec("const e=document.querySelector(\"[data-testid='studio-mode-problem']\");return e?e.textContent:'';") as Promise<string>;
const seg = async (sess: Sess, label: string) => clickText(sess, ".sbe-studio-seg-btn", label);
const headerCount = async (sess: Sess) => Number(/Changes \((\d+)\)/.exec(await text(sess, "[data-testid='studio-changes-button']"))?.[1]);
async function openBrowse(sess: Sess) {
  await sess.exec("const d=document.querySelector(\"[data-testid='studio-browse']\");if(d&&!d.open)d.querySelector('summary').click();");
  await waitVisible(sess, ".sbe-fpick");
}
const pickerRows = (sess: Sess) => sess.exec("return [...document.querySelectorAll('.sbe-fpick-item')].map(e=>e.getAttribute('data-path'));") as Promise<string[]>;
const pickerChip = (sess: Sess, prefix: string) => clickText(sess, ".sbe-fpick-bar button", prefix, { exact: false });

// ==========================================================================================
// Choose
// ==========================================================================================
test("MD1 Start from a message type lists the official message types and the count line matches the tiles", async (sess) => {
  await openStudio(sess, browser);
  const codes = await tiles(sess);
  for (const c of [CAMT, PACS, PAIN]) assert.ok(codes.includes(c), `${c} missing`);
  assert.equal(await messageCountText(sess), `${codes.length} message types`);
  const all = (await chipLabels(sess)).find((c: { family: string }) => c.family === "");
  assert.equal(all.label, `All (${codes.length})`);
  assert.equal(all.pressed, "true");
  assert.equal(await sess.exec("return document.querySelectorAll('.sbe-studio-msg[disabled]').length;"), await sess.exec("return [...document.querySelectorAll('.sbe-studio-msg')].filter(b=>b.textContent.includes('No tags read')).length;"));
});

test("MD2 each category chip shows exactly as many message types as its count says, and All brings them back", async (sess) => {
  await openStudio(sess, browser);
  const total = (await tiles(sess)).length;
  const chips = (await chipLabels(sess)).filter((c: { family: string }) => c.family !== "");
  assert.ok(chips.length >= 3, "expected several families");
  let sum = 0;
  for (const chip of chips.slice(0, 6)) {
    await sess.exec("document.querySelector(\".sbe-studio-chip[data-family='\"+arguments[0]+\"']\").click();", [chip.family]);
    const n = Number(/\((\d+)\)/.exec(chip.label)?.[1]);
    await waitFor(async () => (await tiles(sess)).length === n, { message: `${chip.label} tiles` });
    assert.equal(await messageCountText(sess), n === 1 ? "1 message type" : `${n} message types`);
    assert.equal(await sess.exec("return document.querySelector(\".sbe-studio-chip[data-family='\"+arguments[0]+\"']\").getAttribute('aria-pressed');", [chip.family]), "true");
  }
  for (const chip of chips) sum += Number(/\((\d+)\)/.exec(chip.label)?.[1]);
  assert.equal(sum, total, "every message type belongs to exactly one family");
  await sess.exec("document.querySelector(\".sbe-studio-chip[data-family='']\").click();");
  await waitFor(async () => (await tiles(sess)).length === total, { message: "All to restore every tile" });
});

test("MD3 Find a message narrows by code, by what it does and by family, ignoring case", async (sess) => {
  await openStudio(sess, browser);
  await setValue(sess, "#sbe-studio-find", "PACS.008");
  await waitFor(async () => (await tiles(sess)).join() === PACS, { message: "only pacs.008" });
  assert.equal(await messageCountText(sess), "1 message type");
  await setValue(sess, "#sbe-studio-find", "account statement");
  await waitFor(async () => (await tiles(sess)).includes(CAMT) && !(await tiles(sess)).includes(PACS), { message: "the statement message" });
  await setValue(sess, "#sbe-studio-find", "payment initiation");
  await waitFor(async () => (await tiles(sess)).includes(PAIN), { message: "by family name" });
});

test("MD4 a search with no match says so and shows no tiles; clearing it brings the list back", async (sess) => {
  await openStudio(sess, browser);
  const total = (await tiles(sess)).length;
  await setValue(sess, "#sbe-studio-find", "zzzz-no-such-message");
  await waitFor(async () => (await tiles(sess)).length === 0, { message: "no tiles" });
  assert.equal(await messageCountText(sess), "0 message types");
  assert.match(await text(sess, ".sbe-studio-empty"), /No message type matches that search\./);
  await setValue(sess, "#sbe-studio-find", "");
  await waitFor(async () => (await tiles(sess)).length === total, { message: "the whole list" });
});

test("MD5 the guided filters (who sends, who receives, what it is about) pick the matching message types", async (sess) => {
  await openStudio(sess, browser);
  const total = (await tiles(sess)).length;
  await openHelper(sess);
  assert.deepEqual(await sess.exec("return [...document.querySelectorAll(\"select[aria-label='Who sends it?'] option\")].map(o=>o.textContent);"), ["Not sure", "A customer", "A bank"]);
  await selectOption(sess, "select[aria-label='Who sends it?']", "A customer");
  await selectOption(sess, "select[aria-label='Who receives it?']", "A bank");
  await selectOption(sess, "select[aria-label='What is it about?']", "Making a payment");
  await waitFor(async () => (await tiles(sess)).join() === PAIN, { message: "only pain.001" });
  await selectOption(sess, "select[aria-label='Who sends it?']", "A bank");
  await waitFor(async () => (await tiles(sess)).join() === PACS, { message: "only pacs.008 (bank to bank payment)" });
  await selectOption(sess, "select[aria-label='Who receives it?']", "A customer");
  await selectOption(sess, "select[aria-label='What is it about?']", "Statements and account movements");
  await waitFor(async () => (await tiles(sess)).includes(CAMT) && !(await tiles(sess)).includes(PACS), { message: "the statement message" });
  assert.ok(!(await tiles(sess)).some((c) => /^sit|imported/i.test(c)), "imported schemes of unknown purpose are left out while an answer is set");
  await clickText(sess, "button", "Clear answers");
  await waitFor(async () => (await tiles(sess)).length === total, { message: "the whole list after Clear answers" });
});

test("MD6 answers that match nothing say why and offer Clear answers", async (sess) => {
  await openStudio(sess, browser);
  await openHelper(sess);
  await selectOption(sess, "select[aria-label='Who sends it?']", "A customer");
  await selectOption(sess, "select[aria-label='Who receives it?']", "A customer");
  await waitFor(async () => (await tiles(sess)).length === 0, { message: "no tiles" });
  assert.match(await text(sess, ".sbe-studio-empty"), /No message type matches those answers\. Message types whose purpose is not known are left out/);
  assert.equal(await messageCountText(sess), "0 message types");
});

test("MD7 Start from a saved definition lists the saved definitions with their tag count and status", async (sess) => {
  const name = uniqueName("MdSaved");
  await start(sess, { name });
  await openStudio(sess, browser);
  await seg(sess, "Start from a saved definition");
  await waitFor(async () => (await count(sess, "[data-definition]")) > 0, { message: "saved definitions" });
  const api = await savedFromApi();
  await waitFor(async () => (await count(sess, "[data-definition]")) === api.length, { message: "as many rows as the API lists" });
  const row = await sess.exec("const b=[...document.querySelectorAll('[data-definition]')].find(b=>b.getAttribute('aria-label')==='Start from '+arguments[0]);return b?b.innerText.replace(/\\n+/g,' | '):null;", [name]);
  assert.ok(row, "the new definition is offered");
  assert.match(row, new RegExp(`${PAIN} \\| \\d+ tags \\| Draft`));
});

test("MD8 starting from a saved definition opens a copy named 'Copy of ...' and leaves the original alone", async (sess) => {
  const name = uniqueName("MdCopy");
  const original = await start(sess, { name });
  await openStudio(sess, browser);
  await seg(sess, "Start from a saved definition");
  await waitVisible(sess, "[data-definition]");
  await sess.exec("[...document.querySelectorAll('[data-definition]')].find(b=>b.getAttribute('aria-label')==='Start from '+arguments[0]).click();", [name]);
  await waitFor(async () => (await value(sess, "#sbe-studio-name")) === `Copy of ${name}`, { message: "the copy's name" });
  const copy = await savedDefinition(`Copy of ${name}`);
  assert.notEqual(copy.id, original.id);
  assert.equal(copy.fieldCount, original.fieldCount);
  assert.equal(copy.msgTypeCode, PAIN);
  assert.equal((await definitionRow(name))?.id, original.id, "the original is still there");
  assert.equal((await definitionFull(original.id))?.name, name);
});

// ==========================================================================================
// Build
// ==========================================================================================
test("MD9 One message or many is asked first; the Build and Generate tabs say what was chosen", async (sess) => {
  await openStudio(sess, browser);
  await chooseTile(sess, CAMT);
  assert.equal(await studioAttr(sess, "data-mode"), "none");
  assert.match(await generateHint(sess), /One message or many/);
  await chooseMode(sess, false);
  await waitFor(async () => (await studioAttr(sess, "data-mode")) === "one", { message: "one message" });
  assert.match(await generateHint(sess), /One message/);
  await chooseMode(sess, true);
  await waitFor(async () => /10 messages/.test(await generateHint(sess)), { message: "the default of 10 messages" });
  assert.equal(await value(sess, "#sbe-studio-batch-count"), "10");
});

test("MD10 a batch of 1 message: the Generate tab says 1 and the button is Download", async (sess) => {
  await start(sess, { tile: CAMT, many: 1 });
  await waitFor(async () => /1 messages?/.test(await generateHint(sess)), { message: "1 message hint" });
  await goTab(sess, "generate");
  assert.equal(await text(sess, "#sbe-studio-batch-title, .sbe-studio-card-head h3"), "1 message");
  assert.equal(await count(sess, "[data-testid='studio-download-all']"), 1);
  assert.equal(await text(sess, "[data-testid='studio-download-all']"), "Download");
});

test("MD11 a batch of 2 messages shows two named samples and 'Download all 2'", async (sess) => {
  await start(sess, { tile: CAMT, many: 2 });
  await goTab(sess, "generate");
  await waitFor(async () => (await sampleNames(sess)).length === 2, { message: "two samples" });
  assert.equal(await text(sess, "[data-testid='studio-download-all']"), "Download all 2");
  assert.match(await text(sess, "[data-testid='studio-batch-status']"), /^2 messages, 7 tags each\./);
});

test("MD12 a batch of 10000 is accepted; only the first ten are shown as samples", async (sess) => {
  await start(sess, { tile: CAMT, many: 10000 });
  await waitFor(async () => /10000 messages/.test(await generateHint(sess)), { message: "10000 in the tab hint" });
  assert.equal(await problemText(sess), "");
  await goTab(sess, "generate");
  await waitFor(async () => (await sampleNames(sess)).length === 10, { timeout: 30000, message: "ten samples" });
  assert.equal(await text(sess, "[data-testid='studio-download-all']"), "Download all 10000");
  assert.match(await text(sess, "[data-testid='studio-batch-status']"), /^10000 messages, 7 tags each\. The first 10 are shown as samples\./);
});

test("MD13 counts of 0, 10001, blank, 2.5 and -3 are refused with a reason and the last good count stays", async (sess) => {
  await start(sess, { tile: CAMT, many: 5 });
  const whole = "Type how many messages you want: a whole number, 1 or more.";
  const expectations: Array<[string, string]> = [["0", whole], ["10001", "A definition makes at most 10000 messages at a time."], ["", whole], ["2.5", whole], ["-3", whole]];
  for (const [input, reason] of expectations) {
    await setValue(sess, "#sbe-studio-batch-count", input);
    await waitFor(async () => (await problemText(sess)).startsWith(reason), { message: `the refusal of "${input}"` });
    assert.match(await problemText(sess), /The definition still makes 5\./);
    assert.equal(await sess.exec("return document.getElementById('sbe-studio-batch-count').getAttribute('aria-invalid');"), "true");
    assert.match(await generateHint(sess), /5 messages/);
  }
  await setValue(sess, "#sbe-studio-batch-count", "6");
  await waitFor(async () => (await problemText(sess)) === "", { message: "the refusal to clear" });
  assert.match(await generateHint(sess), /6 messages/);
});

test("MD14 the batch count is saved with the definition: the API holds the working copy with the count", async (sess) => {
  const name = uniqueName("MdCount");
  const def = await start(sess, { tile: CAMT, many: 7, name });
  await waitFor(async () => {
    const full = await definitionFull(def!.id);
    const ws = full?.workingCopy || full?.working_copy || full?.working || full;
    return JSON.stringify(ws).includes('"count":7');
  }, { timeout: 15000, message: "the saved batch count of 7" });
});

test("MD15 message name options: prefix, name, counter start, date and time decide the file names", async (sess) => {
  const name = uniqueName("MdNames");
  await start(sess, { tile: CAMT, many: 3, name });
  await goTab(sess, "generate");
  await waitFor(async () => (await sampleNames(sess)).length === 3, { message: "samples" });
  const today = new Date().toISOString().slice(0, 10);
  assert.deepEqual(await sampleNames(sess), [1, 2, 3].map((i) => `${name}-${today}-${i}`), "default: definition name, today's date and a counter from 1");
  await openMore(sess);
  const tick = (label: string) => sess.exec("[...document.querySelectorAll('label.sbe-studio-check')].find(l=>l.textContent.includes(arguments[0])).querySelector('input').click();", [label]);
  await setValue(sess, "[aria-label='Message name prefix']", "PFX");
  await setValue(sess, "[aria-label='Message name']", "Nm");
  await setValue(sess, "[aria-label='Counter start']", "50");
  await waitFor(async () => (await sampleNames(sess)).join() === [50, 51, 52].map((i) => `PFX-Nm-${today}-${i}`).join(), { message: "prefix, name and counter" });
  await tick("Include the date");
  await waitFor(async () => (await sampleNames(sess))[0] === "PFX-Nm-50", { message: "the date to leave the name" });
  await tick("Include the time");
  await waitFor(async () => /^PFX-Nm-\d{6}\.\d{3}-50$/.test((await sampleNames(sess))[0]), { message: "the time in the name" });
  await tick("Include the date");
  await waitFor(async () => /^PFX-Nm-\d{4}-\d{2}-\d{2}-\d{6}\.\d{3}-50$/.test((await sampleNames(sess))[0]), { message: "date and time" });
});

test("MD16 a blank or negative counter start says the messages cannot be made and hides the download buttons", async (sess) => {
  await start(sess, { tile: CAMT, many: 3 });
  await goTab(sess, "generate");
  await openMore(sess);
  for (const v of ["", "-1"]) {
    await sess.exec("const e=document.querySelector(\"[aria-label='Counter start']\");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,arguments[0]);e.dispatchEvent(new Event('input',{bubbles:true}));", [v]);
    await waitFor(() => exists(sess, "[data-testid='studio-batch-problem']"), { message: `the problem for "${v}"` });
    assert.match(await text(sess, "[data-testid='studio-batch-problem']"), /Counter start must be a non-negative whole number/);
    assert.equal(await count(sess, "[data-testid='studio-download-all']"), 0);
  }
  await sess.exec("const e=document.querySelector(\"[aria-label='Counter start']\");Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'4');e.dispatchEvent(new Event('input',{bubbles:true}));");
  await waitFor(() => exists(sess, "[data-testid='studio-download-all']"), { message: "the buttons to return" });
});

test("MD17 text before and after wrap generated free text in every message", async (sess) => {
  await start(sess, { tile: PAIN, many: 2 });
  await goTab(sess, "generate");
  await openMore(sess);
  await setValue(sess, "[aria-label='Text before']", "BEF");
  await setValue(sess, "[aria-label='Text after']", "AFT");
  await waitFor(async () => /<Nm>BEF.*AFT<\/Nm>/.test(await preview(sess)), { message: "marks on the name text" });
  await waitFor(async () => (await sampleNames(sess)).length === 2, { message: "two samples" });
  await sess.exec("[...document.querySelectorAll('.sbe-studio-link')].find(b=>/Read message 2/.test(b.getAttribute('aria-label'))).click();");
  await waitFor(async () => /Message 2 of 2/.test(await text(sess, "[data-testid='studio-preview-name']")), { message: "message 2" });
  assert.match(await preview(sess), /<Nm>BEF.*AFT<\/Nm>/);
});

test("MD18 the XML and JSON buttons switch the preview format", async (sess) => {
  await start(sess, { tile: CAMT });
  await goTab(sess, "generate");
  await waitFor(async () => (await preview(sess)).startsWith("<?xml"), { message: "XML by default" });
  await seg(sess, "JSON");
  await waitFor(async () => (await preview(sess)).trim().startsWith("{"), { message: "JSON preview" });
  const doc = JSON.parse(await preview(sess));
  assert.ok(doc.Document.BkToCstmrStmt.GrpHdr.MsgId);
  assert.equal(await sess.exec("return [...document.querySelectorAll('.sbe-studio-seg-btn')].filter(b=>b.getAttribute('aria-pressed')==='true').map(b=>b.textContent.trim()).join();"), "JSON");
  await seg(sess, "XML");
  await waitFor(async () => (await preview(sess)).startsWith("<?xml"), { message: "XML again" });
});

test("MD19 New values changes the generated values and keeps the tags", async (sess) => {
  await start(sess, { tile: CAMT });
  await goTab(sess, "generate");
  const one = await preview(sess);
  await waitFor(async () => { await clickText(sess, "button", "New values"); return (await preview(sess)) !== one; }, { message: "different values" });
  const two = await preview(sess);
  assert.equal(one.replace(/>[^<]*</g, "><"), two.replace(/>[^<]*</g, "><"), "the tags are the same");
});

test("MD20 Copy answers 'Copied' and goes back to 'Copy'", async (sess) => {
  await start(sess, { tile: CAMT });
  await goTab(sess, "generate");
  await sess.exec("Object.defineProperty(navigator,'clipboard',{value:{writeText:(t)=>{window.__sitCopied=t;return Promise.resolve();}},configurable:true});");
  await clickText(sess, "button", "Copy");
  await waitFor(async () => (await sess.exec("return window.__sitCopied||'';")).startsWith("<?xml"), { message: "the message on the clipboard" });
  await waitFor(async () => /Copied/.test(await sess.exec("return document.body.innerText;")), { message: "Copied" });
  await waitFor(async () => (await sess.exec("return [...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Copy');")) === true, { message: "the label to return" });
  assert.equal(await sess.exec("return window.__sitCopied;"), await preview(sess));
});

test("MD21 Download saves the one message as <definition>.xml or .json with the previewed content", async (sess) => {
  const name = uniqueName("MdDl");
  await start(sess, { tile: CAMT, name });
  await goTab(sess, "generate");
  await captureDownloads(sess);
  await click(sess, "[data-testid='studio-download']");
  const xml = await waitDownload(sess);
  assert.equal(xml.name, `${name.toLowerCase()}.xml`);
  assert.equal(xml.text.trim(), (await preview(sess)).trim());
  await seg(sess, "JSON");
  await waitFor(async () => (await preview(sess)).trim().startsWith("{"), { message: "JSON" });
  await click(sess, "[data-testid='studio-download']");
  const json = await waitDownload(sess, { after: 1 });
  assert.equal(json.name, `${name.toLowerCase()}.json`);
  assert.doesNotThrow(() => JSON.parse(json.text));
});

test("MD22 Download this one saves the message being read, named by the batch naming", async (sess) => {
  const name = uniqueName("MdDl1");
  await start(sess, { tile: CAMT, many: 3, name });
  await goTab(sess, "generate");
  await waitFor(async () => (await sampleNames(sess)).length === 3, { message: "samples" });
  await sess.exec("[...document.querySelectorAll('.sbe-studio-link')].find(b=>/Read message 2/.test(b.getAttribute('aria-label'))).click();");
  await waitFor(async () => /Message 2 of 3/.test(await text(sess, "[data-testid='studio-preview-name']")), { message: "message 2" });
  await captureDownloads(sess);
  await click(sess, "[data-testid='studio-download']");
  const file = await waitDownload(sess);
  assert.equal(file.name, `${name}-${new Date().toISOString().slice(0, 10)}-2.xml`);
  assert.equal(file.text.trim(), (await preview(sess)).trim());
});

test("MD23 Download all N saves one zip holding N files with the batch names", async (sess) => {
  const name = uniqueName("MdZip");
  await start(sess, { tile: CAMT, many: 4, name });
  await goTab(sess, "generate");
  await waitFor(async () => (await sampleNames(sess)).length === 4, { message: "samples" });
  await captureDownloads(sess);
  await click(sess, "[data-testid='studio-download-all']");
  const zip = await waitDownload(sess);
  assert.equal(zip.name, `${name.toLowerCase()}-batch.zip`);
  assert.equal(zip.magic.slice(0, 2), "PK");
  const today = new Date().toISOString().slice(0, 10);
  for (let i = 1; i <= 4; i++) assert.ok(zip.text.includes(`${name}-${today}-${i}.xml`), `${name}-${today}-${i}.xml missing from the zip`);
  assert.ok(!zip.text.includes(`${name}-${today}-5.xml`));
  assert.equal((zip.text.match(/<\?xml version/g) || []).length, 4, "four XML documents");
});

test("MD24 Undo and Redo step back and forward through the changes and the buttons enable accordingly", async (sess) => {
  await start(sess, { tile: PAIN });
  assert.equal(await sess.exec("return document.querySelector(\"button[aria-label='Redo']\").disabled;"), true);
  assert.equal(await headerCount(sess), 1);
  await click(sess, "button[aria-label='Undo']");
  await waitFor(async () => (await headerCount(sess)) === 0, { message: "Changes (0)" });
  assert.equal(await sess.exec("return document.querySelector(\"button[aria-label='Undo']\").disabled;"), true);
  assert.equal(await sess.exec("return document.querySelector(\"button[aria-label='Redo']\").disabled;"), false);
  await click(sess, "button[aria-label='Redo']");
  await waitFor(async () => (await headerCount(sess)) === 1, { message: "Changes (1) again" });
});

test("MD25 the Changes list names each change, marks where you are, and a line goes back to that point", async (sess) => {
  await start(sess, { tile: PAIN });
  await click(sess, "[data-testid='studio-changes-button']");
  const panel = await panelText(sess, "studio-changes");
  assert.match(panel, /Chose pain\.001\.001\.09/);
  assert.match(panel, /You are here/);
  assert.match(panel, /Start \(where this work began\)/);
  await sess.exec("[...document.querySelectorAll(\"[data-testid='studio-changes'] li button\")].find(b=>/where this work began/.test(b.textContent)).click();");
  await waitFor(async () => (await sess.exec("return document.querySelector(\"button[aria-label='Redo']\").disabled;")) === false, { message: "Redo to enable after going back" });
  await closePanel(sess);
  assert.equal(await headerCount(sess), 0);
});

test("MD26 the Glossary opens beside the studio, searches its words and closes", async (sess) => {
  await start(sess, { tile: PAIN });
  await click(sess, "[data-testid='studio-glossary-button']");
  const all = await panelText(sess, "studio-glossary");
  assert.match(all, /Definition[\s\S]*Scheme[\s\S]*Tag/);
  await setValue(sess, "[aria-label='Find a word']", "xyzzy-none");
  await waitFor(async () => /No word matches that search\./.test(await panelText(sess, "studio-glossary")), { message: "the empty result" });
  await setValue(sess, "[aria-label='Find a word']", "scheme");
  await waitFor(async () => { const t = await panelText(sess, "studio-glossary"); return /Scheme/.test(t) && !/No word matches/.test(t); }, { message: "the scheme entry" });
  await closePanel(sess);
});

test("MD27 Show technical details adds the path and type of a selected tag and the choice is kept", async (sess) => {
  await start(sess, { tile: CAMT });
  await sess.exec("const b=document.querySelector(\".sbe-studio-xml [data-field-id] .sbe-studio-tagbtn\");b.click();");
  await waitVisible(sess, "[data-testid='studio-explainer-name']");
  assert.equal(await count(sess, "[data-testid='studio-technical']"), 0);
  try {
    await sess.exec("[...document.querySelectorAll('label.sbe-studio-check')].find(l=>/Show technical details/.test(l.textContent)).querySelector('input').click();");
    await waitFor(() => exists(sess, "[data-testid='studio-technical']"), { message: "the technical details" });
    assert.match(await text(sess, "[data-testid='studio-technical']"), /Path/);
    assert.equal(await sess.exec("return localStorage.getItem('sbe.studio.technical');"), "1");
  } finally {
    await sess.exec("localStorage.removeItem('sbe.studio.technical');");
  }
});

test("MD28 Show tags I can add is on by default: it counts the optional tags and shows them as dashed 'not in your message' lines; turning it off hides them", async (sess) => {
  await start(sess, { tile: PAIN });
  const label = () => sess.exec("return [...document.querySelectorAll('label.sbe-studio-check')].map(l=>l.textContent.trim()).find(t=>/Show tags I can add/.test(t));");
  const box = () => sess.exec("return [...document.querySelectorAll('label.sbe-studio-check')].find(l=>/Show tags I can add/.test(l.textContent)).querySelector('input').checked;");
  assert.equal(await label(), "Show tags I can add (1)");
  assert.equal(await box(), true);
  await waitFor(async () => (await count(sess, ".sbe-studio-line.is-ghost")) > 0, { message: "ghost lines" });
  assert.match(await sess.exec("return document.querySelector(\".sbe-studio-line.is-ghost .sbe-studio-plain\").textContent;"), /not in your message/);
  assert.match(await text(sess, ".sbe-studio-legend"), /Not in your message/);
  await sess.exec("[...document.querySelectorAll('label.sbe-studio-check')].find(l=>/Show tags I can add/.test(l.textContent)).querySelector('input').click();");
  await waitFor(async () => (await count(sess, ".sbe-studio-line.is-ghost")) === 0, { message: "the ghost lines to go" });
  assert.doesNotMatch(await text(sess, ".sbe-studio-legend"), /Not in your message/);
});

/** Selects the optional BICFI ghost line and ticks "In my message". */
async function addBic(sess: Sess) {
  await waitFor(async () => (await count(sess, ".sbe-studio-line.is-ghost")) > 0, { message: "ghost lines" });
  await sess.exec("[...document.querySelectorAll('.sbe-studio-line.is-ghost .sbe-studio-tagbtn')].find(b=>/tag BICFI/.test(b.getAttribute('aria-label'))).click();");
  await waitVisible(sess, "input[aria-label='In my message']");
  await click(sess, "input[aria-label='In my message']");
}
test("MD29 adding an optional tag puts it in the message, counts a change and is saved with the definition", async (sess) => {
  const name = uniqueName("MdAdd");
  const def = await start(sess, { tile: PAIN, name });
  const before = def!.fieldCount;
  const changes = await headerCount(sess);
  await addBic(sess);
  await waitFor(async () => (await headerCount(sess)) === changes + 1, { message: "a new change" });
  assert.match(await text(sess, "[data-testid='studio-validity']"), /No problems found, 14 tags|No problems found, 13 tags/);
  assert.equal(await sess.exec("return document.querySelectorAll('.sbe-studio-line.is-ghost').length;"), 0, "the tag is no longer a ghost");
  await waitFor(async () => (await definitionRow(name))?.fieldCount === before + 1, { timeout: 15000, message: "the saved field count to grow by one" });
});

test("MD30 a required tag stays in: its In my message box is disabled with the reason", async (sess) => {
  await start(sess, { tile: PAIN });
  await sess.exec("document.querySelector(\".sbe-studio-line.is-required .sbe-studio-tagbtn\").click();");
  await waitVisible(sess, "input[aria-label='In my message']");
  assert.equal(await sess.exec("return document.querySelector(\"input[aria-label='In my message']\").disabled;"), true);
  assert.match(await sess.exec("return document.querySelector(\"[data-testid='studio-explainer']\").innerText;"), /A required tag stays in\./);
});

test("MD31 Browse all tags: the All, Mandatory and Optional filters count the scheme's tags", async (sess) => {
  await start(sess, { tile: PAIN });
  await openBrowse(sess);
  const labels = await sess.exec("return [...document.querySelectorAll('.sbe-fpick-bar button')].map(b=>b.textContent.trim());");
  assert.ok(labels.includes("All (13)") && labels.includes("Mandatory (12)") && labels.includes("Optional (1)"), labels.join());
  await waitFor(async () => /Selected 12 of 13 fields/.test(await pageText(sess)), { message: "the selected-fields count" });
  await pickerChip(sess, "Optional");
  await waitFor(async () => (await pickerRows(sess)).some((p) => p.endsWith("/BICFI")), { message: "the optional tag" });
  assert.ok(!(await pickerRows(sess)).some((p) => p.endsWith("/MsgId")), "required tags are hidden under Optional");
  await pickerChip(sess, "Mandatory");
  await waitFor(async () => !(await pickerRows(sess)).some((p) => p.endsWith("/BICFI")), { message: "the optional tag to go" });
  await pickerChip(sess, "All");
  await waitFor(async () => (await pickerRows(sess)).some((p) => p.endsWith("/BICFI")), { message: "everything again" });
});

test("MD32 Browse all tags: Find a field filters the tree and Tree / List change how the rows are laid out", async (sess) => {
  await start(sess, { tile: PAIN });
  await openBrowse(sess);
  const treeRows = (await pickerRows(sess)).length;
  await clickText(sess, ".opsc-viewtoggle button", "List");
  await waitFor(async () => (await pickerRows(sess)).length === 13, { message: "13 flat rows in List" });
  assert.ok((await pickerRows(sess)).length !== treeRows || treeRows === 13);
  assert.equal(await sess.exec("return [...document.querySelectorAll('.sbe-fpick-item')].every(e=>e.getAttribute('aria-expanded')===null);"), true, "the list has no groups");
  await setValue(sess, ".sbe-fpick input[type=search]", "IBAN");
  await waitFor(async () => (await pickerRows(sess)).length === 2, { message: "two IBAN rows" });
  assert.ok((await pickerRows(sess)).every((p) => /IBAN$/.test(p)));
  await setValue(sess, ".sbe-fpick input[type=search]", "");
  await clickText(sess, ".opsc-viewtoggle button", "Tree");
  await waitFor(async () => (await pickerRows(sess)).length === treeRows, { message: "the tree again" });
});

test("MD33 Browse all tags: Collapse all hides the children and Expand all shows them again", async (sess) => {
  await start(sess, { tile: PAIN });
  await openBrowse(sess);
  await clickText(sess, ".sbe-fpick-bar button", "Expand all");
  const open = (await pickerRows(sess)).length;
  await clickText(sess, ".sbe-fpick-bar button", "Collapse all");
  await waitFor(async () => (await pickerRows(sess)).length < open, { message: "fewer rows" });
  assert.equal((await pickerRows(sess)).length, 1, "only the root remains");
  await clickText(sess, ".sbe-fpick-bar button", "Expand all");
  await waitFor(async () => (await pickerRows(sess)).length === open, { message: "all rows" });
});

test("MD34 Browse all tags: an optional tag's Include box adds it, a required tag's box is disabled", async (sess) => {
  await start(sess, { tile: PAIN });
  await openBrowse(sess);
  assert.equal(await sess.exec("return document.querySelector(\".sbe-fpick-item[data-path$='/MsgId'] input.sbe-fpick-check\").disabled;"), true);
  const changes = await headerCount(sess);
  await sess.exec("document.querySelector(\".sbe-fpick-item[data-path$='/BICFI'] input.sbe-fpick-check\").click();");
  await waitFor(async () => (await headerCount(sess)) === changes + 1, { message: "a change for the added tag" });
  assert.equal(await sess.exec("return document.querySelector(\".sbe-fpick-item[data-path$='/BICFI'] input.sbe-fpick-check\").checked;"), true);
  assert.match(await text(sess, ".sbe-fpick-bar"), /Selected 13 of 13 fields/);
});

// ==========================================================================================
// Publish and datasets
// ==========================================================================================
test("MD35 Publish is off until a message is chosen, named and saved; it is off again once published", async (sess) => {
  await openStudio(sess, browser);
  assert.equal((await publishState(sess)).disabled, true);
  await chooseTile(sess, CAMT);
  await chooseMode(sess, false);
  assert.equal((await publishState(sess)).disabled, true, "chosen but not yet saved");
  assert.match(await saveStatusText(sess), /Unsaved changes|Saving/);
  const name = uniqueName("MdGate");
  await nameDefinition(sess, name);
  await savedDefinition(name);
  await waitFor(async () => (await publishState(sess)).disabled === false, { timeout: 15000, message: "Publish to enable once saved" });
  assert.equal((await publishState(sess)).label, "Publish");
  await click(sess, "[data-testid='studio-publish']");
  await waitPublished(sess, name);
  await waitFor(async () => (await publishState(sess)).disabled === true, { message: "Publish to disable" });
  assert.equal((await publishState(sess)).label, "Published");
  assert.equal(await studioAttr(sess, "data-state"), "active");
});

test("MD36 publishing, changing and publishing again makes a second dataset v2 and keeps v1", async (sess) => {
  const name = uniqueName("MdV2");
  const def = await start(sess, { tile: CAMT, name });
  await click(sess, "[data-testid='studio-publish']");
  const first = await waitPublished(sess, name);
  assert.equal(first.held, 1);
  await chooseMode(sess, true, { count: 3 });
  await waitFor(async () => (await publishState(sess)).disabled === false && (await publishState(sess)).label === "Publish changes", { timeout: 15000, message: "Publish changes to enable" });
  await click(sess, "[data-testid='studio-publish']");
  await waitFor(async () => (await datasetsLinkedTo(def!.id)).length === 2, { timeout: 40000, message: "two datasets linked to the definition" });
  const linked = (await datasetsLinkedTo(def!.id)).sort((a: { definition_version: string }, b: { definition_version: string }) => Number(a.definition_version) - Number(b.definition_version));
  assert.deepEqual(linked.map((d: { name: string }) => d.name), [`${name} v1`, `${name} v2`]);
  assert.deepEqual(linked.map((d: { definition_version: string }) => String(d.definition_version)), ["1", "2"]);
  await waitFor(async () => (await datasetsLinkedTo(def!.id)).every((d: { row_count: number }) => d.row_count > 0), { message: "both datasets filled" });
  const counts = (await datasetsLinkedTo(def!.id)).sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)).map((d: { row_count: number }) => d.row_count);
  assert.deepEqual(counts, [1, 3]);
  const list = rowsOf((await apiJson(`/api/v1/definitions/${def!.id}/datasets`)).body);
  assert.equal(list.length, 2);
  assert.equal((await definitionRow(name))?.version, "2");
});

test("MD37 Choose a dataset lists the datasets and adds the messages to a new dataset", async (sess) => {
  const name = uniqueName("MdDs"), target = uniqueName("MdDsNew");
  await start(sess, { tile: CAMT, many: 3, name });
  await goTab(sess, "generate");
  await openMore(sess);
  assert.equal(await sess.exec("return document.querySelector(\"[data-testid='studio-dataset'] p\").textContent;"), "Adds all 3 messages to a dataset you choose.");
  await clickText(sess, "button", "Choose a dataset");
  await waitVisible(sess, "select[aria-label='Dataset']");
  const options = await sess.exec("return [...document.querySelectorAll(\"select[aria-label='Dataset'] option\")].map(o=>o.textContent);");
  assert.equal(options[0], "Choose a dataset");
  assert.equal(options[options.length - 1], "A new dataset…");
  const api = rowsOf((await apiJson("/api/v1/datasets")).body);
  assert.ok(options.length - 2 <= api.length + 3 && options.length - 2 >= 1);
  assert.equal(await sess.exec("return document.querySelector(\"[data-testid='studio-save-dataset']\").disabled;"), true, "Add is off until a dataset is chosen");
  await selectOption(sess, "select[aria-label='Dataset']", "A new dataset…");
  await setValue(sess, "input[aria-label='Name of the new dataset']", target);
  await click(sess, "[data-testid='studio-save-dataset']");
  await waitFor(async () => (await apiJson("/api/v1/datasets")).body && rowsOf((await apiJson("/api/v1/datasets")).body).some((d: { name: string; row_count: number }) => d.name === target && d.row_count === 3), { timeout: 20000, message: "the new dataset with 3 messages" });
  const ds = rowsOf((await apiJson("/api/v1/datasets")).body).find((d: { name: string }) => d.name === target);
  assert.equal(ds.message_type_code, CAMT);
  assert.equal(rowsOf((await apiJson(`/api/v1/datasets/${ds.id}/messages`)).body).length, 3);
});

test("MD38 a new dataset needs a name: Add says so and creates nothing", async (sess) => {
  await start(sess, { tile: CAMT });
  await goTab(sess, "generate");
  await openMore(sess);
  await clickText(sess, "button", "Choose a dataset");
  await waitVisible(sess, "select[aria-label='Dataset']");
  const before = rowsOf((await apiJson("/api/v1/datasets")).body).length;
  await selectOption(sess, "select[aria-label='Dataset']", "A new dataset…");
  await click(sess, "[data-testid='studio-save-dataset']");
  await waitFor(async () => /Give the new dataset a name\./.test(await sess.exec("return document.body.innerText;")), { message: "the naming message" });
  assert.equal(rowsOf((await apiJson("/api/v1/datasets")).body).length, before);
});

test("MD39 Choose a system lists the enabled external systems and Send stays off until one is chosen", async (sess) => {
  await start(sess, { tile: CAMT });
  await goTab(sess, "generate");
  await openMore(sess);
  await click(sess, "[data-testid='studio-send']");
  await waitVisible(sess, "select[aria-label='Delivery target']");
  await waitFor(async () => (await count(sess, "select[aria-label='Delivery target'] option")) > 1, { message: "the targets to load" });
  const shown = await sess.exec("return [...document.querySelectorAll(\"select[aria-label='Delivery target'] option\")].map(o=>o.textContent).slice(1);");
  const api = rowsOf((await apiJson("/api/v1/external-systems")).body).filter((s: { enabled?: boolean }) => s.enabled !== false).map((s: { name: string }) => s.name);
  assert.equal(shown.length, api.length);
  for (const n of api) assert.ok(shown.includes(n), `${n} not offered`);
  assert.equal(await sess.exec("return [...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Send messages').disabled;"), true);
  assert.match(await sess.exec("return document.querySelector(\"section[aria-label='Send generated messages'] p[role=status]\").textContent;"), /Choose a test target\. Nothing has been sent\./);
  await clickText(sess, "button", "Close");
  await waitFor(async () => !(await exists(sess, "select[aria-label='Delivery target']")), { message: "the send panel to close" });
});

test("MD40 Send messages to a test system reports how many messages were accepted, or why not", { todo: "Send messages POSTs /api/v1/external-systems/:id/send, a route that is never registered (404), so no target can ever accept a message" }, async (sess) => {
  await start(sess, { tile: CAMT });
  await goTab(sess, "generate");
  await openMore(sess);
  await click(sess, "[data-testid='studio-send']");
  await waitVisible(sess, "select[aria-label='Delivery target']");
  await waitFor(async () => (await count(sess, "select[aria-label='Delivery target'] option")) > 1, { message: "the targets to load" });
  await selectOption(sess, "select[aria-label='Delivery target']", "Dummy FTP drop");
  await clickText(sess, "button", "Send messages");
  const status = await waitFor(async () => { const t = await sess.exec("return document.querySelector(\"section[aria-label='Send generated messages'] p[role=status]\").textContent;"); return /accepted|failed/i.test(t) ? t : null; }, { message: "the send outcome" });
  const route = await apiJson("/api/v1/external-systems/ext_ftp/send", { method: "POST" });
  assert.notEqual(route.status, 404, `Send messages calls POST /send, which answers 404; the page said: ${status}`);
});

void chipLabels; void visible; void sleep; void definitionFull;
