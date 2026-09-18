import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));

await page.goto('http://127.0.0.1:18787/catalog', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
await page.screenshot({ path: 'C:/GitHub/gavriq-test-engine/catalog-overview.png', fullPage: true });

const sideNavCount = await page.locator('#sideNav .nav-item').count();
console.log('nav items:', sideNavCount);

await page.locator('#sideNav .nav-item', { hasText: 'Every test case' }).click();
await page.waitForTimeout(800);
await page.screenshot({ path: 'C:/GitHub/gavriq-test-engine/catalog-all.png', fullPage: true });
console.log('all-cases rows:', await page.locator('#content tbody tr').count());

const secBtn = page.locator('#sideNav .nav-item', { hasText: 'Security' }).first();
if (await secBtn.count()) {
  await secBtn.click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:/GitHub/gavriq-test-engine/catalog-suite.png', fullPage: true });
  console.log('security rows:', await page.locator('#content tbody tr').count());
}

const firstCase = page.locator('#content .case-name').first();
if (await firstCase.count()) {
  await firstCase.click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:/GitHub/gavriq-test-engine/catalog-detail.png' });
  console.log('dialog open:', await page.locator('#detail[open]').count());
}

console.log('console/page errors:', JSON.stringify(errors, null, 2));
await browser.close();
