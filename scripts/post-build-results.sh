#!/usr/bin/env bash
# Post in-container / CI test results to the Test Engine (display only — not re-run).
#
# Usage:
#   export TEST_ENGINE_URL=http://localhost:8787
#   export BUILD_ID="${GITHUB_RUN_ID:-local-$(date +%s)}"
#   ./scripts/post-build-results.sh results.json
#
# results.json format:
#   [
#     { "test_key": "unit-auth", "test_name": "Auth unit", "status": "passed", "duration_ms": 12 },
#     { "test_key": "unit-api",  "test_name": "API unit",  "status": "failed", "duration_ms": 40 }
#   ]
set -euo pipefail

ENGINE="${TEST_ENGINE_URL:-http://127.0.0.1:8787}"
APP_KEY="${APPLICATION_KEY:-sand-bench}"
BUILD_ID="${BUILD_ID:-local-$(date +%s)}"
COMMIT="${COMMIT_SHA:-${GITHUB_SHA:-unknown}}"
FILE="${1:-}"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 <results.json>" >&2
  exit 1
fi

BODY=$(jq -n \
  --arg app "$APP_KEY" \
  --arg build "$BUILD_ID" \
  --arg commit "$COMMIT" \
  --slurpfile results "$FILE" \
  '{application_key:$app, build_id:$build, commit_sha:$commit, results:$results[0]}')

echo "Posting $(jq 'length' "$FILE") results for build $BUILD_ID → $ENGINE"
curl -sf -X POST "$ENGINE/api/v1/build-results" \
  -H 'content-type: application/json' \
  -d "$BODY" | jq .
echo "OK — view on dashboard or GET $ENGINE/api/v1/test-status?application_key=$APP_KEY"
