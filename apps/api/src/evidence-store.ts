/**
 * Evidence store: files under EVIDENCE_DIR addressed by storage_key.
 *
 *   evidence/<file>                      legacy flat key (worker wrote straight into a shared volume)
 *   evidence/<execution-id>/<file>       uploaded by a worker for one execution
 *   evidence/_probe/<file>               worker preflight probes
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const EVIDENCE_DIR = process.env.EVIDENCE_DIR || path.resolve(process.cwd(), 'evidence');
export const MAX_EVIDENCE_BYTES = Number(process.env.EVIDENCE_MAX_BYTES || 5 * 1024 * 1024);

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;

function safeSegment(value: string): string | null {
  return SEGMENT.test(value) && !value.includes('..') ? value : null;
}

/** Absolute path for a storage key, or null when the key could escape the store. */
export function resolveKey(storageKey: string): string | null {
  const parts = String(storageKey || '').replace(/^evidence\//, '').split('/');
  if (!parts.length || parts.length > 2) return null;
  const safe: string[] = [];
  for (const p of parts) {
    const s = p === '_probe' ? p : safeSegment(p);
    if (!s) return null;
    safe.push(s);
  }
  const full = path.resolve(EVIDENCE_DIR, ...safe);
  const rootDir = path.resolve(EVIDENCE_DIR);
  return full.startsWith(rootDir + path.sep) ? full : null;
}

export function statEvidence(storageKey: string): { path: string; size: number } | null {
  const full = resolveKey(storageKey);
  if (!full || !existsSync(full)) return null;
  const st = statSync(full);
  return st.isFile() && st.size > 0 ? { path: full, size: st.size } : null;
}

export function hashEvidence(storageKey: string): string | null {
  const found = statEvidence(storageKey);
  return found ? createHash('sha256').update(readFileSync(found.path)).digest('hex') : null;
}

export function saveEvidence(folder: string, name: string, data: Buffer): { storage_key: string; size_bytes: number; sha256: string } {
  const dir = folder === '_probe' ? folder : safeSegment(folder);
  const file = safeSegment(path.basename(name));
  if (!dir || !file) throw new Error('Invalid evidence name');
  if (!data.length) throw new Error('Evidence is empty');
  if (data.length > MAX_EVIDENCE_BYTES) throw new Error(`Evidence exceeds ${MAX_EVIDENCE_BYTES} bytes`);
  const target = path.join(EVIDENCE_DIR, dir);
  mkdirSync(target, { recursive: true });
  writeFileSync(path.join(target, file), data);
  return {
    storage_key: `evidence/${dir}/${file}`,
    size_bytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
  };
}

export function evidenceUrl(storageKey: string | null | undefined): string | null {
  return storageKey ? `/api/v1/evidence/file?key=${encodeURIComponent(storageKey)}` : null;
}
