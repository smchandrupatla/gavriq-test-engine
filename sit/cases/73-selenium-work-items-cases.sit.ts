// Business flows for the test-authoring screens: Test suites (TS) and Test cases (TC).
// Standalone documents opened after console sign-in; every case is a GUI action followed by an
// INDEPENDENT API confirmation (/api/v1/test-suites, /api/v1/test-cases). Names are unique per run.
import { after, test } from "node:test";
import assert from "node:assert/strict";
import { apiJson, click, count, pageText, saveShot, setValue, sharedBrowser, sleep, text, typeInto, value, visible, waitFor } from "../lib/selenium/flow.mjs";
import {
  apiTestCase, byName, countByName, ENTER, listOf, makeSuite, makeTestCase, raw, ready, tcAddStep, tcId, tcInsertTemplate,
  tcOpen, tcPriority, tcRowsShown, tcStatus, tcStepTexts, tcTag, tcTags, tcTitle, tcValidationText, tcVisibility, tcWaitStatus,
  uniqueName, waitByName,
} from "../lib/selenium/work-items.mjs";

const browser = sharedBrowser({ prompts: true });
after(() => browser.close());

async function gui(name: string, t: { skip: (m?: string) => void }, body: (sess: any) => Promise<void>) {
  if (!(await browser.available(`work-items-cases-${name}`))) { t.skip(browser.reason); return; }
  const sess = await browser.signedIn();
  try { await body(sess); }
  catch (error) { await saveShot(sess, `work-items-cases-${name}`); throw error; }
}

// ==========================================================================================
// TEST SUITES
// ==========================================================================================
async function suiteForm(sess: any, o: { name?: string; filter?: string; pick?: string[]; submit?: boolean }) {
  await browser.open("/test-suite-form.html");
  await ready(sess, "#f-name");
  await waitFor(async () => (await count(sess, ".member-case")) > 0, { message: "cases listed" });
  if (o.name !== undefined) await typeInto(sess, "#f-name", o.name);
  if (o.filter !== undefined) await typeInto(sess, "#case-filter", o.filter);
  for (const id of o.pick || []) {
    await waitFor(async () => (await count(sess, `.member-case[value="${id}"]`)) === 1, { message: `case ${id}` });
    await click(sess, `.member-case[value="${id}"]`);
  }
  if (o.submit !== false) await click(sess, "#create-btn");
}

test("TS1 create a test suite with two selected cases: it is stored with exactly those cases and listed", async (t) => {
  await gui("ts1", t, async (sess) => {
    const a = await makeTestCase(uniqueName("SitTsA"));
    const b = await makeTestCase(uniqueName("SitTsB"));
    const name = uniqueName("SitSuite");
    await suiteForm(sess, { name, filter: "SitTs", pick: [a.id, b.id] });
    const row = await waitByName("/api/v1/test-suites", name);
    assert.deepEqual([...row.case_ids].sort(), [a.id, b.id].sort());
    assert.equal(row.status, "active");
    await waitFor(async () => (await sess.url()).endsWith("/test-suites.html"), { message: "redirect to Test suites" });
    await waitFor(async () => (await count(sess, `#suite-rows tr[data-id="${row.id}"]`)) === 1, { message: "the suite in the list" });
    assert.match(await raw(sess, `#suite-rows tr[data-id="${row.id}"]`), /2 cases/);
  });
});

test("TS2 a suite needs a name: the page says so and stores nothing", async (t) => {
  await gui("ts2", t, async (sess) => {
    const c = await makeTestCase(uniqueName("SitTsNoName"));
    const before = (await listOf("/api/v1/test-suites")).length;
    await suiteForm(sess, { filter: c.id, pick: [c.id] });
    await waitFor(async () => (await raw(sess, "#status-msg")) === "Suite name is required.", { message: "name required message" });
    assert.ok((await sess.url()).includes("/test-suite-form.html"));
    await sleep(400);
    assert.equal((await listOf("/api/v1/test-suites")).length, before);
  });
});

