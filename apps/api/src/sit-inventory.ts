/**
 * Reading the application team's SIT suite (sit/cases/*.sit.ts) as an inventory:
 * which tests it has, what each is called, and how each is shown on the Test
 * cases screen. No database here — import-sit-catalog.ts writes the result.
 */
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export interface SitMeta { suite: string; type: string; method: string; tags: string[] }
export interface SitTest { file: string; fileKey: string; name: string | null; meta: SitMeta }

/** Files the repository already groups under a shared suite; every other file gets a suite of its own. */
const CATEGORY: Record<string, { suite: string; type: string; method: string }> = {
  '00-health': { suite: 'sit-health', type: 'smoke', method: 'http' },
  '10-mq-round-trip': { suite: 'sit-mq', type: 'integration', method: 'http' },
  '20-kafka-round-trip': { suite: 'sit-kafka', type: 'integration', method: 'http' },
  '30-api-round-trip': { suite: 'sit-api', type: 'api', method: 'http' },
  '40-worker-job': { suite: 'sit-worker', type: 'integration', method: 'http' },
  '50-dbviewer-cross-check': { suite: 'sit-db', type: 'database', method: 'http' },
  '51-use-case-api': { suite: 'sit-use-case-api', type: 'api', method: 'http' },
  '60-gui-smoke': { suite: 'sit-gui-smoke', type: 'ui', method: 'playwright' },
  '60-ui-eventing': { suite: 'sit-ui-eventing', type: 'ui', method: 'playwright' },
  '61-selenium-screens': { suite: 'sit-selenium-screens', type: 'ui', method: 'selenium' },
  '62-selenium-fields': { suite: 'sit-selenium-fields', type: 'ui', method: 'selenium' },
  '63-selenium-workflows': { suite: 'sit-selenium-workflows', type: 'ui', method: 'selenium' },
  '64-use-case-ui': { suite: 'sit-use-case-ui', type: 'ui', method: 'selenium' },
  '66-official-clicks': { suite: 'sit-official-clicks', type: 'ui', method: 'selenium' },
  '67-feature-access-ui': { suite: 'sit-feature-access', type: 'ui', method: 'selenium' },
  '68-console-chrome': { suite: 'sit-console-chrome', type: 'ui', method: 'selenium' },
  '70-e2e-ux': { suite: 'sit-e2e-ux', type: 'e2e', method: 'selenium' },
  '70-ui-pages': { suite: 'sit-ui-pages', type: 'ui', method: 'selenium' },
  '80-security-auth': { suite: 'sit-security', type: 'security', method: 'http' },
  '80-ui-workflows': { suite: 'sit-ui-workflows', type: 'ui', method: 'selenium' },
  '81-security-api': { suite: 'sit-security', type: 'security', method: 'http' },
  '82-security-headers': { suite: 'sit-security', type: 'security', method: 'http' },
  '83-security-vuln': { suite: 'sit-security', type: 'security', method: 'http' },
  '84-security-zap': { suite: 'sit-security', type: 'security', method: 'http' },
  '85-security-sast': { suite: 'sit-security', type: 'security', method: 'http' },
  '90-agents': { suite: 'sit-agents', type: 'integration', method: 'http' },
};

/** A file not listed above is classified by what its name says it is. First match wins. */
const BY_NAME: Array<{ match: RegExp; type: string; method: string; tags?: string[] }> = [
  { match: /^1\d{2}-business-use-case/, type: 'acceptance', method: 'selenium', tags: ['business-use-case'] },
  { match: /performance|soak|burst/, type: 'performance', method: 'http' },
  { match: /pentest|security/, type: 'security', method: 'http' },
  { match: /client-uat/, type: 'ui', method: 'playwright', tags: ['client-uat'] },
  { match: /selenium|screen|ui-|-ui|console|workflow|help-icon|menu/, type: 'ui', method: 'selenium' },
  { match: /e2e/, type: 'e2e', method: 'http' },
  { match: /.*/, type: 'integration', method: 'http' },
];

export function sitMetaFor(fileKey: string): SitMeta {
  const known = CATEGORY[fileKey];
  if (known) return { ...known, tags: [] };
  const by = BY_NAME.find((b) => b.match.test(fileKey))!;
  return { suite: `sit-${fileKey.toLowerCase()}`, type: by.type, method: by.method, tags: by.tags || [] };
}

/** Whether a file shares its suite with other files (the description says so). */
export const sharesSuite = (fileKey: string) => !!CATEGORY[fileKey];

