/**
 * Record & play HTTP surface.
 *
 * The engine does not spawn browsers itself (it runs in Docker without a
 * display). Instead it owns a short queue and a session store; a host-side
 * agent (apps/record-agent) polls `/pending`, launches `playwright codegen`
 * on the user's machine with the chosen browser, and POSTs the captured
 * script back to `/sessions/:id/finished`. The console form drives the
 * engine over the three UI endpoints below (start/get/stop/import).
 *
 *   -- console-facing --
 *   POST /api/v1/record/start                 queue a recording request
 *   GET  /api/v1/record/agent                 is the host agent connected? which browsers?
 *   GET  /api/v1/record/:id                   session state
 *   POST /api/v1/record/:id/stop              parse the captured script, save a test case
 *   POST /api/v1/record/:id/cancel            drop a queued/in-flight session
 *   POST /api/v1/record/import                parse a pasted codegen script, save a case
 *
 *   -- agent-facing --
 *   POST /api/v1/record/agent                 heartbeat + installed browsers
 *   GET  /api/v1/record/pending               claim the next queued request
 *   POST /api/v1/record/sessions/:id/progress live progress (state, message, step count)
 *   POST /api/v1/record/sessions/:id/finished script + optional snapshot, or error
 */
import type { FastifyInstance } from 'fastify';
import { query, withTransaction } from '../db/client.js';
import { uniqueName } from '../lib/naming.js';
import { caseView } from './test-cases.js';
import {
  enqueueRecording,
  getSession,
  updateSession,
  finishSession,
  cancelSession,
  dropSession,
  viewSession,
  claimNext,
  registerAgent,
  recordAgentOnline,
  recordAgentView,
  listUiAdoptable,
  type Browser,
  type StartSnapshot,
} from '../record/queue.js';
import { parseCodegen, recordingTitle, type RecordedStep } from '../record/parser.js';
import { RECORD_AND_PLAY_TYPE, recordAndPlaySuite } from '../catalog/record-and-play-cases.js';
import { TYPE_TO_ENUM } from '../catalog/types.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BROWSERS: ReadonlySet<Browser> = new Set(['chromium', 'firefox', 'webkit']);

async function resolveApplication(idOrKey: unknown): Promise<{ id: string; key: string } | null> {
  if (typeof idOrKey !== 'string' || !idOrKey) return null;
  const { rows } = await query(
    UUID.test(idOrKey)
      ? 'SELECT id, key FROM applications WHERE id = $1::uuid'
      : 'SELECT id, key FROM applications WHERE key = $1',
    [idOrKey]
  );
  return rows[0] ? { id: rows[0].id as string, key: rows[0].key as string } : null;
}

async function ensureRecordSuite(appId: string, appKey: string): Promise<string> {
  const suite = recordAndPlaySuite(appKey);
  const { rows } = await query(
    `INSERT INTO test_suites (key, name, description, application_id, suite_type, created_by)
     VALUES ($1, $2, $3, $4, $5, 'record-and-play')
     ON CONFLICT (application_id, key) DO UPDATE SET updated_at = now()
     RETURNING id`,
    [suite.key, suite.name, suite.description, appId, suite.typeKey]
  );
  return rows[0]!.id as string;
}

async function uniqueCaseName(name: string): Promise<string> {
  return uniqueName(name, async (n) => {
    const { rows } = await query('SELECT 1 FROM test_cases WHERE lower(name) = lower($1) LIMIT 1', [n]);
    return rows.length > 0;
  });
}

