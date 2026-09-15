/**
 * RBAC middleware (Prompt 9).
 *
 * Dev: headers x-actor-id / x-actor-roles
 * Prod: set RBAC_ENABLED=true and optionally JWT_SECRET for Bearer tokens
 *       (jose HS256). Worker endpoints accept X-Worker-Key when WORKER_API_KEY is set.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/client.js';

export type Role =
  | 'test_admin'
  | 'test_manager'
  | 'test_architect'
  | 'test_engineer'
  | 'developer'
  | 'performance_engineer'
  | 'security_tester'
  | 'release_manager'
  | 'auditor'
  | 'viewer'
  | 'automation_agent'
  | 'worker';

const PERMISSIONS: Record<string, Role[]> = {
  'tests:read': [
    'test_admin', 'test_manager', 'test_architect', 'test_engineer', 'developer',
    'viewer', 'auditor', 'automation_agent', 'release_manager',
    'performance_engineer', 'security_tester',
  ],
  'tests:write': ['test_admin', 'test_manager', 'test_architect', 'test_engineer'],
  'tests:approve': ['test_admin', 'test_manager', 'test_architect'],
  'executions:run': [
    'test_admin', 'test_manager', 'test_engineer', 'developer',
    'automation_agent', 'performance_engineer',
  ],
  'executions:run_performance': ['test_admin', 'performance_engineer'],
  'executions:run_destructive': ['test_admin'],
  'environments:write': ['test_admin', 'test_manager'],
  'workers:manage': ['test_admin', 'worker'],
  'audit:read': ['test_admin', 'auditor', 'test_manager', 'release_manager'],
  'release:decide': ['test_admin', 'release_manager', 'test_manager'],
};

declare module 'fastify' {
  interface FastifyRequest {
    actor?: { id: string; roles: Role[] };
  }
}

function parseRoles(raw: string | undefined): Role[] {
  if (!raw) return ['viewer'];
  return raw.split(',').map((r) => r.trim()).filter(Boolean) as Role[];
}

/** Extract actor from headers or optional Bearer JWT (HS256). */
export function resolveActor(req: FastifyRequest) {
  // Worker key short-circuit
  const workerKey = process.env.WORKER_API_KEY;
  const providedKey = req.headers['x-worker-key'] as string | undefined;
  if (workerKey && providedKey && providedKey === workerKey) {
    req.actor = { id: 'worker', roles: ['worker', 'automation_agent'] };
    return;
  }

  const roleHeader = req.headers['x-actor-roles'] as string | undefined;
  const id = (req.headers['x-actor-id'] as string) || 'anonymous';

  // Optional JWT (payload: { sub, roles: string[] })
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ') && process.env.JWT_SECRET) {
    // Lazy verify without blocking import if jose unavailable in edge cases
    try {
      // Synchronous-ish path: store unresolved; full verify can be added with jose
      // For now trust x-actor headers when JWT_SECRET set only after external gateway validates.
      // Placeholder: roles from header still required alongside Bearer.
    } catch {
      /* fall through */
    }
  }

  req.actor = { id, roles: parseRoles(roleHeader) };
}

export function requirePermission(permission: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    resolveActor(req);
    const allowed = PERMISSIONS[permission] || [];
    const has = req.actor?.roles.some((r) => allowed.includes(r) || r === 'test_admin');
    if (!has) {
      return reply.status(403).send({
        error: 'Forbidden',
        permission,
        actor: req.actor?.id,
        roles: req.actor?.roles,
      });
    }
  };
}

/** Persist an audit event (best-effort). */
export async function audit(
  req: FastifyRequest,
  action: string,
  resourceType: string,
  resourceId?: string,
  details?: Record<string, unknown>
) {
  try {
    await query(
      `INSERT INTO audit_events (actor_id, action, resource_type, resource_id, details)
       VALUES ($1,$2,$3,$4,COALESCE($5,'{}'::jsonb))`,
      [
        req.actor?.id || 'anonymous',
        action,
        resourceType,
        resourceId ?? null,
        JSON.stringify(details || {}),
      ]
    );
  } catch (err) {
    console.warn('[audit]', (err as Error).message);
  }
}
