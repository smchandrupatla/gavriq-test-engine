// Helpers for the Message Designer "Create message definition" wizard cases
// (sit/cases/63-selenium-message-definition-wizard.sit.ts).
//
// Engine-owned: it sits next to the files synced from Sand Bench (sit/lib/selenium.ts) and
// builds on them without editing them, so `npm run check:sit-sync` stays clean.
//
// The wizard's controls are found by the stable data-testid attributes the console puts on
// them (wizard-back, wizard-family-card, wizard-save-definition, ...), never by position or
// styling. Every check that the console saved something is confirmed a second time through
// the public API — the on-screen "Saved" marker is the UI's claim, the API is the proof.
import { By, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { apiJson, correlationId, pollUntil } from "./client.ts";
import { ENV } from "./env.ts";
import { openNav, withDriver } from "./selenium.ts";

export { correlationId, pollUntil, withDriver };

export const ENTER = "";
export const tid = (id: string) => By.css(`[data-testid="${id}"]`);

/** A prefix that marks everything these cases create, so leftovers are recognisable. */
export const NAME_PREFIX = "sit-wizard";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------- console + wizard

/**
 * Opens the console and signs in if the sign-in gate is showing. (Sand Bench's own
 * openConsole only waits for an auto sign-in; this also signs in with the SIT account when
 * the deployment shows the gate.)
 */
export async function openSignedIn(driver: WebDriver): Promise<void> {
  await driver.get(`${ENV.webBase}/`);
  const mounted = async () => (await driver.findElements(By.css("#console-root:not(.hidden) .opsc-sidebar"))).length > 0;
  for (let attempt = 0; attempt < 24 && !(await mounted()); attempt++) {
    const fields = await driver.findElements(By.css("#gate:not(.hidden) #username"));
    if (fields.length && attempt >= 6) {
      const fill = async (css: string, value: string) => {
        const el = (await driver.findElements(By.css(css)))[0];
        if (el) { await el.clear(); await el.sendKeys(value); }
      };
      await fill("#gate:not(.hidden) #tenant", ENV.tenantSlug);
      await fill("#gate:not(.hidden) #username", ENV.username);
      await fill("#gate:not(.hidden) #password", ENV.password);
      const login = (await driver.findElements(By.css("#gate:not(.hidden) #login")))[0];
      if (login) await login.click();
      await driver.wait(async () => mounted(), 20000, "console did not mount after signing in");
      return;
    }
    await sleep(500);
  }
  await driver.wait(async () => mounted(), 20000, "console sidebar did not mount");
}

/** Opens Message Designer > Create message definition on the family step. */
export async function openWizard(driver: WebDriver): Promise<void> {
  await openSignedIn(driver);
  await openNav(driver, "Message Designer", "Create message definition");
  await driver.wait(until.elementLocated(tid("wizard-family-card")), 20000, "no message family cards appeared — is any scheme imported?");
}

export async function present(driver: WebDriver, id: string): Promise<boolean> {
  return (await driver.findElements(tid(id))).length > 0;
}

export async function waitFor(driver: WebDriver, id: string, message?: string, timeoutMs = 20000): Promise<WebElement> {
  return driver.wait(until.elementLocated(tid(id)), timeoutMs, message || `"${id}" never appeared`);
}

export async function attr(driver: WebDriver, id: string, name: string): Promise<string> {
  const el = await waitFor(driver, id);
  return ((await el.getAttribute(name)) ?? "").trim();
}

export async function text(driver: WebDriver, id: string): Promise<string> {
  const el = await waitFor(driver, id);
  return ((await el.getText()) ?? "").trim();
}

/** Scrolls an element into view and clicks it (long pages leave controls below the fold). */
export async function press(driver: WebDriver, id: string): Promise<void> {
  const el = await waitFor(driver, id);
  await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", el);
  await el.click();
}

export async function familyNames(driver: WebDriver): Promise<string[]> {
  const cards: WebElement[] = await driver.findElements(tid("wizard-family-card"));
  return Promise.all(cards.map(async (card) => (await card.getAttribute("data-family")) as string));
}

export async function pickFamily(driver: WebDriver, family: string): Promise<void> {
  const cards: WebElement[] = await driver.findElements(tid("wizard-family-card"));
  for (const card of cards) {
    if ((await card.getAttribute("data-family")) === family) {
      await card.click();
      await driver.wait(until.elementLocated(tid("wizard-message-card")), 15000, `no messages listed for family "${family}"`);
      return;
    }
  }
  throw new Error(`family "${family}" is not offered (offered: ${(await familyNames(driver)).join(", ")})`);
}

/** Messages listed on the message step; `ready` ones only by default (a parsed scheme with fields). */
export async function messageKeys(driver: WebDriver, readyOnly = true): Promise<string[]> {
  const cards: WebElement[] = await driver.findElements(tid("wizard-message-card"));
  const keys: string[] = [];
  for (const card of cards) {
    if (readyOnly && (await card.getAttribute("aria-disabled")) === "true") continue;
    keys.push((await card.getAttribute("data-message")) as string);
  }
  return keys;
}

export async function markedMessages(driver: WebDriver): Promise<string[]> {
  const cards: WebElement[] = await driver.findElements(tid("wizard-message-card"));
  const marked: string[] = [];
  for (const card of cards) if ((await card.getAttribute("aria-pressed")) === "true") marked.push((await card.getAttribute("data-message")) as string);
  return marked;
}

export async function pickMessage(driver: WebDriver, key: string): Promise<void> {
  const cards: WebElement[] = await driver.findElements(tid("wizard-message-card"));
  for (const card of cards) {
    if ((await card.getAttribute("data-message")) === key) {
      await card.click();
      await driver.wait(until.elementLocated(By.css(".sbe-fpick-tile")), 20000, `the field step for "${key}" never listed its fields`);
      return;
    }
  }
  throw new Error(`message "${key}" is not offered`);
}

/** What the wizard says is chosen, from its own selection line (data attributes, then text). */
export async function selection(driver: WebDriver): Promise<{ family: string; message: string; text: string }> {
  const el = await waitFor(driver, "wizard-selection");
  return { family: ((await el.getAttribute("data-family")) ?? "").trim(), message: ((await el.getAttribute("data-message")) ?? "").trim(), text: ((await el.getText()) ?? "").trim() };
}

/** The field tiles on the field step, as their paths — a fingerprint of which message is shown. */
export async function fieldPaths(driver: WebDriver): Promise<string[]> {
  const rows: WebElement[] = await driver.findElements(By.css(".sbe-fpick-item"));
  return Promise.all(rows.map(async (row) => ((await row.getAttribute("data-path")) ?? (await row.getText()) ?? "").trim()));
}

/** Family step -> message step -> field step for the first family/message that fit. */
export async function reachFieldStep(driver: WebDriver, opts: { family?: string; message?: string } = {}): Promise<{ family: string; message: string }> {
  const family = opts.family || (await familyNames(driver))[0]!;
  await pickFamily(driver, family);
  const message = opts.message || (await messageKeys(driver))[0];
  if (!message) throw new Error(`family "${family}" has no parsed message to choose`);
  await pickMessage(driver, message);
  return { family, message };
}

/** Finds a family that lists at least `min` parsed messages, and leaves the wizard on that family's message step. */
export async function reachFamilyWithMessages(driver: WebDriver, min: number): Promise<{ family: string; messages: string[] }> {
  for (const family of await familyNames(driver)) {
    await pickFamily(driver, family);
    const messages = await messageKeys(driver);
    if (messages.length >= min) return { family, messages };
    await press(driver, "wizard-back");
    await waitFor(driver, "wizard-family-card");
  }
  throw new Error(`no family lists ${min} parsed messages; the reselect cases need a catalogue with two messages in one family`);
}

/** Field step -> workspace (the definition is created here) and waits for the save panel. */
export async function reachWorkspace(driver: WebDriver, opts: { family?: string; message?: string } = {}): Promise<{ family: string; message: string }> {
  const chosen = await reachFieldStep(driver, opts);
  await press(driver, "wizard-create");
  await waitFor(driver, "wizard-save-panel", "the workspace never opened after Create message(s)", 30000);
  return chosen;
}

export async function setDefinitionName(driver: WebDriver, name: string): Promise<void> {
  const box = await waitFor(driver, "wizard-definition-name");
  await driver.executeScript("arguments[0].scrollIntoView({block:'center'})", box);
  await box.clear();
  await box.sendKeys(name);
}

export type SaveState = "saved" | "unsaved" | "saving" | "error";
export const saveState = async (driver: WebDriver) => (await attr(driver, "wizard-save-status", "data-state")) as SaveState;

export async function waitForSaveState(driver: WebDriver, want: SaveState, timeoutMs = 15000): Promise<void> {
  await driver.wait(async () => (await saveState(driver)) === want, timeoutMs, `the save marker never reached "${want}" (it shows "${await saveState(driver).catch(() => "?")}")`);
}

/** The label of an IconButton is its aria-label; disabled ones say so in aria-disabled. */
export async function isDisabled(driver: WebDriver, id: string): Promise<boolean> {
  return (await attr(driver, id, "aria-disabled")) === "true";
}

// ---------------------------------------------------------------- independent checks via the API

export type DefinitionRow = { id: string; name: string; status: string; fieldCount: number; familyCode?: string | null; msgTypeCode?: string | null; fields?: Array<{ id: string; defaultValue?: string; mandatory?: boolean }> };

export async function listDefinitions(): Promise<DefinitionRow[]> {
  // ?source=saved leaves out the rows derived from message types: only what a person saved.
  const { status, body } = await apiJson<{ data?: DefinitionRow[] }>("/api/v1/definitions?source=saved");
  if (status !== 200) throw new Error(`GET /api/v1/definitions?source=saved answered ${status}`);
  return body.data || [];
}

export async function definitionsNamed(name: string): Promise<DefinitionRow[]> {
  return (await listDefinitions()).filter((row) => row.name === name);
}

export async function getDefinition(id: string): Promise<DefinitionRow> {
  const { status, body } = await apiJson<DefinitionRow>(`/api/v1/definitions/${encodeURIComponent(id)}`);
  if (status !== 200) throw new Error(`GET /api/v1/definitions/${id} answered ${status}`);
  return body;
}

export async function definitionIds(): Promise<Set<string>> {
  return new Set((await listDefinitions()).map((row) => row.id));
}

export type DatasetRow = { id: string; name: string; etag?: string; row_count?: number; rowCount?: number };

export async function datasetsNamed(name: string): Promise<DatasetRow[]> {
  const { status, body } = await apiJson<{ data?: DatasetRow[] }>("/api/v1/datasets");
  if (status !== 200) throw new Error(`GET /api/v1/datasets answered ${status}`);
  return (body.data || []).filter((row) => row.name === name);
}

export async function datasetMessages(id: string): Promise<Array<{ name?: string; format?: string; content?: string }>> {
  const { status, body } = await apiJson<{ data?: Array<{ name?: string; format?: string; content?: string; payload?: { name?: string; format?: string; content?: string } }> }>(`/api/v1/datasets/${encodeURIComponent(id)}/messages`);
  if (status !== 200) throw new Error(`GET /api/v1/datasets/${id}/messages answered ${status}`);
  return (body.data || []).map((row) => ({ name: row.name ?? row.payload?.name, format: row.format ?? row.payload?.format, content: row.content ?? row.payload?.content }));
}

/** Removes what a case created. Best effort: a failure here must not hide the case's own result. */
export async function cleanUp(created: { definitionIds?: string[]; definitionNames?: string[]; datasetNames?: string[] }): Promise<void> {
  try {
    const ids = new Set(created.definitionIds || []);
    for (const name of created.definitionNames || []) for (const row of await definitionsNamed(name)) ids.add(row.id);
    for (const id of ids) await apiJson(`/api/v1/definitions/${encodeURIComponent(id)}`, { method: "DELETE" });
    for (const name of created.datasetNames || []) {
      for (const row of await datasetsNamed(name)) {
        const detail = await apiJson<{ etag?: string }>(`/api/v1/datasets/${encodeURIComponent(row.id)}`);
        const etag = detail.body.etag || row.etag;
        await apiJson(`/api/v1/datasets/${encodeURIComponent(row.id)}`, { method: "DELETE", headers: etag ? { "if-match": etag } : {} });
      }
    }
  } catch { /* leftovers are recognisable by NAME_PREFIX */ }
}
