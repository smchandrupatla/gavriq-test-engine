# Target manifest (draft)

One engine serves many apps. Each app describes itself in `targets/<key>/target.json`
(schema: `targets/target.schema.json`) instead of the engine hardcoding `sand-bench`.

Registration today: `POST /api/v1/applications` + `POST /api/v1/environments`, results via
`scripts/post-build-results.sh` with `APPLICATION_KEY`. The manifest will drive those calls.

## Engine changes
Done:
- Loader (`apps/api/src/targets.ts`): at boot, validates `targets/*/target.json` and upserts the application and one environment per entry (`<app>-<env>`). `TARGETS_DIR` overrides the folder. Suites are not loaded yet.
- Default app key is now `DEFAULT_APPLICATION_KEY` (env, default `sand-bench`) in `build-status.ts`, `schedule/service.ts`, `import-sit-catalog.ts`; the scheduler options take an app key. `post-build-results.sh` warns when `APPLICATION_KEY` is unset.

Still to do:
1. Load suites/catalog from the manifest.
2. Remove the remaining literals: `'sand-bench'` literals `seed*.ts`, `schema.sql` seed row, `ops.ts` (`sandbench` tag, `seed-sandbench` route), dashboard `app.js` (`sand-bench`) and the `sandbench_types` metadata name.
3. Replace filename-prefix taxonomy (`sit/lib/catalog.mjs`, `routes/sit-catalog.ts`) with `suites.taxonomy: manifest`.
4. N-target sync script (replace `sync-sandbench-sit.mjs`).
5. App-scoped RBAC and an app selector in the dashboard.

Credentials are referenced by env var name only.
