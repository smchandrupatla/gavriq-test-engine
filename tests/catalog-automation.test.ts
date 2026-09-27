/**
 * Every Sand Bench catalog case is either backed by a real script / load profile or
 * retired with a reason — never a placeholder. Guards data/sandbench-catalog-automation.json.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyCase, resolveDefinition } from '../apps/api/src/case-definition.ts';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = path.join(root, 'data');

type Entry = { script?: string; execution_method?: string; validation_rules?: Record<string, unknown>; title?: string; retire?: string };

function catalogKeys(): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const f of readdirSync(dataDir).filter((n) => /^sandbench-catalog(-part\d+)?\.json$/.test(n)).sort()) {
    const { types } = JSON.parse(readFileSync(path.join(dataDir, f), 'utf8')) as { types: Array<{ key: string; suites: Array<{ id: string; cases: Array<{ name: string }> }> }> };
    for (const t of types) {
      if (seen.has(t.key)) continue;
      seen.add(t.key);
      for (const s of t.suites) for (const c of s.cases) keys.push(`${t.key}/${s.id}/${c.name}`);
    }
  }
  return keys;
}

const automation = JSON.parse(readFileSync(path.join(dataDir, 'sandbench-catalog-automation.json'), 'utf8')) as { cases: Record<string, Entry> };

describe('catalog automation map', () => {
  it('covers every catalog case and nothing else', () => {
    const keys = catalogKeys();
    assert.ok(keys.length >= 100, `expected the full catalog, got ${keys.length}`);
    const missing = keys.filter((k) => !automation.cases[k]);
    const extra = Object.keys(automation.cases).filter((k) => !keys.includes(k));
    assert.deepEqual(missing, [], 'catalog cases with no automation decision');
    assert.deepEqual(extra, [], 'automation entries for cases not in the catalog');
  });

  it('gives each case exactly one decision: a script, a load profile, or a retirement reason', () => {
    for (const [key, e] of Object.entries(automation.cases)) {
      const kinds = [e.script, e.validation_rules, e.retire].filter(Boolean).length;
      assert.equal(kinds, 1, `${key} must have exactly one of script / validation_rules / retire`);
      if (e.retire) assert.ok(e.retire.length > 15, `${key} needs a real retirement reason`);
    }
  });

  it('points every scripted case at a SIT test that exists', () => {
    for (const [key, e] of Object.entries(automation.cases)) {
      if (!e.script) continue;
      const def = resolveDefinition({ execution_method: 'sit', script: e.script }, root);
      assert.equal(def.executable, true, `${key}: ${def.reason}`);
      assert.ok(def.source && def.source.length > 40, `${key}: no source found for ${e.script}`);
    }
  });

  it('makes every load-profile case an executable performance case', () => {
    for (const [key, e] of Object.entries(automation.cases)) {
      if (!e.validation_rules) continue;
      const c = classifyCase({ execution_method: e.execution_method || 'performance', validation_rules: e.validation_rules });
      assert.equal(c.kind, 'performance', key);
      assert.equal(c.executable, true, key);
    }
  });

  it('leaves no placeholders', () => {
    const scripted = Object.values(automation.cases).filter((e) => e.script || e.validation_rules).length;
    const retired = Object.values(automation.cases).filter((e) => e.retire).length;
    assert.equal(scripted + retired, catalogKeys().length);
  });
});
