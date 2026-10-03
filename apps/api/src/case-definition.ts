/**
 * What actually runs behind a test case.
 *
 * The worker picks a runner from execution_method + script + steps + validation_rules.
 * A case with none of those used to fall through to "GET the base URL" and pass, which
 * made placeholder catalog rows look like real passing tests. This module is the single
 * place that decides whether a case is executable and where its source lives, so the
 * API (definition view, catalog audit) and the worker (refuse to fake-pass) agree.
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type DefinitionKind = 'sit-file' | 'named-script' | 'steps' | 'performance' | 'placeholder';

export interface CaseLike {
  key?: string | null;
  execution_method?: string | null;
  script?: string | null;
  steps?: unknown;
  validation_rules?: unknown;
}

export interface Classification {
  kind: DefinitionKind;
  runner: string;
  executable: boolean;
  reason: string;
}

export interface Definition extends Classification {
  language: 'typescript' | 'json' | 'text';
  file: string | null;
  test_name: string | null;
  source: string | null;
  file_source: string | null;
  config: Record<string, unknown> | null;
}

/** Named scripts each runner implements (kept in step with the runner sources by a unit test). */
export const NAMED_SCRIPTS: Record<string, string[]> = {
  selenium: [
    'smoke_home', 'nav_to_login', 'login_page_elements', 'login_submit',
    'header_branding', 'dashboard_widgets', 'full_smoke_suite',
  ],
  playwright: ['smoke_home', 'nav_to_login', 'login_page_elements', 'full_smoke_suite'],
  http: ['health', 'smoke_health'],
};

export const RUNNER_FILES: Record<string, string> = {
  selenium: 'apps/worker/src/runners/selenium.ts',
  playwright: 'apps/worker/src/runners/playwright.ts',
  http: 'apps/worker/src/runners/http.ts',
  performance: 'apps/worker/src/runners/performance.ts',
  sit: 'apps/worker/src/runners/sit.ts',
};

const PERF_METHODS = new Set(['performance', 'load', 'k6', 'endurance', 'soak']);
const HTTP_METHODS = new Set(['http', 'rest', 'api']);

export function isSitScript(script?: string | null): boolean {
  if (!script) return false;
  return script.includes('sit/cases/') || script.endsWith('.sit.ts') || script.includes('.sit.ts::');
}

function runnerFor(method: string): string {
  if (PERF_METHODS.has(method)) return 'performance';
  if (HTTP_METHODS.has(method)) return 'http';
  if (method === 'playwright') return 'playwright';
  return 'selenium';
}

function hasKeys(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0;
}

