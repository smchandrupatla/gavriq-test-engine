/**
 * Map runner errors to execution status + failure_classification.
 * Environment / target problems are blocked, not failed.
 */

const TARGET_RE =
  /econnrefused|enotfound|ehostunreach|etimedout|fetch failed|network error|target unreachable|not reachable|connect(?:ion)? refused|getaddrinfo|socket hang up|und_err_connect/i;

const AUTH_RE = /\b401\b|\b403\b|unauthorized|forbidden|authentication/i;
const ASSERT_RE = /assert|expected|unexpected|did not match/i;
const TIMEOUT_RE = /timed? out|timeout|abort(ed)?/i;
const SCRIPT_RE = /not a sit script|file not found|unknown http action|syntax/i;

export type Classified = {
  status: 'passed' | 'failed' | 'error' | 'skipped' | 'blocked';
  classification?: string;
};

export function classifyOutcome(input: {
  status?: string;
  message?: string;
  classification?: string | null;
}): Classified {
  const message = String(input.message || '');
  const incoming = String(input.status || 'error').toLowerCase();

  if (incoming === 'passed' || incoming === 'skipped' || incoming === 'cancelled') {
    return { status: incoming as Classified['status'], classification: input.classification || undefined };
  }

  if (incoming === 'blocked' || input.classification === 'target_unreachable' || TARGET_RE.test(message)) {
    return { status: 'blocked', classification: 'target_unreachable' };
  }

  if (input.classification === 'environment_problem' || input.classification === 'network_failure') {
    return { status: 'blocked', classification: input.classification };
  }

  if (TIMEOUT_RE.test(message)) {
    return { status: incoming === 'error' ? 'error' : 'failed', classification: 'timeout' };
  }
  if (AUTH_RE.test(message)) {
    return { status: 'failed', classification: 'authentication_problem' };
  }
  if (SCRIPT_RE.test(message)) {
    return { status: 'failed', classification: 'script_problem' };
  }
  if (ASSERT_RE.test(message)) {
    return { status: 'failed', classification: 'assertion_failure' };
  }

  return {
    status: incoming === 'error' ? 'error' : 'failed',
    classification: input.classification || 'unknown',
  };
}

export function isEnvironmentFailure(status?: string, classification?: string | null): boolean {
  return status === 'blocked' || classification === 'target_unreachable'
    || classification === 'environment_problem' || classification === 'network_failure'
    || classification === 'infrastructure_failure' || classification === 'deployment_problem';
}
