import { mkdir, writeFile } from 'node:fs/promises';
import { runAllCases } from './lib/runner.mjs';

const run = await runAllCases({
  files: ['51-use-case-api.sit.ts', '64-use-case-ui.sit.ts'],
  onFileStart: file => console.log(`Running ${file.fileName}`),
  onOutput: (_file, output) => process.stdout.write(output),
});
const report = {
  at: new Date().toISOString(), scope: 'Use-case catalogue API and editor regression, not complete business workflow acceptance',
  ...run, total: run.results.length,
  passed: run.results.filter(r => r.passed).length,
  failed: run.results.filter(r => r.status === 'failed').length,
  skipped: run.results.filter(r => ['skipped', 'todo'].includes(r.status)).length,
};
await mkdir(new URL('./public/evidence/', import.meta.url), { recursive: true });
await writeFile(new URL('./public/evidence/use-case-regression.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
console.log(`Use-case regression: ${report.passed} passed, ${report.failed} failed, ${report.skipped} skipped; ${report.total} reported cases`);
process.exitCode = report.anyProcessFailed || report.failed || !report.total ? 1 : 0;
