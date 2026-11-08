// Page object for /schema-converter.html. Every method drives the DOM a person uses (the
// selects, the textarea, the field table, the buttons) and reads back what the page shows.
import { apiJson, captureDownloads, click, count, isDisabled, optionTexts, selectOption, setValue, text, texts, visible, waitFor, waitVisible } from "./flow.mjs";

export const SOURCE_LABELS = { jsd: "JSD / JSON Schema", xsd: "XSD", xml: "XML sample (infer definition)", json: "JSON sample (infer definition)", yaml: "YAML (JSON Schema)", flat: "Flat-file definition" };
export const TARGET_LABELS = { jsd: "JSD / JSON Schema", xsd: "XSD + XML samples", yaml: "YAML (JSON Schema)", flat: "Flat-file definition + samples" };
export const DELIMITERS = [
  { name: "comma", value: ",", label: "Comma" },
  { name: "semicolon", value: ";", label: "Semicolon" },
  { name: "pipe", value: "|", label: "Pipe" },
  { name: "tab", value: "\t", label: "Tab" },
];
export const DEFINITION_EXTENSION = { jsd: "jsd", yaml: "yaml", xsd: "xsd", flat: "flat.json" };
export const SAMPLE_EXTENSION = { jsd: "json", yaml: "yaml", xsd: "xml" };

export async function openConverter(browser) {
  const sess = await browser.open("/schema-converter.html");
  await waitVisible(sess, "#inspect");
  await captureDownloads(sess);
  return sess;
}

export async function raw(sess, css) {
  return String(await sess.exec("const e=document.querySelector(arguments[0]);return e?e.textContent:null;", [css]) ?? "");
}

// (The keys are not message/error: the driver treats any returned object with an `error` key as a
// protocol failure.) One script reads both fields, so a response landing between two reads cannot pair a message
// with the wrong error flag.
export async function status(sess) {
  const s = await sess.exec("const e=document.getElementById('converter-status');return {text:e.textContent.trim(),isError:e.dataset.error==='true'};");
  return { message: s.text, error: s.isError };
}

export async function setSource(sess, format, content) {
  await selectOption(sess, "#source-format", format);
  await setValue(sess, "#source-content", content);
}

/** Clicks Inspect fields and waits for either the field table or an error. */
export async function inspectSource(sess) {
  await click(sess, "#inspect");
  return waitFor(async () => {
    const s = await status(sess);
    if (s.error) return { ok: false, ...s };
    if (/^Inspected \d+ fields/.test(s.message)) return { ok: true, ...s };
    return null;
  }, { message: "inspection to finish" });
}

export async function loadSource(sess, format, content) {
  await setSource(sess, format, content);
  const result = await inspectSource(sess);
  if (!result.ok) throw new Error(`inspect failed: ${result.message}`);
  return result;
}

export async function fieldRows(sess) {
  return sess.exec(`return [...document.querySelectorAll('#fields tr')].map(tr => {
    const c = tr.cells;
    return { path: tr.dataset.path, included: c[0].querySelector('input').checked, type: c[2].textContent.trim(), required: c[3].textContent.trim() === 'Mandatory', width: Number(c[4].querySelector('input').value), description: c[5].textContent.trim() };
  });`);
}

export async function selectFields(sess, mode) {
  await click(sess, `[data-select="${mode}"]`);
}

export async function setWidth(sess, path, width) {
  const done = await sess.exec(`const tr=[...document.querySelectorAll('#fields tr')].find(r=>r.dataset.path===arguments[0]);if(!tr)return false;const i=tr.querySelector('input[type=number]');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,String(arguments[1]));i.dispatchEvent(new Event('input',{bubbles:true}));return true;`, [path, width]);
  if (!done) throw new Error(`no field row for ${path}`);
}

export async function setInclude(sess, path, included) {
  const clicked = await sess.exec(`const tr=[...document.querySelectorAll('#fields tr')].find(r=>r.dataset.path===arguments[0]);if(!tr)return null;const c=tr.querySelector('input[type=checkbox]');if(c.checked!==arguments[1])c.click();return c.checked;`, [path, included]);
  if (clicked === null) throw new Error(`no field row for ${path}`);
}

/** Applies only the options given; anything omitted keeps the page's current value. */
export async function setOptions(sess, o = {}) {
  if (o.target) await selectOption(sess, "#target-format", o.target);
  if (o.requiredness) await selectOption(sess, "#requiredness", o.requiredness);
  if (o.flatMode) await selectOption(sess, "#flat-mode", o.flatMode);
  if (o.delimiter !== undefined) await selectOption(sess, "#delimiter", o.delimiter);
  if (o.samples !== undefined) await setValue(sess, "#sample-count", o.samples);
  if (o.repeats !== undefined) await setValue(sess, "#repeat-count", o.repeats);
}

/** Clicks Convert and waits for the preview or an error message. */
export async function convertNow(sess) {
  await click(sess, "#convert");
  return waitFor(async () => {
    const s = await status(sess);
    if (s.error) return { ok: false, ...s };
    if (/^Conversion ready/.test(s.message) && (await visible(sess, "#preview"))) return { ok: true, ...s };
    return null;
  }, { timeout: 15000, message: "conversion to finish" });
}

export async function preview(sess) {
  return {
    visible: await visible(sess, "#preview"),
    // textContent: the heading is upper-cased by CSS, which innerText would return.
    fileName: (await raw(sess, "#definition-name")).trim(),
    definition: await raw(sess, "#definition-preview"),
    validation: (await text(sess, "#validation-summary")).trim(),
    warnings: await texts(sess, "#warnings li"),
    recordLength: (await text(sess, "#record-length")).trim(),
    sampleNames: await optionTexts(sess, "#sample-picker"),
    sample: await raw(sess, "#sample-preview"),
    importNote: (await text(sess, "#import-note")).trim(),
    downloadSamplesDisabled: await isDisabled(sess, "#download-samples"),
  };
}

/** Reads every sample by walking the picker, returning [{ fileName, content }]. */
export async function allSamples(sess) {
  const names = await optionTexts(sess, "#sample-picker");
  const out = [];
  for (let i = 0; i < names.length; i++) {
    await selectOption(sess, "#sample-picker", String(i));
    out.push({ fileName: names[i], content: await raw(sess, "#sample-preview") });
  }
  return out;
}

export async function convertedCount(sess) {
  return count(sess, "#fields tr");
}

/** The request body the page sends for the current state, so the API can be asked the same question. */
export async function pageRequest(sess, { source, sourceContent, target }) {
  const rows = await fieldRows(sess);
  return {
    content: sourceContent, sourceFormat: source, targetFormat: target, inspect: false,
    selected: rows.filter((r) => r.included).map((r) => r.path),
    widths: Object.fromEntries(rows.map((r) => [r.path, r.width])),
    requiredness: await sess.exec("return document.getElementById('requiredness').value;"),
    sampleCount: Number(await sess.exec("return document.getElementById('sample-count').value;")),
    repeatCount: Number(await sess.exec("return document.getElementById('repeat-count').value;")),
    flatMode: await sess.exec("return document.getElementById('flat-mode').value;"),
    delimiter: await sess.exec("return document.getElementById('delimiter').value;"),
  };
}

/** Asks the API the same question the page asked; the definition text must match what the page shows. */
export async function apiConvert(body) {
  const res = await apiJson("/api/v1/catalog/schemas/convert", { method: "POST", body: JSON.stringify(body) });
  return res;
}
