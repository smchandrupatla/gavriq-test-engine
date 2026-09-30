import { test } from "node:test";
import assert from "node:assert/strict";
import { By } from "selenium-webdriver";
import {
  ENTER, NAME_PREFIX, attr, cleanUp, correlationId, datasetMessages, datasetsNamed, definitionIds, definitionsNamed,
  fieldPaths, familyNames, getDefinition, isDisabled, markedMessages, messageKeys, openWizard, pickFamily, pickMessage,
  present, press, reachFamilyWithMessages, reachFieldStep, reachWorkspace, saveState, selection, setDefinitionName, text, tid,
  waitFor, waitForSaveState, withDriver, pollUntil, listDefinitions,
} from "../lib/selenium-wizard.ts";
import { openNav } from "../lib/selenium.ts";

// Selenium coverage of Message Designer > Create message definition.
//
// The wizard only builds a definition (family -> message -> fields -> workspace). What it
// must guarantee:
//   1. Navigation: the user can go Back from the message step and from the chosen message's
//      field step, the earlier choice stays marked, exactly one message is ever chosen, and
//      a different one can be picked instead.
//   2. Saving: the last step has a Save definition button and a visible Saved marker, and
//      no publish / "Send to system" control — nothing is sent to an external system from
//      this screen. The definition is saved under its own name, with the chosen default
//      values, as one record however many times it is saved.
//   3. Datasets: a dataset is a separate entity created from the definition. The same
//      definition can make further datasets. A refused save shows the server's own reason
//      on screen, never a bare "request failed".
//
// Every "saved" claim the console makes is confirmed independently through the API, and
// every case removes what it created. Cases that need a catalogue with two parsed messages
// in one family fail with a message saying so rather than passing vacuously.

// ---------------------------------------------------------------- 1. navigation

test("wizard: opens on the family step, offers families and has nothing to go Back to", async () => {
  await withDriver(async (driver) => {
    await openWizard(driver);
    assert.ok((await familyNames(driver)).length > 0, "no message family is offered");
    assert.equal(await present(driver, "wizard-back"), false, "the first step must not show a Back button");
    assert.equal(await present(driver, "wizard-message-card"), false, "messages must not show before a family is chosen");
  });
});

test("wizard: choosing a family shows its messages, names the family, and offers Back", async () => {
  await withDriver(async (driver) => {
    await openWizard(driver);
    const family = (await familyNames(driver))[0]!;
    await pickFamily(driver, family);
    assert.ok((await messageKeys(driver, false)).length > 0, `family "${family}" lists no messages`);
    const chosen = await selection(driver);
    assert.equal(chosen.family, family);
    assert.match(chosen.text, new RegExp(`Family: ${family}`));
    assert.equal(await present(driver, "wizard-back"), true, "the message step must offer Back");
    assert.deepEqual(await markedMessages(driver).then((rows) => rows.length <= 1), true, "at most one message may be marked");
  });
});

test("wizard: choosing a message opens the field step, names the message, and offers Back", async () => {
  await withDriver(async (driver) => {
    await openWizard(driver);
    const { family, message } = await reachFieldStep(driver);
    const chosen = await selection(driver);
    assert.equal(chosen.family, family);
    assert.equal(chosen.message, message, "the field step must name the message that was chosen");
    assert.ok((await fieldPaths(driver)).length > 0, "the field step lists no fields");
    assert.equal(await present(driver, "wizard-back"), true, "the field step must offer Back");
    assert.equal(await present(driver, "wizard-create"), true, "the field step must offer Create message(s)");
  });
});

test("wizard: Back from the chosen message returns to the messages, the choice stays marked, and only one is marked", async () => {
  await withDriver(async (driver) => {
    await openWizard(driver);
    const { message } = await reachFieldStep(driver);
    await press(driver, "wizard-back");
    await waitFor(driver, "wizard-message-card", "Back did not return to the message step");
    assert.equal(await present(driver, "wizard-create"), false, "Back must leave the field step");
    assert.deepEqual(await markedMessages(driver), [message], "exactly the message chosen before Back must be marked");
  });
});

