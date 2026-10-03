/**
 * Plain-language representation of catalog cases.
 *
 * The Test cases screen (adopted from Sand Bench) shows every case the way a
 * person reads it: an objective, numbered steps with "what is done / what
 * should happen / data used", the owner, component, environment, estimated
 * duration, the automation link and the triage notes. Catalog cases are
 * written for the worker runners (URLs, selectors, JSON paths); this module
 * turns that executable detail into words anyone can follow, and fills the
 * screen fields a case leaves unset. A case may always write its own wording:
 * `text` / `expected` / `testData` on a step, or any of the CaseDef screen
 * fields, win over what is derived here.
 *
 * Rules of the wording (see .github/skills/plain-language-test-cases/SKILL.md):
 *   - name the surface, not its address ("the application's API", not {{api}});
 *   - say what is asked for, not the route ("the list of delivery channels");
 *   - say what a status means, with the code in brackets ("refuses — sign-in
 *     required (401)");
 *   - keep the technical detail reachable (route, selector) in brackets at the
 *     end, never instead of the plain sentence.
 */
import type { Attachment, CaseDef, EstimatedDuration, HumanStep, SuiteDef } from './types.js';
import { ESTIMATED_DURATIONS } from './types.js';

type Step = Record<string, any>;

/* ------------------------------------------------------------------------ */
/* Surfaces and vocabulary                                                   */
/* ------------------------------------------------------------------------ */

/** {{var}} base URLs → what a person calls that surface. */
const SURFACES: Record<string, string> = {
  api: "the application's API",
  web: 'the web console',
  testhub: 'the test hub (the external-system simulator)',
  dbviewer: 'the database viewer',
  engine: 'the test engine',
};

/** Possessive form of a surface ("the application API's reply"). */
const SURFACE_SHORT: Record<string, string> = {
  api: 'the API',
  web: 'the web console',
  testhub: 'the test hub',
  dbviewer: 'the database viewer',
  engine: 'the test engine',
};

/** Screen names for the static pages a case opens (file name → screen). */
const PAGE_TITLES: Record<string, string> = {
  'index.html': 'sign-in page',
  '': 'home page',
  'about.html': 'About screen',
  'help.html': 'Help screen',
  'overview.html': 'Overview screen',
  'admin.html': 'Admin screen',
  'test-cases.html': 'Test cases screen',
  'test-case-form.html': 'Test case form',
  'test-suites.html': 'Test suites screen',
  'test-suite-form.html': 'Test suite form',
  'test-runs-all.html': 'All test runs screen',
  'test-runs-active.html': 'Active runs screen',
  'test-runs-new.html': 'New test run screen',
  'message-designer.html': 'Message Designer',
  'message-designer-saved.html': 'Message Designer · saved definitions',
  'message-designer-schema-register.html': 'Message Designer · schema register',
  'message-designer-export-template.html': 'Message Designer · export template',
  'message-data-files.html': 'Message data files screen',
  'datasets.html': 'Datasets screen',
  'datasets-new.html': 'New dataset screen',
  'schedules-all.html': 'All schedules screen',
  'schedules-upcoming.html': 'Upcoming schedules screen',
  'schedules-new.html': 'New schedule screen',
  'reports-all.html': 'All reports screen',
  'reports-runs.html': 'Run reports screen',
  'reports-suites.html': 'Suite reports screen',
  'reports-coverage.html': 'Coverage reports screen',
  'reports-compliance.html': 'Compliance reports screen',
  'reports-scheduled.html': 'Scheduled reports screen',
  'rule-canvas.html': 'Rule canvas',
  'rule-bench-create.html': 'Rule bench · create',
  'rule-bench-existing.html': 'Rule bench · existing rules',
  'rule-bench-export.html': 'Rule bench · export',
  'rule-bench-stage.html': 'Rule bench · stage',
  'rule-bench-validate.html': 'Rule bench · validate',
  'configuration.html': 'Configuration screen',
  'configuration-api-access.html': 'Configuration · API access',
  'configuration-app-configs.html': 'Configuration · application configs',
  'configuration-data-retention.html': 'Configuration · data retention',
  'configuration-environment-defaults.html': 'Configuration · environment defaults',
  'configuration-eventing.html': 'Configuration · eventing',
  'configuration-notifications.html': 'Configuration · notifications',
  'configuration-user-roles.html': 'Configuration · user roles',
  'application-events.html': 'Application events screen',
  'event-framework.html': 'Event framework screen',
  'feature-ids.html': 'Feature IDs screen',
  'use-case.html': 'Use case screen',
  'use-case-templates.html': 'Use case templates screen',
  'security.html': 'Security screen',
  'naming.html': 'Naming conventions screen',
  'mask-demo.html': 'Masking demo screen',
  'not-production.html': '"Not production" notice page',
  'schema-canvas.html': 'Schema canvas',
  'create-schema.html': 'Create schema screen',
  'external-systems.html': 'External systems screen',
  'catalog/': 'test engine console',
  'sit/': 'embedded SIT console',
};

