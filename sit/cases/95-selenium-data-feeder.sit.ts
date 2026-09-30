import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { By, Select, until, type WebDriver, type WebElement } from "selenium-webdriver";
import { apiJson, authToken, correlationId } from "../lib/client.ts";
import { ENV } from "../lib/env.ts";
import { newDriver, openConsole, openNav, pageTitle } from "../lib/selenium.ts";

// Selenium coverage for the New feeder screen (Data Feeders → New feeder), which is laid
// out as three tabs: Dataset, Target system, Window & pacing. What it proves, the way a
// person would see it:
//   - the dataset tab shows how many messages the chosen dataset holds, their message type
//     and a message preview, and has no "Number of messages" field;
//   - the window is a length (1 hour, 2 hours, 6 hours, 5 days, Custom), not start and end dates;
//   - pacing and spikes live in the same tab as the window;
//   - a save round-trips through the API with the count taken from the dataset and the
//     length the operator picked.
// The test owns its dataset (3 stored messages) and feeder and removes both afterwards.
// Engine-only case: it is not part of the files synced from Sand Bench (sit/SYNCED-FROM-SANDBENCH.json).

const MESSAGE_TYPE = "pacs.008.001.08";
const MESSAGES = [1, 2, 3].map((n) => ({ name: `feeder-msg-${n}`, format: "xml", content: `<Doc><Id>${n}</Id></Doc>` }));

let driver: WebDriver;
let datasetId = "";
let datasetName = "";
let feederId = "";

const $ = (css: string) => driver.findElement(By.css(css));

async function shown(css: string): Promise<boolean> {
  const els = await driver.findElements(By.css(css));
  return els.length > 0 && (await els[0].isDisplayed());
}
async function text(css: string): Promise<string> {
  return ((await $(css).getText()) || "").trim();
}
async function waitText(css: string, pattern: RegExp, message: string) {
  await driver.wait(async () => pattern.test(await text(css)), 8000, message);
}
async function openTab(name: "dataset" | "target" | "window") {
  await $(`#tab-${name}`).click();
  await driver.wait(until.elementIsVisible($(`#panel-${name}`)), 4000, `${name} tab did not open`);
}
async function clickByText(css: string, label: string) {
  const els: WebElement[] = await driver.findElements(By.css(css));
  for (const el of els) {
    if (((await el.getText()) || "").trim() === label) { await el.click(); return; }
  }
  throw new Error(`no ${css} with text "${label}"`);
}
async function openNewFeeder() {
  await openConsole(driver);
  await openNav(driver, "Data Feeders", "New feeder");
  // The feeder screens are standalone pages inside the console shell; wait for the tabs.
  await driver.wait(until.elementLocated(By.css("#tab-dataset")), 15000, "New feeder tabs never appeared");
}
async function chooseDataset() {
  const sel = await driver.wait(until.elementLocated(By.css("#df-datasets select")), 10000, "dataset picker never appeared");
  await new Select(sel).selectByVisibleText(`${datasetName} · ${MESSAGE_TYPE} · 3 records`);
}

before(async () => {
  datasetName = correlationId("sit-feeder-ds");
  const created = await apiJson<{ id: string }>("/api/v1/datasets", {
    method: "POST",
    body: JSON.stringify({ name: datasetName, messageTypeCode: MESSAGE_TYPE }),
  });
  assert.ok(created.body.id, `could not create dataset (HTTP ${created.status})`);
  datasetId = created.body.id;
  const stored = await apiJson(`/api/v1/datasets/${encodeURIComponent(datasetId)}/messages`, {
    method: "POST",
    body: JSON.stringify({ messages: MESSAGES }),
  });
  assert.equal(stored.status, 200, "could not store the dataset messages");
  driver = await newDriver();
  // The standalone feeder page signs in from the same session the console just created;
  // seed it explicitly so the first page load is never unauthenticated.
  await driver.get(`${ENV.webBase}/`);
  const token = await authToken();
  await driver.executeScript(`try{sessionStorage.setItem('sbe_token', arguments[0]);localStorage.setItem('sbe_token', arguments[0]);}catch(e){}`, token);
  await openNewFeeder();
});

after(async () => {
  try {
    if (feederId) await apiJson(`/api/v1/data-feeders/${encodeURIComponent(feederId)}/archive`, { method: "POST", body: "{}" }).catch(() => undefined);
    if (datasetId) await apiJson(`/api/v1/datasets/${encodeURIComponent(datasetId)}`, { method: "DELETE" }).catch(() => undefined);
  } finally {
    if (driver) await driver.quit();
  }
});