test("TS3 a suite without any case is accepted (cases are optional) and lists 0 cases", async (t) => {
  await gui("ts3", t, async (sess) => {
    const name = uniqueName("SitSuiteEmpty");
    await suiteForm(sess, { name });
    const row = await waitByName("/api/v1/test-suites", name);
    assert.deepEqual(row.case_ids, []);
    await waitFor(async () => (await sess.url()).endsWith("/test-suites.html"), { message: "redirect" });
    await waitFor(async () => (await count(sess, `#suite-rows tr[data-id="${row.id}"]`)) === 1, { message: "listed" });
    assert.match(await raw(sess, `#suite-rows tr[data-id="${row.id}"]`), /0 cases/);
  });
});

test("TS4 the case filter narrows the picker by name or id and clearing it restores every case", async (t) => {
  await gui("ts4", t, async (sess) => {
    const a = await makeTestCase(uniqueName("SitTsFiltA"));
    await browser.open("/test-suite-form.html");
    await ready(sess, "#case-filter");
    await waitFor(async () => (await count(sess, ".member-case")) > 3, { message: "cases" });
    const all = await count(sess, ".member-case");
    await typeInto(sess, "#case-filter", a.name);
    await waitFor(async () => (await count(sess, ".member-case")) === 1, { message: "one match by name" });
    await typeInto(sess, "#case-filter", a.id.toUpperCase());
    await waitFor(async () => (await count(sess, ".member-case")) === 1, { message: "one match by id, case-insensitive" });
    await typeInto(sess, "#case-filter", "zzz-no-such-case-zzz");
    await waitFor(async () => (await count(sess, ".member-case")) === 0, { message: "no match" });
    await setValue(sess, "#case-filter", "");
    await waitFor(async () => (await count(sess, ".member-case")) === all, { message: "full list restored" });
  });
});

test("TS5 the picker shows how many cases are selected", async (t) => {
  await gui("ts5", t, async (sess) => {
    const a = await makeTestCase(uniqueName("SitTsCntA"));
    const b = await makeTestCase(uniqueName("SitTsCntB"));
    await suiteForm(sess, { filter: "SitTsCnt", pick: [a.id], submit: false });
    await waitFor(async () => (await raw(sess, "#case-count")) === "(1 selected)", { message: "1 selected" });
    await click(sess, `.member-case[value="${b.id}"]`);
    await waitFor(async () => (await raw(sess, "#case-count")) === "(2 selected)", { message: "2 selected" });
    await click(sess, `.member-case[value="${a.id}"]`);
    await waitFor(async () => (await raw(sess, "#case-count")) === "(1 selected)", { message: "back to 1" });
  });
});

test("TS6 cases ticked before changing the filter stay selected and are saved", { todo: "test-suite-form.html re-renders the picker on every filter change and drops the checkboxes' state, so a case ticked before filtering is silently not saved" }, async (t) => {
  await gui("ts6", t, async (sess) => {
    const a = await makeTestCase(uniqueName("SitTsKeepA"));
    const b = await makeTestCase(uniqueName("SitTsKeepB"));
    const name = uniqueName("SitSuiteKeep");
    await browser.open("/test-suite-form.html");
    await ready(sess, "#f-name");
    await typeInto(sess, "#f-name", name);
    await typeInto(sess, "#case-filter", a.id);
    await waitFor(async () => (await count(sess, ".member-case")) === 1, { message: "filtered to A" });
    await click(sess, `.member-case[value="${a.id}"]`);
    await typeInto(sess, "#case-filter", b.id);
    await waitFor(async () => (await count(sess, `.member-case[value="${b.id}"]`)) === 1, { message: "filtered to B" });
    await click(sess, `.member-case[value="${b.id}"]`);
    await click(sess, "#create-btn");
    const row = await waitByName("/api/v1/test-suites", name);
    assert.deepEqual([...row.case_ids].sort(), [a.id, b.id].sort());
  });
});