/** API routes → what is being asked for. First match wins; `{id}` stands for any id segment. */
const PATH_GLOSSARY: Array<[RegExp, string]> = [
  [/^\/health$/, 'its health check'],
  [/^\/ready$/, 'its readiness check'],
  [/^\/api\/v1\/session\/login$/, 'sign-in'],
  [/^\/api\/v1\/session\/me$/, 'the details of the signed-in session'],
  [/^\/api\/v1\/session\/features$/, 'the features the signed-in user may use'],
  [/^\/api\/v1\/session\/password-reset$/, 'a password reset'],
  [/^\/api\/v1\/session\/security-question$/, 'the security question of an account'],
  [/^\/api\/v1\/capabilities$/, 'the list of capabilities it publishes'],
  [/^\/api\/v1\/resilience$/, 'its resilience posture'],
  [/^\/api\/v1\/security\/health$/, 'the health of its security and encryption subsystem'],
  [/^\/api\/v1\/security\/records$/, 'its security records'],
  [/^\/api\/v1\/security\/policies$/, 'its security policies'],
  [/^\/api\/v1\/channel-targets$/, 'the list of delivery channels'],
  [/^\/api\/v1\/runs\/{id}$/, 'the details of the selected run'],
  [/^\/api\/v1\/runs$/, 'message generation runs'],
  [/^\/api\/v1\/rules\/export$/, 'an export of the validation rules'],
  [/^\/api\/v1\/rules\/{id}\/validate$/, 'a validation of the selected rule'],
  [/^\/api\/v1\/rules\/{id}\/stage$/, 'staging of the selected rule'],
  [/^\/api\/v1\/rules\/{id}\/transitions$/, 'the allowed state changes of the selected rule'],
  [/^\/api\/v1\/rules$/, 'validation rules'],
  [/^\/api\/v1\/reports$/, 'reports'],
  [/^\/api\/v1\/catalog\/designer-types$/, 'the message types known to the Message Designer'],
  [/^\/api\/v1\/catalog\/schemas\/drafts\/{id}\/rules$/, 'the rules of the selected schema draft'],
  [/^\/api\/v1\/catalog\/schemas\/drafts\/{id}\/tests$/, 'the test messages of the selected schema draft'],
  [/^\/api\/v1\/catalog\/schemas\/drafts\/{id}\/publish$/, 'publication of the selected schema draft'],
  [/^\/api\/v1\/catalog\/schemas\/drafts\/{id}$/, 'the selected schema draft'],
  [/^\/api\/v1\/catalog\/schemas\/drafts$/, 'schema drafts'],
  [/^\/api\/v1\/catalog\/schemas\/build$/, 'a schema build'],
  [/^\/api\/v1\/catalog\/iso\/uploads$/, 'uploaded ISO 20022 schema files'],
  [/^\/api\/v1\/catalog\/iso\/parse$/, 'parsing of an ISO 20022 document'],
  [/^\/api\/v1\/catalog\/iso\/validate-markdown$/, 'validation of an ISO 20022 markdown document'],
  [/^\/api\/v1\/catalog\/signatures$/, 'message signatures'],
  [/^\/api\/v1\/schedules\/{id}$/, 'the selected schedule'],
  [/^\/api\/v1\/schedules$/, 'schedules'],
  [/^\/api\/v1\/message-types\/[^/]+\/template\.csv$/, 'the CSV template of a message type'],
  [/^\/api\/v1\/message-types$/, 'the message type catalogue'],
  [/^\/api\/v1\/datasets\/{id}\/assemble$/, 'assembly of the selected dataset'],
  [/^\/api\/v1\/datasets\/{id}$/, 'the selected dataset'],
  [/^\/api\/v1\/datasets$/, 'datasets'],
  [/^\/api\/v1\/test-cases\/describe$/, 'a description of a test case'],
  [/^\/api\/v1\/test-cases\/{id}$/, 'the selected test case'],
  [/^\/api\/v1\/test-cases$/, 'test cases'],
  [/^\/api\/v1\/test-suites\/{id}\/cases$/, 'the member cases of the selected suite'],
  [/^\/api\/v1\/test-suites\/{id}\/run$/, 'a run of the selected suite'],
  [/^\/api\/v1\/test-suites\/{id}$/, 'the selected test suite'],
  [/^\/api\/v1\/test-suites$/, 'test suites'],
  [/^\/hub\/to-app$/, 'delivery of a message into the application'],
  [/^\/api\/rows$/, 'rows of an application database table'],
  [/^\/api\/v1\/settings\/eventing\/test$/, 'a test of the eventing settings'],
  [/^\/api\/v1\/settings\/eventing$/, 'the eventing settings'],
  [/^\/api\/v1\/settings\/logging$/, 'the logging settings'],
  [/^\/api\/v1\/settings\/use-cases$/, 'the use-case settings'],
  [/^\/api\/v1\/settings$/, 'the engine settings'],
  [/^\/api\/v1\/inbound\/events$/, 'inbound events'],
  [/^\/api\/v1\/features\/pages$/, 'the pages each feature level may open'],
  [/^\/api\/v1\/features$/, 'feature flags'],
  [/^\/api\/v1\/definitions\/preview$/, 'a preview of a message definition'],
  [/^\/api\/v1\/definitions$/, 'saved message definitions'],
  [/^\/api\/v1\/events\/framework$/, 'the event framework'],
  [/^\/api\/v1\/events\/headers$/, 'the event headers'],
  [/^\/api\/v1\/events\/catalog$/, 'the event catalogue'],
  [/^\/api\/v1\/events$/, 'application events'],
  [/^\/api\/v1\/admin\/users\/{id}\/effective-access$/, 'the effective access of the selected user'],
  [/^\/api\/v1\/admin\/users$/, 'user accounts'],
  [/^\/api\/v1\/admin\/tenants\/[^/]+\/users$/, 'the user accounts of the tenant'],
  [/^\/api\/v1\/admin\/functional-access-profiles$/, 'functional access profiles'],
  [/^\/api\/v1\/admin\/data-access-profiles$/, 'data access profiles'],
  [/^\/api\/v1\/ux\/first-run$/, 'the first-run guidance'],
  [/^\/api\/v1\/ux\/demo\/n2$/, 'the N-2 walkthrough demo'],
  [/^\/api\/v1\/naming\/preview$/, 'a naming preview'],
  [/^\/api\/v1\/naming-conventions$/, 'the naming conventions'],
  [/^\/api\/v1\/external-systems\/public$/, 'the public list of external systems'],
  [/^\/api\/v1\/external-systems\/kafka\/connectivity-check$/, 'a Kafka connectivity check'],
  [/^\/api\/v1\/external-systems$/, 'external systems'],
  [/^\/api\/v1\/generated-messages$/, 'generated messages'],
  [/^\/api\/v1\/data-files$/, 'message data files'],
  [/^\/api\/v1\/console\/bootstrap$/, 'the console start-up data'],
  [/^\/api\/v1\/audit$/, 'the audit trail'],
  [/^\/api\/v1\/use-cases\/review\/[^/]+$/, 'the review of a use case'],
  [/^\/api\/v1\/use-cases\/review$/, 'the use-case review list'],
  [/^\/api\/v1\/use-cases\/[^/]+\/revisions$/, 'the revisions of a use case'],
  [/^\/api\/v1\/use-cases\/[^/]+\.md$/, 'the markdown of a use case'],
  [/^\/api\/v1\/use-cases\/[^/]+$/, 'a use case'],
  [/^\/api\/v1\/use-cases$/, 'the use-case catalogue'],
  [/^\/api\/v1\/list-boxes$/, 'the list-box values'],
  [/^\/api\/v1\/schemas$/, 'schemas'],
  [/^\/api\/v1\/users$/, 'users'],
  // Test engine (self-test catalogue)
  [/^\/api\/v1\/meta$/, 'its version and capability map'],
  [/^\/api\/v1\/applications\/[^/]+$/, 'the selected application'],
  [/^\/api\/v1\/applications$/, 'the registered applications'],
  [/^\/api\/v1\/environments\/[^/]+$/, 'the selected environment'],
  [/^\/api\/v1\/environments$/, 'the registered environments'],
  [/^\/api\/v1\/suites\/{id}\/cases$/, 'the member cases of the selected suite'],
  [/^\/api\/v1\/suites\/{id}$/, 'the selected suite'],
  [/^\/api\/v1\/suites$/, 'test suites'],
  [/^\/api\/v1\/test-case-suites$/, 'the suite membership of every case'],
  [/^\/api\/v1\/plans$/, 'test plans'],
  [/^\/api\/v1\/executions\/claim$/, 'the next queued execution (as a worker would)'],
  [/^\/api\/v1\/executions\/cancel-all$/, 'cancellation of every run in progress'],
  [/^\/api\/v1\/executions\/run-all$/, 'a run of everything for an application'],
  [/^\/api\/v1\/executions\/{id}\/results$/, 'a result report for the selected execution'],
  [/^\/api\/v1\/executions\/{id}\/complete$/, 'completion of the selected execution'],
  [/^\/api\/v1\/executions\/{id}\/cancel$/, 'cancellation of the selected execution'],
  [/^\/api\/v1\/executions\/{id}\/status$/, 'the status of the selected execution'],
  [/^\/api\/v1\/executions\/{id}\/evidence$/, 'the evidence of the selected execution'],
  [/^\/api\/v1\/executions\/{id}\/remarks$/, 'a remark on the selected execution'],
  [/^\/api\/v1\/executions\/{id}$/, 'the selected execution'],
  [/^\/api\/v1\/executions$/, 'executions (queued runs)'],
  [/^\/api\/v1\/runs\/{id}\/evidence$/, 'the evidence manifest of the selected run'],
  [/^\/api\/v1\/execution-results\/{id}\/evidence$/, 'the evidence of the selected result'],
  [/^\/api\/v1\/evidence\/upload$/, 'an evidence upload'],
  [/^\/api\/v1\/evidence\/file$/, 'a stored evidence file'],
  [/^\/api\/v1\/evidence\/prune$/, 'evidence pruning'],
  [/^\/api\/v1\/workers\/register$/, 'worker registration'],
  [/^\/api\/v1\/workers\/heartbeat$/, 'a worker heartbeat'],
  [/^\/api\/v1\/workers$/, 'the registered workers'],
  [/^\/api\/v1\/schedules\/{id}\/run$/, 'an immediate run of the selected schedule'],
  [/^\/api\/v1\/schedules\/trigger$/, 'an event trigger for schedules'],
  [/^\/api\/v1\/build-results$/, 'build results posted by CI'],
  [/^\/api\/v1\/ui\/summary$/, 'the console summary (cases, suites, environments)'],
  [/^\/api\/v1\/ui\/live$/, 'the live run board'],
  [/^\/api\/v1\/ui\/runs$/, 'the run history'],
  [/^\/api\/v1\/ui\/executions\/{id}$/, 'the run screen data of the selected execution'],
  [/^\/api\/v1\/ui\/history$/, 'the pass/fail history of a set of cases'],
  [/^\/api\/v1\/ui\/build-history$/, 'the build history'],
  [/^\/api\/v1\/dashboard$/, 'the dashboard figures'],
  [/^\/api\/v1\/release-readiness$/, 'the release readiness verdict'],
  [/^\/api\/v1\/test-status$/, 'the combined test status'],
  [/^\/api\/v1\/agents\/context$/, 'the context an agent is given'],
  [/^\/api\/v1\/ai-proposals\/{id}\/review$/, 'a review decision on the selected AI proposal'],
  [/^\/api\/v1\/ai-proposals$/, 'AI test proposals'],
  [/^\/api\/v1\/insights$/, 'quality insights'],
  [/^\/api\/v1\/reports\/preview$/, 'a report preview'],
  [/^\/api\/v1\/deployments$/, 'deployments'],
  [/^\/api\/v1\/sit-catalog$/, 'the SIT catalogue'],
  [/^\/api\/v1\/sit-runs$/, 'SIT runs'],
  [/^\/api\/v1\/ops\/.*$/, 'an operations action'],
  [/^\/sit\/health$/, 'the health of the embedded SIT console'],
];

