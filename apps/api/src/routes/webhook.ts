/**
 * Remote-execution webhook — a commit on the remote repo kicks off a deploy
 * -> run-all -> teardown cycle on the mapped environment.
 *
 *   POST /api/v1/webhooks/git/:projectKey   verify signature, fetch, deploy
 *   GET  /api/v1/webhooks/git               list configured triggers (no secrets)
 *   GET  /api/v1/webhooks/git/:projectKey   one trigger (no secret value)
 *
 * The source (GitHub, GitLab, a cron, a curl) signs the raw request body with
 * HMAC-SHA256 using the project's shared secret. The engine recomputes the
 * MAC against the raw bytes it received and refuses the request on a mismatch.
 *
 * On success, the engine queues a deploy via createDeployment(mode:
 * "deploy_and_run", ref: <commit or branch>). The host-side infra agent runs
 * the environment's deploy.mjs, which does the `git fetch` and resolves the
 * SHA against its own local mirror (git is on the host, not in this
 * container). infra.ts then chains deploy -> run-all -> teardown.
 *
 * The config lives in config/remote-triggers.json (see remote-triggers.ts),
 * fresh-read every call so edits take effect without a restart.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  findTrigger,
  loadRemoteTriggers,
  sanitize,
  triggerSecret,
  type RemoteTrigger,
} from '../remote-triggers.js';
import { createDeployment } from '../infra.js';
import { audit } from '../middleware/rbac.js';

interface ParsedPush {
  ref: string | null; // "refs/heads/main"
  branch: string | null;
  commit: string | null;
  pusher: string | null;
  message: string | null;
}

/** Pull the push bits we need out of a GitHub payload, or a generic one. */
function parsePush(body: unknown): ParsedPush {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, any>;
  const ref = typeof b.ref === 'string' ? b.ref : null;
  const branch = ref && ref.startsWith('refs/heads/') ? ref.slice('refs/heads/'.length) : typeof b.branch === 'string' ? b.branch : null;
  const commit =
    (typeof b.after === 'string' && b.after) ||
    (typeof b.commit === 'string' && b.commit) ||
    (b.head_commit && typeof b.head_commit.id === 'string' ? b.head_commit.id : null) ||
    null;
  const pusher = (b.pusher && typeof b.pusher.name === 'string' ? b.pusher.name : null) || (typeof b.sender?.login === 'string' ? b.sender.login : null);
  const message = (b.head_commit && typeof b.head_commit.message === 'string' ? b.head_commit.message.split('\n')[0] : null) || null;
  return { ref, branch, commit, pusher, message };
}

