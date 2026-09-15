/**
 * RBAC middleware skeleton (Prompt 9).
 * In production, wire to real auth (JWT / session) and role store.
 *
 * Roles: test_admin | test_manager | test_architect | test_engineer |
 *        developer | performance_engineer | security_tester |
 *        release_manager | auditor | viewer | automation_agent
 */
import type { FastifyRequest, FastifyReply } from 'fastify';

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
  | 'automation_agent';

const PERMISSIONS: Record<string, Role[]> = {
  'tests:read': ['test_admin', 'test_manager', 'test_architect', 'test_engineer', 'developer', 'viewer', 'auditor', 'automation_agent', 'release_manager', 'performance_engineer', 'security_tester'],
  'tests:write': ['test_admin', 'test_manager', 'test_architect', 'test_engineer'],
  'tests:approve': ['test_admin', 'test_manager', 'test_architect'],
  'executions:run': ['test_admin', 'test_manager', 'test_engineer', 'developer', 'automation_agent', 'performance_engineer'],
  'executions:run_performance': ['test_admin', 'performance_engineer'],
  'executions:run_destructive': ['test_admin'],
  'environments:write': ['test_admin', 'test_manager'],
  'workers:manage': ['test_admin'],
  'audit:read': ['test_admin', 'auditor', 'test_manager', 'release_manager'],
  'release:decide': ['test_admin', 'release_manager', 'test_manager'],
};

declare module 'fastify' {
  interface FastifyRequest {
    actor?: { id: string; roles: Role[] };
  }
}

/** Extract actor from header (dev) or JWT (prod). */
export function resolveActor(req: FastifyRequest) {
  const roleHeader = (req.headers['x-actor-roles'] as string) || 'test_engineer';
  const id = (req.headers['x-actor-id'] as string) || 'anonymous';
  const roles = roleHeader.split(',').map((r) => r.trim()) as Role[];
  req.actor = { id, roles };
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
