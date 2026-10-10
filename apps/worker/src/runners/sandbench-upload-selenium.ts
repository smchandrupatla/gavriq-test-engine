import { createHash, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { By, Select, until, type WebDriver } from 'selenium-webdriver';

export interface SandbenchUploadSeleniumInput {
  fileName: string;
  markdownFileName?: string;
  fixtureDir?: string;
  baseUrl: string;
  vars?: Record<string, string>;
  timeoutMs?: number;
  /** Capture evidence while the uploaded schema is visible, before test cleanup. */
  onVisible?: (driver: WebDriver) => Promise<void>;
}

type StoredFile = { kind: string; fileName: string; sha256: string };
type StoredJob = { id: string; code: string; status: string; files: StoredFile[] };
type Captured = { url: string; method: string; status: number; ok: boolean; body: string; ts: number };

const FIXTURE_DIR = fileURLToPath(new URL('../../../../data/iso20022-upload/', import.meta.url));
const UPLOAD_PATH = '/api/v1/catalog/iso/uploads';
const STORE_CONFIRM = 'Are you sure you want to store this schema?';

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Upload assertion failed: ${message}`);
}

function pathOf(url: string, base: string): string {
  try {
    return new URL(url, base).pathname;
  } catch {
    return url;
  }
}

// Selenium has no built-in network-response interception (unlike Playwright's
// page.waitForResponse). Listening to CDP's Network domain directly, over the
// devtools WebSocket already opened for the session, avoids two problems a
// page-injected fetch/XHR shim has: it can't miss a request just because the
// page's own bundle captured a native fetch/XHR reference before the shim
// installed, and it never needs polling via extra WebDriver commands (which
// contend with the open CDP socket and can stall indefinitely under load).
async function installNetworkCapture(driver: WebDriver): Promise<Captured[]> {
  const connection = await (driver as any).createCDPConnection('page');
  await connection.send('Network.enable', {});
  const log: Captured[] = [];
  const requests = new Map<string, { url: string; method: string }>();
  const responses = new Map<string, { status: number }>();
  connection._wsConnection.on('message', (raw: unknown) => {
    let msg: any;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    if (msg.method === 'Network.requestWillBeSent') {
      const p = msg.params;
      requests.set(p.requestId, { url: p.request.url, method: String(p.request.method || 'GET').toUpperCase() });
    } else if (msg.method === 'Network.responseReceived') {
      const p = msg.params;
      responses.set(p.requestId, { status: p.response.status });
    } else if (msg.method === 'Network.loadingFinished') {
      const requestId = msg.params.requestId;
      const req = requests.get(requestId);
      const res = responses.get(requestId);
      if (!req || !res) return;
      connection
        .send('Network.getResponseBody', { requestId })
        .then((result: any) => {
          log.push({ url: req.url, method: req.method, status: res.status, ok: res.status >= 200 && res.status < 300, body: result?.result?.body ?? '', ts: Date.now() });
        })
        .catch(() => {
          log.push({ url: req.url, method: req.method, status: res.status, ok: res.status >= 200 && res.status < 300, body: '', ts: Date.now() });
        });
    }
  });
  return log;
}

async function waitForCapture(log: Captured[], timeout: number, after: number, match: (entry: Captured) => boolean): Promise<Captured> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const hit = log.find((entry) => entry.ts >= after && match(entry));
    if (hit) return hit;
    if (Date.now() > deadline) throw new Error('Timed out waiting for a matching network response');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function located(driver: WebDriver, selector: string, timeout: number) {
  return driver.wait(until.elementLocated(By.css(selector)), timeout);
}

async function visible(driver: WebDriver, selector: string, timeout: number) {
  const element = await located(driver, selector, timeout);
  await driver.wait(until.elementIsVisible(element), timeout);
  return element;
}

async function elementText(driver: WebDriver, selector: string): Promise<string> {
  const els = await driver.findElements(By.css(selector));
  return els.length ? (await els[0]!.getText()) || '' : '';
}

async function openMenu(driver: WebDriver, item: string, timeout: number) {
  const xpath = `//*[contains(concat(' ', normalize-space(@class), ' '), ' opsc-subitem ') and normalize-space(.)='${item}']`;
  const already = await driver.findElements(By.xpath(xpath));
  const shown = already.length ? await already[0]!.isDisplayed().catch(() => false) : false;
  if (!shown) {
    const navItems = await driver.findElements(By.xpath(`//*[contains(concat(' ', normalize-space(@class), ' '), ' opsc-navitem ') and normalize-space(.)='Message Schemes']`));
    requireCondition(navItems.length, 'Message Schemes nav item not found');
    await navItems[0]!.click();
  }
  const sub = await driver.wait(until.elementLocated(By.xpath(xpath)), timeout);
  await driver.wait(until.elementIsVisible(sub), timeout);
  await sub.click();
}

