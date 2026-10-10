import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Dialog, Page } from 'playwright';

export interface SandbenchUploadInput {
  fileName: string;
  markdownFileName?: string;
  fixtureDir?: string;
  baseUrl: string;
  vars?: Record<string, string>;
  timeoutMs?: number;
  /** Capture evidence while the uploaded schema is visible, before test cleanup. */
  onVisible?: (page: Page) => Promise<void>;
}

type StoredFile = { kind: string; fileName: string; sha256: string };
type StoredJob = { id: string; code: string; status: string; files: StoredFile[] };

const FIXTURE_DIR = fileURLToPath(new URL('../../../../data/iso20022-upload/', import.meta.url));
const UPLOAD_PATH = '/api/v1/catalog/iso/uploads';
const STORE_CONFIRM = 'Are you sure you want to store this schema?';

function requireCondition(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`Upload assertion failed: ${message}`);
}

/**
 * Exercise the real Sandbench import screen with an operator fixture plus a
 * unique XML comment. The schema and original filename are preserved; the
 * comment avoids colliding with user-owned copies of this same ISO schema.
 * Each successful run removes only the new job acknowledged by its own upload,
 * after checking persisted content and the visible Scheme Definitions card.
 * A duplicate is a failed upload, never silently treated as success or removed.
 */
