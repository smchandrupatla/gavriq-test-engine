/**
 * GAVRIQ Test Engine — self-test catalog.
 *
 * The engine registered as an application under test, with the same taxonomy
 * a customer application gets. Every case targets {{engine}} from the selected
 * environment's config.vars: the staging engine (a pinned commit, deployed by
 * deploy/engine-staging/deploy.mjs) or the development engine.
 *
 *   engine-functional-cases.ts   smoke, api, integration, use case, regression, data quality
 *   engine-ui-cases.ts           screen, Selenium baseline, browser compatibility
 *   engine-quality-cases.ts      performance, endurance, upgrade, robustness, security,
 *                                chaos, compliance, recovery
 *
 * engine-case-kit.ts explains what a case needs from its target (read-only,
 * sandbox, isolated) and how it skips where that is missing.
 */
import { tagSource, type CaseDef, type SuiteDef, type TypeMeta } from './types.js';
import { ENGINE_FUNCTIONAL_CASES } from './engine-functional-cases.js';
import { ENGINE_UI_CASES } from './engine-ui-cases.js';
import { ENGINE_QUALITY_CASES } from './engine-quality-cases.js';
import { ENGINE_SELF_CASES } from './engine-self-cases.js';

export const ENGINE_TYPES: TypeMeta[] = [
  { key: 'smoke', label: 'Smoke tests', subtitle: 'Control plane, console and SIT console answer after a deploy.', category: 'qa' },
  { key: 'unit', label: 'Unit tests', subtitle: 'Focused checks on single endpoints and the invariants they enforce (settings validation, metadata-aware hooks, enum shape).', category: 'qa' },
  { key: 'api', label: 'API tests', subtitle: 'Every control-plane endpoint behaves to its contract.', category: 'qa' },
  { key: 'integration', label: 'Integration tests', subtitle: 'Repository, run planner, worker protocol, schedules and build reports working together.', category: 'qa' },
  { key: 'screen', label: 'Screen tests', subtitle: 'Real-browser rendering of the unified console.', category: 'qa' },
  { key: 'usecase', label: 'Use case driven tests', subtitle: 'What a pipeline, an operator and a release manager do with the engine, end to end.', category: 'qa' },
  { key: 'regression', label: 'Regression tests', subtitle: 'Response shapes, error copy and fixed defects that must not drift.', category: 'qa' },
  { key: 'dataQuality', label: 'Data quality tests', subtitle: 'The engine\'s own records agree across its read paths.', category: 'qa' },
  { key: 'selenium-baseline', label: 'Selenium Baseline', subtitle: 'Selenium WebDriver baseline against the unified console.', category: 'qa' },
  { key: 'performance', label: 'Performance tests', subtitle: 'Latency benchmarks with explicit SLAs on the endpoints the console and workers poll.', category: 'qc' },
  { key: 'endurance', label: 'Endurance tests', subtitle: 'Bounded soak: the load an open console and a polling worker put on the engine all day.', category: 'qc' },
  { key: 'rollingUpgrade', label: 'Rolling upgrade tests', subtitle: 'Contracts an older worker, console or CI reporter depends on stay intact.', category: 'qc' },
  { key: 'nonFunctional', label: 'Non-functional tests', subtitle: 'Bad input fails cleanly: a 4xx with a reason, never a 500.', category: 'qc' },
  { key: 'vulnerabilityScanning', label: 'Vulnerability scanning', subtitle: 'Exposure probes: secret files, traversal, error leakage, header hygiene.', category: 'qc' },
  { key: 'penTesting', label: 'Penetration tests', subtitle: 'Forged results, hostile uploads and injection against the write surface.', category: 'qc' },
  { key: 'compatibility', label: 'Compatibility tests', subtitle: 'The console in Chromium, Firefox and WebKit across four screen sizes.', category: 'qc' },
  { key: 'chaos', label: 'Chaos & failover tests', subtitle: 'Misbehaving workers and request storms do not corrupt a run.', category: 'qc' },
  { key: 'compliance', label: 'Compliance tests', subtitle: 'Audit trail, evidence gate, safety policy and secrets handling.', category: 'qc' },
  { key: 'drRecovery', label: 'DR recovery & self-healing', subtitle: 'Abandoned runs recover; what was written stays readable everywhere.', category: 'qc' },
];

