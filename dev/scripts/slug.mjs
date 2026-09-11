// Shared slug/id scheme so a test's catalog id (generate-testhub-catalog.mjs) and the id
// a suite run reports back (sit/run.mjs, tests/*.test.ts via CI) always agree.
export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Builds the same id for the nth (0-based) occurrence of `name` within `file` that
// generate-testhub-catalog.mjs assigns when scanning the file top to bottom.
export function caseId(file, name, occurrenceIndex = 0) {
  const slug = slugify(name) || "case";
  return occurrenceIndex === 0 ? `${file}__${slug}` : `${file}__${slug}-${occurrenceIndex + 1}`;
}
