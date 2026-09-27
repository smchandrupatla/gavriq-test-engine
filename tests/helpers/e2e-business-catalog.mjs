/** Machine index for the 50 Sand Bench business E2E scenarios. Keep in lockstep with docs/testing/E2E-BUSINESS-SCENARIOS.md. */

export const FIRST_WAVE = [
  "E2E-01",
  "E2E-02",
  "E2E-15",
  "E2E-16",
  "E2E-05",
  "E2E-23",
  "E2E-25",
  "E2E-26",
  "E2E-29",
  "E2E-32",
  "E2E-34",
  "E2E-44",
  "E2E-45",
  "E2E-46",
  "E2E-49",
];

export const GAPS = ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8", "G9", "G10"];

export const STATUSES = ["Not run", "In progress", "Passed", "Failed", "Blocked"];

export const SCENARIOS = [
  { id: "E2E-01", priority: "P0", title: "New reporting schema to an evidenced test result", traces: ["S1", "S2", "S3", "S4", "S5", "S6"], watch: ["G1", "G2", "G3", "G4", "G5", "G6", "G9"], wave: 1 },
  { id: "E2E-02", priority: "P0", title: "Import an XML reporting schema and use it through execution", traces: ["S1", "S2", "S3"], watch: ["G1", "G2", "G3"], wave: 1 },
  { id: "E2E-03", priority: "P0", title: "JSON schema to JSON definition, data and test result", traces: ["S1", "S2", "S3"], watch: ["G1", "G2", "G3"], wave: 2 },
  { id: "E2E-04", priority: "P0", title: "Flat-file layout to delivered file and reconciled report", traces: ["S1", "S2", "S3", "S5"], watch: ["G1", "G2", "G3", "G4"], wave: 2 },
  { id: "E2E-05", priority: "P0", title: "Reuse a saved definition and batch in a later session", traces: ["S2", "S3"], watch: ["G2", "G3"], wave: 1 },
  { id: "E2E-06", priority: "P0", title: "Evolve a registered schema without changing earlier results", traces: ["S1", "S2", "S6"], watch: ["G1", "G2", "G3", "G10"], wave: 2 },
  { id: "E2E-07", priority: "P1", title: "Compose baseline schemas into a new reporting definition", traces: ["S1", "S2"], watch: ["G1", "G2", "G3", "G10"], wave: 2 },
  { id: "E2E-08", priority: "P1", title: "Resolve documentation mismatch before creating the definition", traces: ["S1", "S2"], watch: ["G1", "G2", "G9"], wave: 2 },
  { id: "E2E-09", priority: "P0", title: "Review a duplicate schema and deliberately override it", traces: ["S1", "S2", "S6"], watch: ["G1", "G2", "G10"], wave: 2 },
  { id: "E2E-10", priority: "P0", title: "Repair an invalid import and complete the same business task", traces: ["S1", "S2"], watch: ["G1", "G2"], wave: 2 },
  { id: "E2E-11", priority: "P1", title: "Edit the schema canvas and verify downstream meaning", traces: ["S1", "S2"], watch: ["G1", "G2"], wave: 2 },
  { id: "E2E-12", priority: "P0", title: "Preserve constraints from authoring through rule execution", traces: ["S1", "S2", "S3"], watch: ["G1", "G2", "G3"], wave: 2 },
  { id: "E2E-13", priority: "P1", title: "Recover an unfinished schema and complete its definition", traces: ["S1", "S2"], watch: ["G1", "G2"], wave: 2 },
  { id: "E2E-14", priority: "P0", title: "Reconcile an uncertain publication or definition save", traces: ["S1", "S2", "S6"], watch: ["G1", "G2", "G10"], wave: 2 },
  { id: "E2E-15", priority: "P0", title: "Prevent publication with invalid or stale validation evidence", traces: ["S1", "S2"], watch: ["G1", "G2"], wave: 1 },
  { id: "E2E-16", priority: "P0", title: "Persist optional-field selection and mandatory content", traces: ["S2", "S3"], watch: ["G2", "G3"], wave: 1 },
  { id: "E2E-17", priority: "P0", title: "Reuse a generation profile with field and correlation rules", traces: ["S2", "S3", "S4"], watch: ["G2", "G3", "G10"], wave: 2 },
  { id: "E2E-18", priority: "P1", title: "Reproduce test data and results with the same seed", traces: ["S2", "S3", "S4"], watch: ["G2", "G3", "G10"], wave: 2 },
  { id: "E2E-19", priority: "P0", title: "Carry intentional invalid data into negative-test evidence", traces: ["S2", "S3", "S4", "S5"], watch: ["G1", "G2", "G3", "G4", "G6"], wave: 2 },
  { id: "E2E-20", priority: "P0", title: "Recover from partial message persistence without losing counts", traces: ["S2", "S3", "S6"], watch: ["G2", "G3", "G10"], wave: 2 },
  { id: "E2E-21", priority: "P1", title: "Export and populate a template for later testing", traces: ["S1", "S2", "S3"], watch: ["G1", "G3", "G10"], wave: 2 },
  { id: "E2E-22", priority: "P1", title: "Apply naming conventions without duplicate identities", traces: ["S2", "S3", "S7"], watch: ["G7", "G10"], wave: 2 },
  { id: "E2E-23", priority: "P0", title: "Assemble a mixed-source dataset and use its actual records", traces: ["S3", "S6"], watch: ["G2", "G3", "G10"], wave: 1 },
  { id: "E2E-24", priority: "P1", title: "Merge datasets while retaining lineage and duplicate policy", traces: ["S3", "S6"], watch: ["G3", "G10"], wave: 2 },
  { id: "E2E-25", priority: "P0", title: "Turn a business objective into an executable case", traces: ["S3", "S4"], watch: ["G3", "G9", "G10"], wave: 1 },
  { id: "E2E-26", priority: "P0", title: "Reorder and revise a suite, then prove what executed", traces: ["S3", "S6"], watch: ["G3", "G10"], wave: 1 },
  { id: "E2E-27", priority: "P0", title: "Repair a broken source reference before rerunning", traces: ["S2", "S3", "S6"], watch: ["G1", "G2", "G3", "G10"], wave: 2 },
  { id: "E2E-28", priority: "P0", title: "Prevent lost edits and duplicate execution requests", traces: ["S3", "S6"], watch: ["G3", "G10"], wave: 2 },
  { id: "E2E-29", priority: "P0", title: "Validate a threshold rule against exact boundary data", traces: ["S3", "S4", "S9"], watch: ["G3", "G9", "G10"], wave: 1 },
  { id: "E2E-30", priority: "P1", title: "Combine country and field-equality expectations in one suite", traces: ["S3", "S4"], watch: ["G3", "G9", "G10"], wave: 2 },
  { id: "E2E-31", priority: "P1", title: "Generate typology trigger/clean pairs and verify detection", traces: ["S3", "S4"], watch: ["G3", "G10"], wave: 2 },
  { id: "E2E-32", priority: "P0", title: "Enforce independent approval before using an active rule", traces: ["S4", "S6", "S7"], watch: ["G3", "G7", "G10"], wave: 1 },
  { id: "E2E-33", priority: "P1", title: "Replace an active rule and retain historical/export evidence", traces: ["S3", "S4"], watch: ["G3", "G6", "G10"], wave: 2 },
  { id: "E2E-34", priority: "P0", title: "Deliver a reporting dataset to the selected HTTP system", traces: ["S3", "S5", "S7"], watch: ["G3", "G4", "G9"], wave: 1 },
  { id: "E2E-35", priority: "P0", title: "Deliver through MQ and correlate responses", traces: ["S3", "S5", "S7"], watch: ["G3", "G4"], wave: 2 },
  { id: "E2E-36", priority: "P0", title: "Deliver through Kafka and verify the chosen topic", traces: ["S3", "S5", "S7"], watch: ["G3", "G4"], wave: 2 },
  { id: "E2E-37", priority: "P0", title: "Generate, deliver and reopen a file artifact", traces: ["S2", "S3", "S5", "S6"], watch: ["G3", "G4"], wave: 2 },
  { id: "E2E-38", priority: "P0", title: "Recover from a destination outage with truthful results", traces: ["S3", "S5", "S8"], watch: ["G3", "G4", "G10"], wave: 2 },
  { id: "E2E-39", priority: "P1", title: "Pause, resume and cancel a genuinely running workload", traces: ["S3", "S6"], watch: ["G3", "G4", "G10"], wave: 2 },
  { id: "E2E-40", priority: "P1", title: "Run a bounded performance workload and reconcile measurements", traces: ["S3", "S5"], watch: ["G3", "G4", "G6", "G10"], wave: 2 },
  { id: "E2E-41", priority: "P0", title: "Schedule an existing suite and verify its actual execution", traces: ["S3", "S6", "S9"], watch: ["G3", "G4", "G5", "G9", "G10"], wave: 2 },
  { id: "E2E-42", priority: "P1", title: "Schedule a report export and verify delivery of that report", traces: ["S3", "S5"], watch: ["G5", "G6", "G10"], wave: 2 },
  { id: "E2E-43", priority: "P1", title: "Follow application events from a real workflow through recovery", traces: ["S5", "S7", "S8"], watch: ["G4", "G8", "G10"], wave: 2 },
  { id: "E2E-44", priority: "P0", title: "Reconcile coverage, failed cases and history before sign-off", traces: ["S3", "S4", "S6"], watch: ["G3", "G6", "G10"], wave: 1 },
  { id: "E2E-45", priority: "P0", title: "Apply user permissions across the full working journey", traces: ["S4", "S6", "S7"], watch: ["G7", "G10"], wave: 1 },
  { id: "E2E-46", priority: "P0", title: "Keep tenant and API-client data isolated through execution", traces: ["S3", "S6", "S7", "S8"], watch: ["G1", "G7", "G8"], wave: 1 },
  { id: "E2E-47", priority: "P0", title: "Protect, sign and inspect message evidence with proper access", traces: ["S2", "S6", "S7"], watch: ["G2", "G8"], wave: 2 },
  { id: "E2E-48", priority: "P1", title: "Remove expired test data without damaging unrelated evidence", traces: ["S3", "S6", "S7"], watch: ["G8", "G10"], wave: 2 },
  { id: "E2E-49", priority: "P0", title: "Trace a reviewed requirement to complete evidence", traces: ["S1", "S2", "S3", "S4", "S5", "S6", "S7", "S8"], watch: ["G1", "G2", "G3", "G6", "G8", "G10"], wave: 1 },
  { id: "E2E-50", priority: "P1", title: "Recover a configured tenant and continue its business work", traces: ["S2", "S3", "S6", "S7"], watch: ["G1", "G2", "G3", "G4", "G5", "G6", "G7", "G10"], wave: 2 },
];

export function byId(id) {
  return SCENARIOS.find((row) => row.id === id) || null;
}

export function firstWave() {
  return FIRST_WAVE.map((id) => byId(id));
}