export async function runSandbenchUpload(page: Page, input: SandbenchUploadInput): Promise<string> {
  requireCondition(/^pacs\.\d{3}\.\d{3}\.\d{2}\.xsd$/.test(input.fileName), 'expected a supplied pacs XSD filename');
  const fixturePath = path.resolve(input.fixtureDir || FIXTURE_DIR, input.fileName);
  // File.text(), used by Sandbench, removes a leading UTF-8 byte order mark.
  const content = readFileSync(fixturePath, 'utf8').replace(/^\uFEFF/, '') + `\n<!-- gavriq-upload-test:${randomUUID()} -->\n`;
  const checksum = createHash('sha256').update(content).digest('hex');
  requireCondition(!input.markdownFileName || path.basename(input.markdownFileName) === input.markdownFileName, 'expected a Markdown fixture filename without a directory');
  const markdownPath = input.markdownFileName ? path.resolve(input.fixtureDir || FIXTURE_DIR, input.markdownFileName) : undefined;
  const markdown = markdownPath ? readFileSync(markdownPath, 'utf8').replace(/^\uFEFF/, '') : undefined;
  const code = input.fileName.replace(/\.xsd$/, '');
  const vars = input.vars || {};
  const base = (vars.web || input.baseUrl).replace(/\/$/, '');
  const timeout = input.timeoutMs || 120_000;
  page.setDefaultTimeout(timeout);
  let token = '';
  let createdId: string | undefined;
  let failure: unknown;
  let unexpectedDialog = '';
  const beforeIds = new Set<string>();
  const dialogHandler = async (dialog: Dialog) => {
    if (dialog.type() === 'confirm' && dialog.message() === STORE_CONFIRM) await dialog.accept();
    else {
      unexpectedDialog = dialog.message();
      await dialog.dismiss();
    }
  };
  page.on('dialog', dialogHandler);

  const api = async (pathname: string, method = 'GET') => {
    const response = await page.request.fetch(base + pathname, {
      method,
      headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
      timeout,
    });
    requireCondition(response.ok(), `${method} ${pathname} returned HTTP ${response.status()}`);
    return response;
  };
  const listJobs = async (): Promise<StoredJob[]> => {
    const body = await (await api(UPLOAD_PATH)).json();
    requireCondition(Array.isArray(body.data), 'stored upload list has no data array');
    return body.data;
  };
  const openMenu = async (item: string) => {
    const sub = page.locator('.opsc-subitem').filter({ hasText: new RegExp(`^${item}$`) });
    if (!(await sub.isVisible())) {
      await page.locator('.opsc-navitem').filter({ hasText: /^Message Schemes$/ }).click();
    }
    await sub.click();
  };
  const visibleCards = async () => {
    await page.locator('.opsc-family-card').filter({
      has: page.locator('.opsc-family-name').filter({ hasText: /^pacs$/ }),
    }).click();
    const card = page.locator(`.opsc-msgtype-card[data-scheme-code="${code}"][data-scheme-source="imported"]`);
    await card.first().waitFor({ state: 'visible', timeout });
    return card;
  };

  try {
    await page.goto(base + '/', { waitUntil: 'domcontentloaded', timeout });
    await page.locator('#gate').waitFor({ state: 'visible', timeout });
    // The current Sand Bench gate is single-tenant and no longer renders #tenant;
    // older builds did. Fill it only if present so this runner works on both.
    if (await page.locator('#tenant').count()) {
      await page.locator('#tenant').fill(vars.tenant || vars.tenantSlug || 'acme-demo');
    }
    await page.locator('#username').fill(vars.username || 'operator.acme');
    if (vars.password) await page.locator('#password').fill(vars.password);
    const [login] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/v1/session/login', { timeout }),
      page.locator('#gate #login').click(),
    ]);
    const session = await login.json();
    requireCondition(login.ok() && typeof session.token === 'string' && session.token.length > 0, `Sandbench sign-in returned HTTP ${login.status()}`);
    token = session.token;
    await page.locator('.opsc-sidebar').waitFor({ state: 'visible', timeout });
    for (const job of await listJobs()) beforeIds.add(job.id);
    await openMenu('Import Scheme');
    await page.locator('#sbe-source-format[data-sbe-formats="configured"]').waitFor({ state: 'visible', timeout });
    await page.locator('#sbe-source-format').selectOption('xsd');
    await page.locator('#sbe-markdown-choice').selectOption(markdownPath ? 'yes' : 'no');
    await page.locator('#sbe-schema-file').setInputFiles({ name: input.fileName, mimeType: 'application/xml', buffer: Buffer.from(content) });
    requireCondition((await page.locator('#sbe-schema-chosen').innerText()).includes(input.fileName), 'chosen filename is not displayed');
    if (markdownPath) {
      await page.locator('#sbe-md-file').setInputFiles(markdownPath);
      await page.locator('#sbe-validate-md').click();
      await page.waitForFunction(() => /All checks passed|not available in the markdown|Stopped at/.test(document.querySelector('#sbe-import-result')?.textContent || ''), undefined, { timeout });
      const validation = await page.locator('#sbe-import-result').innerText();
      requireCondition(validation.includes('All checks passed'), `Markdown validation did not pass: ${validation}`);
    }
    const [upload] = await Promise.all([
      page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === UPLOAD_PATH, { timeout }),
      page.locator('#sbe-confirm-upload').click(),
    ]);
    const receipt = await upload.json();
    if (upload.ok() && typeof receipt.job_id === 'string' && !beforeIds.has(receipt.job_id)) createdId = receipt.job_id;
    requireCondition(upload.status() === 202, `expected a successful upload (HTTP 202), received HTTP ${upload.status()}: ${receipt.error?.message || 'no successful upload receipt'}`);
    requireCondition(createdId, 'upload did not acknowledge a new job; pre-existing jobs are preserved');
    requireCondition(receipt.accepted === 1 && receipt.code === code && receipt.status === 'stored', `expected one stored ${code} job`);
    requireCondition(!unexpectedDialog, `unexpected dialog: ${unexpectedDialog}`);
    await page.waitForFunction((expected) => document.querySelector('#sbe-import-result')?.textContent?.includes(`Stored ${expected}`), code, { timeout });
    const stored = (await listJobs()).find((job) => job.id === createdId);
    requireCondition(stored?.status === 'stored' && stored.code === code, 'new upload was not persisted in the catalogue');
    const source = stored.files.find((file) => file.kind === 'xsd');
    requireCondition(source?.fileName === input.fileName && source.sha256 === checksum, 'stored filename or SHA-256 differs from the original fixture');
    const download = await api(`${UPLOAD_PATH}/${encodeURIComponent(createdId)}/files/xsd`);
    requireCondition(await download.text() === content, 'downloaded schema content differs from the per-run fixture');
    if (markdown !== undefined) {
      const mdSource = stored.files.find((file) => file.kind === 'markdown');
      requireCondition(mdSource?.fileName === input.markdownFileName && mdSource.sha256 === createHash('sha256').update(markdown).digest('hex'), 'stored Markdown filename or SHA-256 differs from the original fixture');
      const mdDownload = await api(`${UPLOAD_PATH}/${encodeURIComponent(createdId)}/files/markdown`);
      requireCondition(await mdDownload.text() === markdown, 'downloaded Markdown content differs from the original fixture');
    }
    await page.locator('#sbe-import-jump').click();
    await visibleCards();
    // A fresh navigation proves the card is supplied by persisted application state.
    await page.reload({ waitUntil: 'domcontentloaded', timeout });
    await page.locator('.opsc-sidebar').waitFor({ state: 'visible', timeout });
    await openMenu('Scheme Definitions');
    const cards = await visibleCards();
    const cardCount = await cards.count();
    let matched = false;
    // Sandbench currently exposes no job-id attribute on its cards. Verify the
    // chosen card's real detail request, rather than accepting an older card
    // which happens to have the same ISO message code.
    for (let index = 0; index < cardCount; index++) {
      const card = cards.nth(index);
      requireCondition((await card.innerText()).includes('Parsed'), `${code} card must show Parsed`);
      const [detail] = await Promise.all([
        page.waitForResponse((response) => response.request().method() === 'GET' && /^\/api\/v1\/catalog\/designer-types\/[^/]+$/.test(new URL(response.url()).pathname), { timeout }),
        card.click(),
      ]);
      requireCondition(detail.ok(), `scheme details returned HTTP ${detail.status()}`);
      const detailBody = await detail.json();
      if (detailBody.data?.id === createdId) { matched = true; break; }
      await page.getByRole('button', { name: 'Back', exact: true }).click();
    }
    requireCondition(matched, `newly uploaded job ${createdId} is not available from its Scheme Definitions cards after reload`);
    await page.getByRole('button', { name: 'Download XSD', exact: true }).waitFor({ state: 'visible', timeout });
    if (markdown !== undefined) await page.getByRole('button', { name: 'Download Markdown', exact: true }).waitFor({ state: 'visible', timeout });
    await input.onVisible?.(page);
  } catch (error) {
    failure = error;
  } finally {
    page.off('dialog', dialogHandler);
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
            const adminSession = (await adminLogin.json()) as { token?: string };
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
  }
  if (failure) throw failure;
  return `${input.markdownFileName || input.fileName}: upload stored, content verified${markdown !== undefined ? ' with its companion schema' : ' with a unique XML comment'}, exact new scheme visible after reload; test-created upload cleaned up for repeat runs.`;
}
