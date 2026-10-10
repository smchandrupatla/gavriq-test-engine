/**
 * Host-side spawn of `playwright codegen`.
 *
 * The engine process launches `npx playwright codegen <url>` as a child
 * process. Codegen opens a headful Chromium on whatever display the engine
 * process has access to (the user's own screen when the engine runs on the
 * host; the recording is unreachable when the engine runs headless in a
 * container — the route reports that so the user can fall back to pasting a
 * codegen script instead).
 *
 * One recording session at a time. The session id addresses stop/status calls.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright';

export type RecordState = 'launching' | 'recording' | 'closing' | 'done' | 'error';

export interface StartSnapshot {
  title: string;
  summary: string;        // first ~500 chars of visible page text
  capturedAt: string;
}

export interface RecordSession {
  id: string;
  url: string;
  state: RecordState;
  output: string;         // the codegen TypeScript, filled on 'done'
  message?: string;       // last log line (for the UI's status pill)
  error?: string;
  startedAt: number;
  endedAt?: number;
  tmpDir: string;
  outFile: string;
  child?: ChildProcess;
  /** Snapshot of the start URL taken headlessly before codegen opens; the stop route folds it into the case's preconditions when the user didn't type their own. */
  snapshot?: StartSnapshot;
}

const sessions = new Map<string, RecordSession>();
let active: string | null = null;

/** Spawn codegen on the host. Resolves once the child is launched (not once recording ends). */
export async function startRecording(url: string, title?: string): Promise<RecordSession> {
  if (active) {
    const prev = sessions.get(active);
    if (prev && (prev.state === 'launching' || prev.state === 'recording')) {
      throw new Error('A recording is already in progress — stop it first.');
    }
  }
  const id = randomUUID();
  const tmpDir = await mkdtemp(path.join(tmpdir(), 'engine-codegen-'));
  const outFile = path.join(tmpDir, 'recording.ts');

  const session: RecordSession = {
    id,
    url,
    state: 'launching',
    output: '',
    startedAt: Date.now(),
    tmpDir,
    outFile,
  };
  sessions.set(id, session);
  active = id;

  // Pre-visit the start URL headlessly and keep what the page looks like
  // before the user does anything, so a replay carries a record of the
  // starting state ("pre-existing data"). Best-effort: a failure here does
  // not stop the recording.
  session.snapshot = await captureStartSnapshot(url).catch(() => undefined);

  // Prefer the project's own playwright (the api package depends on it) over
  // a globally resolved one, so we do not rely on PATH containing npx.
  const args = ['playwright', 'codegen', '--target=playwright-test', '-o', outFile, url];
  const child = spawn('npx', args, {
    cwd: process.cwd(),
    env: { ...process.env, PWDEBUG: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  });
  session.child = child;
  session.state = 'recording';

  child.stdout?.on('data', (b: Buffer) => {
    session.message = b.toString('utf8').split('\n').filter(Boolean).slice(-1)[0] || session.message;
  });
  child.stderr?.on('data', (b: Buffer) => {
    session.message = b.toString('utf8').split('\n').filter(Boolean).slice(-1)[0] || session.message;
  });
  child.on('error', (err) => {
    session.state = 'error';
    session.error = err.message;
    session.endedAt = Date.now();
    if (active === id) active = null;
  });
  child.on('exit', async (code) => {
    try {
      const txt = await readFile(outFile, 'utf8').catch(() => '');
      session.output = txt;
      if (!txt && code !== 0) {
        session.state = 'error';
        session.error = `codegen exited with code ${code} and no recording file`;
      } else {
        session.state = 'done';
      }
    } catch (err) {
      session.state = 'error';
      session.error = (err as Error).message;
    } finally {
      session.endedAt = Date.now();
      if (active === id) active = null;
    }
  });

  return session;
}

/** Ask codegen to close its browser; the exit handler flushes the recording. */
export function stopRecording(id: string): RecordSession {
  const s = sessions.get(id);
  if (!s) throw new Error('No such recording session.');
  if (s.state === 'done' || s.state === 'error') return s;
  s.state = 'closing';
  // Codegen writes its file on close; SIGTERM lets Chromium shut down cleanly.
  try {
    s.child?.kill('SIGTERM');
  } catch (err) {
    s.message = (err as Error).message;
  }
  return s;
}

export function getRecording(id: string): RecordSession | undefined {
  return sessions.get(id);
}

/** Delete the recording's tmp directory. Called after a case is created from it. */
export async function cleanupRecording(id: string): Promise<void> {
  const s = sessions.get(id);
  if (!s) return;
  try { await rm(s.tmpDir, { recursive: true, force: true }); } catch { /* ignore */ }
  sessions.delete(id);
}

/** Expose a tiny view for API responses (never leaks the ChildProcess). */
export function viewSession(s: RecordSession) {
  return {
    id: s.id,
    url: s.url,
    state: s.state,
    message: s.message,
    error: s.error,
    started_at: new Date(s.startedAt).toISOString(),
    ended_at: s.endedAt ? new Date(s.endedAt).toISOString() : null,
    has_output: Boolean(s.output),
    snapshot: s.snapshot ?? null,
  };
}

/** Headlessly open the URL and keep the title + the first ~500 chars of visible text. */
async function captureStartSnapshot(url: string): Promise<StartSnapshot | undefined> {
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_BIN || undefined,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  }).catch(() => null);
  if (!browser) return undefined;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 });
    const title = await page.title().catch(() => '');
    const body = (await page.locator('body').innerText().catch(() => '')) || '';
    const summary = body.replace(/\s+/g, ' ').trim().slice(0, 500);
    return { title, summary, capturedAt: new Date().toISOString() };
  } catch {
    return undefined;
  } finally {
    await browser.close().catch(() => undefined);
  }
}
