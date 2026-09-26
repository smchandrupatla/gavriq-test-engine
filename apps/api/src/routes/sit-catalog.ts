import type { FastifyInstance } from 'fastify';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../db/client.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const casesDir = path.join(root, 'sit/cases');

export const SIT_APPS = [
  { id: 'sand-bench', title: 'Sand Bench Enterprise', summary: 'Rule assurance bench, official console, API.' },
  { id: 'testhub', title: 'Testhub', summary: 'External system simulator.' },
  { id: 'desks', title: 'Channel desks', summary: 'MQ, Kafka, and API desks.' },
  { id: 'agentdesk', title: 'Agent Desk', summary: 'Workers and orchestration.' },
  { id: 'security', title: 'Security tooling', summary: 'Trivy, ZAP, Semgrep, Security Desk.' },
];

export const SIT_TYPES = [
  { id: 'health', title: 'Health', summary: 'Process and dependency reachability after deploy.' },
  { id: 'integration', title: 'Integration', summary: 'API round-trip with Testhub and inbound events.' },
  { id: 'gui', title: 'GUI', summary: 'Official console pages, Selenium screens, fields, workflows.' },
  { id: 'e2e', title: 'End to end', summary: 'First-run path a control owner can repeat.' },
  { id: 'security', title: 'Security', summary: 'ASVS 5.0 L1, OWASP API Top 10, vuln scan, pentest-lite.' },
  { id: 'agents', title: 'Agent Desk', summary: 'Independent AI workers portal.' },
  { id: 'performance', title: 'Performance', summary: 'Bounded soak and burst-concurrency checks.' },
];

const KNOWN_FILES = [
  '00-health.sit.ts',
  '10-mq-round-trip.sit.ts',
  '20-kafka-round-trip.sit.ts',
  '30-api-round-trip.sit.ts',
  '40-worker-job.sit.ts',
  '50-dbviewer-cross-check.sit.ts',
  '51-use-case-api.sit.ts',
  '60-gui-smoke.sit.ts',
  '60-ui-eventing.sit.ts',
  '61-selenium-screens.sit.ts',
  '62-selenium-fields.sit.ts',
  '63-selenium-workflows.sit.ts',
  '64-use-case-ui.sit.ts',
  '66-official-clicks.sit.ts',
  '67-feature-access-ui.sit.ts',
  '68-console-chrome.sit.ts',
  '70-e2e-ux.sit.ts',
  '70-ui-pages.sit.ts',
  '80-security-auth.sit.ts',
  '80-ui-workflows.sit.ts',
  '81-security-api.sit.ts',
  '82-security-headers.sit.ts',
  '83-security-vuln.sit.ts',
  '84-security-zap.sit.ts',
  '85-security-sast.sit.ts',
  '90-agents.sit.ts',
  '91-performance-soak.sit.ts',
  '92-performance-burst.sit.ts',
];

export function suiteOf(fileName: string): string {
  if (fileName.startsWith('51-') || fileName.startsWith('00-')) return fileName.startsWith('00-') ? 'health' : 'integration';
  if (fileName.startsWith('30-') || fileName.startsWith('10-') || fileName.startsWith('20-') || fileName.startsWith('40-') || fileName.startsWith('50-')) return 'integration';
  if (fileName.startsWith('60-') || fileName.startsWith('61-') || fileName.startsWith('62-') || fileName.startsWith('63-') || fileName.startsWith('64-') || fileName.startsWith('66-') || fileName.startsWith('67-') || fileName.startsWith('68-')) return 'gui';
  if (fileName.startsWith('70-')) return 'e2e';
  if (fileName.startsWith('8')) return fileName.startsWith('80-ui') ? 'gui' : 'security';
  if (fileName.startsWith('90-')) return 'agents';
  if (fileName.startsWith('91-') || fileName.startsWith('92-')) return 'performance';
  return 'other';
}

