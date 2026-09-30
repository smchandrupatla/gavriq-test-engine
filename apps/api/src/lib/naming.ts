/**
 * Shared naming helpers: when a name collides, append a date-time stamp
 * rather than a random id or sequential counter, so the suffix itself tells
 * you when the duplicate was created.
 */

/** Compact UTC stamp, e.g. 20260930-143512. */
export function timestampSuffix(d: Date = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}` +
    `-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}`
  );
}

/** Readable stamp for display, e.g. "2026-09-30 14:35 UTC". */
export function humanDateTime(d: Date = new Date()): string {
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

/**
 * Returns `base` unchanged unless `exists(base)` resolves true, in which
 * case a timestamp suffix is appended to make it unique.
 */
export async function uniqueName(base: string, exists: (name: string) => Promise<boolean>): Promise<string> {
  if (!(await exists(base))) return base;
  return `${base} (${timestampSuffix()})`;
}
