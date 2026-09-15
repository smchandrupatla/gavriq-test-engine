/**
 * RBAC + identity resolution.
 *
 * Priority:
 * 1. X-Worker-Key matches WORKER_API_KEY → worker role
 * 2. Authorization: Bearer <jwt> verified with JWT_SECRET (HS256) via jose
 * 3. x-actor-id / x-actor-roles headers (dev / trusted gateway)
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { jwtVerify } from 'jose';
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

function parseRoles(raw: unknown): Role[] {
  if (Array.isArray(raw)) return raw.map(String).map((r) => r.trim()).filter(Boolean) as Role[];
  if (typeof raw === 'string') {
    return raw.split(',').map((r) => r.trim()).filter(Boolean) as Role[];
  }
  return ['viewer'];
}

async function verifyBearer(token: string): Promise<{ id: string; roles: Role[] } | null> {
  const secret = process.env.JWT_SECRET;
  if (!secret) return null;
  try {
    const key = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
    const id = String(payload.sub || payload.user_id || 'jwt-user');
    const roles = parseRoles(payload.roles ?? payload.role);
    return { id, roles: roles.length ? roles : ['viewer'] };
  } catch (err) {
    console.warn('[jwt] verify failed:', (err as Error).message);
    return null;
  }
}

export function resolveActor(req: FastifyRequest) {
  const workerKey = process.env.WORKER_API_KEY;
  const providedKey = req.headers['x-worker-key'] as string | undefined;
  if (workerKey && providedKey && providedKey === workerKey) {
    req.actor = { id: 'worker', roles: ['worker', 'automation_agent'] };
    return;
  }

  // Async JWT is resolved in preHandler hook when needed; sync path uses headers.
  // Callers that need JWT must await resolveActorAsync.
  const roleHeader = req.headers['x-actor-roles'] as string | undefined;
  const id = (req.headers['x-actor-id'] as string) || 'anonymous';
  req.actor = { id, roles: parseRoles(roleHeader) };
}

/** Full async resolution including Bearer JWT. */
export async function resolveActorAsync(req: FastifyRequest) {
  const workerKey = process.env.WORKER_API_KEY;
  const providedKey = req.headers['x-worker-key'] as string | undefined;
  if (workerKey && providedKey && providedKey === workerKey) {
    req.actor = { id: 'worker', roles: ['worker', 'automation_agent'] };
    return;
  }

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const token = auth.slice(7).trim();
    const verified = await verifyBearer(token);
    if (verified) {
      req.actor = verified;
      return;
    }
    // Invalid token when JWT_SECRET is set → anonymous viewer (RBAC will block writes)
    if (process.env.JWT_SECRET) {
      req.actor = { id: 'invalid-token', roles: ['viewer'] };
      return;
    }
  }

  const roleHeader = req.headers['x-actor-roles'] as string | undefined;
  const id = (req.headers['x-actor-id'] as string) || 'anonymous';
  req.actor = { id, roles: parseRoles(roleHeader) };
}

export function requirePermission(permission: string) {
  return async (req: FastifyRequest, reply: FastifyReply) => {
    await resolveActorAsync(req);
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
