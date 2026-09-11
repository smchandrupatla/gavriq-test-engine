// Shared `node:test` `test("description", ...)` scanner. Used by
// generate-testhub-catalog.mjs (building the Test Hub coverage catalog) and by
// sit/console.mjs (listing SIT cases in its own GUI directly from source, with no
// dependency on the Test Hub catalog file or any other service).
import { caseId, slugify } from "./slug.mjs";

const TEST_CALL = /\btest\(\s*"((?:[^"\\]|\\.)*)"/g;

export function extractTestCases(fileKey, filePath, source) {
  const cases = [];
  const seen = new Map();
  let match;
  TEST_CALL.lastIndex = 0;
  while ((match = TEST_CALL.exec(source))) {
    const name = match[1].replace(/\\"/g, '"');
    const slug = slugify(name) || "case";
    const occurrence = seen.get(slug) || 0;
    seen.set(slug, occurrence + 1);
    cases.push({ id: caseId(fileKey, name, occurrence), name, file: filePath });
  }
  return cases;
}
