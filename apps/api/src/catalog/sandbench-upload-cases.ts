import type { CaseDef, SuiteDef } from './types.js';

export const SANDBENCH_UPLOAD_SUITE: SuiteDef = {
  key: 'sb-upload-xsd',
  name: 'Upload XSD test case',
  description: 'Sandbench Enterprise: ten separate ISO 20022 XSD upload cases and one separate Markdown companion upload case. Every case checks a new successful upload, persisted file contents, and the exact imported item in Scheme Definitions after reload.',
  typeKey: 'usecase',
  category: 'qa',
};

export const UPLOAD_XSD_FILES = [
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
] as const;

export const UPLOAD_MARKDOWN_FILE = 'ISO20022_MDRPart2_PaymentsClearingandSettlement_2025_2026_v1.md';

function uploadCase(fileName: string, markdownFileName?: string): CaseDef {
  const document = markdownFileName || fileName;
  return {
    key: markdownFileName ? 'SB-UPLOAD-MARKDOWN-MDR-2025-2026' : `SB-UPLOAD-XSD-${fileName.replace(/\.xsd$/, '').toUpperCase().replaceAll('.', '-')}`,
    name: `${markdownFileName ? 'Upload Markdown test case' : 'Upload XSD test case'} - ${document}`,
    objective: `Upload the ISO 20022 file ${document}${markdownFileName ? ` together with its companion schema ${fileName}` : ''} through the Import Scheme screen, confirm it is stored and appears in the list of scheme definitions after a reload, then remove only this run's import.`,
    description: `Validate Sandbench Enterprise using ${document}. ${markdownFileName ? `Upload this Markdown as an accompanying document with ${fileName}, as required by the Import Scheme screen.` : 'Upload this XSD alone through the Import Scheme screen.'} Require a successful new stored response, verify the saved filename and content, then locate the exact imported record in Scheme Definitions after reloading. Capture screenshot evidence and remove only this execution's temporary import.`,
    suiteKey: SANDBENCH_UPLOAD_SUITE.key,
    testType: 'acceptance',
    method: 'playwright',
    severity: 'high',
    priority: 'p1',
    preconditions: 'Sandbench Enterprise web and API reachable. Selected environment supplies web, tenant, username and optional password. Account can import and delete its test-created schemas. Worker has Chromium and data/iso20022-upload fixtures. No dependency on another test case.',
    steps: [{
      action: 'sandbench_upload',
      value: fileName,
      ...(markdownFileName ? { markdown_file: markdownFileName } : {}),
      timeout_ms: 120000,
      description: `Sign in; select ${document}; confirm upload; verify stored contents and exact imported item after reload; capture evidence; clean up this run's import`,
    }],
    timeoutSeconds: 180,
    validationRules: { browser: 'chromium', viewport: { width: 1440, height: 1000 } },
    tags: ['sand-bench', 'sandbench-enterprise', 'upload', 'iso20022', 'playwright', 'on-demand', markdownFileName ? 'markdown' : 'xsd'],
    dataProfile: {
      profile: 'supplied-iso20022-schema-with-unique-run-comment',
      data: `${document}${markdownFileName ? ` with companion schema ${fileName}` : ''}. The XSD receives a unique XML comment in memory to avoid Sandbench's content-hash duplicate rejection; its schema definition and original filename are unchanged. Markdown bytes are unchanged. Original fixture files remain unmodified.`,
      source: 'User-supplied ISO 20022 files copied into data/iso20022-upload; checksums recorded in manifest.json.',
    },
    expected: `A new upload is accepted and stored; ${document} has the expected filename and content; the exact created import is visible in Sandbench Enterprise's Scheme Definitions after reload${markdownFileName ? ' with the Markdown download available' : ''}. Test-created data is removed after evidence is captured; existing uploads are preserved.`,
  };
}

export const SANDBENCH_UPLOAD_CASES: CaseDef[] = [
  ...UPLOAD_XSD_FILES.map((fileName) => uploadCase(fileName)),
  uploadCase('pacs.002.001.16.xsd', UPLOAD_MARKDOWN_FILE),
];