const SELECTOR_GLOSSARY: Array<[RegExp, string]> = [
  [/^#screen-action$/, 'the main action button'],
  [/^#screen-status$/, 'the outcome line under the form'],
  [/^#screen-title$|^h1$/, 'the page heading'],
  [/^#gate #login$|^#login$/, 'the Sign in button'],
  [/^#gate #username$|^#username$|name=username/, 'the username field'],
  [/^#gate #password$|^#password$|name=password/, 'the password field'],
  [/^#gate$/, 'the sign-in gate'],
  [/^#viewTitle$/, 'the page title'],
  [/^#globalSearch$/, 'the search box'],
  [/^#appSelect option\[value=/, 'the application selector entry'],
  [/^#appSelect/, 'the application selector'],
  [/^#envSelect/, 'the environment selector'],
  [/^#sideNav \.nav-item\[data-view=/, 'the side-menu entry'],
  [/^#sideNav|\.opsc-navitem|\.nav-item/, 'the side menu'],
  [/^#content tbody tr \.case-name$/, 'a test case name in the table'],
  [/^#content tbody tr$/, 'a row of the table'],
  [/^#content dl\.kv$/, 'the details list'],
  [/^#content \.kpi$/, 'a summary figure'],
  [/^#content \.tab-btn\.active$/, 'the active tab'],
  [/^#content \.card\.empty$/, 'the "nothing here" card'],
  [/^#content \.card$/, 'a card'],
  [/^#content table$/, 'the table'],
  [/^\.stile\[data-tile=/, 'the status tile'],
  [/^\.hp \.card-head$|^\.hp$/, 'the history panel'],
  [/^\.brand-title$/, 'the product name in the corner'],
  [/^#workerPill$/, 'the workers indicator'],
  [/^#livePill$/, 'the live-update indicator'],
  [/^#healthPill\.ok$/, 'the engine health indicator (green)'],
  [/^#healthPill$/, 'the engine health indicator'],
  [/^#retentionDays$/, 'the retention days field'],
  [/^#menuToggle$/, 'the menu button'],
  [/^#sidebar\.open$/, 'the opened side menu'],
  [/^\.opsc-hero-title, \.opsc-pagehead-title$/, 'the page title'],
  [/^body$/, 'the page'],
];

/** HTTP status → what it means to a reader. */
export function plainStatus(code: number | string): string {
  const n = Number(code);
  const map: Record<number, string> = {
    200: 'answers OK (200)',
    201: 'confirms it was created (201)',
    202: 'accepts it for processing (202)',
    204: 'answers with nothing to show (204)',
    301: 'redirects (301)',
    302: 'redirects (302)',
    304: 'answers "not modified" (304)',
    400: 'rejects the request as invalid (400)',
    401: 'refuses — sign-in required (401)',
    403: 'refuses — not allowed (403)',
    404: 'reports there is nothing there (404)',
    405: 'reports the action is not allowed there (405)',
    409: 'reports a conflict with the current state (409)',
    410: 'reports it is gone (410)',
    412: 'refuses — the precondition failed (412)',
    413: 'rejects the request as too large (413)',
    415: 'rejects the content type (415)',
    422: 'rejects the content as unprocessable (422)',
    428: 'refuses — a precondition header is required (428)',
    429: 'asks the caller to slow down (429)',
    500: 'fails with an internal error (500)',
    501: 'reports it is not implemented (501)',
    502: 'reports a bad gateway (502)',
    503: 'reports it is unavailable (503)',
    504: 'times out upstream (504)',
  };
  if (map[n]) return map[n];
  if (n >= 200 && n < 300) return `answers successfully (${n})`;
  if (n >= 300 && n < 400) return `redirects (${n})`;
  if (n >= 400 && n < 500) return `rejects the request (${n})`;
  if (n >= 500) return `fails on the server side (${n})`;
  return `answers with status ${code}`;
}

/* ------------------------------------------------------------------------ */
/* Text helpers                                                              */
/* ------------------------------------------------------------------------ */

const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const endDot = (s: string) => (/[.!?]$/.test(s.trim()) ? s.trim() : s.trim() + '.');

/** Replaces {{var}} placeholders inside free text with words. */
export function plainText(s: string | undefined | null): string {
  if (!s) return '';
  return String(s)
    .replace(/\{\{\s*(api|web|testhub|dbviewer|engine)\s*\}\}\s*base URL/gi, (_m, v) => `${SURFACE_SHORT[v.toLowerCase()]} address`)
    .replace(/\{\{\s*(api|web|testhub|dbviewer|engine)\s*\}\}/gi, (_m, v) => SURFACE_SHORT[v.toLowerCase()] || v)
    .replace(/\{\{\s*username\s*\}\}/g, 'the demo operator username')
    .replace(/\{\{\s*password\s*\}\}/g, 'the demo password')
    .replace(/\{\{\s*tenant\s*\}\}/g, 'the demo tenant')
    .replace(/\{\{\s*(ts|rand)\s*\}\}/g, 'a unique run stamp')
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_m, v) => `the ${v.replace(/_/g, ' ')} captured earlier`);
}

/** A {{var}} value inside request data, in words. */
function plainValue(v: unknown): string {
  if (v === null) return 'empty';
  if (typeof v === 'string') {
    const m = v.match(/^\{\{\s*([\w.-]+)\s*\}\}$/);
    if (m) {
      const name = m[1]!;
      if (name === 'username') return 'the demo operator username';
      if (name === 'password') return 'the demo password';
      if (name === 'tenant') return 'the demo tenant';
      if (name === 'token' || name === 'adminToken') return 'the sign-in token';
      if (name === 'ts' || name === 'rand') return 'a unique run stamp';
      return `the ${name.replace(/_/g, ' ')} captured earlier`;
    }
    const t = v.replace(/\{\{\s*(ts|rand)\s*\}\}/g, '<stamp>');
    return t.length > 70 ? `"${t.slice(0, 67)}…"` : `"${t}"`;
  }
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.length ? `a list of ${v.length}` : 'an empty list';
  if (typeof v === 'object') {
    const keys = Object.keys(v as object);
    return keys.length ? `{${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ', …' : ''}}` : 'an empty object';
  }
  return String(v);
}

/** Request body → "field = value, field = value" in words (capped). */
function plainBody(body: unknown): string {
  if (body === undefined) return '';
  if (body === null || typeof body !== 'object') return plainValue(body);
  if (Array.isArray(body)) return body.length ? `a list of ${body.length} entries` : 'an empty list';
  const entries = Object.entries(body as Record<string, unknown>);
  if (!entries.length) return 'an empty request (no fields)';
  const parts = entries.slice(0, 6).map(([k, v]) => `${k.replace(/_/g, ' ')} = ${plainValue(v)}`);
  if (entries.length > 6) parts.push(`and ${entries.length - 6} more field(s)`);
  return parts.join(', ');
}

/** "GET {{api}}/api/v1/x?y" → { surface, path }. */
function splitUrl(raw: string): { surface: string | null; path: string; page: string | null } {
  const m = String(raw || '').match(/^\{\{\s*(api|web|testhub|dbviewer|engine)\s*\}\}(.*)$/i);
  let surface: string | null = null;
  let rest = String(raw || '');
  if (m) { surface = m[1]!.toLowerCase(); rest = m[2]!; }
  else {
    const abs = rest.match(/^https?:\/\/[^/]+(.*)$/);
    if (abs) rest = abs[1]!;
  }
  const path = rest.replace(/[?#].*$/, '') || '/';
  const page = /\.html$/.test(path) || path === '/' || path.endsWith('/') ? path.replace(/^\//, '') : null;
  return { surface, path, page };
}

function normalizePath(path: string): string {
  return path
    .replace(/\{\{[^}]+\}\}/g, '{id}')
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/gi, '/{id}')
    .replace(/\/(?:TE|SB|TC|SIT)-[A-Z0-9-]+(?=\/|$)/g, '/{id}')
    .replace(/\/\d+(?=\/|$)/g, '/{id}');
}

function humanSegments(path: string): string {
  const segs = path.replace(/^\/api\/v\d+\//, '/').split('/').filter(Boolean);
  if (!segs.length) return 'its home page';
  const words = (s: string) => s.replace(/[-_]+/g, ' ');
  const last = segs[segs.length - 1]!;
  if (last === '{id}') {
    const parent = segs[segs.length - 2] || 'item';
    return `the selected ${words(parent).replace(/s$/, '')}`;
  }
  const idAt = segs.indexOf('{id}');
  if (idAt > 0) return `the ${words(last)} of the selected ${words(segs[idAt - 1]!).replace(/s$/, '')}`;
  return `the ${words(segs.join(' '))}`;
}

/** Route → what is asked for ("the list of delivery channels"). */
export function describePath(path: string): string {
  const norm = normalizePath(path);
  for (const [re, phrase] of PATH_GLOSSARY) if (re.test(norm)) return phrase;
  return humanSegments(norm);
}

/** A templated URL → "the API's health check" / "the sign-in page of the web console". */
export function describeTarget(raw: string): string {
  const { surface, path, page } = splitUrl(raw);
  const who = surface ? SURFACE_SHORT[surface]! : 'the target';
  if (page !== null) return `${describePage(page, surface)}${surface === 'web' || !surface ? '' : ` of ${who}`}`;
  const what = describePath(path).replace(/^its /, '');
  return `${who}'s ${what.replace(/^the /, '')}`;
}

/** Page file → screen name ("the Test cases screen"). */
export function describePage(page: string, surface: string | null): string {
  const file = page.replace(/^\//, '');
  const known = PAGE_TITLES[file];
  if (known) return `the ${known}`;
  const base = file.replace(/\.html$/, '').replace(/[-_]+/g, ' ');
  return `the ${cap(base)} screen${surface && surface !== 'web' ? ` of ${SURFACE_SHORT[surface]}` : ''}`;
}

export function describeSelector(sel: string | undefined): string {
  if (!sel) return 'the page';
  for (const [re, phrase] of SELECTOR_GLOSSARY) if (re.test(sel)) return `${phrase} (${sel})`;
  const named = sel.match(/\[name=['"]?([\w-]+)['"]?\]/);
  if (named) return `the ${named[1]!.replace(/[-_]+/g, ' ')} field`;
  const id = sel.match(/^#([\w-]+)$/);
  if (id) return `the "${id[1]!.replace(/^f-/, '').replace(/[-_]+/g, ' ')}" element (${sel})`;
  return `the element "${sel}"`;
}

/** Looks for the step wording a case author already wrote. */
function authored(step: Step): Partial<HumanStep> {
  const out: Partial<HumanStep> = {};
  if (typeof step.text === 'string' && step.text.trim()) out.text = step.text.trim();
  if (typeof step.expected === 'string' && step.expected.trim() && step.action === 'request') out.expected = step.expected.trim();
  if (typeof step.expected_text === 'string' && step.expected_text.trim()) out.expected = step.expected_text.trim();
  if (typeof step.testData === 'string' && step.testData.trim()) out.testData = step.testData.trim();
  if (Array.isArray(step.attachments)) out.attachments = step.attachments;
  return out;
}

/* ------------------------------------------------------------------------ */
/* Step narration                                                            */
/* ------------------------------------------------------------------------ */

function jsonCheck(e: Step): string {
  const field = `"${String(e.path).replace(/^data\./, '')}"`;
  if (e.equals !== undefined) return `${field} is ${plainValue(e.equals)}`;
  if (e.contains !== undefined) return `${field} mentions ${plainValue(e.contains)}`;
  if (e.matches !== undefined) return `${field} has the expected format`;
  if (e.min_length !== undefined && e.max_length !== undefined) return `${field} has between ${e.min_length} and ${e.max_length} entries`;
  if (e.min_length !== undefined) return e.min_length === 1 ? `${field} is not empty` : `${field} has at least ${e.min_length} entries`;
  if (e.max_length !== undefined) return `${field} has at most ${e.max_length} entries`;
  if (e.min !== undefined && e.max !== undefined) return `${field} is between ${e.min} and ${e.max}`;
  if (e.min !== undefined) return `${field} is at least ${e.min}`;
  if (e.max !== undefined) return `${field} is at most ${e.max}`;
  if (e.exists === false) return `${field} is absent`;
  return `${field} is present`;
}

function headerCheck(h: Step): string {
  const name = `the "${h.name}" header`;
  if (h.exists === false) return `${name} is not sent`;
  if (h.contains) return `${name} mentions "${h.contains}"`;
  if (h.not_contains) return `${name} does not mention "${h.not_contains}"`;
  return `${name} is present`;
}

function requestExpected(step: Step): string {
  const parts: string[] = [];
  const st = step.expected_status;
  if (Array.isArray(st)) parts.push(`it ${st.length === 1 ? plainStatus(st[0]) : 'answers with one of: ' + st.map((c: number) => plainStatus(c)).join(' / ')}`);
  else if (st !== undefined) parts.push(`it ${plainStatus(st)}`);
  const checks: string[] = [];
  for (const e of step.expect_json || []) checks.push(jsonCheck(e));
  if (step.expected_body_contains) checks.push(`the reply contains "${String(step.expected_body_contains).slice(0, 80)}"`);
  if (step.expected_body_not_contains) checks.push(`the reply does not contain "${String(step.expected_body_not_contains).slice(0, 80)}"`);
  for (const h of step.expect_headers || []) checks.push(headerCheck(h));
  if (checks.length) parts.push((parts.length ? 'and ' : 'The reply shows: ') + checks.join('; '));
  if (!parts.length) parts.push('it answers without error');
  return cap(endDot(parts.join(' ')));
}

function requestText(step: Step): string {
  const method = String(step.method || 'GET').toUpperCase();
  const { surface, path, page } = splitUrl(step.url || step.path || '');
  const who = surface ? SURFACES[surface]! : 'the target';
  const whoShort = surface ? SURFACE_SHORT[surface]! : 'the target';
  const desc = typeof step.description === 'string' ? step.description.trim() : '';
  const descIsRoute = !desc || /^\/|^(GET|POST|PUT|PATCH|DELETE)\b|^\{\{|^[a-z-]+$/.test(desc) && desc.length < 12;
  const route = `${method} ${path}`;

  // Sign-in has its own wording wherever it appears.
  if (/\/session\/login$/.test(path) && method === 'POST') {
    const body = step.body || {};
    const who2 = typeof body.username === 'string' && !/\{\{/.test(body.username) ? `as "${body.username}"` : 'as the demo operator';
    const bad = step.expected_status !== undefined && Number(Array.isArray(step.expected_status) ? step.expected_status[0] : step.expected_status) >= 400;
    return bad ? `Try to sign in to ${whoShort} with ${desc && !descIsRoute ? desc : 'invalid details'} (${route})` : `Sign in to ${whoShort} ${who2} (${route})`;
  }

  let what: string;
  if (page !== null) what = describePage(page, surface);
  else what = describePath(path);

  let verb: string;
  if (method === 'GET' || method === 'HEAD') verb = page !== null ? `Open ${what}` : `Ask ${who} for ${what}`;
  else if (method === 'DELETE') verb = `Delete ${what.replace(/^(the |a |an )/, 'the ')} on ${whoShort}`;
  else if (method === 'PUT' || method === 'PATCH') verb = `Update ${what} on ${whoShort}`;
  else if (method === 'OPTIONS' || method === 'TRACE') verb = `Send a ${method} request for ${what} to ${whoShort}`;
  else verb = step.body !== undefined || step.body_raw !== undefined ? `Submit ${what} to ${whoShort}` : `Request ${what} from ${whoShort}`;

  const extra = desc && !descIsRoute && !/^(load screen|load current|load host screen)/i.test(desc) ? ` — ${desc}` : '';
  let text = `${verb}${extra} (${route})`;
  if (step.poll) text = `Keep asking until the expected answer appears, for up to ${Math.round((step.poll.timeout_ms ?? 8000) / 1000)} s: ${text[0]!.toLowerCase()}${text.slice(1)}`;
  if (step.precondition) text = `Check the target is ready for this test — ${text[0]!.toLowerCase()}${text.slice(1)}. If not, the test is skipped rather than failed`;
  else if (step.allow_failure) text = `${text}; this step may fail without failing the test`;
  return text;
}

function requestTestData(step: Step): string | undefined {
  const parts: string[] = [];
  if (step.body_raw !== undefined) parts.push(`A deliberately malformed body: ${JSON.stringify(String(step.body_raw)).slice(0, 90)}`);
  else if (step.body !== undefined) parts.push(cap(plainBody(step.body)));
  const headers = step.headers || {};
  for (const [k, v] of Object.entries(headers)) {
    const key = k.toLowerCase();
    if (key === 'authorization') parts.push(/\{\{\s*adminToken\s*\}\}/.test(String(v)) ? 'Signed in as the tenant administrator' : /\{\{/.test(String(v)) ? 'Signed in (token from the sign-in step)' : `Authorization header: ${plainValue(v)}`);
    else if (key === 'content-type') parts.push(`Content type ${v}`);
    else parts.push(`Header ${k}: ${plainValue(v)}`);
  }
  const q = String(step.url || '').match(/\?(.*)$/);
  if (q && q[1]) parts.push(`Query: ${q[1].slice(0, 100).replace(/\{\{\s*(ts|rand)\s*\}\}/g, '<stamp>')}`);
  return parts.length ? parts.join('. ') : undefined;
}

function uiStep(step: Step): HumanStep {
  const a = String(step.action || '');
  const sel = describeSelector(step.selector);
  const val = step.value !== undefined ? String(step.value) : '';
  const exp = step.expected !== undefined ? String(step.expected) : '';
  const t = step.timeout_ms ? ` (within ${Math.round(step.timeout_ms / 1000)} s)` : '';
  switch (a) {
    case 'navigate': {
      const { surface, path, page } = splitUrl(val);
      const what = page !== null ? describePage(page, surface) : describePath(path);
      return { text: `Open ${what} in the browser (${plainText(val)})`, expected: 'The page loads.' };
    }
    case 'click': return { text: `Click ${sel}`, expected: 'The click is accepted and the page reacts.' };
    case 'click_text': return { text: `Click the item labelled "${val}"`, expected: 'The click is accepted and the page reacts.' };
    case 'type': {
      const secret = /password/i.test(String(step.selector || '')) || /\{\{\s*password\s*\}\}/.test(val);
      return { text: `Type into ${sel}`, expected: 'The value is accepted by the field.', testData: secret ? 'The demo password' : plainText(val) };
    }
    case 'select': return { text: `Choose "${val}" in ${sel}`, expected: 'The option is selected.' };
    case 'wait_for': return { text: `Wait until ${sel} appears${t}`, expected: 'It appears in time.' };
    case 'wait_for_hidden': return { text: `Wait until ${sel} disappears${t}`, expected: 'It disappears in time.' };
    case 'assert_text': return { text: `Check the page shows the text "${exp}"`, expected: `The text "${exp}" is visible on the page.` };
    case 'assert_selector_text': return { text: `Check ${sel} reads "${exp}"`, expected: `It shows "${exp}".` };
    case 'assert_selector_count_min': return { text: `Count ${sel}`, expected: `There ${Number(exp) === 1 ? 'is at least 1' : `are at least ${exp}`}.` };
    case 'assert_title': return { text: 'Check the browser tab title', expected: `The tab title is "${exp}".` };
    case 'assert_no_horizontal_overflow': return { text: 'Check the page fits the screen width', expected: 'Nothing sticks out sideways; no horizontal scrolling is needed.' };
    case 'wait': return { text: `Wait ${step.timeout_ms ? Math.round(step.timeout_ms / 1000) + ' s' : 'a moment'}`, expected: 'The page is given time to settle.' };
    case 'screenshot': return { text: 'Take a screenshot of the page', expected: 'A screenshot is stored as evidence.' };
    case 'sandbench_upload': return { text: `Upload the file "${val}" through the import screen${step.markdown_file ? ` together with its companion document "${step.markdown_file}"` : ''}`, expected: 'The upload is accepted and the file appears in the list of uploads.', testData: `File ${val}${step.markdown_file ? ` + ${step.markdown_file}` : ''}` };
    default: return { text: `${cap(a.replace(/_/g, ' '))}${step.selector ? ` on ${sel}` : ''}${val ? ` with "${val}"` : ''}`, expected: exp ? `Expected: ${exp}.` : 'The step completes without error.' };
  }
}

/** Plain-language view of one executable step (the authored wording wins). */
export function narrateStep(raw: unknown, index = 0): HumanStep {
  const step = (raw && typeof raw === 'object' ? raw : {}) as Step;
  const own = authored(step);
  let derived: HumanStep;
  if (String(step.action || 'request') === 'request' && (step.url || step.path || step.method)) {
    derived = { text: requestText(step), expected: requestExpected(step), testData: requestTestData(step) };
  } else if (step.action === 'performance') {
    derived = { text: String(step.text || 'Measure response times'), expected: String(step.expected || 'Within the SLA.'), testData: step.testData };
  } else {
    derived = uiStep(step);
  }
  const text = own.text || derived.text;
  const expected = own.expected || derived.expected;
  const testData = own.testData || derived.testData;
  const out: HumanStep = { text: endDot(cap(text)).replace(/\.\.$/, '.'), expected: endDot(cap(expected)) };
  if (testData) out.testData = testData;
  if (own.attachments) out.attachments = own.attachments;
  void index;
  return out;
}

/** The human step for a performance case, built from its runner options. */
export function performanceStep(rules: Record<string, any>): HumanStep {
  const { surface, path } = splitUrl(String(rules.url || rules.path || '/'));
  const who = surface ? SURFACES[surface]! : 'the target';
  const what = describePath(path);
  const conc = Number(rules.concurrency) || 5;
  const sla = rules.sla || {};
  const text = Number(rules.duration_seconds) > 0
    ? `Keep sending requests for ${what} to ${who} for ${Math.round(Number(rules.duration_seconds) / 60) || 1} minute(s), ${conc} at a time, and record every response time`
    : `Send ${Number(rules.requests) || 20} requests for ${what} to ${who}, ${conc} at a time, and record every response time`;
  const checks: string[] = [];
  if (sla.p95_ms !== undefined) checks.push(`95 out of 100 answers arrive within ${Number(sla.p95_ms) >= 1000 ? (Number(sla.p95_ms) / 1000) + ' s' : sla.p95_ms + ' ms'}`);
  if (sla.error_rate_pct !== undefined) checks.push(sla.error_rate_pct === 0 ? 'no request fails' : `no more than ${sla.error_rate_pct}% of requests fail`);
  if (sla.min_rps !== undefined) checks.push(`at least ${sla.min_rps} requests per second are served`);
  return {
    text: text + ` (${String(rules.method || 'GET').toUpperCase()} ${path})`,
    expected: checks.length ? cap(checks.join(', and ')) + '.' : 'The target stays healthy throughout.',
    testData: 'No input data; repeated identical requests.',
  };
}

/* ------------------------------------------------------------------------ */
/* Case-level fields                                                         */
/* ------------------------------------------------------------------------ */

export interface AppContext {
  /** Application key ('sand-bench' | 'gavriq-test-engine'). */
  appKey: string;
  /** Environment the case is written for (used when the case names none). */
  defaultEnvironment: string;
  /** Environment for cases that need prepared fixtures (sandbox/isolated engine cases). */
  fixtureEnvironment?: string;
  /** Display name of the team that raises issues on this application. */
  team: string;
}

function surfacesTouched(c: CaseDef): Set<string> {
  const out = new Set<string>();
  const scan = (v: unknown) => {
    if (typeof v === 'string') for (const m of v.matchAll(/\{\{\s*(api|web|testhub|dbviewer|engine)\s*\}\}/gi)) out.add(m[1]!.toLowerCase());
    else if (Array.isArray(v)) v.forEach(scan);
    else if (v && typeof v === 'object') Object.values(v as object).forEach(scan);
  };
  scan(c.steps);
  scan(c.validationRules);
  return out;
}

function touchesConsole(c: CaseDef): boolean {
  const scan = (v: unknown): boolean => typeof v === 'string' ? /\.html|\/catalog\/|\/sit\/|\/api\/v1\/ui\//.test(v) : Array.isArray(v) ? v.some(scan) : v && typeof v === 'object' ? Object.values(v as object).some(scan) : false;
  return c.method === 'playwright' || c.method === 'selenium' || scan(c.steps) || scan(c.validationRules);
}

/** The part of the application a case exercises. */
export function deriveComponent(c: CaseDef, suite: SuiteDef | undefined, ctx: AppContext): string {
  if (c.component) return c.component;
  const uc = c.description.match(/\bUC-[\w]+ \(([^))]+)\)/);
  if (uc) return uc[1]!;
  const s = surfacesTouched(c);
  if (ctx.appKey === 'gavriq-test-engine') {
    if (c.suiteKey === 'te-smoke') return 'Control plane';
    return touchesConsole(c) ? 'Console' : 'Control-plane API';
  }
  if (c.suiteKey === 'sb-identity') return 'Login & identity';
  if (s.has('dbviewer')) return 'Database viewer';
  if (s.has('testhub')) return 'Test hub & channels';
  if (c.method === 'playwright' || c.method === 'selenium') return 'Web console';
  if (s.has('web') && !s.has('api')) return 'Web console';
  if (s.has('api')) return 'API';
  return suite ? suite.name : 'Application';
}

function bucketSeconds(sec: number): EstimatedDuration {
  if (sec < 60) return 'Under 1m';
  if (sec <= 300) return '1-5m';
  if (sec <= 900) return '5-15m';
  if (sec <= 3600) return '15-60m';
  return '60m+';
}

/** How long one run of the case usually takes. */
export function deriveDuration(c: CaseDef): EstimatedDuration {
  if (c.estimatedDuration && ESTIMATED_DURATIONS.includes(c.estimatedDuration)) return c.estimatedDuration;
  const rules = (c.validationRules || {}) as Record<string, any>;
  if (c.method === 'performance') {
    if (Number(rules.duration_seconds) > 0) return bucketSeconds(Number(rules.duration_seconds) + 10);
    const reqs = Number(rules.requests) || 20;
    return reqs > 300 ? '1-5m' : 'Under 1m';
  }
  const steps = (c.steps || []) as Step[];
  const polls = steps.reduce((n, s) => n + (s.poll ? Number(s.poll.timeout_ms ?? 8000) / 1000 : 0), 0);
  const waits = steps.reduce((n, s) => n + (s.action === 'wait' && s.timeout_ms ? s.timeout_ms / 1000 : 0), 0);
  const base = c.method === 'http' ? steps.length * 1.5 : 10 + steps.length * 2;
  return bucketSeconds(Math.min(base + polls + waits, c.timeoutSeconds || 60));
}

function triageDefaults(c: CaseDef, ctx: AppContext) {
  const tags = c.tags.map((t) => t.toLowerCase());
  const known = tags.includes('known-defect');
  const notes = {
    flakinessNotes: c.flakinessNotes,
    knownWorkarounds: c.knownWorkarounds,
    commonFailureCauses: c.commonFailureCauses,
  };
  const method = c.method;
  const isPerf = method === 'performance';
  const isBrowser = method === 'playwright' || method === 'selenium';
  const authRequired = tags.includes('auth-required') || JSON.stringify(c.steps || []).includes('/session/login');
  const hasPrecondition = ((c.steps || []) as Step[]).some((s) => s.precondition);

  if (!notes.flakinessNotes) {
    notes.flakinessNotes = isPerf
      ? 'Timing-sensitive: the response-time limit can be missed on a busy host (other runs or image builds in progress) with no change in the application.'
      : isBrowser
        ? 'Browser timing: a slow page load on a loaded host can exceed a step wait.'
        : 'None known — a deterministic request-and-check.';
  }
  if (!notes.knownWorkarounds) {
    notes.knownWorkarounds = isPerf
      ? 'Re-run when the host is quiet and compare with the previous run before calling it a regression.'
      : isBrowser
        ? 'Re-run once; if it fails again, compare the selector with the deployed console (the UI changes often).'
        : hasPrecondition
          ? 'A skipped result means the target was not prepared (fixtures missing or a worker draining the queue) — seed the fixtures or use the staging engine.'
          : 'Re-run after confirming the target is up and reachable from the worker.';
  }
  if (!notes.commonFailureCauses) {
    const causes: string[] = [];
    if (known) causes.push(`Known defect (tagged known-defect): stays red until the ${ctx.team} fixes it`);
    if (isPerf) causes.push('Host CPU/RAM pressure', 'target restarted mid-run', 'SLA tighter than the environment can meet');
    else if (isBrowser) causes.push('worker image without the browser engine', 'UI selector or copy changed', 'sign-in gate shown unexpectedly');
    else causes.push('target not deployed or unreachable from the worker', 'response contract changed in a new build');
    if (authRequired) causes.push('demo identity disabled or its password rotated (reported as authentication_problem)');
    if (hasPrecondition) causes.push('fixtures not seeded on the target (reported as skipped)');
    notes.commonFailureCauses = cap(causes.join('; ')) + '.';
  }
  return {
    ...notes,
    triageStatus: known ? 'Investigating' : 'None',
    assignee: known ? ctx.team : null,
  };
}

/** Attachments: links to the documents that explain the case. */
export function deriveAttachments(c: CaseDef): Attachment[] {
  const out: Attachment[] = [...(c.attachments || [])];
  const uc = c.key.match(/^SB-UC-([\w]+)-/);
  if (uc && !out.some((a) => a.url.includes(`UC-${uc[1]}.md`))) out.push({ name: `Use case UC-${uc[1]}`, url: `docs/use-cases/UC-${uc[1]}.md` });
  if (!out.some((a) => a.url.includes('TEST-CASE-CATALOG'))) out.push({ name: 'Catalog documentation', url: 'docs/TEST-CASE-CATALOG.md' });
  return out;
}

export interface ScreenFields {
  objective: string;
  owner: string;
  component: string;
  environment: string;
  estimated_duration: EstimatedDuration;
  visibility: 'Public' | 'Team' | 'Private';
  automation_link: string;
  test_data: string;
  attachments: Attachment[];
  dependency_ids: string[];
  flakiness_notes: string;
  known_workarounds: string;
  common_failure_causes: string;
  triage_status: string;
  assignee: string | null;
  /** Executable steps with the person-facing fields merged in. */
  steps: Array<Step & HumanStep>;
}

/** Every Test cases screen field for a catalog case, authored values first. */
export function screenFields(c: CaseDef, suite: SuiteDef | undefined, ctx: AppContext): ScreenFields {
  const steps: Array<Step & HumanStep> = ((c.steps || []) as Step[]).map((s, i) => ({ ...s, ...narrateStep(s, i) }));
  if (!steps.length && c.method === 'performance') steps.push({ action: 'performance', ...performanceStep((c.validationRules || {}) as Record<string, any>) });
  const triage = triageDefaults(c, ctx);
  const hasPrecondition = ((c.steps || []) as Step[]).some((s) => s.precondition);
  return {
    objective: c.objective,
    owner: c.owner || (suite?.category === 'qc' ? 'Quality control team' : 'Quality assurance team'),
    component: deriveComponent(c, suite, ctx),
    environment: c.environment || (hasPrecondition && ctx.fixtureEnvironment ? ctx.fixtureEnvironment : ctx.defaultEnvironment),
    estimated_duration: deriveDuration(c),
    visibility: c.visibility || 'Team',
    automation_link: c.automationLink || `apps/api/src/catalog/${c.sourceFile || 'sandbench-cases.ts'}#${c.key} (${c.method} runner)`,
    test_data: c.testData || plainText(c.dataProfile.data),
    attachments: deriveAttachments(c),
    dependency_ids: c.dependencyIds || [],
    flakiness_notes: triage.flakinessNotes!,
    known_workarounds: triage.knownWorkarounds!,
    common_failure_causes: triage.commonFailureCauses!,
    triage_status: triage.triageStatus,
    assignee: triage.assignee,
    steps,
  };
}

/* ------------------------------------------------------------------------ */
/* Plain-language lint (used by tests/plain-language-catalog.test.ts)       */
/* ------------------------------------------------------------------------ */

/** Phrases that mark text as written for a machine, not a person. */
export const JARGON: Array<[RegExp, string]> = [
  [/\{\{/, 'a {{placeholder}}'],
  [/\b(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS|TRACE)\s+[\/{]/, 'an HTTP verb with a route'],
  [/\/api\/v\d/, 'an API route'],
  [/\bexpect_json\b|\bexpected_status\b|\bbody_raw\b|\bexpected_body_contains\b/, 'a runner field name'],
  [/\bjsonb\b/i, 'JSONB'],
  [/(?<![\d,.])\b[45]\d\d\b(?! (?:ms|s|rows|cases|messages|requests|bytes|entries|chars|characters|px|KB|MB))/, 'a bare status code'],
  [/[#.][a-z][\w-]*\[|^#[\w-]+$|\s#[\w-]+(?:\s|$)/, 'a CSS selector'],
  [/\bp95\b|\bp99\b/i, 'a latency percentile'],
  [/\b(?:uuid|regex|regexp)\b/i, 'a technical term'],
];

/** Returns the first jargon found in a plain-language field, or null. */
export function findJargon(text: string): string | null {
  for (const [re, label] of JARGON) if (re.test(text)) return label;
  return null;
}
