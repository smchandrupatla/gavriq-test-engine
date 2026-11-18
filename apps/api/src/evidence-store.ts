/**
 * Evidence store: artefact bytes live in the database (table evidence_blobs),
 * addressed by storage_key. Nothing is written to disk by the API.
 *
 *   evidence/<file>                      legacy flat key
 *   evidence/<execution-id>/<file>       uploaded by a worker for one execution
 *   evidence/_probe/<file>               worker preflight probes
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { query } from './db/client.js';

export const MAX_EVIDENCE_BYTES = Number(process.env.EVIDENCE_MAX_BYTES || 5 * 1024 * 1024);
/** Days evidence is kept; 0 keeps it forever. */
export const EVIDENCE_RETENTION_DAYS = Math.max(0, Number(process.env.EVIDENCE_RETENTION_DAYS || 0));

const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,180}$/;

const CONTENT_TYPES: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.log': 'text/plain; charset=utf-8',
  '.tap': 'text/plain; charset=utf-8',
  '.html': 'text/plain; charset=utf-8', // never rendered: captured pages are served as source
};

export function contentTypeFor(name: string): string {
  return CONTENT_TYPES[path.extname(name).toLowerCase()] || 'application/octet-stream';
}

function safeSegment(value: string): string | null {
  return SEGMENT.test(value) && !value.includes('..') ? value : null;
}

/** Canonical storage key (evidence/<folder>/<file> or evidence/<file>), or null when it is not a valid key. */
export function normalizeKey(storageKey: string): string | null {
  const parts = String(storageKey || '').replace(/^evidence\//, '').split('/');
  if (!parts.length || parts.length > 2) return null;
  const safe: string[] = [];
  for (const p of parts) {
    const s = p === '_probe' ? p : safeSegment(p);
    if (!s) return null;
    safe.push(s);
  }
  return `evidence/${safe.join('/')}`;
}

export async function statEvidence(storageKey: string): Promise<{ key: string; size: number; sha256: string; contentType: string } | null> {
  const key = normalizeKey(storageKey);
  if (!key) return null;
  const { rows } = await query(
    `SELECT size_bytes, sha256, content_type FROM evidence_blobs WHERE storage_key = $1 AND size_bytes > 0`,
    [key]
  );
  return rows[0] ? { key, size: Number(rows[0].size_bytes), sha256: rows[0].sha256, contentType: rows[0].content_type } : null;
}

export async function hashEvidence(storageKey: string): Promise<string | null> {
  return (await statEvidence(storageKey))?.sha256 ?? null;
}

export async function readEvidence(storageKey: string): Promise<{ data: Buffer; contentType: string } | null> {
  const key = normalizeKey(storageKey);
  if (!key) return null;
  const { rows } = await query(`SELECT content, content_type FROM evidence_blobs WHERE storage_key = $1`, [key]);
  return rows[0] ? { data: rows[0].content as Buffer, contentType: rows[0].content_type } : null;
}

export async function saveEvidence(folder: string, name: string, data: Buffer): Promise<{ storage_key: string; size_bytes: number; sha256: string }> {
  const dir = folder === '_probe' ? folder : safeSegment(folder);
  const file = safeSegment(path.basename(name));
  if (!dir || !file) throw new Error('Invalid evidence name');
  if (!data.length) throw new Error('Evidence is empty');
  if (data.length > MAX_EVIDENCE_BYTES) throw new Error(`Evidence exceeds ${MAX_EVIDENCE_BYTES} bytes`);
  const storage_key = `evidence/${dir}/${file}`;
  const sha256 = createHash('sha256').update(data).digest('hex');
  await query(
    `INSERT INTO evidence_blobs (storage_key, content, content_type, size_bytes, sha256)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (storage_key) DO UPDATE
       SET content = EXCLUDED.content, content_type = EXCLUDED.content_type,
           size_bytes = EXCLUDED.size_bytes, sha256 = EXCLUDED.sha256, created_at = now()`,
    [storage_key, data, contentTypeFor(file), data.length, sha256]
  );
  return { storage_key, size_bytes: data.length, sha256 };
}

export function evidenceUrl(storageKey: string | null | undefined): string | null {
  return storageKey ? `/api/v1/evidence/file?key=${encodeURIComponent(storageKey)}` : null;
}

export interface PruneResult {
  older_than_days: number;
  rows: number;
  files: number;
  bytes: number;
  probe_files: number;
}

/**
 * Retention: drop evidence older than `days` — the stored bytes and the rows
 * that point at them, plus stale preflight probes. Results and their verdicts
 * are untouched: only the artefacts behind them expire.
 */
export async function pruneEvidence(days: number): Promise<PruneResult> {
  const result: PruneResult = { older_than_days: days, rows: 0, files: 0, bytes: 0, probe_files: 0 };
  if (!(days > 0)) return result;
  const d = Math.floor(days);

  const blobs = await query(
    `DELETE FROM evidence_blobs
      WHERE storage_key IN (SELECT storage_key FROM evidence WHERE created_at < now() - ($1::int * interval '1 day'))
      RETURNING size_bytes`,
    [d]
  );
  result.files = blobs.rowCount ?? 0;
  result.bytes = blobs.rows.reduce((n, r) => n + Number(r.size_bytes || 0), 0);

  const gone = await query(`DELETE FROM evidence WHERE created_at < now() - ($1::int * interval '1 day')`, [d]);
  result.rows = gone.rowCount ?? 0;

  const probes = await query(
    `DELETE FROM evidence_blobs WHERE storage_key LIKE 'evidence/_probe/%' AND created_at < now() - ($1::int * interval '1 day')`,
    [d]
  );
  result.probe_files = probes.rowCount ?? 0;
  return result;
}

/**
 * One-time carry-over: artefacts an older engine left as files in a data volume
 * (LEGACY_EVIDENCE_DIR) are copied into the database. Idempotent; the files are
 * left where they are for the operator to delete.
 */
export async function importLegacyEvidenceFiles(dir = process.env.LEGACY_EVIDENCE_DIR || ''): Promise<number> {
  if (!dir || !existsSync(dir)) return 0;
  let imported = 0;
  const visit = async (folder: string, relative: string[]) => {
    for (const name of readdirSync(folder)) {
      const full = path.join(folder, name);
      if (statSync(full).isDirectory()) {
        if (relative.length === 0) await visit(full, [name]);
        continue;
      }
      const key = normalizeKey([...relative, name].join('/'));
      const data = readFileSync(full);
      if (!key || !data.length || data.length > MAX_EVIDENCE_BYTES) continue;
      const res = await query(
        `INSERT INTO evidence_blobs (storage_key, content, content_type, size_bytes, sha256)
         VALUES ($1, $2, $3, $4, $5) ON CONFLICT (storage_key) DO NOTHING`,
        [key, data, contentTypeFor(name), data.length, createHash('sha256').update(data).digest('hex')]
      );
      imported += res.rowCount ?? 0;
    }
  };
  await visit(dir, []);
  return imported;
}