test("TS7 Test suites search finds the new suite and clearing restores the list", async (t) => {
  await gui("ts7", t, async (sess) => {
    const c = await makeTestCase(uniqueName("SitTsSrchCase"));
    const s = await makeSuite(uniqueName("SitSuiteSearch"), [c.id]);
    await browser.open("/test-suites.html");
    await waitFor(async () => (await count(sess, "#suite-rows tr.suite-row")) > 1, { message: "suites listed" });
    const all = await count(sess, "#suite-rows tr.suite-row");
    await typeInto(sess, "#search", s.name);
    await waitFor(async () => (await count(sess, "#suite-rows tr.suite-row")) === 1, { message: "one row" });
    assert.match(await raw(sess, "#suite-rows tr.suite-row"), /1 case/);
    await setValue(sess, "#search", "");
    await waitFor(async () => (await count(sess, "#suite-rows tr.suite-row")) === all, { message: "all rows again" });
  });
});

test("TS8 two suites may share a name and are stored as separate suites", async (t) => {
  await gui("ts8", t, async (sess) => {
    const name = uniqueName("SitSuiteTwin");
    await suiteForm(sess, { name });
    await waitByName("/api/v1/test-suites", name);
    await suiteForm(sess, { name });
    await waitFor(async () => (await countByName("/api/v1/test-suites", name)) === 2, { message: "two suites" });
    const ids = (await listOf("/api/v1/test-suites")).filter((s: any) => s.name === name).map((s: any) => s.id);
    assert.equal(new Set(ids).size, 2);
  });
});

test("TS9 the suite form is refused an unknown case id with a validation error rather than a server error", { todo: "POST /api/v1/test-suites with an unknown case id answers 500 internal instead of a 422 naming the case" }, async (t) => {
  await gui("ts9", t, async () => {
    const res = await apiJson("/api/v1/test-suites", { method: "POST", body: JSON.stringify({ name: uniqueName("SitSuiteBadCase"), caseIds: ["no-such-case-zzz"] }) });
    assert.equal(res.status, 422, JSON.stringify(res.body));
  });
});

// ==========================================================================================
// TEST CASES
// ==========================================================================================
const SAVE_DRAFT = "#btn-save-draft";
async function newCase(sess: any, o: { title: string; priority?: string; visibility?: string }) {
  await tcOpen(browser, sess);
  await tcTitle(sess, o.title);
  if (o.priority) await tcPriority(sess, o.priority);
  if (o.visibility) await tcVisibility(sess, o.visibility);
  return tcId(sess);
}
async function saveDraft(sess: any, id: string) {
  await click(sess, SAVE_DRAFT);
  await tcWaitStatus(sess, new RegExp(`Saved ${id}`));
  return waitFor(() => apiTestCase(id), { message: `test case ${id} in the API` });
}

test("TC1 a title alone is enough for Save as draft: the case is stored as a draft with the defaults", async (t) => {
  await gui("tc1", t, async (sess) => {
    const title = uniqueName("SitTcDraft");
    const id = await newCase(sess, { title });
    assert.equal(id, title.toLowerCase(), "the Test ID is suggested from the title");
    const row = await saveDraft(sess, id);
    assert.equal(row.name, title);
    assert.deepEqual([row.status, row.priority, row.visibility], ["draft", "Medium", "Team"]);
    assert.deepEqual(row.tags, []);
    assert.deepEqual(row.steps, []);
    assert.ok((await raw(sess, "#mode-kicker")).includes("EDIT"), "the form switches to edit after the first save");
    assert.ok((await sess.url()).includes(`?id=${id}`));
  });
});

test("TC2 priority Critical with visibility Public is stored as chosen", async (t) => {
  await gui("tc2", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcCritPub"), priority: "Critical", visibility: "Public" });
    const row = await saveDraft(sess, id);
    assert.deepEqual([row.priority, row.visibility], ["Critical", "Public"]);
  });
});

test("TC3 priority High with visibility Team is stored as chosen", async (t) => {
  await gui("tc3", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcHighTeam"), priority: "High", visibility: "Team" });
    const row = await saveDraft(sess, id);
    assert.deepEqual([row.priority, row.visibility], ["High", "Team"]);
  });
});

test("TC4 priority Medium with visibility Private is stored as chosen", async (t) => {
  await gui("tc4", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcMedPriv"), priority: "Medium", visibility: "Private" });
    const row = await saveDraft(sess, id);
    assert.deepEqual([row.priority, row.visibility], ["Medium", "Private"]);
  });
});

