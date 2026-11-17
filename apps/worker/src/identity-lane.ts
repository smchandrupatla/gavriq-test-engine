/**
 * Identity lane: the engine hands every running execution its own pool identity
 * (`metadata.identity_lane`, see leaseIdentityLane in apps/api/src/routes/
 * executions.ts), so two cases running at the same time never share a signed-in
 * user. Here the lane becomes the identity every case of that execution uses:
 * {{username}} / {{password}} resolve to the lane's `pool_user_<lane>` /
 * `pool_pass_<lane>`. An execution without a lane (no pool on the environment,
 * or claimed from an older API) keeps the environment's own username.
 */
export function withIdentityLane(vars: Record<string, string>, lane: unknown): Record<string, string> {
  const n = typeof lane === 'number' ? lane : typeof lane === 'string' && lane !== '' ? Number(lane) : NaN;
  if (!Number.isInteger(n) || n < 0) return vars;
  const user = vars[`pool_user_${n}`];
  if (user === undefined) return vars;
  const out: Record<string, string> = { ...vars, identity_lane: String(n), username: user };
  const pass = vars[`pool_pass_${n}`];
  if (pass !== undefined) out.password = pass;
  return out;
}
