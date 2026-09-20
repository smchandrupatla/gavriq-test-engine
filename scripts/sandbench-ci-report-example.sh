#!/usr/bin/env bash
# Example: call from Sand Bench CI / Dockerfile after unit tests.
#
#   export TEST_ENGINE_URL=https://gavriq-test-engine.onrender.com
#   export APPLICATION_KEY=sand-bench
#   export BUILD_ID="$RENDER_GIT_COMMIT"
#   ./scripts/sandbench-ci-report-example.sh path/to/junit.xml
#
# Or with Jest JSON:
#   node scripts/parse-junit.mjs --jest jest-results.json > /tmp/results.json
#   ./scripts/post-build-results.sh /tmp/results.json
#
# Or all-in-one unit + report (no JUnit file):
#   node scripts/in-container-unit-report.mjs
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="${TEST_ENGINE_URL:-https://gavriq-test-engine.onrender.com}"
export TEST_ENGINE_URL="$ENGINE"
export APPLICATION_KEY="${APPLICATION_KEY:-sand-bench}"
export BUILD_ID="${BUILD_ID:-${RENDER_GIT_COMMIT:-${GITHUB_RUN_ID:-local-$(date +%s)}}}"
export COMMIT_SHA="${COMMIT_SHA:-${RENDER_GIT_COMMIT:-${GITHUB_SHA:-}}}"
export BRANCH="${BRANCH:-${RENDER_GIT_BRANCH:-${GITHUB_REF_NAME:-}}}"

REPORT="${1:-}"
if [[ -n "$REPORT" && -f "$REPORT" ]]; then
  if [[ "$REPORT" == *.xml ]]; then
    node "$ROOT/scripts/parse-junit.mjs" "$REPORT" > /tmp/te-build-results.json
  else
    node "$ROOT/scripts/parse-junit.mjs" --jest "$REPORT" > /tmp/te-build-results.json
  fi
  bash "$ROOT/scripts/post-build-results.sh" /tmp/te-build-results.json
else
  echo "No report file — running in-container unit job…"
  node "$ROOT/scripts/in-container-unit-report.mjs"
fi

echo "Verify: curl -sS \"$ENGINE/api/v1/build-results?application_key=$APPLICATION_KEY\" | head"
