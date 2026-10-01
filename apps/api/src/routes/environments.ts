import type { FastifyInstance } from 'fastify';
import { query } from '../db/client.js';
import { audit } from '../middleware/rbac.js';

type Probe = { ok: boolean; status?: number; error?: string } | null;

async function probe(url: unknown): Promise<Probe> {
  if (typeof url !== 'string' || !url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function environmentRoutes(app: FastifyInstance) {
  app.get('/api/v1/environments', async (_req, reply) => {
    const { rows } = await query('SELECT * FROM environments ORDER BY name');
    return reply.send({ data: rows });
  });

  app.get<{ Params: { id: string } }>('/api/v1/environments/:id', async (req, reply) => {
    const { rows } = await query(
      'SELECT * FROM environments WHERE id::text = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Environment not found' });
    return reply.send({ data: rows[0] });
  });

  app.post<{ Body: Record<string, unknown> }>('/api/v1/environments', async (req, reply) => {
    const b = req.body || {};
    if (!b.key || !b.name) return reply.status(400).send({ error: 'key and name required' });
    const { rows } = await query(
      `INSERT INTO environments (key, name, env_type, base_url, config, secrets_ref, safety_policy, worker_affinity, created_by)
       VALUES ($1,$2,COALESCE($3::environment_type,'development'),$4,COALESCE($5,'{}'::jsonb),$6,COALESCE($7,'{}'::jsonb),$8,$9)
       RETURNING *`,
      [
        b.key, b.name, b.env_type ?? null, b.base_url ?? null,
        JSON.stringify(b.config ?? {}), b.secrets_ref ?? null,
        JSON.stringify(b.safety_policy ?? {}),
        b.worker_affinity ?? null, b.created_by ?? null,
      ]
    );
    return reply.status(201).send({ data: rows[0] });
  });

  /**
   * Partial update. `config` and `safety_policy` merge onto the existing
   * value (one level deep for config.vars/config.secret_env) rather than
   * replacing it wholesale, so a caller can patch e.g. just config.vars.password
   * without resending the rest of the environment's configuration.
   */
  app.patch<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/api/v1/environments/:id',
    async (req, reply) => {
      const { rows: existing } = await query(
        'SELECT * FROM environments WHERE id::text = $1 OR key = $1',
        [req.params.id]
      );
      if (!existing[0]) return reply.status(404).send({ error: 'Environment not found' });
      const b = req.body || {};

      let config = existing[0].config || {};
      if (b.config && typeof b.config === 'object') {
        const patch = b.config as Record<string, unknown>;
        config = { ...config, ...patch };
        for (const key of ['vars', 'secret_env']) {
          if (patch[key] && typeof patch[key] === 'object') {
            config[key] = { ...(config[key] || {}), ...(patch[key] as Record<string, unknown>) };
          }
        }
      }

      let safetyPolicy = existing[0].safety_policy || {};
      if (b.safety_policy && typeof b.safety_policy === 'object') {
        safetyPolicy = { ...safetyPolicy, ...(b.safety_policy as Record<string, unknown>) };
      }

      const { rows } = await query(
        `UPDATE environments SET
           name = COALESCE($2, name),
           env_type = COALESCE($3, env_type),
           base_url = COALESCE($4, base_url),
           config = $5::jsonb,
           secrets_ref = COALESCE($6, secrets_ref),
           safety_policy = $7::jsonb,
           worker_affinity = COALESCE($8, worker_affinity),
           status = COALESCE($9, status),
           updated_by = COALESCE($10, updated_by),
           updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [
          existing[0].id,
          typeof b.name === 'string' ? b.name : null,
          typeof b.env_type === 'string' ? b.env_type : null,
          typeof b.base_url === 'string' ? b.base_url : null,
          JSON.stringify(config),
          typeof b.secrets_ref === 'string' ? b.secrets_ref : null,
          JSON.stringify(safetyPolicy),
          Array.isArray(b.worker_affinity) ? b.worker_affinity : null,
          typeof b.status === 'string' ? b.status : null,
          typeof b.updated_by === 'string' ? b.updated_by : (req.actor?.id ?? null),
        ]
      );
      await audit(req, 'environment.update', 'environment', rows[0]!.id, {
        key: rows[0]!.key,
        changed_fields: Object.keys(b),
      });
      return reply.send({ data: rows[0] });
    }
  );

  app.get<{ Params: { id: string } }>('/api/v1/environments/:id/policy', async (req, reply) => {
    const { rows } = await query(
      'SELECT key, name, safety_policy FROM environments WHERE id::text = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Environment not found' });
    return reply.send({ data: rows[0] });
  });

  /** Check whether a safety category is allowed on this environment */
  app.post<{ Params: { id: string }; Body: { category: string } }>(
    '/api/v1/environments/:id/policy/check',
    async (req, reply) => {
      const { rows } = await query(
        'SELECT safety_policy FROM environments WHERE id::text = $1 OR key = $1',
        [req.params.id]
      );
      if (!rows[0]) return reply.status(404).send({ error: 'Environment not found' });
      const policy = rows[0].safety_policy || {};
      const category = req.body?.category;
      const decision = policy[category] || 'prohibited';
      return reply.send({
        data: {
          category,
          decision,
          allowed: decision === 'allowed',
          requires_approval: decision === 'approval_required',
          prohibited: decision === 'prohibited',
        },
      });
    }
  );

  /**
   * Live reachability of this environment's web, API and database (viewer)
   * endpoints — "is it actually up", not what's registered. Never throws:
   * each leg reports ok/status/error independently, and a leg with no URL
   * configured reports null ("not configured") rather than failing.
   */
  app.get<{ Params: { id: string } }>('/api/v1/environments/:id/status', async (req, reply) => {
    const { rows } = await query(
      'SELECT id, key, base_url, config FROM environments WHERE id::text = $1 OR key = $1',
      [req.params.id]
    );
    if (!rows[0]) return reply.status(404).send({ error: 'Environment not found' });
    const env = rows[0];
    const vars = (env.config || {}).vars || {};
    const webUrl = vars.web || env.base_url;
    const apiUrl = vars.api ? `${String(vars.api).replace(/\/$/, '')}/health` : null;
    const dbUrl = vars.dbviewer ? `${String(vars.dbviewer).replace(/\/$/, '')}/health` : null;

    const [web, api, db] = await Promise.all([probe(webUrl), probe(apiUrl), probe(dbUrl)]);
    return reply.send({ data: { checked_at: new Date().toISOString(), web, api, db } });
  });
}
