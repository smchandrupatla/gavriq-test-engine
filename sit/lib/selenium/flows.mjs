// Business-flow page objects: the screens a person walks through to get from a schema to a
// scheduled feed. Each function drives real DOM, waits for the page's own evidence that the step
// finished, and returns what the page reported. Callers then confirm the same fact through the
// API, so a toast that lies (or a page that silently fails) cannot pass.
import {
  apiJson, clickText, click, findByText, localInputValue, must, pageText, rowsOf, selectOption, setValue, sleep, text,
  typeInto, uploadText, value, visible, waitFor, waitVisible,
} from "./flow.mjs";

const CONFIRM_STORE = /Are you sure you want to store this schema\?/;

/** Clicks a radio inside the label whose text starts with the given words. */
export async function chooseRadio(sess, label) {
  const ok = await sess.exec(
    "const l=[...document.querySelectorAll('label')].find(x=>(x.innerText||'').trim().startsWith(arguments[0]));if(!l)return false;const r=l.querySelector('input[type=radio]');if(!r)return false;r.scrollIntoView({block:'center'});r.click();return r.checked;",
    [label]);
  if (!ok) throw new Error(`no radio labelled "${label}"`);
}

/** Selects an option whose text contains the fragment (option texts carry row counts that change). */
export async function selectOptionContaining(sess, css, fragment) {
  const chosen = await sess.exec(
    "const e=document.querySelector(arguments[0]);if(!e)return null;const i=[...e.options].findIndex(o=>o.text.includes(arguments[1]));if(i<0)return {missing:[...e.options].map(o=>o.text.trim())};e.selectedIndex=i;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return {text:e.options[i].text.trim(),value:e.options[i].value};",
    [css, fragment]);
  if (!chosen) throw new Error(`no <select> ${css}`);
  if (chosen.missing) throw new Error(`no option containing "${fragment}" in ${css}. Options: ${chosen.missing.join(" | ")}`);
  return chosen;
}

// ------------------------------------------------------------------------------------------
// Message Schemes → Import Scheme
// ------------------------------------------------------------------------------------------
/**
 * Clicks Confirm upload and answers the "Are you sure you want to store this schema?" browser
 * dialog, so the browser must be opened with prompts: true. Returns the dialog's text.
 */
export async function confirmImport(sess, { accept = true } = {}) {
  await waitFor(async () => !(await sess.exec("return document.getElementById('sbe-confirm-upload').disabled;")), { message: "Confirm upload to enable" });
  await sess.exec("document.getElementById('sbe-confirm-upload').click();");
  const prompt = await waitFor(async () => { try { return await sess.alertText(); } catch { return null; } }, { timeout: 8000, message: "the store confirmation dialog" });
  if (!CONFIRM_STORE.test(prompt)) throw new Error(`unexpected confirmation text: ${prompt}`);
  if (accept) await sess.acceptAlert(); else await sess.dismissAlert();
  return prompt;
}

/** Imports one schema file through the Import Scheme screen (choose the format, attach the file, confirm). */
export async function importSchema(sess, browser, { format = "XSD", fileName, content, mime = "application/xml", accept = true }) {
  await browser.open("/?page=msgImportSchema");
  await waitVisible(sess, "#sbe-confirm-upload", { timeout: 20000 });
  await selectOption(sess, "#sbe-source-format", format);
  await uploadText(sess, "#sbe-schema-file", fileName, content, mime);
  await waitFor(async () => (await pageText(sess)).includes(`Chosen: ${fileName}`), { message: `the chosen file ${fileName}` });
  const prompt = await confirmImport(sess, { accept });
  return { prompt };
}

/** Waits for the import screen's verdict: a stored line, or the reason it was refused. */
export async function importOutcome(sess) {
  return waitFor(async () => {
    const t = (await text(sess, "#sbe-import-result")) || "";
    if (/^Stored\s/.test(t)) {
      const m = /^Stored\s+(\S+)(?:\s+·\s+(\d+) fields)?/.exec(t);
      return { stored: true, code: m?.[1], fieldCount: m?.[2] ? Number(m[2]) : null, text: t };
    }
    if (t && !/^Storing|^…$/.test(t) && (await sess.exec("return document.getElementById('sbe-import-result').style.color;")) !== "rgb(125, 255, 179)") {
      return { stored: false, text: t };
    }
    return null;
  }, { timeout: 30000, message: "the import result" });
}

/** The import as the API lists it, newest first. */
export async function storedImports() {
  const res = await apiJson("/api/v1/catalog/iso/uploads");
  return rowsOf(res.body);
}

