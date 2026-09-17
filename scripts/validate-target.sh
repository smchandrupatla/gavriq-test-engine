#!/usr/bin/env bash
# Validate TARGET_BASE_URL (Sand Bench / app under test) is reachable before smoke runs.
set -euo pipefail

TARGET="${TARGET_BASE_URL:-http://127.0.0.1:8001}"
PATHS=("/" "/health" "/api/health" "/login")

echo "Checking target: $TARGET"
OK=0
for p in "${PATHS[@]}"; do
  url="${TARGET%/}$p"
  code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 3 --max-time 8 "$url" || echo "000")
  echo "  $code  $url"
  if [[ "$code" =~ ^(200|201|204|301|302|303|307|308|401|403)$ ]]; then
    OK=1
  fi
done

if [[ "$OK" -eq 1 ]]; then
  echo "Target looks reachable. Set TARGET_BASE_URL=$TARGET when starting workers."
  exit 0
fi

echo "No successful response from $TARGET — start Sand Bench or fix TARGET_BASE_URL" >&2
exit 1