test("TC5 priority Low is stored as chosen", async (t) => {
  await gui("tc5", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcLow"), priority: "Low", visibility: "Public" });
    const row = await saveDraft(sess, id);
    assert.deepEqual([row.priority, row.visibility], ["Low", "Public"]);
  });
});

test("TC6 every descriptive field is stored: owner, component, environment, duration, tags, preconditions and notes", async (t) => {
  await gui("tc6", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcFull"), priority: "High", visibility: "Private" });
    await typeInto(sess, "#f-owner", "sit.owner");
    await typeInto(sess, "#f-component", "Payments");
    await typeInto(sess, "#f-environment", "UAT");
    const { selectOption } = await import("../lib/selenium/flow.mjs");
    await selectOption(sess, "#f-duration", "5-15m");
    await tcTag(sess, "regression");
    await tcTag(sess, "smoke");
    await typeInto(sess, "#f-preconditions", "Account exists and is unlocked");
    await typeInto(sess, "#f-testdata", "user: demo_acme_qa");
    await click(sess, "details.accordion > summary");
    await typeInto(sess, "#f-flaky-notes", "Fails on slow CI");
    await typeInto(sess, "#f-workarounds", "Rerun once");
    await typeInto(sess, "#f-causes", "Timeouts");
    const row = await saveDraft(sess, id);
    assert.equal(row.owner, "sit.owner");
    assert.equal(row.component, "Payments");
    assert.equal(row.environment, "UAT");
    assert.equal(row.estimated_duration, "5-15m");
    assert.deepEqual(row.tags, ["regression", "smoke"]);
    assert.equal(row.preconditions, "Account exists and is unlocked");
    assert.equal(row.test_data, "user: demo_acme_qa");
    assert.equal(row.flakiness_notes, "Fails on slow CI");
    assert.equal(row.known_workarounds, "Rerun once");
    assert.equal(row.common_failure_causes, "Timeouts");
  });
});

test("TC7 reopening a saved case shows exactly the values that were saved", async (t) => {
  await gui("tc7", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcRound"), priority: "Critical", visibility: "Public" });
    await typeInto(sess, "#f-owner", "round.owner");
    await typeInto(sess, "#f-component", "Sanctions");
    await typeInto(sess, "#f-environment", "SIT");
    await tcTag(sess, "roundtrip");
    await typeInto(sess, "#f-preconditions", "Precondition text");
    await tcAddStep(sess, { text: "Open the page", expected: "Page opens", testData: "n/a" });
    await typeInto(sess, "#f-automation", "https://ci.example/job/round");
    const saved = await saveDraft(sess, id);
    await tcOpen(browser, sess, `?id=${id}`);
    await waitFor(async () => (await value(sess, "#f-title")) === saved.name, { message: "the form is populated" });
    assert.equal(await value(sess, "#f-id"), id);
    assert.equal(await sess.exec("return document.querySelector('input[name=priority]:checked').value;"), "Critical");
    assert.equal(await sess.exec("return document.querySelector('input[name=visibility]:checked').value;"), "Public");
    assert.equal(await value(sess, "#f-owner"), "round.owner");
    assert.equal(await value(sess, "#f-component"), "Sanctions");
    assert.equal(await value(sess, "#f-environment"), "SIT");
    assert.deepEqual(await tcTags(sess), ["roundtrip"]);
    assert.equal(await value(sess, "#f-preconditions"), "Precondition text");
    assert.deepEqual(await tcStepTexts(sess), ["Open the page"]);
    assert.equal(await value(sess, "#f-automation"), "https://ci.example/job/round");
    assert.equal(await sess.exec("return document.getElementById('f-id').disabled;"), true, "the Test ID is locked after creation");
  });
});

test("TC8 Add step appends numbered steps and their text, expected result and data are stored in order", async (t) => {
  await gui("tc8", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcSteps") });
    await tcAddStep(sess, { text: "First step", expected: "First result", testData: "d1" });
    await tcAddStep(sess, { text: "Second step", expected: "Second result" });
    assert.equal(await count(sess, ".step-card"), 2);
    const row = await saveDraft(sess, id);
    assert.deepEqual(row.steps.map((s: any) => [s.text, s.expected, s.testData]), [["First step", "First result", "d1"], ["Second step", "Second result", ""]]);
  });
});

