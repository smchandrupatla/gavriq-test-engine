/** The complete seeded Sand Bench inventory, shared by seeding and quality checks. */
import { SANDBENCH_CASES, SANDBENCH_SUITES } from './sandbench-cases.js';
import { SANDBENCH_PORTAL_CASES, SANDBENCH_PORTAL_SUITES } from './sandbench-portal-cases.js';
import { SANDBENCH_API_COVERAGE_CASES, SANDBENCH_API_COVERAGE_SUITE } from './sandbench-api-coverage-cases.js';
import { SANDBENCH_EVENT_RT_CASES, SANDBENCH_EVENT_RT_SUITES } from './sandbench-event-roundtrip-cases.js';
import { SANDBENCH_PENDING_CASES, SANDBENCH_PENDING_SUITE } from './sandbench-pending-feature-cases.js';
import { SANDBENCH_RESILIENCE_CASES, SANDBENCH_RESILIENCE_SUITE } from './sandbench-resilience-cases.js';
import type { CaseDef, SuiteDef } from './types.js';

export const SANDBENCH_ALL_CASES: CaseDef[] = [
  ...SANDBENCH_CASES,
  ...SANDBENCH_PORTAL_CASES,
  ...SANDBENCH_API_COVERAGE_CASES,
  ...SANDBENCH_EVENT_RT_CASES,
  ...SANDBENCH_PENDING_CASES,
  ...SANDBENCH_RESILIENCE_CASES,
];

export const SANDBENCH_ALL_SUITES: SuiteDef[] = [
  ...SANDBENCH_SUITES,
  ...SANDBENCH_PORTAL_SUITES,
  SANDBENCH_API_COVERAGE_SUITE,
  ...SANDBENCH_EVENT_RT_SUITES,
  SANDBENCH_PENDING_SUITE,
  SANDBENCH_RESILIENCE_SUITE,
];
