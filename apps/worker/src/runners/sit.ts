/**
 * Execute an imported SIT case file (sit/cases/*.sit.ts) via node/tsx --test.
 * Script field formats from import-sit-catalog:
 *   sit/cases/00-health.sit.ts
 *   sit/cases/00-health.sit.ts::Health endpoint returns 200
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export interface SitRunInput {
  script: string;
  baseUrl?: string;
  timeoutSeconds?: number;
}

export interface SitRunResult {
  status: 'passed' | 'failed' | 'error' | 'skipped';
  message: string;
  duration_ms: number;
  classification?: string;
  metrics?: Record<string, unknown>;
}

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function parseScript(script: string): { fileRel: string; testName?: string } | null {
  const s = script.trim();
  if (!s.startsWith('sit/cases/') && !s.includes('.sit.ts')) return null;
  const [filePart, ...rest] = s.split('::');
  const fileRel = filePart.trim();
  const testName = rest.length ? rest.join('::').trim() : undefined;
  return { fileRel, testName };
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
  const env = {
    ...process.env,
    ...(input.baseUrl ? { SIT_WEB_BASE: input.baseUrl, TARGET_BASE_URL: input.baseUrl } : {}),
  };

  const extra = parsed.testName
    ? ['--test-name-pattern', `^${parsed.testName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`]
    : [];

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
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
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
      resolve({
        status: 'error',
        message: err.message,
        duration_ms: Date.now() - start,
        classification: 'environment_problem',
      });
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      const tapFailed = /not ok \d+/m.test(stdout);
      const ok = code === 0 && !tapFailed;
      const summary = stdout
        .split('\n')
        .filter((l) => /^(ok|not ok) /.test(l.trim()))
        .slice(0, 8)
        .join(' | ');
      resolve({
        status: ok ? 'passed' : 'failed',
        message: summary || stderr.slice(0, 400) || `exit ${code}`,
        duration_ms: Date.now() - start,
        classification: ok ? undefined : 'assertion_failure',
        metrics: { exit_code: code, file: parsed.fileRel, test_name: parsed.testName || null },
      });
    });
  });
}

export function isSitScript(script?: string | null): boolean {
  if (!script) return false;
  return script.includes('sit/cases/') || script.endsWith('.sit.ts') || script.includes('.sit.ts::');
}