/** HMAC-SHA256 compare that tolerates GitHub's "sha256=<hex>" prefix. */
function verifySignature(raw: Buffer, provided: string | undefined, secret: string): boolean {
  if (!provided) return false;
  const bare = provided.startsWith('sha256=') ? provided.slice('sha256='.length) : provided;
  if (!/^[0-9a-f]{64}$/i.test(bare)) return false;
  const mac = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(mac, 'hex');
  const b = Buffer.from(bare.toLowerCase(), 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Shape a loaded trigger for the GET responses — never includes the resolved secret. */
function publicView(t: RemoteTrigger, engineBase: string) {
  return {
    ...sanitize(t),
    webhook_url: `${engineBase.replace(/\/$/, '')}/api/v1/webhooks/git/${encodeURIComponent(t.project_key)}`,
  };
}

const ENGINE_PUBLIC_URL = (process.env.ENGINE_PUBLIC_URL || 'http://127.0.0.1:8797').replace(/\/$/, '');

type WebhookRequest = FastifyRequest & { rawBody?: Buffer };

export async function webhookRoutes(app: FastifyInstance) {
  // Capture the raw request bytes on webhook POSTs so HMAC verification can
  // compare against exactly what the sender signed — JSON re-serialization
  // (even with the same keys and values) can differ in whitespace, which would
  // make a valid signature look invalid. The parser still produces the usual
  // JSON object on req.body, so handlers downstream are unchanged.
  app.addContentTypeParser('application/json', { parseAs: 'buffer' }, (req, body: Buffer, done) => {
    if (typeof req.url === 'string' && req.url.startsWith('/api/v1/webhooks/git/')) {
      (req as WebhookRequest).rawBody = body;
    }
    if (!body.length) return done(null, {});
    try {
      done(null, JSON.parse(body.toString('utf8')));
    } catch (err) {
      done(err as Error, undefined);
    }
  });

  app.get('/api/v1/webhooks/git', async (_req, reply) => {
    const loaded = loadRemoteTriggers();
    return reply.send({
      data: {
        file: loaded.file,
        exists: loaded.exists,
        error: loaded.error ?? null,
        triggers: loaded.triggers.map((t) => publicView(t, ENGINE_PUBLIC_URL)),
      },
    });
  });

  app.get<{ Params: { projectKey: string } }>('/api/v1/webhooks/git/:projectKey', async (req, reply) => {
    const t = findTrigger(req.params.projectKey);
    if (!t) return reply.status(404).send({ error: `Unknown project_key "${req.params.projectKey}"` });
    return reply.send({ data: publicView(t, ENGINE_PUBLIC_URL) });
  });

  app.post<{ Params: { projectKey: string } }>('/api/v1/webhooks/git/:projectKey', async (req, reply) => {
    const t = findTrigger(req.params.projectKey);
    if (!t) return reply.status(404).send({ error: `Unknown project_key "${req.params.projectKey}"` });
    if (!t.enabled) return reply.status(409).send({ error: `Project "${t.project_key}" is disabled in remote-triggers.json` });

    const secret = triggerSecret(t);
    if (!secret) {
      return reply.status(500).send({
        error: `Shared secret env ${t.secret_env} is not set on the test engine — a signed webhook cannot be verified`,
      });
    }

    // HMAC against the raw bytes the sender signed, captured by our scoped parser above.
    const raw = (req as WebhookRequest).rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}), 'utf8');
    const providedSig = (req.headers[t.signature_header] as string) || (req.headers['x-webhook-secret'] as string);
    // Allow a shared-token fallback for sources that cannot sign (plain curl, simple cron):
    // header x-webhook-secret must equal the resolved secret, timing-safe.
    let signed = false;
    if (providedSig) {
      if (providedSig.startsWith('sha256=') || /^[0-9a-f]{64}$/i.test(providedSig)) {
        signed = verifySignature(raw, providedSig, secret);
      } else {
        const a = Buffer.from(providedSig);
        const b = Buffer.from(secret);
        signed = a.length === b.length && timingSafeEqual(a, b);
      }
    }
    if (!signed) return reply.status(401).send({ error: 'Signature verification failed' });

    const event = String(req.headers['x-github-event'] || '').toLowerCase();
    if (event === 'ping') return reply.send({ ok: true, pong: true });

    const push = parsePush(req.body);
    if (push.branch && push.branch !== t.branch) {
      return reply.send({
        ok: true,
        skipped: `branch "${push.branch}" is not the configured branch "${t.branch}"`,
      });
    }

    // The host-side deploy.mjs fetches origin and resolves this ref against its own
    // mirror (git lives on the host, not in this container). Prefer the payload's
    // commit SHA when GitHub provided one; fall back to the configured branch name.
    const ref = push.commit && /^[0-9a-f]{7,40}$/i.test(push.commit) ? push.commit : t.branch;

    const requestedBy = push.pusher ? `remote:${push.pusher}` : 'remote-webhook';
    const outcome = await createDeployment(
      {
        environment: t.environment,
        application: t.application,
        mode: 'deploy_and_run',
        ref,
        requested_by: requestedBy,
        run_request: {
          planner: 'run_all',
          application: t.application,
          trigger_source: t.trigger_source,
          requested_by: requestedBy,
          metadata: {
            remote: {
              project_key: t.project_key,
              branch: t.branch,
              commit: push.commit,
              ref,
              pusher: push.pusher,
              message: push.message,
            },
          },
        },
        reason: t.reason || `remote commit on ${t.branch}`,
      },
      req.actor?.id ?? null,
    );
    if (outcome.audit) {
      await audit(req, 'webhook.deploy_and_run', 'environment', outcome.audit.environment_id, {
        ...outcome.audit.details,
        project_key: t.project_key,
        ref,
        commit: push.commit,
        branch: t.branch,
      });
    }
    return reply.status(outcome.status).send({
      ...outcome.body,
      trigger: { project_key: t.project_key, branch: t.branch, ref, commit: push.commit, pusher: push.pusher, message: push.message },
    });
  });
}
