/**
 * Pre-flight atomic-contract check for test cases.
 *
 * Scans the case's steps + cleanupSteps (and any precondition steps) and
 * refuses to run when a `{{var}}` reference cannot resolve — either from
 * the environment's config vars, from a prior step's `save:`, or from a
 * known atomicityNote carve-out. The CI audit at
 * `scripts/audit-case-atomicity.mts` catches these at catalog-authoring
 * time; this is the runner-side belt-and-braces for cases that slipped in
 * through another path (SIT imports, worker-only step injection, manual DB
 * edits).
 *
 * Only HTTP cases are checked; UI runners (Playwright, Selenium) use their
 * own substitution shapes.
 *
 * Returns null when the case shape is sound; otherwise a short reason the
 * caller turns into a failed RunnerResult.
 */
export function validateCaseShape(tc: any, vars: Record<string, string>): string | null {
  const method = (tc?.execution_method || '').toLowerCase();
  if (method !== 'http' && method !== 'rest' && method !== 'api') return null;
  const rules = tc?.validation_rules || {};
  const steps = Array.isArray(tc?.steps) ? tc.steps : [];
  const cleanup = Array.isArray(rules.cleanup_steps) ? rules.cleanup_steps : [];

  // Cases that acknowledge their shape at the catalog level bypass the
  // var-resolution gate.
  const atomNote = rules.atomicity_note || tc?.atomicity_note;
  if (atomNote && typeof atomNote === 'object' && typeof atomNote.reason === 'string') {
    if (['reads-baseline', 'no-cleanup-endpoint', 'pending-cleanup', 'pending-split'].includes(atomNote.reason)) {
      return null;
    }
  }

  // The http runner (apps/worker/src/runners/http.ts) injects `base`, `ts` and
  // `rand` into every case's vars at execution time — a case that references
  // {{ts}} or {{rand}} resolves correctly at runtime but failed this shape
  // check which only inspects the operator-authored env config vars. Treat
  // them as always-known so the shape gate stays in sync with the runtime.
  const KNOWN_VARS = new Set([...Object.keys(vars), 'base', 'ts', 'rand']);
  const savedByMain = new Set<string>();

  const collectRefs = (node: unknown, out: Set<string>): void => {
    if (node == null) return;
    if (typeof node === 'string') {
      for (const m of node.matchAll(/\{\{\s*([\w.-]+)\s*\}\}/g)) out.add(m[1]);
      return;
    }
    if (Array.isArray(node)) { for (const x of node) collectRefs(x, out); return; }
    if (typeof node === 'object') { for (const v of Object.values(node as Record<string, unknown>)) collectRefs(v, out); }
  };

  for (const [i, s] of (steps as any[]).entries()) {
    if (!s || typeof s !== 'object') continue;
    const refs = new Set<string>();
    collectRefs(s, refs);
    for (const r of refs) {
      if (KNOWN_VARS.has(r) || savedByMain.has(r)) continue;
      return `step ${i + 1}: references unresolved {{${r}}} — the atomic contract requires every var to come from env config or a prior step save (see .github/skills/test-case-lifecycle/SKILL.md)`;
    }
    for (const name of Object.keys(s.save || {})) savedByMain.add(name);
  }

  // Cleanup steps can also save vars for later cleanup steps (e.g. a GET that
  // captures an ETag so the following DELETE sends an If-Match). Walk cleanup
  // in order and track its own saves alongside what main saved.
  const savedByCleanup = new Set<string>();
  for (const [i, s] of (cleanup as any[]).entries()) {
    if (!s || typeof s !== 'object') continue;
    const refs = new Set<string>();
    collectRefs(s, refs);
    for (const r of refs) {
      if (KNOWN_VARS.has(r) || savedByMain.has(r) || savedByCleanup.has(r)) continue;
      // `skip_if_missing` protects a cleanup step that references a var only
      // some code paths saved — if the var is listed there, it's an opt-in
      // skip, not a shape violation.
      const skipIf = Array.isArray(s.skip_if_missing) ? s.skip_if_missing : [];
      if (skipIf.includes(r)) continue;
      return `cleanup step ${i + 1}: references unresolved {{${r}}} — add it to skip_if_missing or save it in main steps`;
    }
    for (const name of Object.keys(s.save || {})) savedByCleanup.add(name);
  }

  return null;
}