test("TC9 the Login flow template inserts its two steps", async (t) => {
  await gui("tc9", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcTplLogin") });
    await tcInsertTemplate(sess, "login");
    await waitFor(async () => (await count(sess, ".step-card")) === 2, { message: "two steps" });
    const row = await saveDraft(sess, id);
    assert.deepEqual(row.steps.map((s: any) => s.text), ["Navigate to the login page", "Enter valid credentials and submit"]);
    assert.equal(row.steps[1].testData, "user: demo_acme_qa");
  });
});

test("TC10 the API smoke template inserts its two steps", async (t) => {
  await gui("tc10", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcTplApi") });
    await tcInsertTemplate(sess, "api");
    await waitFor(async () => (await count(sess, ".step-card")) === 2, { message: "two steps" });
    const row = await saveDraft(sess, id);
    assert.deepEqual(row.steps.map((s: any) => s.text), ["Send request to the endpoint", "Verify response payload shape"]);
    assert.equal(row.steps[0].expected, "200 response within SLA");
  });
});

test("TC11 the Form validation template inserts its two steps, and templates stack after existing steps", async (t) => {
  await gui("tc11", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcTplForm") });
    await tcAddStep(sess, { text: "My own step", expected: "ok" });
    await tcInsertTemplate(sess, "form");
    await waitFor(async () => (await count(sess, ".step-card")) === 3, { message: "three steps" });
    const row = await saveDraft(sess, id);
    assert.deepEqual(row.steps.map((s: any) => s.text), ["My own step", "Submit the form with valid data", "Submit the form with invalid data"]);
  });
});

test("TC12 steps can be moved down and removed, and the stored order follows", async (t) => {
  await gui("tc12", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcMove") });
    await tcAddStep(sess, { text: "one" });
    await tcAddStep(sess, { text: "two" });
    await tcAddStep(sess, { text: "three" });
    await click(sess, '.step-card[data-i="0"] button[data-act=down]');
    await waitFor(async () => JSON.stringify(await tcStepTexts(sess)) === JSON.stringify(["two", "one", "three"]), { message: "one moved down" });
    await click(sess, '.step-card[data-i="2"] button[data-act=remove]');
    await waitFor(async () => (await count(sess, ".step-card")) === 2, { message: "one step removed" });
    const row = await saveDraft(sess, id);
    assert.deepEqual(row.steps.map((s: any) => s.text), ["two", "one"]);
  });
});

test("TC13 a dependency chosen by name is stored as that case's id", async (t) => {
  await gui("tc13", t, async (sess) => {
    const dep = await makeTestCase(uniqueName("SitTcDepTarget"));
    const id = await newCase(sess, { title: uniqueName("SitTcDep") });
    await typeInto(sess, "#f-dep-input", dep.name + ENTER);
    await waitFor(async () => (await count(sess, "#deps-row .tag-chip")) === 1, { message: "a dependency chip" });
    assert.ok((await text(sess, "#deps-row")).includes(dep.name));
    const row = await saveDraft(sess, id);
    assert.deepEqual(row.dependency_ids, [dep.id]);
  });
});

test("TC14 a dependency that matches no case is refused with a message and adds nothing", async (t) => {
  await gui("tc14", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcDepBad") });
    await typeInto(sess, "#f-dep-input", "no-such-case-zzz" + ENTER);
    await tcWaitStatus(sess, /No matching test case found/);
    assert.equal(await count(sess, "#deps-row .tag-chip"), 0);
    const row = await saveDraft(sess, id);
    assert.deepEqual(row.dependency_ids, []);
  });
});

test("TC15 Validate format accepts a CI job URL and a script path", async (t) => {
  await gui("tc15", t, async (sess) => {
    await newCase(sess, { title: uniqueName("SitTcLinkOk") });
    await typeInto(sess, "#f-automation", "https://ci.example/job/login");
    await click(sess, "#validate-link");
    assert.match(await text(sess, "#link-status"), /Looks like a valid CI job URL/);
    await typeInto(sess, "#f-automation", "suites/auth/login.spec.ts");
    await click(sess, "#validate-link");
    assert.match(await text(sess, "#link-status"), /Looks like a valid script path/);
    await typeInto(sess, "#f-automation", "run_checks.sh");
    await click(sess, "#validate-link");
    assert.match(await text(sess, "#link-status"), /valid script path/);
  });
});

