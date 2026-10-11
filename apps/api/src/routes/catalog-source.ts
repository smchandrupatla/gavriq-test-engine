/**
 * GET /api/v1/catalog/cases/:case_key/source
 *
 * Returns the raw TypeScript source of a CaseDef object literal, together with
 * the file path and the line range it occupies. The fixer-agent uses this to
 * feed Claude Code the exact bytes to patch — the DB holds rendered SQL steps
 * only (comments and structure stripped), which is not enough context.
 *
 * Lookup is a byte scan of apps/api/src/catalog/*.ts for `key: '<case_key>'`
 * (single or double quoted). On hit, we walk the enclosing `{ ... }` by brace
 * counting (strings and // / block comments respected) to extract the literal.
 * An in-memory index is cached and rebuilt when any catalog file's mtime
 * changes, so successive calls are O(1).
 */
import type { FastifyInstance } from 'fastify';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CATALOG_DIR = resolve(fileURLToPath(import.meta.url), '../../catalog');
const REPO_ROOT = resolve(CATALOG_DIR, '../../../..');

interface Entry { file: string; relFile: string; mtimeMs: number; byKey: Map<string, { start: number; end: number }>; }
const cache = new Map<string, Entry>();

function listCatalogFiles(): string[] {
  try {
    return readdirSync(CATALOG_DIR).filter((n) => n.endsWith('.ts')).map((n) => join(CATALOG_DIR, n));
  } catch {
    return [];
  }
}

/**
 * One pass over the file that classifies every byte as code (0) or
 * string / template / line comment / block comment (1). We use the mask to
 * ignore braces inside strings and comments when walking the object literal.
 */
function codeMask(text: string): Uint8Array {
  const n = text.length;
  const mask = new Uint8Array(n);
  let state: 'code' | 'sq' | 'dq' | 'tp' | 'lc' | 'bc' = 'code';
  for (let i = 0; i < n; i++) {
    const ch = text[i];
    const nx = text[i + 1];
    if (state === 'code') {
      if (ch === '/' && nx === '/') { state = 'lc'; mask[i] = 1; mask[i + 1] = 1; i++; continue; }
      if (ch === '/' && nx === '*') { state = 'bc'; mask[i] = 1; mask[i + 1] = 1; i++; continue; }
      if (ch === "'") { state = 'sq'; mask[i] = 1; continue; }
      if (ch === '"') { state = 'dq'; mask[i] = 1; continue; }
      if (ch === '`') { state = 'tp'; mask[i] = 1; continue; }
    } else if (state === 'sq') {
      mask[i] = 1;
      if (ch === '\\') { if (i + 1 < n) mask[i + 1] = 1; i++; continue; }
      if (ch === "'") state = 'code';
    } else if (state === 'dq') {
      mask[i] = 1;
      if (ch === '\\') { if (i + 1 < n) mask[i + 1] = 1; i++; continue; }
      if (ch === '"') state = 'code';
    } else if (state === 'tp') {
      mask[i] = 1;
      if (ch === '\\') { if (i + 1 < n) mask[i + 1] = 1; i++; continue; }
      if (ch === '`') state = 'code';
    } else if (state === 'lc') {
      mask[i] = 1;
      if (ch === '\n') state = 'code';
    } else if (state === 'bc') {
      mask[i] = 1;
      if (ch === '*' && nx === '/') { mask[i + 1] = 1; i++; state = 'code'; continue; }
    }
  }
  return mask;
}

function indexFile(text: string): Map<string, { start: number; end: number }> {
  const mask = codeMask(text);
  const result = new Map<string, { start: number; end: number }>();
  // Find `key: '<name>'` ONLY where the key token itself is code (not inside a
  // string or comment). The regex gives us candidate positions; the mask filters.
  const keyRe = /(^|[\s,{(])key\s*:\s*(['"])([A-Za-z0-9_.\-]+)\2/g;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(text))) {
    const atKey = m.index + m[1]!.length;
    if (mask[atKey]) continue; // the match was inside a string/comment
    const caseKey = m[3]!;
    const start = findEnclosingOpenBrace(text, mask, atKey);
    if (start < 0) continue;
    const end = matchCloseBrace(text, mask, start);
    if (end < 0) continue;
    if (!result.has(caseKey)) result.set(caseKey, { start, end });
  }
  return result;
}

function findEnclosingOpenBrace(text: string, mask: Uint8Array, from: number): number {
  let depth = 0;
  for (let i = from; i >= 0; i--) {
    if (mask[i]) continue;
    const ch = text[i];
    if (ch === '}') depth++;
    else if (ch === '{') {
      if (depth === 0) return i;
      depth--;
    }
  }
  return -1;
}

function matchCloseBrace(text: string, mask: Uint8Array, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (mask[i]) continue;
    const ch = text[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

function ensureIndex(file: string): Entry {
  const stat = statSync(file);
  const cached = cache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached;
  const text = readFileSync(file, 'utf8');
  const byKey = indexFile(text);
  const entry: Entry = {
    file,
    relFile: file.replace(REPO_ROOT, '').replace(/\\/g, '/').replace(/^\//, ''),
    mtimeMs: stat.mtimeMs,
    byKey,
  };
  cache.set(file, entry);
  return entry;
}

function byteOffsetToLine(text: string, offset: number): number {
  // 1-indexed line number of the character at `offset`.
  let n = 1;
  for (let i = 0; i < offset && i < text.length; i++) if (text[i] === '\n') n++;
  return n;
}

export function findCaseSource(caseKey: string): {
  case_key: string;
  file: string;
  text: string;
  start_line: number;
  end_line: number;
  file_text: string;
} | null {
  const files = listCatalogFiles();
  for (const f of files) {
    const entry = ensureIndex(f);
    const range = entry.byKey.get(caseKey);
    if (!range) continue;
    const fileText = readFileSync(f, 'utf8');
    const literal = fileText.slice(range.start, range.end + 1);
    return {
      case_key: caseKey,
      file: entry.relFile,
      text: literal,
      start_line: byteOffsetToLine(fileText, range.start),
      end_line: byteOffsetToLine(fileText, range.end),
      file_text: fileText,
    };
  }
  return null;
}

export async function catalogSourceRoutes(app: FastifyInstance) {
  app.get<{ Params: { case_key: string } }>('/api/v1/catalog/cases/:case_key/source', async (req, reply) => {
    const found = findCaseSource(req.params.case_key);
    if (!found) return reply.status(404).send({ error: 'Case not found in any catalog file', case_key: req.params.case_key });
    return reply.send({ data: found });
  });
}