export function groupOf(fileName: string): string {
  if (fileName.startsWith('51-') || fileName.startsWith('64-')) return 'use-cases';
  if (fileName.startsWith('90-')) return 'workers';
  if (fileName.startsWith('91-')) return 'soak';
  if (fileName.startsWith('92-')) return 'burst';
  if (fileName.startsWith('00-')) return 'reachability';
  if (fileName.startsWith('10-')) return 'mq';
  if (fileName.startsWith('20-')) return 'kafka';
  if (fileName.startsWith('30-')) return 'api';
  if (fileName.startsWith('40-')) return 'worker';
  if (fileName.startsWith('50-')) return 'dbviewer';
  if (fileName.startsWith('60-')) return 'smoke';
  if (fileName.startsWith('61-')) return 'screens';
  if (fileName.startsWith('62-')) return 'fields';
  if (fileName.startsWith('63-') || fileName.startsWith('80-ui')) return 'workflows';
  if (fileName.startsWith('66-') || fileName.startsWith('67-') || fileName.startsWith('68-')) return 'console';
  if (fileName.startsWith('70-')) return 'first-run';
  if (fileName.startsWith('85-')) return 'sast';
  if (fileName.startsWith('84-')) return 'dast';
  if (fileName.startsWith('83-')) return 'vuln-scan';
  if (fileName.startsWith('82-')) return 'headers';
  if (fileName.startsWith('81-')) return 'api-top10';
  if (fileName.startsWith('80-')) return 'authentication';
  return 'other';
}

export function appOf(fileName: string): string {
  if (fileName.startsWith('90-')) return 'agentdesk';
  if (fileName.startsWith('8') && !fileName.startsWith('80-ui')) return 'security';
  if (/^(10-|20-|30-)/.test(fileName)) return 'testhub';
  return 'sand-bench';
}

function extractTestNames(source: string): string[] {
  const names: string[] = [];
  const re = /\b(?:test|it)\s*\(\s*[`'"]([^`'"\n]+)[`'"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) names.push(m[1]!);
  return [...new Set(names)];
}

function methodOf(fileName: string): string {
  if (/60-ui-eventing|60-gui/.test(fileName)) return 'playwright';
  if (/^6[0-9]-|^70-|^80-ui/.test(fileName)) return 'selenium';
  return 'http';
}

export async function sitCatalogRoutes(app: FastifyInstance) {
  app.get('/api/v1/sit-catalog', async (_req, reply) => {
    const diskFiles = existsSync(casesDir)
      ? readdirSync(casesDir).filter((f) => f.endsWith('.sit.ts')).sort()
      : [];
    const files = diskFiles.length ? diskFiles : KNOWN_FILES;

    const packs = files.map((file) => {
      const sourcePath = path.join(casesDir, file);
      const names = existsSync(sourcePath) ? extractTestNames(readFileSync(sourcePath, 'utf8')) : [];
      return {
        file,
        fileKey: file.replace(/\.sit\.ts$/, ''),
        app: appOf(file),
        type: suiteOf(file),
        group: groupOf(file),
        method: methodOf(file),
        onDisk: existsSync(sourcePath),
        cases: names.map((name) => ({ name, executable: true })),
      };
    });

    let registered: unknown[] = [];
    try {
      const { rows } = await query(
        `SELECT id, key, name, description, test_type, execution_method, script, tags, automation_status, lifecycle, updated_at
         FROM test_cases
         WHERE key LIKE 'SIT-%' OR 'sit' = ANY(tags)
         ORDER BY key`
      );
      registered = rows;
    } catch {
      registered = [];
    }

    return reply.send({
      data: {
        apps: SIT_APPS,
        types: SIT_TYPES,
        files: packs,
        registered,
        source: existsSync(casesDir) ? 'sit/cases' : 'builtin-inventory',
        counts: {
          files: packs.length,
          extracted: packs.reduce((n, p) => n + p.cases.length, 0),
          registered: registered.length,
        },
      },
    });
  });
}
