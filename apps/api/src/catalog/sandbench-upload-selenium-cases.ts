import type { CaseDef, SuiteDef } from './types.js';
import { UPLOAD_MARKDOWN_FILE, UPLOAD_XSD_FILES } from './sandbench-upload-cases.js';

export const SANDBENCH_UPLOAD_SELENIUM_SUITE: SuiteDef = {
  key: 'sb-upload-xsd-selenium',
  name: 'Upload XSD test case (Selenium)',
  description: 'Sandbench Enterprise: the same ten ISO 20022 XSD upload cases and Markdown companion upload case as the Playwright suite, run through Selenium WebDriver instead. Every case checks a new successful upload, persisted file contents, and the exact imported item in Scheme Definitions after reload.',
  typeKey: 'selenium-baseline',
  category: 'qa',
};

function uploadCase(fileName: string, markdownFileName?: string): CaseDef {
  const document = markdownFileName || fileName;
  return {
    key: markdownFileName ? 'SB-UPLOAD-MARKDOWN-SELENIUM-MDR-2025-2026' : `SB-UPLOAD-XSD-SELENIUM-${fileName.replace(/\.xsd$/, '').toUpperCase().replaceAll('.', '-')}`,
    name: `${markdownFileName ? 'Upload Markdown test case (Selenium)' : 'Upload XSD test case (Selenium)'} - ${document}`,
    objective: `Using the Selenium browser driver, upload the ISO 20022 file ${document}${markdownFileName ? ` together with its companion schema ${fileName}` : ''} through the Import Scheme screen, confirm it is stored and listed after a reload, then remove only this run's import.`,
    description: `Validate Sandbench Enterprise using ${document} via Selenium WebDriver. ${markdownFileName ? `Upload this Markdown as an accompanying document with ${fileName}, as required by the Import Scheme screen.` : 'Upload this XSD alone through the Import Scheme screen.'} Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import. Runs headless by default; pass metadata.headless=false on the execution request to watch the browser.`,
    suiteKey: SANDBENCH_UPLOAD_SELENIUM_SUITE.key,
    testType: 'selenium-baseline',
    method: 'selenium',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chrome/Chromium and data/iso20022-upload fixtures. No dependency on another test case.',
    steps: [{
      action: 'sandbench_upload',
      value: fileName,
      ...(markdownFileName ? { markdown_file: markdownFileName } : {}),
      timeout_ms: 120000,
      description: `Sign in; select ${document}; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import`,
    }],
    timeoutSeconds: 180,
    validationRules: { viewport: { width: 1440, height: 1000 } },
    tags: ['selenium-baseline', 'sand-bench', 'sandbench-enterprise', 'upload', 'iso20022', 'selenium', 'on-demand', markdownFileName ? 'markdown' : 'xsd'],
    dataProfile: {
      profile: 'supplied-iso20022-schema-with-unique-run-comment',
      data: `${document}${markdownFileName ? ` with companion schema ${fileName}` : ''}. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.`,
      source: 'User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.',
    },
    expected: `A new upload is accepted and stored; ${document} has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload${markdownFileName ? ' with the Markdown download available' : ''}. Test-created data is removed after evidence is captured; existing uploads are preserved.`,
  };
}

export const SANDBENCH_UPLOAD_SELENIUM_CASES: CaseDef[] = [
  ...UPLOAD_XSD_FILES.map((fileName) => uploadCase(fileName)),
  uploadCase('pacs.002.001.16.xsd', UPLOAD_MARKDOWN_FILE),
];