// Polls rather than taking an instant snapshot: called right after a fresh
// navigation (initial load, or a reload back from the designer canvas), so the
// family grid may not have finished rendering yet.
async function openPacsFamily(driver: WebDriver, timeout: number) {
  const target = await driver.wait(async () => {
    const cards = await driver.findElements(By.css('.opsc-family-card'));
    for (const card of cards) {
      const names = await card.findElements(By.css('.opsc-family-name'));
      if (names.length && (await names[0]!.getText()).trim() === 'pacs') return card;
    }
    return null;
  }, timeout, 'pacs family card not found');
  await target.click();
}

async function importedCards(driver: WebDriver, code: string, timeout: number) {
  const selector = `.opsc-msgtype-card[data-scheme-code="${code}"][data-scheme-source="imported"]`;
  await driver.wait(until.elementLocated(By.css(selector)), timeout);
  const cards = await driver.findElements(By.css(selector));
  await driver.wait(until.elementIsVisible(cards[0]!), timeout);
  return cards;
}

// Matches a button-role control by its exact text, whether it is a real
// <button> or an <a>/role="button"-style download control.
async function waitButtonVisible(driver: WebDriver, label: string, timeout: number) {
  const xpath = `//*[(self::button or self::a or @role='button') and normalize-space(.)='${label}']`;
  const btn = await driver.wait(until.elementLocated(By.xpath(xpath)), timeout);
  await driver.wait(until.elementIsVisible(btn), timeout);
}

/**
 * Selenium equivalent of runSandbenchUpload (playwright.ts): exercises the same
 * real Sandbench import screen with the same operator fixture plus a unique XML
 * comment, verified end to end via CDP network capture and direct API calls
 * (Selenium has no page.request/page.waitForResponse equivalent).
 */
