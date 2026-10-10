/**
 * Record & play queue — the engine side of a host-driven recorder.
 *
 * The engine runs inside Docker and has no display, so it cannot spawn a
 * visible browser itself. Instead, a host-side agent (apps/record-agent)
 * running on the user's machine polls `/api/v1/record/pending`, launches
 * `playwright codegen` with the chosen browser against the chosen URL, and
 * POSTs the captured script back to `/api/v1/record/sessions/:id/finished`.
 *
 * This module keeps:
 *   - a short queue of pending record requests the agent will claim
 *   - a session store the UI polls for state + result
 *   - the agent's heartbeat and the list of browsers installed on the host.
 *
 * Nothing here persists — a restart loses the queue. That is fine: a
 * recording-in-progress is tied to the browser window on the user's screen.
 */
import { randomUUID } from 'node:crypto';

export type Browser = 'chromium' | 'firefox' | 'webkit';
export type RecordState = 'queued' | 'launching' | 'recording' | 'done' | 'error' | 'cancelled';

export interface StartSnapshot {
  title: string;
  summary: string;
  capturedAt: string;
}

export interface LiveStep {
  action: string;
  text: string;
}

export interface RecordSession {
  id: string;
  url: string;
  browser: Browser;
  applicationKey: string;
  state: RecordState;
  output: string;
  message?: string;
  error?: string;
  queuedAt: number;
  claimedAt?: number;
  finishedAt?: number;
  snapshot?: StartSnapshot;
  /** The number of steps the agent reports so the UI can show live progress even before `done`. */
  liveStepCount?: number;
  /** Last few steps the agent extracted from the growing codegen file (plain-language). */
  liveSteps?: LiveStep[];
  /** Agent-generated auto-assertion steps to append (serialized as recorded steps on commit). */
  autoAssertions?: unknown[];
}

const sessions = new Map<string, RecordSession>();
const queue: string[] = [];

interface AgentHeartbeat {
  lastSeenAt: number;
  browsers: Browser[];
  version?: string;
  machine?: string;
}
let agent: AgentHeartbeat | null = null;

/** Agent must heartbeat at least this often to count as "connected". */
export const AGENT_FRESH_MS = 10_000;

export function recordAgentOnline(): boolean {
  return !!agent && Date.now() - agent.lastSeenAt < AGENT_FRESH_MS;
}

export function recordAgentView() {
  if (!agent) return { online: false, browsers: [] as Browser[], last_seen_at: null as string | null };
  return {
    online: recordAgentOnline(),
    browsers: agent.browsers,
    machine: agent.machine ?? null,
    version: agent.version ?? null,
    last_seen_at: new Date(agent.lastSeenAt).toISOString(),
  };
}

export function registerAgent(h: { browsers: Browser[]; version?: string; machine?: string }): void {
  agent = { lastSeenAt: Date.now(), browsers: h.browsers, version: h.version, machine: h.machine };
}

export function enqueueRecording(input: { url: string; browser: Browser; applicationKey: string }): RecordSession {
  const id = randomUUID();
  const s: RecordSession = {
    id,
    url: input.url,
    browser: input.browser,
    applicationKey: input.applicationKey,
    state: 'queued',
    output: '',
    queuedAt: Date.now(),
  };
  sessions.set(id, s);
  queue.push(id);
  return s;
}

/** Agent claim: hand the oldest queued session over and move it to 'launching'. */
export function claimNext(): RecordSession | null {
  while (queue.length) {
    const id = queue.shift()!;
    const s = sessions.get(id);
    if (!s || s.state !== 'queued') continue;
    s.state = 'launching';
    s.claimedAt = Date.now();
    return s;
  }
  return null;
}

export function getSession(id: string): RecordSession | undefined {
  return sessions.get(id);
}

export function updateSession(id: string, patch: Partial<RecordSession>): RecordSession | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  Object.assign(s, patch);
  return s;
}

export function finishSession(id: string, result: { output?: string; error?: string; snapshot?: StartSnapshot }): RecordSession | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  s.finishedAt = Date.now();
  if (result.snapshot) s.snapshot = result.snapshot;
  if (result.error) {
    s.state = 'error';
    s.error = result.error;
  } else {
    s.state = 'done';
    s.output = result.output ?? '';
  }
  return s;
}

export function cancelSession(id: string): RecordSession | undefined {
  const s = sessions.get(id);
  if (!s) return undefined;
  if (s.state === 'queued') {
    const i = queue.indexOf(id);
    if (i >= 0) queue.splice(i, 1);
  }
  s.state = 'cancelled';
  s.finishedAt = Date.now();
  return s;
}

export function dropSession(id: string): void {
  sessions.delete(id);
  const i = queue.indexOf(id);
  if (i >= 0) queue.splice(i, 1);
}

export function viewSession(s: RecordSession) {
  return {
    id: s.id,
    url: s.url,
    browser: s.browser,
    application_key: s.applicationKey,
    state: s.state,
    message: s.message,
    error: s.error,
    queued_at: new Date(s.queuedAt).toISOString(),
    claimed_at: s.claimedAt ? new Date(s.claimedAt).toISOString() : null,
    finished_at: s.finishedAt ? new Date(s.finishedAt).toISOString() : null,
    has_output: Boolean(s.output),
    snapshot: s.snapshot ?? null,
    live_step_count: s.liveStepCount ?? null,
    live_steps: s.liveSteps ?? [],
    has_auto_assertions: Array.isArray(s.autoAssertions) && s.autoAssertions.length > 0,
  };
}
