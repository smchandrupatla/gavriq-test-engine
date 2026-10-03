# Target manifest (draft)

One engine serves many apps. Each app describes itself in `targets/<key>/target.json`
(schema: `targets/target.schema.json`) instead of the engine hardcoding `sand-bench`.

Registration today: `POST /api/v1/applications` + `POST /api/v1/environments`, results via
`scripts/post-build-results.sh` with `APPLICATION_KEY`. The manifest will drive those calls.

## Planned engine changes (not yet implemented)
1. Loader: read manifests at boot, upsert application, environments, suites.
2. Replace `'sand-bench'` literals (`build-status.ts`, `schedule/service.ts`, `import-sit-catalog.ts`,
   `seed*.ts`, `schema.sql`, `post-build-results.sh`) with the requested app key.
3. Replace filename-prefix taxonomy (`sit/lib/catalog.mjs`, `routes/sit-catalog.ts`) with `suites.taxonomy: manifest`.
4. N-target sync script (replace `sync-sandbench-sit.mjs`).
5. App-scoped RBAC and an app selector in the dashboard.

Credentials are referenced by env var name only.