test("wizard: after Back a different message can be chosen and the field step follows the new choice", async () => {
  await withDriver(async (driver) => {
    await openWizard(driver);
    const { family, messages } = await reachFamilyWithMessages(driver, 2);
    const [first, second] = messages as [string, string];
    await pickMessage(driver, first);
    const firstFields = await fieldPaths(driver);
    assert.equal((await selection(driver)).message, first);

    await press(driver, "wizard-back");
    await waitFor(driver, "wizard-message-card");
    await pickMessage(driver, second);
    const chosen = await selection(driver);
    assert.equal(chosen.family, family);
    assert.equal(chosen.message, second, "the field step still names the first message after choosing another");
    assert.notDeepEqual(await fieldPaths(driver), firstFields, "the field step still lists the first message's fields");

    // And back again: the second choice is now the marked one, and it is the only one.
    await press(driver, "wizard-back");
    await waitFor(driver, "wizard-message-card");
    assert.deepEqual(await markedMessages(driver), [second]);
  });
});

test("wizard: Back from the messages returns to the families and another family can be chosen", async () => {
  await withDriver(async (driver) => {
    await openWizard(driver);
    const families = await familyNames(driver);
    await pickFamily(driver, families[0]!);
    await press(driver, "wizard-back");
    await waitFor(driver, "wizard-family-card", "Back did not return to the family step");
    assert.equal(await present(driver, "wizard-message-card"), false);
    assert.equal(await present(driver, "wizard-back"), false, "the first step must not show Back again");
    if (families.length > 1) {
      await pickFamily(driver, families[1]!);
      assert.equal((await selection(driver)).family, families[1], "the second family was not the one chosen");
    }
  });
});

test("wizard: Start over from the field step returns to the family step", async () => {
  await withDriver(async (driver) => {
    await openWizard(driver);
    await reachFieldStep(driver);
    await press(driver, "wizard-start-over");
    await waitFor(driver, "wizard-family-card", "Start over did not return to the family step");
    assert.equal(await present(driver, "wizard-back"), false);
    assert.equal(await present(driver, "wizard-create"), false);
  });
});

test("wizard: the family and message tiles and Back work from the keyboard", async () => {
  await withDriver(async (driver) => {
    await openWizard(driver);
    const family = (await familyNames(driver))[0]!;
    const familyCard = (await driver.findElements(By.css(`[data-testid="wizard-family-card"][data-family="${family}"]`)))[0];
    await familyCard.sendKeys(ENTER);
    await waitFor(driver, "wizard-message-card", "Enter on a family tile did not open its messages");
    const message = (await messageKeys(driver))[0]!;
    const card = (await driver.findElements(By.css(`[data-testid="wizard-message-card"][data-message="${message}"]`)))[0];
    await card.sendKeys(ENTER);
    await driver.wait(async () => (await selection(driver)).message === message, 15000, "Enter on a message tile did not choose it");
    await (await waitFor(driver, "wizard-back")).sendKeys(ENTER);
    await waitFor(driver, "wizard-message-card", "Enter on Back did not return to the messages");
  });
});

// ---------------------------------------------------------------- 2. saving the definition