async function createRecordedCase(opts: {
  applicationId: string;
  suiteId: string;
  name: string;
  startUrl: string | null;
  steps: RecordedStep[];
  objective: string;
  preconditions: string;
  warnings: string[];
  actor: string | null;
  source: string;
  browser: Browser;
  lifecycle?: 'draft' | 'active';
}) {
  const base = opts.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'recording';
  const key = `REC-${base.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  const name = await uniqueCaseName(opts.name);
  const notes = opts.warnings.length ? `Codegen lines that were not translated into runnable steps:\n- ${opts.warnings.join('\n- ')}` : null;

  const row = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO test_cases (
         key, name, description, application_id, test_type, test_level,
         preconditions, execution_method, steps, expected_results,
         severity, priority, tags, author_id, created_by, updated_by,
         automation_status, lifecycle,
         objective, environment, visibility, automation_link,
         known_workarounds, validation_rules
       ) VALUES (
         $1, $2, $3, $4, $5::test_type, 'system',
         $6, 'playwright', $7::jsonb, $8,
         'medium', 'p2', $9::text[], $10, 'record-and-play', 'record-and-play',
         'automated', $15::test_lifecycle,
         $11, NULL, 'Team', $12,
         $13, $14::jsonb
       ) RETURNING *`,
      [
        key,
        name,
        `Recorded Playwright flow captured by the engine's screen recorder. Starting URL: ${opts.startUrl || '(unknown)'}. ${opts.steps.length} step${opts.steps.length === 1 ? '' : 's'} replayed by the Playwright runner on the application's environment.`,
        opts.applicationId,
        TYPE_TO_ENUM[RECORD_AND_PLAY_TYPE.key] || 'ui',
        opts.preconditions,
        JSON.stringify(opts.steps),
        opts.steps.length ? `All ${opts.steps.length} recorded steps replay without an error.` : 'The recorded flow replays without an error.',
        ['record-and-play', 'playwright', `browser:${opts.browser}`],
        opts.actor,
        opts.objective,
        opts.source,
        notes,
        JSON.stringify({ browser: opts.browser }),
        opts.lifecycle || 'active',
      ]
    );
    await client.query(
      `INSERT INTO test_case_versions (test_case_id, version, snapshot, change_summary, created_by)
       VALUES ($1, 1, $2::jsonb, 'Initial recording', $3)`,
      [rows[0].id, JSON.stringify(rows[0]), opts.actor]
    );
    await client.query(
      `INSERT INTO test_case_suites (test_case_id, test_suite_id, sort_order)
       VALUES ($1, $2, 0) ON CONFLICT DO NOTHING`,
      [rows[0].id, opts.suiteId]
    );
    return rows[0];
  });

  return caseView(row);
}

/** Promote an auto-saved draft case to active and apply any user edits from the review panel. */
async function promoteDraftCase(opts: {
  caseId: string;
  name?: string;
  preconditions?: string;
  steps?: RecordedStep[];
  objective?: string;
  warnings?: string[];
  actor: string | null;
}) {
  const notes = opts.warnings?.length ? `Codegen lines that were not translated into runnable steps:\n- ${opts.warnings.join('\n- ')}` : null;
  const row = await withTransaction(async (client) => {
    const curr = await client.query('SELECT * FROM test_cases WHERE id = $1::uuid', [opts.caseId]);
    if (!curr.rows[0]) return null;
    const prev = curr.rows[0];
    const newName = opts.name && opts.name !== prev.name ? await uniqueCaseName(opts.name) : prev.name;
    const newVersion = Number(prev.version || 1) + 1;
    const { rows } = await client.query(
      `UPDATE test_cases SET
         name = $2,
         lifecycle = 'active',
         preconditions = COALESCE($3, preconditions),
         steps = COALESCE($4::jsonb, steps),
         expected_results = COALESCE($5, expected_results),
         objective = COALESCE($6, objective),
         known_workarounds = COALESCE($7, known_workarounds),
         version = $8,
         updated_at = now(),
         updated_by = COALESCE($9, 'record-and-play')
       WHERE id = $1::uuid
       RETURNING *`,
      [
        opts.caseId,
        newName,
        opts.preconditions ?? null,
        opts.steps ? JSON.stringify(opts.steps) : null,
        opts.steps?.length ? `All ${opts.steps.length} recorded steps replay without an error.` : null,
        opts.objective ?? null,
        notes,
        newVersion,
        opts.actor,
      ]
    );
    await client.query(
      `INSERT INTO test_case_versions (test_case_id, version, snapshot, change_summary, created_by)
       VALUES ($1, $2, $3::jsonb, 'Reviewed and committed', $4)`,
      [opts.caseId, newVersion, JSON.stringify(rows[0]), opts.actor]
    );
    return rows[0];
  });
  return row ? caseView(row) : null;
}

