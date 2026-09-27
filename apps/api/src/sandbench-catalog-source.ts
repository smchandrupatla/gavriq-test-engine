/**
 * Files that define the Sand Bench catalog, and a hash of them so boot can tell when
 * the catalog (or what runs behind each case) changed and needs re-seeding.
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const dataDir = path.join(repoRoot, 'data');
export const AUTOMATION_FILE = 'sandbench-catalog-automation.json';

export function catalogFiles(): string[] {
  if (!existsSync(dataDir)) return [];
  return readdirSync(dataDir)
    .filter((f) => f === 'sandbench-catalog.json' || /^sandbench-catalog-part\d+\.json$/.test(f) || f === AUTOMATION_FILE)
    .sort();
}

export function catalogHash(): string {
  const h = createHash('sha256');
  for (const f of catalogFiles()) h.update(f).update(readFileSync(path.join(dataDir, f)));
  return h.digest('hex').slice(0, 16);
}

export type AutomationEntry = {
  script?: string;
  execution_method?: string;
  validation_rules?: Record<string, unknown>;
  title?: string;
  retire?: string;
};

export function loadAutomation(): Record<string, AutomationEntry> {
  const file = path.join(dataDir, AUTOMATION_FILE);
  if (!existsSync(file)) return {};
  return (JSON.parse(readFileSync(file, 'utf8')) as { cases?: Record<string, AutomationEntry> }).cases || {};
}