test("New feeder: opens on the Dataset tab with three tabs in order", async () => {
  assert.match(await pageTitle(driver), /New data feeder|New feeder/);
  const tabs = await driver.findElements(By.css("[role=tab]"));
  assert.equal(tabs.length, 3);
  const labels = await Promise.all(tabs.map(async (t) => ((await t.getText()) || "").replace(/^\d\s*/, "").trim()));
  assert.deepEqual(labels, ["Dataset", "Target system", "Window & pacing"]);
  assert.equal(await $("#tab-dataset").getAttribute("aria-selected"), "true");
  assert.equal(await shown("#panel-dataset"), true);
  assert.equal(await shown("#panel-target"), false, "Target system panel must be hidden until its tab is opened");
  assert.equal(await shown("#panel-window"), false, "Window panel must be hidden until its tab is opened");
});

test("New feeder: Dataset tab has no Number of messages field and no start or end dates", async () => {
  await openTab("dataset");
  await chooseDataset();
  assert.equal(await shown("#df-count"), false, "the message count is taken from the dataset, not typed in");
  assert.doesNotMatch(await text("#panel-dataset"), /Number of messages/);
  await openTab("window");
  assert.equal(await shown("#df-start-local"), false, "no start date field until the optional schedule section is opened");
  assert.equal(await shown("#df-end"), false, "there is no end date field");
  assert.doesNotMatch(await text("#panel-window"), /\bEnd\b\s*\*/);
});

test("New feeder: choosing a dataset shows its message count, message type and a preview", async () => {
  await openTab("dataset");
  await chooseDataset();
  await waitText("#df-ds-summary", /3 messages will be sent/, "summary never showed the dataset size");
  assert.match(await text("#df-ds-summary"), new RegExp(MESSAGE_TYPE.replace(/\./g, "\\.")));
  const card = await text("#df-ds-details");
  assert.match(card, new RegExp(datasetName));
  assert.match(card, /Messages\s*3/);
  await driver.wait(async () => (await driver.findElements(By.css("#df-ds-details .df-msg"))).length === 3, 8000, "preview did not list the 3 stored messages");
  const first = await $("#df-ds-details .df-msg pre");
  assert.match(await first.getAttribute("textContent"), /<Id>1<\/Id>/, "the first message's content is not previewed");
  // The other messages are collapsed until clicked, and expand to their own content.
  const second = (await driver.findElements(By.css("#df-ds-details .df-msg")))[1];
  await second.findElement(By.css("summary")).click();
  assert.match(await second.findElement(By.css("pre")).getAttribute("textContent"), /<Id>2<\/Id>/);
});

test("New feeder: tabs switch with the mouse and with Next and Back", async () => {
  await openTab("dataset");
  await clickByText("#panel-dataset [data-goto]", "Next: Target system →");
  await driver.wait(until.elementIsVisible($("#panel-target")), 4000);
  assert.equal(await $("#tab-target").getAttribute("aria-selected"), "true");
  assert.equal(await shown("#panel-dataset"), false);
  assert.ok(await shown("#df-system"), "external system picker is on the Target system tab");
  await clickByText("#panel-target [data-goto]", "Next: Window & pacing →");
  await driver.wait(until.elementIsVisible($("#panel-window")), 4000);
  await clickByText("#panel-window [data-goto]", "← Back");
  await driver.wait(until.elementIsVisible($("#panel-target")), 4000);
  await openTab("dataset");
});

test("New feeder: Window tab offers 1 hour, 2 hours, 6 hours, 5 days and Custom", async () => {
  await openTab("window");
  const buttons = await driver.findElements(By.css("[data-length]"));
  const labels = await Promise.all(buttons.map(async (b) => ((await b.getText()) || "").trim()));
  assert.deepEqual(labels, ["1 hour", "2 hours", "6 hours", "5 days", "Custom"]);
  const expected: Array<[string, RegExp]> = [["1 hour", /Runs for 1h\b/], ["2 hours", /Runs for 2h\b/], ["6 hours", /Runs for 6h\b/], ["5 days", /Runs for 5d\b/]];
  for (const [label, pattern] of expected) {
    await clickByText("[data-length]", label);
    await waitText("#df-window-hint", pattern, `choosing ${label} did not set the window length`);
    const pressed = await driver.findElements(By.css('[data-length][aria-pressed="true"]'));
    assert.equal(pressed.length, 1, "exactly one length is selected");
    assert.equal(((await pressed[0].getText()) || "").trim(), label);
    assert.equal(await shown("#df-custom"), false, "custom fields stay hidden for a preset length");
  }
});

