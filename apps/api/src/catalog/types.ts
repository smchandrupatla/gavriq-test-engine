/**
 * Canonical, executable test-case catalog definitions.
 *
 * Every case here is REAL and RUNNABLE: its steps are executed verbatim by the
 * worker runners (http / playwright / selenium / performance) against the
 * environment selected at run time. Endpoints, selectors and expected texts
 * were verified against a live deployment before being encoded — no dummy
 * placeholders. Each case also carries the documentation the repository
 * exposes: description, preconditions, data used and the profile of that data.
 *
 * Representation (adopted from Sand Bench's Test cases screen, 2026-10-03):
 * besides the executable detail, every case is described the way a person
 * reads it on the Test cases screen — Title, Test ID, Priority, Owner,
 * Component, Environment, Estimated duration, Tags, Visibility, Objective,
 * Preconditions, numbered Steps (what is done / what should happen / data
 * used), Dependencies, Automation link, Overall test data, Attachments and
 * the triage notes (flakiness, workarounds, common failure causes). The
 * objective and step wording are PLAIN LANGUAGE: a reader with no technical
 * background must understand what is checked and why (see
 * .github/skills/plain-language-test-cases/SKILL.md). Fields a case does not
 * set are filled from the suite/runner by catalog/plain-language.ts.
 */

export interface DataProfile {
  /** Short label of the data class, e.g. "boundary", "synthetic-iso20022", "none (read-only)". */
  profile: string;
  /** Human description of exactly what data the case sends/uses. */
  data: string;
  /** Where the data comes from / how it is generated. */
  source: string;
}

/** A linked file or page: name + URL (nothing is uploaded; links only). */
export interface Attachment {
  name: string;
  url: string;
}

/**
 * The person-facing side of one step. Executable steps may carry these fields
 * next to their runner fields (action, url, selector, ...); when a step does
 * not, catalog/plain-language.ts derives them from the runner fields.
 */
export interface HumanStep {
  /** What is done in this step, in plain words ("Sign in as the demo operator"). */
  text: string;
  /** What should happen if the step passes ("The console shows the Overview page"). */
  expected: string;
  /** The input data this step uses, if any ("username analyst, demo password"). */
  testData?: string;
  attachments?: Attachment[];
}

export type PriorityLabel = 'Critical' | 'High' | 'Medium' | 'Low';
export type EstimatedDuration = 'Under 1m' | '1-5m' | '5-15m' | '15-60m' | '60m+';
export type Visibility = 'Public' | 'Team' | 'Private';
export type TriageStatus = 'None' | 'Investigating' | 'Assigned' | 'Issue linked' | 'Resolved';

export const ESTIMATED_DURATIONS: EstimatedDuration[] = ['Under 1m', '1-5m', '5-15m', '15-60m', '60m+'];
export const VISIBILITIES: Visibility[] = ['Public', 'Team', 'Private'];
export const TRIAGE_STATUSES: TriageStatus[] = ['None', 'Investigating', 'Assigned', 'Issue linked', 'Resolved'];
export const PRIORITY_LABELS: PriorityLabel[] = ['Critical', 'High', 'Medium', 'Low'];

/** Repository priority (p0..p4) → the label the Test cases screen shows. */
export const PRIORITY_LABEL: Record<string, PriorityLabel> = { p0: 'Critical', p1: 'High', p2: 'Medium', p3: 'Low', p4: 'Low' };
/** Screen label → repository priority. */
export const LABEL_PRIORITY: Record<PriorityLabel, 'p0' | 'p1' | 'p2' | 'p3'> = { Critical: 'p0', High: 'p1', Medium: 'p2', Low: 'p3' };

export interface CaseDef {
  key: string;
  name: string;
  /**
   * One or two plain-language sentences: what this test checks and why it
   * matters, written for a reader with no technical background. No URLs,
   * HTTP verbs, status codes, selectors or field paths — those belong in the
   * steps and in `description`.
   */
  objective: string;
  /** The precise, technical statement of what the case does (endpoints, contracts, verified values). */
  description: string;
  suiteKey: string;
  /** Postgres test_type enum value. */
  testType: string;
  method: 'http' | 'selenium' | 'playwright' | 'performance';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'trivial';
  priority: 'p0' | 'p1' | 'p2' | 'p3' | 'p4';
  preconditions: string;
  /** Executable steps for http/playwright/selenium runners; each may also carry HumanStep fields. */
  steps?: unknown[];
  /** HTTP case-owned cleanup attempted after the main steps, including failures. */
  cleanupSteps?: unknown[];
  /** Maximum seconds reserved for HTTP cleanup after the main case. */
  cleanupTimeoutSeconds?: number;
  /** Runner options (perf profile, browser, viewport, data_profile copy). */
  validationRules?: Record<string, unknown>;
  timeoutSeconds?: number;
  tags: string[];
  dataProfile: DataProfile;
  expected: string;

  // ---- Test cases screen fields (Sand Bench representation) ----------------
  /** Who looks after this case (a person, role or team). Default: the suite category's team. */
  owner?: string;
  /** The part of the application this case exercises ("API", "Web console", "Login", ...). Default: derived from the surfaces the steps touch. */
  component?: string;
  /** The environment the case is written for (an environment key). Default: the application's development environment. */
  environment?: string;
  /** How long one run usually takes. Default: derived from the runner and timeout. */
  estimatedDuration?: EstimatedDuration;
  /** Who may see the case in the console. Default: Team. */
  visibility?: Visibility;
  /** The script, file or job that runs this case. Default: the catalog file and case key. */
  automationLink?: string;
  /** The data the whole case uses, in plain words. Default: dataProfile.data. */
  testData?: string;
  /** Linked screenshots, sample data, documents (name + URL). */
  attachments?: Attachment[];
  /** Keys of cases this one depends on. Catalog cases are independent, so normally empty. */
  dependencyIds?: string[];
  /** Known intermittent behaviour. */
  flakinessNotes?: string;
  /** What to do when it fails for a known reason. */
  knownWorkarounds?: string;
  /** The usual reasons this case goes red. */
  commonFailureCauses?: string;
  /** Catalog module the case is defined in (set by tagSource; used for the automation link). */
  sourceFile?: string;
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

/** Records which catalog module defined each case (its automation link points there). */
export function tagSource<T extends CaseDef>(file: string, cases: T[]): T[] {
  for (const c of cases) if (!c.sourceFile) c.sourceFile = file;
  return cases;
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
