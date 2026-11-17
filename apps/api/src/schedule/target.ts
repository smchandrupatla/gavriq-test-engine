/**
 * What a schedule or a Run-now request runs. Pure validation and wording;
 * resolution to test case ids happens in service.ts.
 */

export type RunTarget =
  | { scope: 'all' }
  | { scope: 'types'; types: string[] }
  | { scope: 'suites'; suite_ids: string[] }
  | { scope: 'cases'; case_ids: string[] };

export class TargetError extends Error {}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TYPE_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/i;

function list(value: unknown, what: string, re: RegExp, max: number): string[] {
  if (!Array.isArray(value) || !value.length) throw new TargetError(`pick at least one ${what}`);
  const out = [...new Set(value.map((v) => String(v).trim()).filter(Boolean))];
  if (out.length > max) throw new TargetError(`at most ${max} ${what}s`);
  const bad = out.find((v) => !re.test(v));
  if (bad) throw new TargetError(`"${bad}" is not a valid ${what}`);
  return out;
}

export function normalizeTarget(input: unknown): RunTarget {
  const t = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  switch (t.scope) {
    case 'all': return { scope: 'all' };
    case 'types': return { scope: 'types', types: list(t.types, 'test type', TYPE_RE, 50).map((s) => s.toLowerCase()) };
    case 'suites': return { scope: 'suites', suite_ids: list(t.suite_ids, 'suite', UUID_RE, 500) };
    case 'cases': return { scope: 'cases', case_ids: list(t.case_ids, 'test case', UUID_RE, 5000) };
    default: throw new TargetError('target.scope must be all, types, suites or cases');
  }
}

/** Target for a schedule saved before targets existed (legacy columns). */
export function legacyTarget(s: { test_case_ids?: string[] | null; test_suite_id?: string | null }): RunTarget | null {
  if (s.test_case_ids?.length) return { scope: 'cases', case_ids: s.test_case_ids };
  if (s.test_suite_id) return { scope: 'suites', suite_ids: [s.test_suite_id] };
  return null;
}

export function describeTarget(t: RunTarget | null, suiteNames: Map<string, string> = new Map()): string {
  if (!t) return 'Nothing selected';
  switch (t.scope) {
    case 'all': return 'All tests';
    case 'types': return `Types: ${t.types.join(', ')}`;
    case 'suites': {
      const names = t.suite_ids.map((id) => suiteNames.get(id) ?? id.slice(0, 8));
      return names.length > 3 ? `Suites: ${names.slice(0, 3).join(', ')} +${names.length - 3}` : `Suites: ${names.join(', ')}`;
    }
    case 'cases': return `${t.case_ids.length} selected case${t.case_ids.length === 1 ? '' : 's'}`;
  }
}
