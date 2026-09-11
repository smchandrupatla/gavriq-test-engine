#!/usr/bin/env node
// Scans tests/*.test.ts and writes apps/testhub/public/coverage-catalog.json so the
// Test Hub coverage page always reflects the real test suite instead of a hand-curated
// list that drifts out of date. Run with `npm run testhub:catalog`; CI checks the
// checked-in file is up to date (see .github/workflows/ci.yml).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { extractTestCases } from "./extract-tests.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const testsDir = path.join(root, "tests");
const sitCasesDir = path.join(root, "sit/cases");
const outFile = path.join(root, "apps/testhub/public/coverage-catalog.json");

// Broad, human-meaningful groupings for the coverage-by-category chart. Every test
// file must be mapped here; the script fails loudly if a new file is left unmapped
// rather than silently dropping it into a catch-all bucket.
const CATEGORY_BY_FILE = {
  "admin-portal": "console-ops",
  "apiportal": "integrations",
  "attack-history": "detection-compliance",
  "audit": "identity-access",
  "auth-flow": "identity-access",
  "ci-gates": "infra-ops",
  "console-bind": "console-ops",
  "console-fields-actions": "console-ops",
  "dataset-items": "runs-datasets",
  "dbviewer": "infra-ops",
  "demo-guard": "identity-access",
  "demo-seed-file": "identity-access",
  "designer-dynamic-fields": "catalogue-schema",
  "detection-rules": "detection-compliance",
  "etag": "infra-ops",
  "eventing": "integrations",
  "external-systems": "integrations",
  "field-rules": "catalogue-schema",
  "generator": "catalogue-schema",
  "http-catalogue": "catalogue-schema",
  "http": "infra-ops",
  "inbound-testhub": "integrations",
  "integration-config": "integrations",
  "integration-identity": "identity-access",
  "iso-catalog": "iso20022",
  "iso-import": "iso20022",
  "iso-official": "iso20022",
  "kernel-config": "identity-access",
  "kernel-errors": "identity-access",
  "kernel-ids": "identity-access",
  "live-bind-mount": "console-ops",
  "live-console": "console-ops",
  "live-ops": "console-ops",
  "mqmgr-compose": "integrations",
  "mqportal": "integrations",
  "official-gui": "console-ops",
  "passwords": "identity-access",
  "pg-cron": "infra-ops",
  "policy": "identity-access",
  "rate-controller": "infra-ops",
  "register-dataset-items": "runs-datasets",
  "run-stream": "runs-datasets",
  "schema-parser": "catalogue-schema",
  "spec-complete": "runs-datasets",
  "spec-contracts": "runs-datasets",
  "spec-missing": "runs-datasets",
  "spec-persist": "runs-datasets",
  "stage10-helm": "infra-ops",
  "stage3-validator": "detection-compliance",
  "stage4-delivery": "detection-compliance",
  "stage7-typologies": "detection-compliance",
  "stage8-dmn": "detection-compliance",
  "stage9-privacy-rbac": "detection-compliance",
  "templates": "catalogue-schema",
  "testhub-coverage": "testhub",
  "testhub-regression": "testhub",
  "wireframe-seed": "console-ops",
};

const CATEGORY_LABEL = {
  "identity-access": "Identity & access",
  "catalogue-schema": "Catalogue & schema",
  "iso20022": "ISO 20022",
  "console-ops": "Console & live ops",
  "runs-datasets": "Runs, streams & datasets",
  "detection-compliance": "Detection & compliance",
  "integrations": "Integrations & external systems",
  "infra-ops": "Infrastructure & ops",
  "testhub": "Test Hub",
  "post-deploy-sit": "Post-deploy SIT",
};

function scanDir(dir, suffix, filePathPrefix, categoryOf) {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(suffix))
    .map((name) => name.slice(0, -suffix.length))
    .sort();

  const unmapped = files.filter((file) => !categoryOf(file));
  if (unmapped.length) {
    console.error(`generate-testhub-catalog: no category mapped for: ${unmapped.map((f) => `${filePathPrefix}${f}${suffix}`).join(", ")}`);
    console.error("Add each new test file to its CATEGORY_BY_FILE map in this script.");
    process.exit(1);
  }

  const cases = [];
  for (const file of files) {
    const source = readFileSync(path.join(dir, `${file}${suffix}`), "utf8");
    const categoryKey = categoryOf(file);
    for (const testCase of extractTestCases(file, `${filePathPrefix}${file}${suffix}`, source)) {
      cases.push({
        ...testCase,
        category: categoryKey,
        categoryLabel: CATEGORY_LABEL[categoryKey],
        lastStatus: "catalogued",
        lastAt: null,
      });
    }
  }
  return { cases, fileCount: files.length };
}

function main() {
  const unit = scanDir(testsDir, ".test.ts", "tests/", (file) => CATEGORY_BY_FILE[file]);
  const sit = scanDir(sitCasesDir, ".sit.ts", "sit/cases/", () => "post-deploy-sit");

  const cases = [...unit.cases, ...sit.cases];
  const fileCount = unit.fileCount + sit.fileCount;

  const payload = {
    generatedAt: new Date().toISOString(),
    source: "tests/*.test.ts + sit/cases/*.sit.ts",
    categories: Object.entries(CATEGORY_LABEL).map(([key, label]) => ({ key, label })),
    cases,
  };

  writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`generate-testhub-catalog: wrote ${cases.length} cases across ${fileCount} files to ${path.relative(root, outFile)}`);
}

main();
