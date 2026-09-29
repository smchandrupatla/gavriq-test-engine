import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { SANDBENCH_UPLOAD_CASES, SANDBENCH_UPLOAD_SUITE } from '../apps/api/src/catalog/sandbench-upload-cases.ts';

// This list comes from the supplied files, independently of the generated catalog.
const expectedXsds = [
  'pacs.029.001.02.xsd',
  'pacs.028.001.07.xsd',
  'pacs.004.001.15.xsd',
  'pacs.008.001.14.xsd',
  'pacs.009.001.13.xsd',
  'pacs.010.001.06.xsd',
  'pacs.007.001.14.xsd',
  'pacs.003.001.12.xsd',
  'pacs.002.001.16.xsd',
  'pacs.002.001.12.xsd',
];
const expectedMarkdown = 'ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md';
const expectedFiles = [...expectedXsds, expectedMarkdown].sort();
const fixtureDir = fileURLToPath(new URL('../data/iso20022-upload/', import.meta.url));
type ManifestEntry = { fileName: string; size_bytes: number; sha256: string };
const manifest: { files: ManifestEntry[] } = JSON.parse(readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8'));
type UploadStep = { action: string; value: string; markdown_file?: string };

describe('Sandbench Enterprise supplied upload fixtures', () => {
  it('preserves exactly the eleven supplied files and their recorded bytes', () => {
    assert.deepEqual(manifest.files.map((file) => file.fileName).sort(), expectedFiles);
    assert.deepEqual(readdirSync(fixtureDir).filter((name) => /\.(xsd|md)$/.test(name)).sort(), expectedFiles);
    for (const fixture of manifest.files) {
      const bytes = readFileSync(path.join(fixtureDir, fixture.fileName));
      assert.equal(bytes.length, fixture.size_bytes, `${fixture.fileName}: byte count changed`);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), fixture.sha256, `${fixture.fileName}: content changed`);
    }
  });

  it('makes every supplied document independently executable against Sandbench Enterprise', () => {
    assert.equal(SANDBENCH_UPLOAD_CASES.length, 11);
    assert.equal(new Set(SANDBENCH_UPLOAD_CASES.map((testCase) => testCase.key)).size, 11, 'case keys must remain individually selectable');
    const manifestNames = new Set(manifest.files.map((file) => file.fileName));
    const independentXsds: string[] = [];
    const independentMarkdown: string[] = [];
    for (const testCase of SANDBENCH_UPLOAD_CASES) {
      assert.equal(testCase.suiteKey, SANDBENCH_UPLOAD_SUITE.key);
      assert.equal(testCase.method, 'playwright', `${testCase.key}: must validate the application window`);
      assert.ok(testCase.tags.includes('sandbench-enterprise'), `${testCase.key}: incorrect application`);
      assert.equal(testCase.steps?.length, 1, `${testCase.key}: must contain its own complete upload flow`);
      const step = testCase.steps![0] as UploadStep;
      assert.equal(step.action, 'sandbench_upload');
      assert.ok(expectedXsds.includes(step.value), `${testCase.key}: unsupported schema fixture`);
      assert.ok(manifestNames.has(step.value), `${testCase.key}: missing schema fixture`);
      if (step.markdown_file) {
        assert.ok(manifestNames.has(step.markdown_file), `${testCase.key}: missing Markdown fixture`);
        independentMarkdown.push(step.markdown_file);
      } else {
        independentXsds.push(step.value);
      }
    }
    assert.deepEqual(independentXsds.sort(), [...expectedXsds].sort(), 'each XSD needs a distinct standalone case');
    assert.deepEqual(independentMarkdown, [expectedMarkdown], 'Markdown needs its own independently runnable case');
  });
});
