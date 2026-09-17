# CI → Test Engine build results

In-container / unit tests run in your application pipeline. The engine **does not re-run** them; it only stores and displays status.

## 1. Emit a JSON results file in CI

```json
[
  { "test_key": "jest-auth", "test_name": "Auth suite", "status": "passed", "duration_ms": 120 },
  { "test_key": "jest-api", "test_name": "API suite", "status": "failed", "duration_ms": 340 }
]
```

`status`: `passed` | `failed` | `skipped` | `error`

## 2. Post to the engine

```bash
export TEST_ENGINE_URL=https://test-engine.example.com
export BUILD_ID=$GITHUB_RUN_ID
export COMMIT_SHA=$GITHUB_SHA
export APPLICATION_KEY=sand-bench

chmod +x scripts/post-build-results.sh
./scripts/post-build-results.sh path/to/results.json
```

Or raw curl:

```bash
curl -X POST "$TEST_ENGINE_URL/api/v1/build-results" \
  -H 'content-type: application/json' \
  -d '{
    "application_key": "sand-bench",
    "build_id": "'"$GITHUB_RUN_ID"'",
    "commit_sha": "'"$GITHUB_SHA"'",
    "results": [ { "test_key": "x", "test_name": "X", "status": "passed", "duration_ms": 1 } ]
  }'
```

## 3. View

- Dashboard → **In-container / build status**
- `GET /api/v1/build-results?application_key=sand-bench`
- `GET /api/v1/test-status?application_key=sand-bench` (engine + in-container combined)

## Example GitHub Actions step

```yaml
- name: Post results to Test Engine
  if: always()
  env:
    TEST_ENGINE_URL: ${{ secrets.TEST_ENGINE_URL }}
    BUILD_ID: ${{ github.run_id }}
    COMMIT_SHA: ${{ github.sha }}
  run: |
    # convert junit/jest output to results.json as needed
    ./scripts/post-build-results.sh results.json
```