/** "76-selenium-navigation-health" → "Navigation health": the part of the application, in words. */
export function sitComponentFor(fileKey: string): string {
  const words = fileKey.replace(/^\d+[a-z]?-/, '').replace(/^(selenium|pentest|business-use-case|client-uat)-/, '').replace(/-/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : 'Sand Bench';
}

/**
 * `node:test`'s `test` is sometimes imported under another name, and some files
 * then declare their own local `test(...)` wrapper on purpose so a catalogue can
 * find their cases — a local declaration wins over the import alias.
 */
function testIdentifier(source: string): string {
  if (/^\s*(function\s+test\s*\(|(?:const|let)\s+test\s*=)/m.test(source)) return 'test';
  const imported = /import\s*\{([^}]*)\}\s*from\s*["']node:test["']/.exec(source);
  const alias = imported && /\btest\s+as\s+([A-Za-z_][A-Za-z0-9_]*)/.exec(imported[1]!);
  return alias ? alias[1]! : 'test';
}

/** Names of the tests a file declares with a literal name (template placeholders kept as written). */
export function extractTestNames(source: string): string[] {
  const id = testIdentifier(source);
  const names: string[] = [];
  const re = new RegExp(`^\\s*${id}\\(\\s*(\`([^\`]*)\`|"((?:[^"\\\\]|\\\\.)*)"|'((?:[^'\\\\]|\\\\.)*)')`, 'gm');
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const raw = m[2] ?? m[3] ?? m[4] ?? '';
    names.push(m[2] !== undefined ? raw : raw.replace(/\\(["'\\])/g, '$1'));
  }
  return [...new Set(names.filter(Boolean))];
}

/**
 * Two files generate one test per documented use case with a computed name; the
 * suite's own helper lists those names without running anything.
 */
async function generatedNames(sourceDir: string): Promise<Map<string, string[]>> {
  const byFile = new Map<string, string[]>();
  const helper = path.join(sourceDir, 'sit/lib/use-cases.mjs');
  if (!existsSync(helper)) return byFile;
  try {
    const mod = await import(pathToFileURL(helper).href);
    if (typeof mod.regressionCases !== 'function') return byFile;
    for (const rc of mod.regressionCases() as Array<{ file: string; name: string }>) {
      const file = String(rc.file).replace(/^sit\/cases\//, '');
      byFile.set(file, [...(byFile.get(file) || []), rc.name]);
    }
  } catch (err) {
    console.warn(`[sit-inventory] could not list the generated use-case tests: ${(err as Error).message}`);
  }
  return byFile;
}

/** Every test of the suite under `<sourceDir>/sit/cases`; a file with no listable test is one whole-file entry. */
export async function listSitTests(sourceDir: string): Promise<{ files: string[]; tests: SitTest[] }> {
  const casesDir = path.join(sourceDir, 'sit/cases');
  if (!existsSync(casesDir)) throw new Error(`sit/cases not found at ${casesDir}`);
  const generated = await generatedNames(sourceDir);
  const files = readdirSync(casesDir).filter((f) => f.endsWith('.sit.ts')).sort();
  const tests: SitTest[] = [];
  for (const file of files) {
    const fileKey = file.replace(/\.sit\.ts$/, '');
    const meta = sitMetaFor(fileKey);
    const names = generated.get(file) || extractTestNames(readFileSync(path.join(casesDir, file), 'utf8'));
    if (!names.length) tests.push({ file, fileKey, name: null, meta });
    for (const name of [...new Set(names)]) tests.push({ file, fileKey, name, meta });
  }
  return { files, tests };
}

const slug = (text: string) => text.toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '');

/** The key the application side's registration would give this test, so both sides name it alike. */
export function sitKeyFor(fileKey: string, name: string | null): string {
  if (!name) return `SIT-${fileKey.toUpperCase().replace(/-/g, '_')}`;
  const m = /^(\d+[a-z]?)-(.+)$/i.exec(fileKey);
  const num = (m ? m[1]! : fileKey).toUpperCase();
  const group = slug(m ? m[2]! : '').replace(/-/g, '_');
  const full = `SIT-${num}_${group}-${slug(name)}`;
  return full.length > 120 ? full.slice(0, 120).replace(/-+$/, '') : full;
}

/** A test's identity in the repository, written exactly as the application side writes it. */
export const sitLinkFor = (file: string, name: string | null) => `sit/cases/${file}${name ? `::${name}` : ''} (SIT runner, node:test)`;
/** What the worker runs. */
export const sitScriptFor = (file: string, name: string | null) => `sit/cases/${file}${name ? `::${name}` : ''}`;

function addressWords(route: string): string {
  const words = route.replace(/^\/api\/v1\//, '').replace(/\?.*$/, '').split('/').filter((s) => s && !s.startsWith(':')).join(' ').replace(/[-_.]/g, ' ').trim();
  return words ? `the ${words} service` : 'the application';
}

const STATUS_WORDS: Record<string, string> = {
  '200': 'success', '201': 'created', '400': 'a rejection', '401': 'a sign-in refusal', '403': 'an access refusal',
  '404': 'a not-found answer', '409': 'a conflict', '422': 'a validation refusal', '429': 'a slow-down answer', '500': 'a server error',
};
const VERB_WORDS: Record<string, string> = { GET: 'reading', POST: 'sending to', PUT: 'replacing', PATCH: 'updating', DELETE: 'removing from' };

/**
 * The objective a person reads on the Test cases screen, from the test's own
 * name: leading reference codes dropped, addresses, request verbs and status
 * numbers put in words. The exact technical statement stays in the description
 * and the automation link.
 */
export function sitObjectiveFor(name: string | null, file: string): string {
  if (!name) return `Run every check in the application team's SIT file ${file} against the deployed Sand Bench and confirm they all pass.`;
  let text = name.replace(/\$\{[^}]*\}/g, 'each one').replace(/\s+/g, ' ').trim();
  // Leading references: "NAV01 …", "TCG-SCR3 …", "UC-sessionLogin AC-07: …", "ASVS V6 …", "BUC-02 …"
  for (let i = 0; i < 3; i++) {
    text = text.replace(/^(?:ASVS\s+V\d+(?:\.\d+)*|[A-Z]{2,}[A-Za-z]*-?[A-Za-z]*\d+[A-Za-z0-9.-]*|[A-Z]{2,}-[A-Za-z]+)\s*[:—-]?\s+/, '');
  }
  text = text
    .replace(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/[^\s,;)]*)/g, (_all, verb: string, route: string) => `${VERB_WORDS[verb]} ${addressWords(route)}`)
    .replace(/(^|\s)(\/api\/v1\/[^\s,;)]*)/g, (_all, lead: string, route: string) => `${lead}${addressWords(route)}`)
    .replace(/\b([1-5]\d\d)\b(?=\s|[,.;)]|$)/g, (code) => STATUS_WORDS[code] || code);
  // "A user signs in…" → "a user signs in…"; a screen or product name at the start keeps its capital.
  const body = /^(A|An|The|Every|Each|No|When|If|Any|All)\b/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
  return `Confirm that ${body.replace(/[.!?]+$/, '')}. This is one of the application team's own checks, run against the deployed Sand Bench.`;
}

/** The Test cases screen fields of one imported SIT test. */
export function sitScreenFields(test: SitTest) {
  const { file, fileKey, name, meta } = test;
  const browser = meta.method !== 'http';
  const perf = meta.type === 'performance';
  const security = meta.type === 'security';
  return {
    objective: sitObjectiveFor(name, file),
    owner: security || perf ? 'Quality control team' : 'Quality assurance team',
    component: sitComponentFor(fileKey),
    environment: 'sand-bench-staging',
    estimated_duration: perf ? '5-15m' : browser ? '1-5m' : 'Under 1m',
    visibility: 'Team',
    automation_link: sitLinkFor(file, name),
    test_data: 'Defined inside the SIT script: the administrator identity of the environment, plus throwaway users, records and messages the check creates for itself and removes.',
    attachments: [{ name: `SIT script ${file}`, url: `sit/cases/${file}` }, { name: 'Catalog documentation', url: 'docs/TEST-CASE-CATALOG.md' }],
    flakiness_notes: browser
      ? 'A browser check: on a heavily loaded host a page can take longer than the check waits.'
      : 'None known — a scripted request-and-check; round-trip checks poll for up to a few seconds.',
    known_workarounds: 'The script is the application team\'s, at the commit deployed on the environment — it is not edited here. A failure is either the deployment missing something the check needs, or a finding for the application team.',
    common_failure_causes: `${browser ? 'No browser driver on the worker; ' : ''}the worker cannot see the exported source of the deployed commit; a service the check talks to (test hub, database viewer, second portal) is not part of the deployment; the administrator identity is not the one registered on the environment.`,
    preconditions: 'The deployed Sand Bench stack is up; the environment records the deployed commit and the worker has that commit\'s exported source; the administrator can sign in.',
    description: `The application team's SIT check sit/cases/${file}${name ? ` — test "${name}"` : ' (every test in the file)'}, run with the suite of the commit deployed on the environment.`,
    steps: [
      { text: `Start the application team's check${name ? ` "${name}"` : 's'} from the file ${file} against this environment`, expected: 'The check starts and signs in as the administrator.', testData: 'The environment\'s addresses and administrator identity.' },
      { text: 'Let the check carry out its actions on the deployed application', expected: 'Every action is answered the way the check requires.', testData: 'Records the check creates for itself and removes afterwards.' },
      { text: 'Read the outcome the check reports', expected: 'The check reports a pass. A failure is recorded with the check\'s own message.' },
    ],
  };
}
