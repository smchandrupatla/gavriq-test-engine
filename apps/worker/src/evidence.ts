/**
 * Evidence files a worker attaches to a result. Files land in EVIDENCE_DIR (a volume the
 * API also mounts) and are served back by /api/v1/evidence/file?key=evidence/<name>.
 */
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export const EVIDENCE_DIR = process.env.EVIDENCE_DIR || path.resolve(process.cwd(), 'evidence');

export interface EvidenceRef {
  type: string;
  storage_key: string;
  content_type: string;
  size_bytes: number;
  metadata?: Record<string, unknown>;
}

export function safeName(s: string): string {
  return String(s || 'x').replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'x';
}

export function saveEvidence(
  prefix: string,
  ext: string,
  data: string | Buffer,
  type: string,
  contentType: string,
  metadata?: Record<string, unknown>
): EvidenceRef | null {
  try {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    const name = `${safeName(prefix)}-${Date.now()}-${randomUUID().slice(0, 6)}.${ext}`;
    const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : data;
    writeFileSync(path.join(EVIDENCE_DIR, name), buf);
    return { type, storage_key: `evidence/${name}`, content_type: contentType, size_bytes: buf.length, metadata };
  } catch (err) {
    console.warn('[evidence] save failed:', (err as Error).message);
    return null;
  }
}

export function saveLog(prefix: string, lines: string | string[], metadata?: Record<string, unknown>) {
  const text = Array.isArray(lines) ? lines.join('\n') : lines;
  return saveEvidence(prefix, 'log', text, 'log', 'text/plain', metadata);
}

export function saveJson(prefix: string, type: string, value: unknown, metadata?: Record<string, unknown>) {
  return saveEvidence(prefix, 'json', JSON.stringify(value, null, 2), type, 'application/json', metadata);
}

export function savePng(prefix: string, png: Buffer, metadata?: Record<string, unknown>) {
  return saveEvidence(prefix, 'png', png, 'screenshot', 'image/png', metadata);
}

export function compact<T>(list: Array<T | null | undefined>): T[] {
  return list.filter((x): x is T => x != null);
}