export async function runSandbenchUploadSelenium(driver: WebDriver, input: SandbenchUploadSeleniumInput): Promise<string> {
  requireCondition(/^pacs\.\d{3}\.\d{3}\.\d{2}\.xsd$/.test(input.fileName), 'expected a supplied pacs XSD filename');
  const fixturePath = path.resolve(input.fixtureDir || FIXTURE_DIR, input.fileName);
  // File.text(), used by Sandbench, removes a leading UTF-8 byte order mark.
  const content = readFileSync(fixturePath, 'utf8').replace(/^﻿/, '') + `\n<!-- gavriq-upload-test:${randomUUID()} -->\n`;
  const checksum = createHash('sha256').update(content).digest('hex');
  requireCondition(!input.markdownFileName || path.basename(input.markdownFileName) === input.markdownFileName, 'expected a Markdown fixture filename without a directory');
  const markdownPath = input.markdownFileName ? path.resolve(input.fixtureDir || FIXTURE_DIR, input.markdownFileName) : undefined;
  const markdown = markdownPath ? readFileSync(markdownPath, 'utf8').replace(/^﻿/, '') : undefined;
  const code = input.fileName.replace(/\.xsd$/, '');
  const vars = input.vars || {};
  const base = (vars.web || input.baseUrl).replace(/\/$/, '');
  const timeout = input.timeoutMs || 120_000;

  // sendKeys() on a file input needs a real path on disk; Playwright can hand
  // Chromium an in-memory buffer, Selenium cannot.
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'gte-sandbench-upload-'));
  const tmpXsdPath = path.join(tmpDir, input.fileName);
  writeFileSync(tmpXsdPath, content, 'utf8');

  let token = '';
  let createdId: string | undefined;
  let failure: unknown;
  const beforeIds = new Set<string>();

  const api = async (pathname: string, method = 'GET') => {
    const response = await fetch(base + pathname, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
    });
    requireCondition(response.ok, `${method} ${pathname} returned HTTP ${response.status}`);
    return response;
  };
  const listJobs = async (): Promise<StoredJob[]> => {
    const body = await (await api(UPLOAD_PATH)).json();
    requireCondition(Array.isArray(body.data), 'stored upload list has no data array');
    return body.data;
  };

  try {
    const networkLog = await installNetworkCapture(driver);
    await driver.get(base + '/');
    await visible(driver, '#gate', timeout);

    // The current Sand Bench gate is single-tenant and no longer renders #tenant;
    // older builds did. Fill it only if present so this runner works on both.
    const tenantMatches = await driver.findElements(By.css('#tenant'));
    if (tenantMatches.length) {
      const tenant = tenantMatches[0]!;
      await tenant.clear();
      await tenant.sendKeys(vars.tenant || vars.tenantSlug || 'acme-demo');
    }
    const username = await located(driver, '#username', timeout);
    await username.clear();
    await username.sendKeys(vars.username || 'operator.acme');
    if (vars.password) {
      const password = await located(driver, '#password', timeout);
      await password.clear();
      await password.sendKeys(vars.password);
    }

    const loginAfter = Date.now();
    await (await located(driver, '#gate #login', timeout)).click();
    const login = await waitForCapture(networkLog, timeout, loginAfter, (e) => e.method === 'POST' && pathOf(e.url, base) === '/api/v1/session/login');
    requireCondition(login.ok, `Sandbench sign-in returned HTTP ${login.status}`);
    // The UI's sign-in network event confirms the gate accepted the credentials; a
    // separate direct API login then yields the Bearer token the API calls below use
    // — selenium-wire does not always decode the response body when the server sends
    // it chunked, so parsing login.body is unreliable here.
    const apiLogin = await fetch(base + '/api/v1/session/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: vars.username || 'operator', password: vars.password || 'password' }),
    });
    requireCondition(apiLogin.ok, `Sandbench API sign-in returned HTTP ${apiLogin.status}`);
    const apiSession = (await apiLogin.json()) as { token?: string };
    requireCondition(typeof apiSession.token === 'string' && apiSession.token.length > 0, 'Sandbench API sign-in returned a response without a token');
    token = apiSession.token!;

    await visible(driver, '.opsc-sidebar', timeout);
    for (const job of await listJobs()) beforeIds.add(job.id);

    await openMenu(driver, 'Import Scheme', timeout);
    await visible(driver, '#sbe-source-format[data-sbe-formats="configured"]', timeout);
    await new Select(await located(driver, '#sbe-source-format', timeout)).selectByValue('xsd');
    await new Select(await located(driver, '#sbe-markdown-choice', timeout)).selectByValue(markdownPath ? 'yes' : 'no');
    await (await located(driver, '#sbe-schema-file', timeout)).sendKeys(tmpXsdPath);
    requireCondition((await elementText(driver, '#sbe-schema-chosen')).includes(input.fileName), 'chosen filename is not displayed');

    if (markdownPath) {
      await (await located(driver, '#sbe-md-file', timeout)).sendKeys(markdownPath);
      await (await located(driver, '#sbe-validate-md', timeout)).click();
      await driver.wait(async () => /All checks passed|not available in the markdown|Stopped at/.test(await elementText(driver, '#sbe-import-result')), timeout);
      const validation = await elementText(driver, '#sbe-import-result');
      requireCondition(validation.includes('All checks passed'), `Markdown validation did not pass: ${validation}`);
    }

    let unexpectedDialog = '';
    const uploadAfter = Date.now();
    await (await located(driver, '#sbe-confirm-upload', timeout)).click();
    try {
      await driver.wait(until.alertIsPresent(), 5000);
      const alert = await driver.switchTo().alert();
      const text = await alert.getText();
      if (text === STORE_CONFIRM) await alert.accept();
      else {
        unexpectedDialog = text;
        await alert.dismiss();
      }
    } catch (err) {
      if (!/NoSuchAlert|TimeoutError|no such alert/i.test(String(err))) throw err;
    }
    const upload = await waitForCapture(networkLog, timeout, uploadAfter, (e) => e.method === 'POST' && pathOf(e.url, base) === UPLOAD_PATH);
    const receipt = JSON.parse(upload.body || '{}');
    if (upload.ok && typeof receipt.job_id === 'string' && !beforeIds.has(receipt.job_id)) createdId = receipt.job_id;
    requireCondition(upload.status === 202, `expected a successful upload (HTTP 202), received HTTP ${upload.status}: ${receipt.error?.message || 'no successful upload receipt'}`);
    requireCondition(createdId, 'upload did not acknowledge a new job; pre-existing jobs are preserved');
    requireCondition(receipt.accepted === 1 && receipt.code === code && receipt.status === 'stored', `expected one stored ${code} job`);
    requireCondition(!unexpectedDialog, `unexpected dialog: ${unexpectedDialog}`);
    await driver.wait(async () => (await elementText(driver, '#sbe-import-result')).includes(`Stored ${code}`), timeout);

    const stored = (await listJobs()).find((job) => job.id === createdId);
    requireCondition(stored?.status === 'stored' && stored.code === code, 'new upload was not persisted in the catalogue');
    const source = stored.files.find((file) => file.kind === 'xsd');
    requireCondition(source?.fileName === input.fileName && source.sha256 === checksum, 'stored filename or SHA-256 differs from the original fixture');
    const download = await api(`${UPLOAD_PATH}/${encodeURIComponent(createdId)}/files/xsd`);
    requireCondition((await download.text()) === content, 'downloaded schema content differs from the per-run fixture');
    if (markdown !== undefined) {
      const mdSource = stored.files.find((file) => file.kind === 'markdown');
      requireCondition(mdSource?.fileName === input.markdownFileName && mdSource.sha256 === createHash('sha256').update(markdown).digest('hex'), 'stored Markdown filename or SHA-256 differs from the original fixture');
      const mdDownload = await api(`${UPLOAD_PATH}/${encodeURIComponent(createdId)}/files/markdown`);
      requireCondition((await mdDownload.text()) === markdown, 'downloaded Markdown content differs from the original fixture');
    }

    await (await located(driver, '#sbe-import-jump', timeout)).click();
    await openPacsFamily(driver, timeout);
    await importedCards(driver, code, timeout);

    // Clicking a card opens the full schema designer/canvas view, which carries
    // no reliable way back to the card list (no "Back" button, and re-clicking
    // the already-active "Scheme Definitions" nav item is a no-op in this SPA's
    // router). A full page reload each iteration is slower but unambiguous: it
    // always lands back on the same persisted card list from scratch, proving
    // the card is supplied by persisted application state.
    let matched = false;
    let cardCount = -1;
    for (let index = 0; cardCount === -1 || index < cardCount; index++) {
      await driver.navigate().refresh();
      await visible(driver, '.opsc-sidebar', timeout);
      await openMenu(driver, 'Scheme Definitions', timeout);
      await openPacsFamily(driver, timeout);
      const cards = await importedCards(driver, code, timeout);
      cardCount = cards.length;
      if (index >= cardCount) break;
      const card = cards[index]!;
      requireCondition((await card.getText()).includes('Parsed'), `${code} card must show Parsed`);
      const detailAfter = Date.now();
      await card.click();
      const detail = await waitForCapture(networkLog, timeout, detailAfter, (e) => e.method === 'GET' && /^\/api\/v1\/catalog\/designer-types\/[^/]+$/.test(pathOf(e.url, base)));
      requireCondition(detail.ok, `scheme details returned HTTP ${detail.status}`);
      const detailBody = JSON.parse(detail.body || '{}');
      if (detailBody.data?.id === createdId) {
        matched = true;
        break;
      }
    }
    requireCondition(matched, `newly uploaded job ${createdId} is not available from its Scheme Definitions cards after reload`);
    await waitButtonVisible(driver, 'Download XSD', timeout);
    if (markdown !== undefined) await waitButtonVisible(driver, 'Download Markdown', timeout);
    await input.onVisible?.(driver);
  } catch (error) {
    failure = error;
  } finally {
    if (createdId) {
      try {
        // The pinned Sand Bench baseline grants operator identities create but
        // not delete on designer types; cleanup therefore re-authenticates as
        // the tenant admin before issuing the DELETE, same identity the admin
        // console would use. The main upload assertions above already proved
        // store/visibility succeeded under the operator identity.
        let cleanupToken = token;
        try {
          const adminLogin = await fetch(base + '/api/v1/session/login', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ username: 'admin', password: vars.password || 'password' }),
          });
          if (adminLogin.ok) {
            const adminSession = await adminLogin.json();
            if (typeof adminSession.token === 'string' && adminSession.token.length > 0) cleanupToken = adminSession.token;
          }
        } catch { /* fall through with operator token */ }
        const deleteRes = await fetch(base + `/api/v1/catalog/designer-types/${encodeURIComponent(createdId)}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${cleanupToken}`, accept: 'application/json' },
        });
        requireCondition(deleteRes.ok, `DELETE /api/v1/catalog/designer-types/${createdId} returned HTTP ${deleteRes.status}`);
        requireCondition(!(await listJobs()).some((job) => job.id === createdId), `test-created upload ${createdId} was not cleaned up`);
      } catch (cleanupError) {
        failure = new Error(`${failure instanceof Error ? failure.message + '; ' : ''}Test cleanup failed for ${createdId}: ${cleanupError instanceof Error ? cleanupError.message : String(cleanupError)}`);
      }
    }
    rmSync(tmpDir, { recursive: true, force: true });
  }
  if (failure) throw failure;
  return `${input.markdownFileName || input.fileName}: upload stored, content verified${markdown !== undefined ? ' with its companion schema' : ' with a unique XML comment'}, exact new scheme visible after reload; test-created upload cleaned up for repeat runs.`;
}