test("New feeder: Custom length accepts minutes, hours or days", async () => {
  await openTab("window");
  await clickByText("[data-length]", "Custom");
  await driver.wait(until.elementIsVisible($("#df-custom")), 4000, "custom length fields did not appear");
  const value = $("#df-custom-value");
  const unit = new Select($("#df-custom-unit"));
  await unit.selectByVisibleText("minutes");
  await value.clear();
  await value.sendKeys("90");
  await waitText("#df-window-hint", /Runs for 1h 30m/, "90 minutes was not shown as 1h 30m");
  await unit.selectByVisibleText("days");
  await value.clear();
  await value.sendKeys("2");
  await waitText("#df-window-hint", /Runs for 2d\b/, "2 days was not applied");
  assert.equal(await $('[data-length="custom"]').getAttribute("aria-pressed"), "true");
});

test("New feeder: pacing and spikes are on the same tab as the window", async () => {
  await openTab("window");
  for (const css of ["#df-gaps", "#df-interval", "#df-add-spike"]) assert.ok(await shown(css), `${css} should be on the Window & pacing tab`);
  assert.match(await text("#panel-window"), /Pacing/);
  assert.match(await text("#panel-window"), /Spikes/);
  await $("#df-add-spike").click();
  const rows = await driver.findElements(By.css("#df-spike-rows .df-row.spike"));
  assert.equal(rows.length, 1, "adding a spike adds one spike row");
  const inputs = await rows[0].findElements(By.css("input[type=number]"));
  assert.ok(inputs.length >= 3, "spike row has from, to and rate inputs (minutes after the start)");
  await rows[0].findElement(By.css('button[aria-label^="Remove spike"]')).click();
  assert.equal((await driver.findElements(By.css("#df-spike-rows .df-row.spike"))).length, 0);
});

test("New feeder: saving without a name returns to the Dataset tab and flags the field", async () => {
  await openTab("window");
  await $("#df-save").click();
  await driver.wait(until.elementIsVisible($("#panel-dataset")), 6000, "the form did not switch to the tab with the error");
  assert.equal(await $("#tab-dataset").getAttribute("aria-selected"), "true");
  assert.match(await text("#err-name"), /required/i);
  assert.match((await $("#tab-dataset").getAttribute("class")) || "", /has-error/);
});

test("New feeder: saving stores the dataset size as the message count and the chosen window length", async () => {
  const name = correlationId("sit-feeder");
  await openTab("dataset");
  await $("#df-name").clear();
  await $("#df-name").sendKeys(name);
  await chooseDataset();
  await openTab("window");
  await clickByText("[data-length]", "2 hours");
  await waitText("#df-window-hint", /Runs for 2h\b/, "2 hours was not applied before saving");
  await $("#df-save").click();
  await waitText("#df-status", /Feeder created/, "the console did not report the feeder as created");
  await driver.wait(async () => /id=/.test(await driver.getCurrentUrl()), 6000, "the page did not move to the saved feeder");
  feederId = decodeURIComponent(new URL(await driver.getCurrentUrl()).searchParams.get("id") || "");
  assert.ok(feederId, "saved feeder id missing from the URL");

  const saved = await apiJson<{ name: string; messageCount: number; windowStart: string; windowEnd: string; datasets: Array<{ datasetId: string }> }>(
    `/api/v1/data-feeders/${encodeURIComponent(feederId)}`
  );
  assert.equal(saved.status, 200);
  assert.equal(saved.body.name, name);
  assert.equal(saved.body.messageCount, 3, "message count must come from the dataset (3 stored messages)");
  assert.deepEqual(saved.body.datasets.map((d) => d.datasetId), [datasetId]);
  const minutes = (Date.parse(saved.body.windowEnd) - Date.parse(saved.body.windowStart)) / 60000;
  assert.equal(minutes, 120, "the 2 hours length must be stored as a 120-minute window");
});

test("New feeder: reopening the saved feeder shows the same length preselected", async () => {
  assert.ok(feederId, "depends on the save test");
  await driver.get(`${ENV.webBase}/data-feeder-form.html?id=${encodeURIComponent(feederId)}`);
  await driver.wait(until.elementLocated(By.css("#tab-window")), 15000);
  await driver.wait(async () => ((await $("#df-name").getAttribute("value")) || "").startsWith("sit-feeder"), 10000, "saved name never loaded");
  await openTab("window");
  const pressed = await driver.findElements(By.css('[data-length][aria-pressed="true"]'));
  assert.equal(pressed.length, 1);
  assert.equal(((await pressed[0].getText()) || "").trim(), "2 hours");
  await openTab("dataset");
  await waitText("#df-ds-summary", /3 messages will be sent/, "saved feeder did not show its dataset size");
});
