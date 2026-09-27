import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "../fixtures/r1");

export function loadJson(name) {
  return JSON.parse(readFileSync(join(dir, name), "utf8"));
}

export function loadText(name) {
  return readFileSync(join(dir, name), "utf8");
}

export function r1JsonDraft() {
  const draft = loadJson("r1.draft.json");
  return {
    name: draft.name,
    format: "json",
    root: draft.root,
    description: draft.description,
    tree: draft.tree,
  };
}

export function r1XmlDraft() {
  const draft = loadJson("r1.draft.json");
  return {
    name: "Reporting fixture R1 XML",
    format: "xml",
    root: "Report",
    namespace: "urn:sandbench:reporting:r1",
    description: draft.description,
    tree: draft.tree,
  };
}

export function r1FlatDraft() {
  return {
    name: "Reporting fixture R1 flat",
    format: "flat",
    root: "Row",
    flat: { style: "csv", delimiter: ",", recordSeparator: "lf", hasHeader: true },
    tree: {
      name: "Row",
      kind: "group",
      children: [
        { name: "reportId", type: "string", required: true, maxLength: 5 },
        { name: "createdAt", type: "string", required: true },
        { name: "currency", type: "string", required: true, maxLength: 3 },
        { name: "amount", type: "decimal", required: true },
        { name: "country", type: "string", required: true, maxLength: 2 },
        { name: "reference", type: "string", required: false },
      ],
    },
  };
}

export const R1_LEAVES = [
  "reportId",
  "createdAt",
  "currency",
  "amount",
  "country",
  "reference",
];

export function payloadForAmount(amount, extras = {}) {
  return {
    reportId: extras.reportId || "00123",
    createdAt: "2026-09-17",
    currency: extras.currency || "AUD",
    country: extras.country || "AU",
    instdAmt: amount,
    amount,
  };
}
