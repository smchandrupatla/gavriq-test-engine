/** Summarise a Semgrep / OpenGrep JSON report. */

export function summariseSemgrep(raw) {
  const results = Array.isArray(raw?.results) ? raw.results : [];
  const errors = Array.isArray(raw?.errors) ? raw.errors : [];
  const items = results.map((row) => ({
    checkId: row.check_id || row.checkId,
    path: row.path,
    line: row.start?.line || row.extra?.line,
    severity: String(row.extra?.severity || row.severity || "").toUpperCase(),
    message: row.extra?.message || row.message || "",
  }));
  const error = items.filter((i) => i.severity === "ERROR" || i.severity === "HIGH").length;
  const warning = items.filter((i) => i.severity === "WARNING" || i.severity === "MEDIUM").length;
  return {
    present: true,
    findings: items.length,
    error,
    warning,
    engineErrors: errors.length,
    items: items.slice(0, 40),
  };
}
