#!/usr/bin/env bash
# Post in-container / CI test results to the Test Engine (display only — not re-run).
#
# Usage:
#   export TEST_ENGINE_URL=https://gavriq-test-engine.onrender.com
#   export BUILD_ID="${RENDER_GIT_COMMIT:-$GITHUB_RUN_ID}"
#   ./scripts/post-build-results.sh results.json
#
# results.json format:
#   [
#     { "test_key": "unit-suite", "test_name": "Unit suite", "suite": "unit",
#       "status": "passed", "duration_ms": 120, "location": "in_container" }
#   ]
set -euo pipefail

ENGINE="${TEST_ENGINE_URL:-https://gavriq-test-engine.onrender.com}"
APP_KEY="${APPLICATION_KEY:-sand-bench}"
BUILD_ID="${BUILD_ID:-${RENDER_GIT_COMMIT:-${GITHUB_RUN_ID:-local-$(date +%s)}}}"
COMMIT="${COMMIT_SHA:-${RENDER_GIT_COMMIT:-${GITHUB_SHA:-unknown}}}"
BRANCH="${BRANCH:-${RENDER_GIT_BRANCH:-${GITHUB_REF_NAME:-}}}"
FILE="${1:-}"

if [[ -z "$FILE" || ! -f "$FILE" ]]; then
  echo "Usage: $0 <results.json>" >&2
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required" >&2
  exit 1
fi

BODY=$(jq -n \
  --arg app "$APP_KEY" \
  --arg build "$BUILD_ID" \
  --arg commit "$COMMIT" \
  --arg branch "$BRANCH" \
  --slurpfile results "$FILE" \
  '{application_key:$app, build_id:$build, commit_sha:$commit, branch:$branch, results:$results[0]}')

echo "Posting $(jq 'length' "$FILE") results for build $BUILD_ID → $ENGINE"
curl -sf -X POST "$ENGINE/api/v1/build-results" \
  -H 'content-type: application/json' \
  -d "$BODY" | jq .
echo "OK — GET $ENGINE/api/v1/build-results?application_key=$APP_KEY"
echo "     GET $ENGINE/api/v1/test-status?application_key=$APP_KEY"