// ------------------------------------------------------------------------------------------
// Message Designer → Create message definition → Publish (this is what makes a dataset)
// ------------------------------------------------------------------------------------------
/**
 * Chooses a message tile, decides one message or many, names the definition and publishes it.
 * Publishing saves the messages the definition makes as a dataset of its own.
 */
export async function publishDefinition(sess, browser, { tile, name, messages = 1 }) {
  await browser.open("/?page=messageDesigner");
  await waitVisible(sess, ".sbe-studio-msg", { timeout: 20000 });
  const before = await sess.exec("return sessionStorage.getItem('sbe_token')?1:0;");
  if (!before) throw new Error("not signed in");
  await clickText(sess, ".sbe-studio-msg", tile, { exact: false });
  await waitVisible(sess, "input[type=radio]");
  await chooseRadio(sess, messages > 1 ? "Multiple messages" : "One message");
  if (messages > 1) {
    await waitVisible(sess, "#sbe-studio-batch-count");
    await setValue(sess, "#sbe-studio-batch-count", String(messages));
  }
  await waitVisible(sess, "#sbe-studio-name");
  await typeInto(sess, "#sbe-studio-name", name);
  // The studio saves the working copy as you go, and Publish stays off until that save lands.
  await waitFor(() => sess.exec("const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Publish');return !!b&&!b.disabled;"), { timeout: 20000, message: "Publish to enable" });
  await clickText(sess, "button", "Publish");
  const line = await waitFor(async () => {
    const t = await pageText(sess);
    return new RegExp(`Dataset "${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} v\\d+" holds (\\d+) messages?`).exec(t);
  }, { timeout: 30000, message: "the published-dataset notice" });
  return { datasetName: line[0].match(/Dataset "([^"]+)"/)[1], held: Number(line[1]) };
}

export async function definitionByName(name) {
  const res = await apiJson("/api/v1/definitions");
  return rowsOf(res.body).find((d) => d.name === name) || null;
}

export async function datasetByName(name) {
  const res = await apiJson("/api/v1/datasets");
  return rowsOf(res.body).find((d) => d.name === name) || null;
}

// ------------------------------------------------------------------------------------------
// Configuration → External systems (the target a feeder sends to)
// ------------------------------------------------------------------------------------------
export async function createExternalSystem(sess, browser, { id, name, channel, endpoint = "http://testhub:8091/stub", destination = "" }) {
  await browser.open("/external-systems.html");
  await waitVisible(sess, "#add");
  await typeInto(sess, "#new-id", id);
  await typeInto(sess, "#new-name", name);
  await selectOption(sess, "#new-channel", channel);
  await typeInto(sess, "#new-endpoint", endpoint);
  await typeInto(sess, "#new-dest", destination);
  await click(sess, "#add");
  await waitFor(async () => (await text(sess, "#status")).includes(`created ${id}`), { message: "external system creation notice" });
}

export async function externalSystem(id) {
  const res = await apiJson("/api/v1/external-systems");
  return rowsOf(res.body).find((s) => s.id === id) || null;
}

// ------------------------------------------------------------------------------------------
// Data Feeders → New feeder (dataset + count + target + window + pacing)
// ------------------------------------------------------------------------------------------
export async function fillFeeder(sess, f) {
  await typeInto(sess, "#df-name", f.name);
  if (f.description !== undefined) await typeInto(sess, "#df-description", f.description);
  await selectOptionContaining(sess, "select", f.dataset);
  if (f.count !== undefined) await setValue(sess, "#df-count", String(f.count));
  if (f.order) await clickText(sess, "button", f.order === "random" ? "Random" : "In order");
  if (f.system) await selectOptionContaining(sess, "#df-system", f.system);
  if (f.start) await setValue(sess, "#df-start", localInputValue(f.start));
  if (f.end) await setValue(sess, "#df-end", localInputValue(f.end));
  if (f.gaps) {
    for (const g of f.gaps) await clickText(sess, "button", g);
  }
  if (f.interval !== undefined) {
    await sess.exec("const r=[...document.querySelectorAll('input[name=pacingMode]')].find(x=>x.value==='fixed'||/fixed/i.test((x.closest('label')||{}).innerText||''));if(r)r.click();");
    await setValue(sess, "#df-interval", String(f.interval));
  }
}

export async function saveFeeder(sess) {
  await click(sess, "#df-save");
  return waitFor(async () => {
    const m = /[?&]id=(dfd_[A-Za-z0-9]+)/.exec(String(await sess.url()));
    return m ? m[1] : null;
  }, { timeout: 20000, message: "the saved feeder id in the address bar" });
}

export async function feederFromApi(id) {
  const res = await apiJson(`/api/v1/data-feeders/${id}`);
  return res.status === 200 ? ((res.body && res.body.data) || res.body) : null;
}

export { findByText, must, value, visible, sleep };