test("TC16 Validate format rejects text that is not a URL or script, and asks for a value when empty", async (t) => {
  await gui("tc16", t, async (sess) => {
    await newCase(sess, { title: uniqueName("SitTcLinkBad") });
    await click(sess, "#validate-link");
    assert.match(await text(sess, "#link-status"), /Enter a link or command first/);
    await typeInto(sess, "#f-automation", "just some words");
    await click(sess, "#validate-link");
    assert.match(await text(sess, "#link-status"), /Doesn't look like a URL or recognizable script path/);
    await typeInto(sess, "#f-automation", "ftp://host/file");
    await click(sess, "#validate-link");
    assert.match(await text(sess, "#link-status"), /Doesn't look like/);
  });
});

test("TC17 Preview shows the case as a card with title, priority, owner, environment and tags, and toggles off", async (t) => {
  await gui("tc17", t, async (sess) => {
    const title = uniqueName("SitTcPreview");
    await newCase(sess, { title, priority: "High" });
    await typeInto(sess, "#f-owner", "prev.owner");
    await typeInto(sess, "#f-environment", "UAT");
    await tcTag(sess, "prev");
    await typeInto(sess, "#f-preconditions", "Some precondition");
    await click(sess, "#btn-preview");
    await waitFor(() => visible(sess, "#preview-card"), { message: "preview card" });
    const card = await text(sess, "#preview-card");
    for (const part of [title, "High", "prev.owner", "UAT", "#prev", "Some precondition"]) assert.ok(card.includes(part), `preview should show ${part}: ${card}`);
    await click(sess, "#btn-preview");
    await waitFor(async () => !(await visible(sess, "#preview-panel")), { message: "preview hidden" });
  });
});

test("TC18 Validate without a title reports the error and the non-blocking warnings", async (t) => {
  await gui("tc18", t, async (sess) => {
    await tcOpen(browser, sess);
    await click(sess, "#btn-validate");
    const panel = await tcValidationText(sess);
    assert.match(panel, /Fix these before saving/);
    assert.match(panel, /Title is required\./);
    assert.match(panel, /No steps defined yet/);
    assert.match(panel, /No overall test data specified/);
    assert.match(panel, /No automation link set/);
  });
});

test("TC19 Validate on a complete case says it looks good", async (t) => {
  await gui("tc19", t, async (sess) => {
    await newCase(sess, { title: uniqueName("SitTcValid") });
    await tcAddStep(sess, { text: "Do it", expected: "It works" });
    await typeInto(sess, "#f-testdata", "some data");
    await typeInto(sess, "#f-automation", "https://ci.example/job/ok");
    await click(sess, "#btn-validate");
    assert.match(await tcValidationText(sess), /Looks good — no issues found\./);
  });
});

test("TC20 Validate warns about a step with no description or expected result", async (t) => {
  await gui("tc20", t, async (sess) => {
    await newCase(sess, { title: uniqueName("SitTcWarn") });
    await tcAddStep(sess, {});
    await click(sess, "#btn-validate");
    const panel = await tcValidationText(sess);
    assert.match(panel, /Non-blocking warnings/);
    assert.match(panel, /Step 1 has no description/);
    assert.match(panel, /Step 1 is missing an expected result/);
  });
});

test("TC21 a case cannot be saved without a title, by any of the three save buttons, and nothing is created", async (t) => {
  await gui("tc21", t, async (sess) => {
    const before = (await listOf("/api/v1/test-cases")).length;
    await tcOpen(browser, sess);
    for (const button of ["#btn-save-draft", "#btn-save-close", "#btn-create-run"]) {
      await click(sess, button);
      await tcWaitStatus(sess, /Fix the errors above before saving\./);
      assert.match(await tcValidationText(sess), /Title is required\./);
      assert.ok((await sess.url()).includes("/test-case-form.html"), `${button} must not navigate away`);
      await sess.exec("document.getElementById('status-msg').textContent='';");
    }
    await sleep(400);
    assert.equal((await listOf("/api/v1/test-cases")).length, before);
  });
});

test("TC22 Save and close stores the case as active, returns to Browse test cases and lists it", async (t) => {
  await gui("tc22", t, async (sess) => {
    const title = uniqueName("SitTcClose");
    const id = await newCase(sess, { title, priority: "High" });
    await click(sess, "#btn-save-close");
    await waitFor(async () => (await sess.url()).endsWith("/test-cases.html"), { message: "redirect to Browse" });
    const row = await apiTestCase(id);
    assert.deepEqual([row?.name, row?.status, row?.priority], [title, "active", "High"]);
    await waitFor(async () => (await tcRowsShown(sess)).includes(id), { message: "the case in Browse" });
  });
});

test("TC23 Save and Run stores the case active and queues a run that the case's run history shows", async (t) => {
  await gui("tc23", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcRun") });
    await typeInto(sess, "#f-environment", "UAT");
    await click(sess, "#btn-create-run");
    await tcWaitStatus(sess, new RegExp(`Saved and run queued for ${id}`));
    assert.equal((await apiTestCase(id))?.status, "active");
    const runs = await waitFor(async () => { const r = await apiJson(`/api/v1/test-cases/${id}/runs`); const rows = r.body?.data || []; return rows.length ? rows : null; }, { message: "a run for the case" });
    assert.equal(runs[0].case_id, id);
    assert.equal(runs[0].environment, "UAT");
  });
});

test("TC24 a custom Test ID is checked live: a free id is Available and is used as the case id", async (t) => {
  await gui("tc24", t, async (sess) => {
    const custom = uniqueName("sit-custom-").toLowerCase();
    await tcOpen(browser, sess);
    await tcTitle(sess, uniqueName("SitTcCustomId"));
    await typeInto(sess, "#f-id", custom);
    await waitFor(async () => (await raw(sess, "#id-status")) === "Available", { message: "id Available" });
    const row = await saveDraft(sess, custom);
    assert.equal(row.id, custom);
  });
});

test("TC25 a Test ID that is already in use is flagged and blocks the save", async (t) => {
  await gui("tc25", t, async (sess) => {
    const taken = await makeTestCase(uniqueName("SitTcTaken"));
    const before = (await listOf("/api/v1/test-cases")).length;
    await tcOpen(browser, sess);
    await tcTitle(sess, uniqueName("SitTcDupId"));
    await typeInto(sess, "#f-id", taken.id);
    await waitFor(async () => (await raw(sess, "#id-status")) === "Already in use", { message: "id Already in use" });
    await click(sess, SAVE_DRAFT);
    await tcWaitStatus(sess, /Fix the errors above before saving\./);
    assert.match(await tcValidationText(sess), /Test ID: Already in use\./);
    await sleep(400);
    assert.equal((await listOf("/api/v1/test-cases")).length, before);
  });
});

test("TC26 an invalid Test ID format is flagged", async (t) => {
  await gui("tc26", t, async (sess) => {
    await tcOpen(browser, sess);
    await tcTitle(sess, uniqueName("SitTcBadId"));
    await typeInto(sess, "#f-id", "Bad Id With Spaces!");
    await waitFor(async () => (await raw(sess, "#id-status")) === "Invalid format", { message: "Invalid format" });
  });
});

test("TC27 saving twice updates the same case instead of creating a second one, and the title change is stored", async (t) => {
  await gui("tc27", t, async (sess) => {
    const title = uniqueName("SitTcTwice");
    const id = await newCase(sess, { title });
    await saveDraft(sess, id);
    const renamed = `${title}Renamed`;
    await tcTitle(sess, renamed);
    await tcPriority(sess, "Critical");
    await click(sess, "#btn-save-close");
    await waitFor(async () => (await sess.url()).endsWith("/test-cases.html"), { message: "redirect" });
    const row = await apiTestCase(id);
    assert.deepEqual([row?.name, row?.priority, row?.status], [renamed, "Critical", "active"]);
    assert.equal((await listOf("/api/v1/test-cases")).filter((c: any) => c.id === id).length, 1);
  });
});

test("TC28 adding a duplicate tag is ignored and a tag can be removed with its x", async (t) => {
  await gui("tc28", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcTags") });
    await tcTag(sess, "alpha");
    await tcTag(sess, "alpha");
    await tcTag(sess, "beta");
    await tcTag(sess, "gamma,");
    await waitFor(async () => (await tcTags(sess)).length === 3, { message: "three unique tags" });
    assert.deepEqual(await tcTags(sess), ["alpha", "beta", "gamma"]);
    await click(sess, '#tags-row .tag-chip:nth-of-type(2) button');
    await waitFor(async () => (await tcTags(sess)).length === 2, { message: "one removed" });
    const row = await saveDraft(sess, id);
    assert.deepEqual(row.tags, ["alpha", "gamma"]);
  });
});

