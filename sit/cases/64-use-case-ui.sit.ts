import { test } from 'node:test';
import assert from 'node:assert/strict';
import { authToken, apiFetch } from '../lib/client.ts';
import { withConsolePage } from '../lib/ui.ts';
import { ENV } from '../lib/env.ts';
import { regressionCases, useCases } from '../lib/use-cases.mjs';

for (const uc of useCases()) {
  const entry = regressionCases().find(row => row.useCaseId === uc.id && row.layer === 'frontend');
  test(entry!.name, { timeout: 60000 }, async () => {
    const token = await authToken();
    const actual = await (await apiFetch(`/api/v1/use-cases/${encodeURIComponent(uc.page)}`)).json();
    await withConsolePage(async page => {
      await page.addInitScript(value => sessionStorage.setItem('sbe_token', value), token);
      for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
        await page.setViewportSize(viewport);
        await page.goto(`${ENV.webBase}/use-case.html?page=${encodeURIComponent(uc.page)}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => Boolean((document.querySelector('#name') as HTMLInputElement)?.value), null, { timeout: 15000 });
        assert.equal(await page.locator('#name').inputValue(), actual.name);
        assert.equal(await page.locator('#goal').inputValue(), actual.goal);
        assert.ok((await page.locator('#heading').textContent())?.includes(uc.id));
        assert.equal(await page.locator('#save').count(), 1);
        assert.equal(await page.locator('#download').count(), 1);
        assert.ok(await page.locator('#download').isVisible());
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow');
      }
    });
  });
}
