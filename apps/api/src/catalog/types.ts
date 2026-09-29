/**
 * Canonical, executable test-case catalog definitions.
 *
 * Every case here is REAL and RUNNABLE: its steps are executed verbatim by the
 * worker runners (http / playwright / selenium / performance) against the
 * environment selected at run time. Endpoints, selectors and expected texts
 * were verified against a live deployment before being encoded — no dummy
 * placeholders. Each case also carries the documentation the repository
 * exposes: description, preconditions, data used and the profile of that data.
 */

export interface DataProfile {
  /** Short label of the data class, e.g. "boundary", "synthetic-iso20022", "none (read-only)". */
  profile: string;
  /** Human description of exactly what data the case sends/uses. */
  data: string;
  /** Where the data comes from / how it is generated. */
  source: string;
}

export interface CaseDef {
  key: string;
  name: string;
  description: string;
  suiteKey: string;
  /** Postgres test_type enum value. */
  testType: string;
  method: 'http' | 'selenium' | 'playwright' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'trivial';
  priority: 'p0' | 'p1' | 'p2' | 'p3' | 'p4';
  preconditions: string;
  /** Executable steps for http/playwright/selenium runners. */
  steps?: unknown[];
  /** Runner options (perf profile, browser, viewport, data_profile copy). */
  validationRules?: Record<string, unknown>;
  timeoutSeconds?: number;
  tags: string[];
  dataProfile: DataProfile;
  expected: string;
}

export interface SuiteDef {
  key: string;
  name: string;
  description: string;
  /** Console taxonomy key (unit | integration | screen | ... | drRecovery). */
  typeKey: string;
  category: 'qa' | 'qc';
}

export interface TypeMeta {
  key: string;
  label: string;
  subtitle: string;
  category: 'qa' | 'qc';
}

/** Console taxonomy key → Postgres test_type enum. */
export const TYPE_TO_ENUM: Record<string, string> = {
  unit: 'unit',
  integration: 'integration',
  screen: 'ui',
  usecase: 'acceptance',
  regression: 'regression',
  smoke: 'smoke',
  dataQuality: 'database',
  'selenium-baseline': 'selenium-baseline',
  endurance: 'performance',
  performance: 'performance',
  rollingUpgrade: 'deployment',
  nonFunctional: 'resilience',
  vulnerabilityScanning: 'security',
  penTesting: 'security',
  compatibility: 'ui',
  chaos: 'resilience',
  compliance: 'other',
  drRecovery: 'resilience',
  api: 'api',
};
