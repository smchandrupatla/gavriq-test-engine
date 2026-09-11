import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { caseId } from '../../dev/scripts/slug.mjs';

const source = new URL('../../docs/use-cases/test-cases.json', import.meta.url);
const supplied = JSON.parse(readFileSync(source, 'utf8')).cases;
export function specificationCases() {
  return supplied.map(row => ({
    ...row, file: row.source, type: 'specification', group: 'acceptance', executable: false,
    useCaseUrl: `/api/use-cases/${encodeURIComponent(row.useCaseId)}`,
  }));
}
export function useCases() {
  return [...new Map(specificationCases().map(row => [row.useCaseId, {
    id: row.useCaseId, name: row.useCaseName, page: row.page,
  }])).values()];
}
export function regressionCases() {
  return useCases().flatMap(uc => ['backend', 'frontend'].map(layer => {
    const fileKey = layer === 'backend' ? '51-use-case-api' : '64-use-case-ui';
    const name = `${uc.id} | ${uc.name} | ${layer} catalogue contract`;
    return { id: caseId(fileKey, name, 0), name, file: `sit/cases/${fileKey}.sit.ts`,
      type: layer === 'backend' ? 'integration' : 'gui', group: 'use-cases',
      useCaseId: uc.id, useCaseName: uc.name, layer, executable: true,
      useCaseUrl: `/api/use-cases/${encodeURIComponent(uc.id)}`,
      coverageScope: 'Use-case catalogue delivery and editor integrity, not full feature acceptance',
    };
  }));
}
export function traceFor(name) {
  const id = String(name).split(' | ')[0];
  const uc = useCases().find(row => row.id === id);
  return uc ? { useCaseId: uc.id, useCaseName: uc.name, useCaseUrl: `/api/use-cases/${encodeURIComponent(uc.id)}` } : {};
}
export function useCaseDocument(id) {
  if (!useCases().some(row => row.id === id)) return null;
  return readFileSync(fileURLToPath(new URL(`../../docs/use-cases/${id}.md`, import.meta.url)), 'utf8');
}