test("workspace: offers Save definition with a Not saved marker and no Send to system / publish control", async () => {
  const name = correlationId(`${NAME_PREFIX}-nosend`);
  const before = await definitionIds();
  await withDriver(async (driver) => {
    try {
      await openWizard(driver);
      await reachWorkspace(driver);
      await setDefinitionName(driver, name);
      assert.equal(await text(driver, "wizard-save-definition"), "Save definition");
      assert.notEqual(await saveState(driver), "saved", "a definition with unsaved changes must not be marked Saved");
      const source = await driver.getPageSource();
      assert.ok(!/Send to system/i.test(source), 'the workspace still offers "Send to system"');
      assert.ok(!/aria-label="Publish/i.test(source), "the workspace offers a Publish control");
    } finally {
      await cleanUp({ definitionIds: [...(await definitionIds())].filter((id) => !before.has(id)) });
    }
  });
});

test("workspace: Save definition marks it Saved, and the API holds it under its own name with the chosen defaults", async () => {
  const name = correlationId(`${NAME_PREFIX}-save`);
  await withDriver(async (driver) => {
    try {
      await openWizard(driver);
      await reachWorkspace(driver);
      await setDefinitionName(driver, name);
      await press(driver, "wizard-save-definition");
      await waitForSaveState(driver, "saved");
      assert.match(await text(driver, "wizard-save-status"), new RegExp(`Saved as "${name}"`));
      assert.equal(await text(driver, "wizard-save-definition"), "Saved");
      assert.equal(await isDisabled(driver, "wizard-save-definition"), true, "a Saved definition must not offer another save");

      const rows = await pollUntil(() => definitionsNamed(name), (found) => found.length > 0);
      assert.equal(rows.length, 1, `expected one saved definition named "${name}", found ${rows.length}`);
      const saved = await getDefinition(rows[0]!.id);
      assert.equal(saved.status, "active");
      assert.ok((saved.fields || []).length > 0, "the saved definition has no fields");
      const missing = (saved.fields || []).filter((f) => !String(f.defaultValue ?? "").trim());
      assert.deepEqual(missing.map((f) => f.id), [], "every selected field must be saved with its default value");
      assert.equal(saved.fieldCount, (saved.fields || []).length);
    } finally {
      await cleanUp({ definitionNames: [name] });
    }
  });
});

test("workspace: saving twice keeps one record; renaming un-marks Saved and the next save updates the same record", async () => {
  const first = correlationId(`${NAME_PREFIX}-rename-a`);
  const second = correlationId(`${NAME_PREFIX}-rename-b`);
  await withDriver(async (driver) => {
    try {
      await openWizard(driver);
      await reachWorkspace(driver);
      await setDefinitionName(driver, first);
      await press(driver, "wizard-save-definition");
      await waitForSaveState(driver, "saved");
      const [record] = await pollUntil(() => definitionsNamed(first), (found) => found.length > 0);
      assert.ok(record, "the first save produced no definition");

      // The Saved button is inert, so a second click cannot create a copy.
      await (await waitFor(driver, "wizard-save-definition")).click().catch(() => undefined);
      assert.equal((await definitionsNamed(first)).length, 1);

      await setDefinitionName(driver, second);
      assert.notEqual(await saveState(driver), "saved", "changing the name must un-mark Saved");
      assert.equal(await text(driver, "wizard-save-definition"), "Save definition");
      await press(driver, "wizard-save-definition");
      await waitForSaveState(driver, "saved");

      const renamed = await pollUntil(() => definitionsNamed(second), (found) => found.length > 0);
      const context = async () => `UI says: ${await text(driver, "wizard-save-status").catch(() => "?")}; API holds: ${JSON.stringify((await listDefinitions()).filter((row) => row.name.startsWith(NAME_PREFIX)).map((row) => ({ id: row.id, name: row.name })))}`;
      assert.equal(renamed.length, 1, `the renamed definition is missing or duplicated (${await context()})`);
      assert.equal(renamed[0]!.id, record!.id, "renaming and saving must update the same record, not create another");
      assert.equal((await definitionsNamed(first)).length, 0, "the old name must be gone");
    } finally {
      await cleanUp({ definitionNames: [first, second] });
    }
  });
});

test("workspace: Create message(s) already stored the definition, and Save as draft then continuing never leaves a duplicate", async () => {
  const name = correlationId(`${NAME_PREFIX}-draft`);
  const before = await definitionIds();
  // Other people's records may appear meanwhile: only this run's draft counts (a new draft of the chosen message).
  const newDrafts = async (msgTypeCode: string) => (await listDefinitions()).filter((row) => !before.has(row.id) && row.status === "draft" && row.name.endsWith("(draft)") && row.msgTypeCode === msgTypeCode);
  let draftId: string | undefined;
  await withDriver(async (driver) => {
    try {
      await openWizard(driver);
      const { message } = await reachFieldStep(driver);
      const msgTypeCode = message;
      await press(driver, "wizard-save-draft");
      const draft = await pollUntil(() => newDrafts(msgTypeCode), (rows) => rows.length > 0);
      assert.equal(draft.length, 1, `Save as draft must create exactly one record, found: ${JSON.stringify(draft.map((row) => ({ id: row.id, name: row.name, status: row.status })))}`);
      draftId = draft[0]!.id;

      await press(driver, "wizard-create");
      await waitFor(driver, "wizard-save-panel", undefined, 30000);
      await setDefinitionName(driver, name);
      await press(driver, "wizard-save-definition");
      await waitForSaveState(driver, "saved");

      const final = await pollUntil(() => definitionsNamed(name), (rows) => rows.length > 0);
      assert.equal(final.length, 1, `the draft and the final save must be one record, found: ${JSON.stringify(final.map((row) => ({ id: row.id, name: row.name, status: row.status })))}`);
      assert.equal(final[0]!.id, draftId, "saving from the workspace must update the draft, not create a second record");
      assert.equal(final[0]!.status, "active", "saving from the workspace must turn the draft into an active definition");
      assert.equal((await newDrafts(msgTypeCode)).length, 0, "the draft record is still there as a draft");
    } finally {
      await cleanUp({ definitionIds: draftId ? [draftId] : [], definitionNames: [name] });
    }
  });
});

test("workspace: a saved definition is listed under View saved definitions", async () => {
  const name = correlationId(`${NAME_PREFIX}-listed`);
  await withDriver(async (driver) => {
    try {
      await openWizard(driver);
      await reachWorkspace(driver);
      await setDefinitionName(driver, name);
      await press(driver, "wizard-save-definition");
      await waitForSaveState(driver, "saved");
      await openNav(driver, "Message Designer", "View saved definitions");
      await driver.wait(async () => (await driver.getPageSource()).includes(name), 20000, `"${name}" is not listed under View saved definitions`);
    } finally {
      await cleanUp({ definitionNames: [name] });
    }
  });
});

// ---------------------------------------------------------------- 3. datasets made from the definition

test("dataset: Create dataset makes a separate dataset holding the message, and the definition stays Saved", async () => {
  const definition = correlationId(`${NAME_PREFIX}-ds-def`);
  const dataset = correlationId(`${NAME_PREFIX}-ds`);
  await withDriver(async (driver) => {
    try {
      await openWizard(driver);
      await reachWorkspace(driver);
      await setDefinitionName(driver, definition);
      await press(driver, "wizard-save-definition");
      await waitForSaveState(driver, "saved");

      const nameBox = await waitFor(driver, "wizard-dataset-name");
      await nameBox.clear();
      await nameBox.sendKeys(dataset);
      await press(driver, "wizard-dataset-create");
      await driver.wait(async () => await present(driver, "wizard-dataset-status"), 20000, `no dataset confirmation; the page says: ${await text(driver, "wizard-dataset-error").catch(() => "(no error either)")}`);
      assert.match(await text(driver, "wizard-dataset-status"), new RegExp(`new dataset "${dataset}"`));

      const rows = await pollUntil(() => datasetsNamed(dataset), (found) => found.length > 0);
      assert.equal(rows.length, 1, `expected one dataset named "${dataset}", found ${rows.length}`);
      const messages = await datasetMessages(rows[0]!.id);
      assert.equal(messages.length, 1, "the dataset must hold the one message the workspace showed");
      assert.ok(messages[0]!.content && messages[0]!.content.trim().length > 0, "the dataset message has no content");
      assert.ok(messages[0]!.name, "the dataset message has no name");
      assert.ok(messages[0]!.format === "xml" || messages[0]!.format === "json");

      // The definition is its own entity: still one record, still Saved.
      assert.equal(await saveState(driver), "saved");
      assert.equal((await definitionsNamed(definition)).length, 1);
      assert.equal(await text(driver, "wizard-dataset-create"), "Dataset created");
      assert.equal(await isDisabled(driver, "wizard-dataset-create"), true, "the same dataset name must not be created twice");
    } finally {
      await cleanUp({ definitionNames: [definition], datasetNames: [dataset] });
    }
  });
});

test("dataset: the same definition can create a second, separate dataset", async () => {
  const definition = correlationId(`${NAME_PREFIX}-two-def`);
  const one = correlationId(`${NAME_PREFIX}-two-a`);
  const two = correlationId(`${NAME_PREFIX}-two-b`);
  await withDriver(async (driver) => {
    try {
      await openWizard(driver);
      await reachWorkspace(driver);
      await setDefinitionName(driver, definition);
      await press(driver, "wizard-save-definition");
      await waitForSaveState(driver, "saved");
      for (const name of [one, two]) {
        const nameBox = await waitFor(driver, "wizard-dataset-name");
        await nameBox.clear();
        await nameBox.sendKeys(name);
        await press(driver, "wizard-dataset-create");
        await driver.wait(async () => (await text(driver, "wizard-dataset-status").catch(() => "")).includes(`"${name}"`), 20000, `dataset "${name}" was not confirmed`);
      }
      const first = await pollUntil(() => datasetsNamed(one), (found) => found.length > 0);
      const second = await pollUntil(() => datasetsNamed(two), (found) => found.length > 0);
      assert.equal(first.length, 1);
      assert.equal(second.length, 1);
      assert.notEqual(first[0]!.id, second[0]!.id, "the two datasets must be separate entities");
      assert.equal((await definitionsNamed(definition)).length, 1, "creating datasets must not duplicate the definition");
      assert.equal(await saveState(driver), "saved");
    } finally {
      await cleanUp({ definitionNames: [definition], datasetNames: [one, two] });
    }
  });
});

test("dataset: a generated batch becomes the messages of the dataset, each with its own name", async () => {
  const definition = correlationId(`${NAME_PREFIX}-batch-def`);
  const dataset = correlationId(`${NAME_PREFIX}-batch`);
  await withDriver(async (driver) => {
    try {
      await openWizard(driver);
      await reachWorkspace(driver);
      await setDefinitionName(driver, definition);
      await press(driver, "wizard-save-definition");
      await waitForSaveState(driver, "saved");

      const tabs = await driver.findElements(By.css(".opsc-tabbtn"));
      let opened = false;
      for (const tab of tabs) if (((await tab.getText()) || "").trim() === "Multiples") { await tab.click(); opened = true; break; }
      assert.ok(opened, "the Multiples tab is missing");
      const generate = (await driver.findElements(By.css('[role="button"][aria-label="Generate batch"]')))[0];
      assert.ok(generate, "Generate batch is missing");
      await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", generate);
      await generate.click();
      await driver.wait(async () => /files ready/i.test(await driver.executeScript("return document.body.innerText")), 20000, "the batch was not generated");

      const nameBox = await waitFor(driver, "wizard-dataset-name");
      await nameBox.clear();
      await nameBox.sendKeys(dataset);
      await press(driver, "wizard-dataset-create");
      await driver.wait(async () => await present(driver, "wizard-dataset-status"), 20000, `no dataset confirmation; the page says: ${await text(driver, "wizard-dataset-error").catch(() => "(no error either)")}`);
      const rows = await pollUntil(() => datasetsNamed(dataset), (found) => found.length > 0);
      assert.equal(rows.length, 1);
      const messages = await datasetMessages(rows[0]!.id);
      assert.ok(messages.length > 1, `a generated batch must save every message, found ${messages.length}`);
      assert.equal(new Set(messages.map((m) => m.name)).size, messages.length, "every message in the dataset needs its own name");
    } finally {
      await cleanUp({ definitionNames: [definition], datasetNames: [dataset] });
    }
  });
});

test("dataset: a refused save shows the reason given by the server on screen, not a bare request failure", async () => {
  const definition = correlationId(`${NAME_PREFIX}-refuse-def`);
  const dataset = correlationId(`${NAME_PREFIX}-refuse`);
  await withDriver(async (driver) => {
    try {
      await openWizard(driver);
      await reachWorkspace(driver);
      await setDefinitionName(driver, definition);
      await press(driver, "wizard-save-definition");
      await waitForSaveState(driver, "saved");

      // A dataset that already holds this message's name refuses the same name again.
      const nameBox = await waitFor(driver, "wizard-dataset-name");
      await nameBox.clear();
      await nameBox.sendKeys(dataset);
      await press(driver, "wizard-dataset-create");
      await driver.wait(async () => await present(driver, "wizard-dataset-status"), 20000, "the dataset was not created");
      const rows = await pollUntil(() => datasetsNamed(dataset), (found) => found.length > 0);
      assert.equal(rows.length, 1);

      // The list of existing datasets refreshes after a save; choose the one just made.
      const select = await waitFor(driver, "wizard-dataset-existing");
      await driver.wait(async () => (await select.findElements(By.css(`option[value="${rows[0]!.id}"]`))).length > 0, 20000, "the new dataset never appeared in the existing-dataset list");
      await (await select.findElement(By.css(`option[value="${rows[0]!.id}"]`))).click();
      await press(driver, "wizard-dataset-add");
      await waitFor(driver, "wizard-dataset-error", "adding the same message name twice was not refused on screen");
      const shown = await text(driver, "wizard-dataset-error");
      assert.match(shown, /already exists/i, `the reason the server gave is missing: "${shown}"`);
      assert.ok(!/request failed/i.test(shown), `the error is a bare request failure: "${shown}"`);
      assert.equal((await datasetMessages(rows[0]!.id)).length, 1, "the refused save must not have stored a duplicate");
    } finally {
      await cleanUp({ definitionNames: [definition], datasetNames: [dataset] });
    }
  });
});