export function classifyCase(tc: CaseLike): Classification {
  const method = String(tc.execution_method || 'selenium').toLowerCase();
  const script = String(tc.script || '').trim();
  const steps = Array.isArray(tc.steps) ? tc.steps : [];

  if (isSitScript(script) || method === 'sit') {
    return { kind: 'sit-file', runner: 'sit', executable: isSitScript(script), reason: isSitScript(script) ? 'Runs a Sand Bench SIT case file.' : 'Method is sit but no sit/cases file is set.' };
  }
  const runner = runnerFor(method);
  if (runner === 'performance') {
    const rules = tc.validation_rules;
    if (hasKeys(rules) || script) {
      return { kind: 'performance', runner, executable: true, reason: 'Concurrent HTTP load with SLA checks.' };
    }
    return { kind: 'placeholder', runner, executable: false, reason: 'Performance case with no target path, load profile or SLA (validation_rules is empty).' };
  }
  if (steps.length) {
    return { kind: 'steps', runner, executable: true, reason: `${steps.length} scripted ${runner} step(s).` };
  }
  if (script) {
    if ((NAMED_SCRIPTS[runner] || []).includes(script)) {
      return { kind: 'named-script', runner, executable: true, reason: `Named ${runner} script "${script}".` };
    }
    return { kind: 'placeholder', runner, executable: false, reason: `Script "${script}" is not a named ${runner} script, so nothing specific would run.` };
  }
  return { kind: 'placeholder', runner, executable: false, reason: 'No script, steps or runner config. The worker would only load the base URL, which proves nothing about this case.' };
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Index just past the brace that closes the one opening at `open`. Skips strings,
 * template literals (with ${} nesting), regex-free comments. Returns -1 when unbalanced.
 */
export function matchBrace(src: string, open: number): number {
  // Stack of open contexts: '{' code brace, '${' template expression, or a quote char.
  const stack: string[] = [];
  for (let i = open; i < src.length; i++) {
    const c = src[i]!;
    const top = stack[stack.length - 1];
    if (top === "'" || top === '"') {
      if (c === '\\') i++;
      else if (c === top || c === '\n') stack.pop();
      continue;
    }
    if (top === '`') {
      if (c === '\\') i++;
      else if (c === '`') stack.pop();
      else if (c === '$' && src[i + 1] === '{') { stack.push('${'); i++; }
      continue;
    }
    if (c === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; continue; }
    if (c === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 1; continue; }
    if (c === "'" || c === '"' || c === '`') { stack.push(c); continue; }
    if (c === '{') { stack.push('{'); continue; }
    if (c === '}') {
      const popped = stack.pop();
      if (popped === '{' && stack.length === 0) return i + 1;
    }
  }
  return -1;
}

/** Whole lines from the one holding `start` to the one holding the brace that closes the first `{` after it. */
export function extractFrom(src: string, start: number): string | null {
  if (start < 0) return null;
  const open = src.indexOf('{', start);
  if (open < 0) return null;
  const end = matchBrace(src, open);
  if (end < 0) return null;
  const lineStart = src.lastIndexOf('\n', start) + 1;
  const nl = src.indexOf('\n', end);
  return src.slice(lineStart, nl < 0 ? src.length : nl).replace(/\s+$/, '');
}

export function extractTestBlock(src: string, testName: string): string | null {
  const re = new RegExp(`\\b(?:test|it)\\s*\\(\\s*[\`'"]${escapeRe(testName)}[\`'"]`);
  const m = re.exec(src);
  return m ? extractFrom(src, m.index) : null;
}

export function extractNamedScript(src: string, runner: string, name: string): string | null {
  if (runner === 'http') {
    const m = /if\s*\(\s*input\.script\s*===\s*'health'/.exec(src);
    return m ? extractFrom(src, m.index) : null;
  }
  const m = new RegExp(`\\basync\\s+${escapeRe(name)}\\s*\\(`).exec(src);
  return m ? extractFrom(src, m.index) : null;
}

const MAX_FILE = 200_000;

function readRepoFile(root: string, rel: string): string | null {
  const full = path.resolve(root, rel);
  if (!full.startsWith(path.resolve(root)) || !existsSync(full)) return null;
  const text = readFileSync(full, 'utf8');
  return text.length > MAX_FILE ? text.slice(0, MAX_FILE) + '\n/* … truncated … */' : text;
}

export function resolveDefinition(tc: CaseLike, root: string): Definition {
  const cls = classifyCase(tc);
  const base: Definition = {
    ...cls, language: 'text', file: null, test_name: null, source: null, file_source: null, config: null,
  };
  const script = String(tc.script || '').trim();

  if (cls.kind === 'sit-file' && cls.executable) {
    const [filePart = '', ...rest] = script.split('::');
    const file = filePart.trim();
    const testName = rest.length ? rest.join('::').trim() : null;
    const src = readRepoFile(root, file);
    const out: Definition = { ...base, language: 'typescript', file, test_name: testName };
    if (src == null) return { ...out, executable: false, reason: `SIT file ${file} is not in this engine build.` };
    out.file_source = src;
    if (!testName) return { ...out, source: src };
    const block = extractTestBlock(src, testName);
    if (!block) return { ...out, executable: false, reason: `Test "${testName}" is no longer in ${file} (stale import).` };
    return { ...out, source: block };
  }

  if (cls.kind === 'named-script') {
    const file = RUNNER_FILES[cls.runner] || null;
    const src = file ? readRepoFile(root, file) : null;
    return {
      ...base, language: 'typescript', file, test_name: script,
      source: src ? extractNamedScript(src, cls.runner, script) : null,
    };
  }

  if (cls.kind === 'steps') {
    return {
      ...base, language: 'json', file: RUNNER_FILES[cls.runner] || null,
      source: JSON.stringify(tc.steps, null, 2),
    };
  }

  if (cls.kind === 'performance') {
    const file = RUNNER_FILES.performance!;
    const src = readRepoFile(root, file);
    const runnerBody = src ? extractFrom(src, src.search(/export async function runPerformance/)) : null;
    const rules = hasKeys(tc.validation_rules) ? tc.validation_rules : {};
    return {
      ...base, language: 'json', file, config: rules,
      source: JSON.stringify(rules, null, 2),
      file_source: runnerBody,
    };
  }

  return base;
}