test("TC29 Clone opens the form with the source values and a ' copy' title, and saving makes a separate case", async (t) => {
  await gui("tc29", t, async (sess) => {
    const src = await makeTestCase(uniqueName("SitTcSource"), { priority: "High", owner: "clone.owner", tags: ["cl"] });
    await tcOpen(browser, sess, `?clone=${src.id}`);
    await waitFor(async () => (await value(sess, "#f-title")) === `${src.name} copy`, { message: "cloned title" });
    assert.equal(await value(sess, "#f-owner"), "clone.owner");
    assert.equal(await sess.exec("return document.querySelector('input[name=priority]:checked').value;"), "High");
    const id = await tcId(sess);
    assert.notEqual(id, src.id);
    const row = await saveDraft(sess, id);
    assert.equal(row.name, `${src.name} copy`);
    assert.equal(row.owner, "clone.owner");
    assert.ok(await apiTestCase(src.id), "the source case is untouched");
  });
});

test("TC30 Browse test cases lists a new case and its search narrows to it and clears", async (t) => {
  await gui("tc30", t, async (sess) => {
    const c = await makeTestCase(uniqueName("SitTcBrowse"), { priority: "Low" });
    await browser.open("/test-cases.html");
    await waitFor(async () => (await tcRowsShown(sess)).includes(c.id), { message: "the case in Browse" });
    const all = (await tcRowsShown(sess)).length;
    await typeInto(sess, "#search", c.name);
    await waitFor(async () => JSON.stringify(await tcRowsShown(sess)) === JSON.stringify([c.id]), { message: "only the match" });
    await setValue(sess, "#search", "");
    await waitFor(async () => (await tcRowsShown(sess)).length === all, { message: "the full list is back" });
  });
});

