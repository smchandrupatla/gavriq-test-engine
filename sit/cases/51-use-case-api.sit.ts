import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiFetch } from '../lib/client.ts';
import { regressionCases, useCases } from '../lib/use-cases.mjs';

for (const uc of useCases()) {
  const entry = regressionCases().find(row => row.useCaseId === uc.id && row.layer === 'backend');
  test(entry!.name, async () => {
    const response = await apiFetch(`/api/v1/use-cases/${encodeURIComponent(uc.page)}`);
    assert.equal(response.status, 200, `${uc.id}: readable authenticated detail`);
    const actual = await response.json();
    assert.equal(actual.id, uc.id);
    assert.equal(actual.page, uc.page);
    for (const key of ['name', 'goal', 'precondition', 'trigger', 'success', 'failed', 'gherkin']) assert.ok(actual[key]?.trim(), `${uc.id}: ${key}`);
    for (const key of ['main', 'alternate', 'exception', 'acceptanceCriteria']) assert.ok(Array.isArray(actual[key]) && actual[key].length, `${uc.id}: ${key}`);
    const download = await apiFetch(`/api/v1/use-cases/${encodeURIComponent(uc.page)}.md`);
    assert.equal(download.status, 200);
    assert.match(download.headers.get('content-type') || '', /markdown/);
    const markdown = await download.text();
    assert.ok(markdown.includes(uc.id));
    assert.ok(markdown.includes(actual.goal));
    assert.ok(markdown.includes('## Gherkin'));
  });
}