export const ENGINE_SUITES: SuiteDef[] = [
  { key: 'te-smoke', name: 'Engine smoke', description: 'The control plane, its database, the console shell and the embedded SIT console are up.', typeKey: 'smoke', category: 'qa' },
  { key: 'te-unit', name: 'Engine unit tests', description: 'Focused checks of single endpoints: settings shape and validation, rolling-fail-cancel defaults and bounds, and the metadata-aware results hook.', typeKey: 'unit', category: 'qa' },
  { key: 'te-self-api', name: 'Engine API contracts', description: 'The engine\'s own repository, execution, run and read-model APIs verified over HTTP.', typeKey: 'api', category: 'qa' },
  { key: 'te-integration', name: 'Engine component flows', description: 'Case lifecycle, suite membership, run planning, the worker protocol, schedules and build-result ingest.', typeKey: 'integration', category: 'qa' },
  { key: 'te-screen', name: 'Console screens', description: 'Playwright-rendered checks of the unified console.', typeKey: 'screen', category: 'qa' },
  { key: 'te-usecase', name: 'Engine use cases', description: 'Pipeline-triggered runs, failure triage, release readiness and agent access, end to end.', typeKey: 'usecase', category: 'qa' },
  { key: 'te-regression', name: 'Engine behavior contracts', description: 'Shapes, copy and fixed defects re-checked on every run.', typeKey: 'regression', category: 'qa' },
  { key: 'te-data-quality', name: 'Engine data consistency', description: 'Counts, enums, references and integrity hashes agree across the engine\'s read paths.', typeKey: 'dataQuality', category: 'qa' },
  { key: 'te-selenium-baseline', name: 'Console Selenium baseline', description: 'Selenium WebDriver baseline: the console loads, navigates and lists its applications.', typeKey: 'selenium-baseline', category: 'qa' },
  { key: 'te-performance', name: 'Engine latency benchmarks', description: 'Short concurrent benchmarks with explicit p95 / error-rate SLAs.', typeKey: 'performance', category: 'qc' },
  { key: 'te-endurance', name: 'Engine bounded soak', description: 'Sustained request streams; the engine must stay healthy throughout.', typeKey: 'endurance', category: 'qc' },
  { key: 'te-rolling-upgrade', name: 'Engine upgrade compatibility', description: 'Addressing schemes, legacy fields and feature-detection contracts older clients rely on.', typeKey: 'rollingUpgrade', category: 'qc' },
  { key: 'te-non-functional', name: 'Engine robustness', description: 'Malformed, out-of-range and misrouted requests fail cleanly.', typeKey: 'nonFunctional', category: 'qc' },
  { key: 'te-vuln-scan', name: 'Engine exposure scanning', description: 'Secret-file probes, path traversal, error leakage and response headers.', typeKey: 'vulnerabilityScanning', category: 'qc' },
  { key: 'te-pen', name: 'Engine write-surface attacks', description: 'Forged results, hostile evidence uploads, mass assignment and injection.', typeKey: 'penTesting', category: 'qc' },
  { key: 'te-compat-browsers', name: 'Console browser & viewport matrix', description: 'Chromium, Firefox and WebKit at desktop/laptop/tablet/mobile sizes.', typeKey: 'compatibility', category: 'qc' },
  { key: 'te-chaos', name: 'Engine graceful degradation', description: 'Duplicate, late and partial worker reports, error floods and read storms.', typeKey: 'chaos', category: 'qc' },
  { key: 'te-compliance', name: 'Engine compliance evidence', description: 'Audit events, exit criteria, safety policy and secrets by reference.', typeKey: 'compliance', category: 'qc' },
  { key: 'te-dr', name: 'Engine durability & recovery', description: 'Abandoned-run recovery, idempotent re-reports and multi-path read consistency.', typeKey: 'drRecovery', category: 'qc' },
];

export const ENGINE_CASES: CaseDef[] = [
  ...tagSource('engine-functional-cases.ts', ENGINE_FUNCTIONAL_CASES),
  ...tagSource('engine-ui-cases.ts', ENGINE_UI_CASES),
  ...tagSource('engine-quality-cases.ts', ENGINE_QUALITY_CASES),
  ...tagSource('engine-self-cases.ts', ENGINE_SELF_CASES),
];