test("TC31 the owner is pre-filled with the signed-in user on a new case", async (t) => {
  await gui("tc31", t, async (sess) => {
    await tcOpen(browser, sess);
    const me = await apiJson("/api/v1/session/me");
    const username = me.body?.username || me.body?.data?.username;
    assert.ok(username, "the API knows who is signed in");
    assert.equal(await value(sess, "#f-owner"), username);
  });
});

test("TC32 a draft saved from the form is listed in Browse test cases", async (t) => {
  await gui("tc32", t, async (sess) => {
    const title = uniqueName("SitTcDraftListed");
    const id = await newCase(sess, { title });
    await saveDraft(sess, id);
    await browser.open("/test-cases.html");
    await waitFor(async () => (await tcRowsShown(sess)).includes(id), { message: "the draft in Browse" });
  });
});

test("TC33 Save and Run leads to a run that actually executes rather than being blocked", { todo: "test-case-form.html has no dataset field, so a case it creates has no linked dataset and its queued run is always 'blocked' (reason: no linked dataset) although the page says 'run queued'" }, async (t) => {
  await gui("tc33", t, async (sess) => {
    const id = await newCase(sess, { title: uniqueName("SitTcRunBlocked") });
    await click(sess, "#btn-create-run");
    await tcWaitStatus(sess, new RegExp(`Saved and run queued for ${id}`));
    const run = await waitFor(async () => { const r = await apiJson(`/api/v1/test-cases/${id}/runs`); return (r.body?.data || [])[0] || null; }, { message: "a run" });
    assert.notEqual(run.status, "blocked", `run logs: ${JSON.stringify(run.logs)}`);
  });
});
