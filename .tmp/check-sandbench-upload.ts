import { chromium } from 'playwright';
import { runSandbenchUpload } from '../apps/worker/src/runners/sandbench-upload.ts';

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  for (let index = 0; index < 2; index++) {
    console.log(await runSandbenchUpload(page, {
      baseUrl: 'http://127.0.0.1:8080',
      fileName: 'pacs.028.001.07.xsd',
      timeoutMs: 90_000,
      onVisible: async (current) => { await current.screenshot({ path: `.tmp/upload-repeat-${index + 1}.png` }); },
    }));
    await page.context().clearCookies();
    await page.evaluate(() => { sessionStorage.clear(); localStorage.clear(); });
  }
  console.log(await runSandbenchUpload(page, {
    baseUrl: 'http://127.0.0.1:8080',
    fileName: 'pacs.002.001.16.xsd',
    markdownFileName: 'ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md',
    timeoutMs: 120_000,
    onVisible: async (current) => { await current.screenshot({ path: '.tmp/upload-markdown.png' }); },
  }));
} finally { await browser.close(); }