async function waitForSession(id: string, isDone: (state: string) => boolean, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const s = getSession(id);
    if (s && isDone(s.state)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
}

export async function recordRoutes(app: FastifyInstance) {
  // ---------------------------------------------------------------- console-facing

  app.get('/api/v1/record/agent', async (_req, reply) => {
    return reply.send({ data: recordAgentView() });
  });

  // Any session the console tab should adopt (recording in flight or
  // finished-but-uncommitted). Lets a page that was reloaded, or a session
  // started from a different client, pick up where things are.
  app.get<{ Querystring: { application_key?: string } }>('/api/v1/record/sessions/pending-ui', async (req, reply) => {
    const key = req.query?.application_key;
    const live = listUiAdoptable(key);
    return reply.send({ data: live });
  });

  // Ask the host-side infra-agent to spawn the record agent on demand. The
  // engine runs in Docker; it reaches the host via host.docker.internal:9900
  // (the infra-agent's control plane). If the infra-agent isn't up either,
  // the response explains the manual command.
  app.post('/api/v1/record/agent/start', async (_req, reply) => {
    const base = (process.env.INFRA_AGENT_CONTROL_URL || 'http://host.docker.internal:9900').replace(/\/+$/, '');
    try {
      const r = await fetch(`${base}/spawn/record-agent`, { method: 'POST', signal: AbortSignal.timeout(5_000) });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) {
        return reply.status(502).send({ error: `infra-agent refused the spawn request: ${(body as any)?.error || r.status}`, infra_agent_url: base });
      }
      return reply.send({ data: body });
    } catch (err) {
      return reply.status(503).send({
        error: 'Could not reach the host infra-agent. Start it on your machine first with: .\\scripts\\start-infra-agent.ps1 (Windows) or scripts/start-infra-agent.sh (macOS/Linux). The infra-agent then starts the record-agent on demand.',
        detail: (err as Error).message,
        infra_agent_url: base,
      });
    }
  });

  app.post<{ Body: { url?: string; application_key?: string; application_id?: string; browser?: string } }>(
    '/api/v1/record/start',
    async (req, reply) => {
      const b = req.body || {};
      if (!b.url || typeof b.url !== 'string') return reply.status(400).send({ error: 'url is required' });
      const browser = (typeof b.browser === 'string' ? b.browser.toLowerCase() : 'chromium') as Browser;
      if (!BROWSERS.has(browser)) return reply.status(400).send({ error: `browser must be one of chromium, firefox, webkit (got "${b.browser}")` });
      const appRef = await resolveApplication(b.application_id || b.application_key);
      if (!appRef) return reply.status(400).send({ error: 'application_id or application_key must resolve to a known application' });
      if (!recordAgentOnline()) {
        return reply.status(503).send({
          error: 'The host record agent is not connected. Start it on your machine with: .\\scripts\\start-record-agent.ps1 (Windows) or scripts/start-record-agent.sh (macOS/Linux).',
          data: { agent: recordAgentView() },
        });
      }
      const agent = recordAgentView();
      if (!agent.browsers.includes(browser)) {
        return reply.status(422).send({
          error: `${browser} is not installed on this machine. Install it with: npx playwright install ${browser}`,
          data: { agent, requested: browser },
        });
      }
      const s = enqueueRecording({ url: b.url, browser, applicationKey: appRef.key });
      return reply.status(202).send({ data: { ...viewSession(s), application: appRef } });
    }
  );

  app.get<{ Params: { id: string } }>('/api/v1/record/:id', async (req, reply) => {
    const s = getSession(req.params.id);
    if (!s) return reply.status(404).send({ error: 'No such recording session.' });
    return reply.send({ data: viewSession(s) });
  });

  // /stop is now a PREVIEW: parse the current output and return steps so the
  // user can review + amend them before committing to a case. /commit takes
  // the (possibly edited) steps and creates the case.
  app.post<{ Params: { id: string } }>('/api/v1/record/:id/stop', async (req, reply) => {
    const s = getSession(req.params.id);
    if (!s) return reply.status(404).send({ error: 'No such recording session.' });
    if (s.state === 'queued' || s.state === 'launching' || s.state === 'recording') {
      await waitForSession(req.params.id, (st) => st === 'done' || st === 'error' || st === 'cancelled', 20_000);
    }
    const latest = getSession(req.params.id);
    if (!latest || latest.state !== 'done') {
      return reply.status(409).send({ error: `recording did not finish cleanly: ${latest?.error || latest?.state || 'unknown'}`, data: latest ? viewSession(latest) : null });
    }
    const parsed = parseCodegen(latest.output);
    const combined = [...parsed.steps, ...((latest.autoAssertions as RecordedStep[] | undefined) || [])];
    return reply.send({ data: { session: viewSession(latest), steps: combined, warnings: parsed.warnings, start_url: parsed.startUrl || latest.url } });
  });

  app.post<{ Params: { id: string }; Body: { application_key?: string; application_id?: string; title?: string; preconditions?: string; steps?: RecordedStep[] } }>(
    '/api/v1/record/:id/commit',
    async (req, reply) => {
      const b = req.body || {};
      const appRef = await resolveApplication(b.application_id || b.application_key);
      if (!appRef) return reply.status(400).send({ error: 'application_id or application_key is required' });
      const s = getSession(req.params.id);
      if (!s) return reply.status(404).send({ error: 'No such recording session.' });
      if (s.state !== 'done') return reply.status(409).send({ error: `cannot commit a session in state ${s.state}`, data: viewSession(s) });

      const parsed = parseCodegen(s.output);
      const defaultSteps = [...parsed.steps, ...((s.autoAssertions as RecordedStep[] | undefined) || [])];
      const steps = Array.isArray(b.steps) && b.steps.length ? b.steps : defaultSteps;
      if (!steps.length) return reply.status(422).send({ error: 'the recording captured no runnable actions', data: viewSession(s) });

      const startUrl = parsed.startUrl || s.url;
      const title = (b.title || '').trim() || recordingTitle(startUrl, 'Recorded flow');
      const extra = (b.preconditions || '').trim();
      const snap = s.snapshot;
      const snapLine = snap
        ? `Before the recording began the page at ${startUrl} showed “${snap.title || '(no title)'}”${snap.summary ? ` — opening text: ${snap.summary.slice(0, 240)}${snap.summary.length > 240 ? '…' : ''}` : ''}.`
        : '';
      const precondBody = extra || 'The user has whatever access the recorded flow needed (sign-in, permissions, pre-existing data).';
      const objective = `Replay the ${steps.length} action${steps.length === 1 ? '' : 's'} a user performed on ${startUrl} and confirm each one still works.`;
      const preconditions = [`The application is reachable at ${startUrl}.`, precondBody, snapLine].filter(Boolean).join(' ');

      // If /finished already auto-saved a draft, promote it (keeps the key the
      // user has been looking at and preserves the version history); otherwise
      // insert fresh (import path, or a session predating the auto-draft code).
      let result;
      if (s.draftCaseId) {
        result = await promoteDraftCase({
          caseId: s.draftCaseId,
          name: title,
          preconditions,
          steps,
          objective,
          warnings: parsed.warnings,
          actor: req.actor?.id ?? null,
        });
        if (!result) return reply.status(409).send({ error: 'the auto-saved draft is missing from the catalog; nothing to commit' });
      } else {
        const suiteId = await ensureRecordSuite(appRef.id, appRef.key);
        result = await createRecordedCase({
          applicationId: appRef.id,
          suiteId,
          name: title,
          startUrl,
          steps,
          objective,
          preconditions,
          warnings: parsed.warnings,
          actor: req.actor?.id ?? null,
          source: 'codegen',
          browser: s.browser,
          lifecycle: 'active',
        });
      }
      dropSession(s.id);
      return reply.status(201).send({ data: result, warnings: parsed.warnings });
    }
  );

  app.post<{ Params: { id: string } }>('/api/v1/record/:id/cancel', async (req, reply) => {
    const s = cancelSession(req.params.id);
    if (!s) return reply.status(404).send({ error: 'No such recording session.' });
    return reply.send({ data: viewSession(s) });
  });

  app.post<{ Body: { script?: string; application_key?: string; application_id?: string; url?: string; title?: string; preconditions?: string; browser?: string } }>(
    '/api/v1/record/import',
    async (req, reply) => {
      const b = req.body || {};
      if (!b.script || typeof b.script !== 'string') return reply.status(400).send({ error: 'script is required (the codegen output)' });
      const appRef = await resolveApplication(b.application_id || b.application_key);
      if (!appRef) return reply.status(400).send({ error: 'application_id or application_key is required' });
      const browser = (typeof b.browser === 'string' && BROWSERS.has(b.browser.toLowerCase() as Browser) ? b.browser.toLowerCase() : 'chromium') as Browser;
      const parsed = parseCodegen(b.script);
      if (!parsed.steps.length) return reply.status(422).send({ error: 'the pasted script contains no runnable actions' });

      const suiteId = await ensureRecordSuite(appRef.id, appRef.key);
      const startUrl = parsed.startUrl || b.url || null;
      const title = (b.title || '').trim() || recordingTitle(startUrl, 'Recorded flow');
      const extra = (b.preconditions || '').trim();
      const createdCase = await createRecordedCase({
        applicationId: appRef.id,
        suiteId,
        name: title,
        startUrl,
        steps: parsed.steps,
        objective: `Replay the ${parsed.steps.length} action${parsed.steps.length === 1 ? '' : 's'} a user performed on ${startUrl || 'the application'} and confirm each one still works.`,
        preconditions: `The application is reachable at ${startUrl || '(the recorded URL)'}.${extra ? ` ${extra}` : ' The user has whatever access the recorded flow needed (sign-in, permissions, pre-existing data).'}`,
        warnings: parsed.warnings,
        actor: req.actor?.id ?? null,
        source: 'import',
        browser,
      });
      return reply.status(201).send({ data: createdCase, warnings: parsed.warnings });
    }
  );

  // ---------------------------------------------------------------- agent-facing

  app.post<{ Body: { browsers?: unknown; version?: string; machine?: string } }>(
    '/api/v1/record/agent',
    async (req, reply) => {
      const b = req.body || {};
      const browsers = Array.isArray(b.browsers)
        ? (b.browsers.filter((x): x is Browser => typeof x === 'string' && BROWSERS.has(x as Browser)))
        : [];
      registerAgent({ browsers, version: b.version, machine: b.machine });
      return reply.send({ data: recordAgentView() });
    }
  );

  app.get('/api/v1/record/pending', async (_req, reply) => {
    const s = claimNext();
    if (!s) return reply.status(204).send();
    return reply.send({ data: viewSession(s) });
  });

  app.post<{ Params: { id: string }; Body: { state?: string; message?: string; live_step_count?: number; live_steps?: Array<{ action: string; text: string }> } }>(
    '/api/v1/record/sessions/:id/progress',
    async (req, reply) => {
      const b = req.body || {};
      const s = updateSession(req.params.id, {
        state: (b.state === 'launching' || b.state === 'recording' ? b.state : undefined) as any,
        message: typeof b.message === 'string' ? b.message : undefined,
        liveStepCount: Number.isFinite(Number(b.live_step_count)) ? Number(b.live_step_count) : undefined,
        liveSteps: Array.isArray(b.live_steps) ? b.live_steps.slice(-20).map((x) => ({ action: String(x.action || ''), text: String(x.text || '') })) : undefined,
      });
      if (!s) return reply.status(404).send({ error: 'No such recording session.' });
      return reply.send({ data: viewSession(s) });
    }
  );

  app.post<{ Params: { id: string }; Body: { output?: string; error?: string; snapshot?: StartSnapshot; auto_assertions?: RecordedStep[] } }>(
    '/api/v1/record/sessions/:id/finished',
    async (req, reply) => {
      const b = req.body || {};
      const s = finishSession(req.params.id, { output: typeof b.output === 'string' ? b.output : undefined, error: typeof b.error === 'string' ? b.error : undefined, snapshot: b.snapshot });
      if (!s) return reply.status(404).send({ error: 'No such recording session.' });
      if (Array.isArray(b.auto_assertions)) updateSession(req.params.id, { autoAssertions: b.auto_assertions });

      // Auto-save the recording as a draft the moment the agent delivers it.
      // The case is persisted even if the user never clicks Save in the console;
      // /commit then promotes the draft to active with any amendments.
      if (s.state === 'done' && s.output) {
        try {
          const parsed = parseCodegen(s.output);
          const steps = [...parsed.steps, ...((b.auto_assertions as RecordedStep[] | undefined) || [])];
          if (steps.length) {
            const appRef = await query('SELECT id, key FROM applications WHERE key = $1', [s.applicationKey]);
            if (appRef.rows[0]) {
              const applicationId = appRef.rows[0].id as string;
              const applicationKey = appRef.rows[0].key as string;
              const suiteId = await ensureRecordSuite(applicationId, applicationKey);
              const startUrl = parsed.startUrl || s.url;
              const title = recordingTitle(startUrl, 'Recorded flow');
              const snap = b.snapshot;
              const snapLine = snap
                ? `Before the recording began the page at ${startUrl} showed “${snap.title || '(no title)'}”${snap.summary ? ` — opening text: ${snap.summary.slice(0, 240)}${snap.summary.length > 240 ? '…' : ''}` : ''}.`
                : '';
              const draft = await createRecordedCase({
                applicationId,
                suiteId,
                name: title,
                startUrl,
                steps,
                objective: `Replay the ${steps.length} action${steps.length === 1 ? '' : 's'} a user performed on ${startUrl} and confirm each one still works.`,
                preconditions: [`The application is reachable at ${startUrl}.`, 'The user has whatever access the recorded flow needed (sign-in, permissions, pre-existing data).', snapLine].filter(Boolean).join(' '),
                warnings: parsed.warnings,
                actor: null,
                source: 'codegen-auto-draft',
                browser: s.browser,
                lifecycle: 'draft',
              });
              updateSession(req.params.id, { draftCaseId: draft.id, draftCaseKey: draft.key });
            }
          }
        } catch (err) {
          req.log?.warn?.({ err: (err as Error).message }, 'auto-draft creation failed');
        }
      }
      return reply.send({ data: viewSession(getSession(req.params.id) || s) });
    }
  );
}
