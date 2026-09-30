/**
 * HTML → PDF via the Playwright Chromium already bundled in the API image
 * (Dockerfile is FROM mcr.microsoft.com/playwright, matched to the playwright
 * npm version), so no extra PDF dependency is needed. Reports are infrequent,
 * on-demand admin actions: a fresh headless browser per request is fine.
 */
import { chromium } from 'playwright';

export interface PdfOptions {
  /** Shown in the running footer next to the page number. */
  footerLabel: string;
}

export async function renderHtmlToPdf(html: string, opts: PdfOptions): Promise<Buffer> {
  const browser = await chromium.launch({ args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const page = await browser.newPage();
    // networkidle lets same-origin <img src="/api/v1/evidence/file?..."> embeds finish loading.
    await page.setContent(html, { waitUntil: 'networkidle' });
    const footer = `
      <div style="width:100%;font-size:9px;color:#6b7a90;padding:0 12mm;display:flex;justify-content:space-between;font-family:system-ui,sans-serif">
        <span>${escapeHtml(opts.footerLabel)}</span>
        <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
      </div>`;
    const buf = await page.pdf({
      format: 'A4',
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer,
      margin: { top: '14mm', right: '12mm', bottom: '18mm', left: '12mm' },
    });
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}

export function escapeHtml(v: unknown): string {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
