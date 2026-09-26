/**
 * Execute an imported SIT case file (sit/cases/*.sit.ts) via node/tsx --test.
 * Script field formats from import-sit-catalog:
 *   sit/cases/00-health.sit.ts
 *   sit/cases/00-health.sit.ts::Health endpoint returns 200
 *
 * Evidence: the full TAP output is kept as a log, and anything the case writes to
 * SIT_EVIDENCE_DIR (Selenium screenshots, skip notes, reports) is attached to the result.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compact, saveEvidence, saveLog, type EvidenceRef } from '../evidence.js';

export interface SitRunInput {
  script: string;
  baseUrl?: string;
  timeoutSeconds?: number;
  /** Evidence file name prefix (execution + case key). */
  evidencePrefix?: string;
}

export interface SitRunResult {
  status: 'passed' | 'failed' | 'error' | 'skipped';
  message: string;
  duration_ms: number;
  classification?: string;
  metrics?: Record<string, unknown>;
  evidence?: EvidenceRef[];
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');

function parseScript(script: string): { fileRel: string; testName?: string } | null {
  const s = script.trim();
  if (!s.startsWith('sit/cases/') && !s.includes('.sit.ts')) return null;
  const [filePart = '', ...rest] = s.split('::');
  const fileRel = filePart.trim();
  const testName = rest.length ? rest.join('::').trim() : undefined;
  return { fileRel, testName };
}

/**
 * --test-name-pattern for an imported test name. Parameterised tests are imported with
 * their template text (`screen ${pageId} opens`), so each ${…} matches any text.
 */
export function testNamePattern(testName: string): string {
  const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return `^${testName.split(/\$\{[^}]*\}/).map(esc).join('.+')}$`;
}

/** Totals from the node:test TAP footer (# pass N, # fail N, # skipped N). */
export function tapCounts(tap: string): { pass: number; fail: number; skipped: number } {
  const n = (label: string) => Number((new RegExp(`^# ${label} (\\d+)`, 'm').exec(tap) || [])[1] || 0);
  return { pass: n('pass'), fail: n('fail'), skipped: n('skipped') };
}

const EVIDENCE_TYPES: Record<string, [string, string]> = {
  '.png': ['screenshot', 'image/png'],
  '.json': ['report', 'application/json'],
  '.txt': ['log', 'text/plain'],
  '.log': ['log', 'text/plain'],
};

/** Move what the SIT case wrote into its SIT_EVIDENCE_DIR into the shared evidence store. */
function collectWritten(dir: string, prefix: string): EvidenceRef[] {
  const out: EvidenceRef[] = [];
  try {
    for (const name of readdirSync(dir).sort()) {
      const ext = path.extname(name).toLowerCase();
      const kind = EVIDENCE_TYPES[ext];
      if (!kind) continue;
      const ref = saveEvidence(
        `${prefix}-${path.parse(name).name}`, ext.slice(1), readFileSync(path.join(dir, name)),
        kind[0], kind[1], { original_name: name }
      );
      if (ref) out.push(ref);
    }
  } catch {
    /* nothing written */
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
  return out;
}

export async function runSit(input: SitRunInput): Promise<SitRunResult> {
  const start = Date.now();
  const parsed = parseScript(input.script || '');
  if (!parsed) {
    return {
      status: 'skipped',
      message: `Not a SIT script path: ${input.script}`,
      duration_ms: Date.now() - start,
      classification: 'script_problem',
    };
  }

  const abs = path.join(root, parsed.fileRel);
  if (!existsSync(abs)) {
    return {
      status: 'failed',
      message: `SIT file not found: ${parsed.fileRel}`,
      duration_ms: Date.now() - start,
      classification: 'script_problem',
    };
  }

  const tsxBin = path.join(root, 'node_modules/tsx/dist/cli.mjs');
  const timeoutMs = (input.timeoutSeconds || 120) * 1000;
  // Each run gets its own evidence dir so its screenshots are not mixed with another run's.
  const evidenceDir = mkdtempSync(path.join(os.tmpdir(), 'sit-evidence-'));
  const prefix = input.evidencePrefix || 'sit';
  const env = {
    ...process.env,
    SIT_EVIDENCE_DIR: evidenceDir,
    ...(input.baseUrl ? { SIT_WEB_BASE: input.baseUrl, TARGET_BASE_URL: input.baseUrl } : {}),
  };

  const extra = parsed.testName ? ['--test-name-pattern', testNamePattern(parsed.testName)] : [];

  const args = existsSync(tsxBin)
    ? [tsxBin, '--test', '--test-reporter=tap', ...extra, abs]
    : ['--test', '--test-reporter=tap', '--experimental-strip-types', ...extra, abs];

  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: root,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (r: SitRunResult) => {
      if (settled) return;
      settled = true;
      const log = saveLog(`${prefix}-tap`, [
        `# command: node ${args.map((a) => (path.isAbsolute(a) ? path.relative(root, a) : a)).join(' ')}`,
        `# file: ${parsed.fileRel}${parsed.testName ? `  test: ${parsed.testName}` : ''}`,
        `# target: ${input.baseUrl || '(default)'}`,
        '',
        '## stdout (TAP)',
        stdout || '(empty)',
        '',
        '## stderr',
        stderr || '(empty)',
      ], { file: parsed.fileRel, test_name: parsed.testName || null });
      resolve({ ...r, evidence: compact([log, ...collectWritten(evidenceDir, prefix)]) });
    };

    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      finish({
        status: 'failed',
        message: `SIT timed out after ${input.timeoutSeconds || 120}s`,
        duration_ms: Date.now() - start,
        classification: 'timeout',
      });
    }, timeoutMs);

    child.stdout.on('data', (c) => { stdout += c; });
    child.stderr.on('data', (c) => { stderr += c; });
    child.on('error', (err) => {
      clearTimeout(timer);
      finish({
        status: 'error',
        message: err.message,
        duration_ms: Date.now() - start,
        classification: 'environment_problem',
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const tap = tapCounts(stdout);
      const tapFailed = /not ok \d+/m.test(stdout) || tap.fail > 0;
      const summary = stdout
        .split('\n')
        .filter((l) => /^(ok|not ok) /.test(l.trim()))
        .slice(0, 8)
        .join(' | ');
      const metrics = { exit_code: code, file: parsed.fileRel, test_name: parsed.testName || null, ...tap };
      // Exit 0 with nothing executed is not a pass: the name matched no test, or every test skipped itself.
      if (code === 0 && !tapFailed && tap.pass === 0 && /^# pass \d+/m.test(stdout)) {
        finish({
          status: 'skipped',
          message: `No test executed (${tap.skipped} skipped${parsed.testName ? `, pattern ${testNamePattern(parsed.testName)}` : ''}). ${summary}`.trim(),
          duration_ms: Date.now() - start,
          classification: 'script_problem',
          metrics,
        });
        return;
      }
      const ok = code === 0 && !tapFailed;
      finish({
        status: ok ? 'passed' : 'failed',
        message: summary || stderr.slice(0, 400) || `exit ${code}`,
        duration_ms: Date.now() - start,
        classification: ok ? undefined : 'assertion_failure',
        metrics,
      });
    });
  });
}

export function isSitScript(script?: string | null): boolean {
  if (!script) return false;
  return script.includes('sit/cases/') || script.endsWith('.sit.ts') || script.includes('.sit.ts::');
}
