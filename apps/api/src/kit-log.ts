/**
 * In-memory kit log + SSE fan-out for the unified dashboard.
 */
export type KitLine = { t: number; line: string; source?: string };

const MAX = 400;
const lines: KitLine[] = [];
const listeners = new Set<NodeJS.WritableStream>();

export function kitPush(line: string, source = 'engine') {
  const parts = String(line ?? '').split('\n');
  for (const part of parts) {
    if (!part) continue;
    const entry: KitLine = { t: Date.now(), line: part, source };
    lines.push(entry);
    if (lines.length > MAX) lines.splice(0, lines.length - MAX);
    const payload = `data: ${JSON.stringify(entry)}\n\n`;
    for (const stream of listeners) {
      try { stream.write(payload); } catch { listeners.delete(stream); }
    }
  }
}

export function kitSnapshot(limit = 200): KitLine[] {
  return lines.slice(-Math.min(limit, MAX));
}

export function kitSubscribe(stream: NodeJS.WritableStream) {
  listeners.add(stream);
  return () => listeners.delete(stream);
}
