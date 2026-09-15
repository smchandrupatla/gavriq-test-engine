#!/usr/bin/env bash
# One-command local bring-up for GAVRIQ Test Engine (+ optional SIT console).
set -euo pipefail
cd "$(dirname "$0")/.."

WITH_WORKERS="${WITH_WORKERS:-0}"

echo "==> docker compose up"
if [[ "$WITH_WORKERS" == "1" ]]; then
  docker compose --profile workers up -d --build
else
  docker compose up -d --build
fi

echo "==> waiting for API health"
for i in $(seq 1 60); do
  if curl -sf http://127.0.0.1:8787/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ $i -eq 60 ]]; then
    echo "API did not become healthy in time" >&2
    docker compose logs --tail=80 test-engine-api || true
    exit 1
  fi
done

echo "==> meta"
curl -sf http://127.0.0.1:8787/api/v1/meta | head -c 400 || true
echo
echo
echo "Dashboard:    http://localhost:8787/"
echo "SIT console:  http://localhost:8098/"
echo "Health:       http://localhost:8787/health"
echo "Meta:         http://localhost:8787/api/v1/meta"
if [[ "$WITH_WORKERS" != "1" ]]; then
  echo
  echo "Tip: WITH_WORKERS=1 $0  # start Selenium/HTTP workers"
fi
