#!/usr/bin/env bash
#
# Pre-push git hook for the local Sand Bench checkout. Fires when `git push`
# is about to publish refs to the remote; if main is in that set, POSTs the
# commit SHA to the test engine on loopback so it can deploy + run on
# sand-bench-staging. The push itself always proceeds — the engine runs in
# parallel, and a failure here is logged but never blocks `git push`.
#
# This script is tracked in the gavriq-test-engine repo; the actual hook file
# at ../sand-bench-enterprise/.git/hooks/pre-push is a one-line stub installed
# by scripts/install-sandbench-git-hooks.ps1 that execs this script.
#
# Pre-push protocol: stdin receives one line per ref being pushed:
#     <local_ref> <local_sha> <remote_ref> <remote_sha>
# A deletion is marked by <local_sha> = 0000000...; those are ignored.
#
# Required env (loaded from the engine repo's .env or the user's shell):
#     SAND_BENCH_WEBHOOK_SECRET   same value the engine has configured
# Optional env:
#     TEST_ENGINE_URL             default http://127.0.0.1:8797
#     TEST_ENGINE_PROJECT_KEY     default sand-bench
#     TEST_ENGINE_BRANCH          default main (only this branch triggers)
#     TEST_ENGINE_HOOK_LOG        where to append output (default /dev/null)
set -u

# The engine repo lives next to the Sand Bench checkout as a sibling by
# default; the installer sets GAVRIQ_ENGINE_REPO to point here explicitly.
ENGINE_REPO="${GAVRIQ_ENGINE_REPO:-}"
if [ -z "$ENGINE_REPO" ]; then
  self_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  ENGINE_REPO="$(cd "$self_dir/.." && pwd)"
fi

# Load the engine's .env to find SAND_BENCH_WEBHOOK_SECRET if the user's shell
# didn't export it. The .env is key=value lines; we parse only what we need.
if [ -z "${SAND_BENCH_WEBHOOK_SECRET:-}" ] && [ -f "$ENGINE_REPO/.env" ]; then
  while IFS='=' read -r k v; do
    case "$k" in
      SAND_BENCH_WEBHOOK_SECRET)
        # Strip Windows CR from the end of the value (Git for Windows .env can be CRLF).
        v="${v%$'\r'}"
        SAND_BENCH_WEBHOOK_SECRET="$v"
        ;;
    esac
  done < "$ENGINE_REPO/.env"
fi

TEST_ENGINE_URL="${TEST_ENGINE_URL:-http://127.0.0.1:8797}"
TEST_ENGINE_PROJECT_KEY="${TEST_ENGINE_PROJECT_KEY:-sand-bench}"
TEST_ENGINE_BRANCH="${TEST_ENGINE_BRANCH:-main}"
LOG="${TEST_ENGINE_HOOK_LOG:-/dev/null}"

log() { printf '[sb-pre-push] %s\n' "$*" >> "$LOG"; }

if [ -z "${SAND_BENCH_WEBHOOK_SECRET:-}" ]; then
  log "SAND_BENCH_WEBHOOK_SECRET not set (checked env and $ENGINE_REPO/.env) — skipping engine trigger"
  exit 0
fi

# Walk stdin for a push of refs/heads/<TEST_ENGINE_BRANCH>. First match wins.
target_sha=""
while read -r local_ref local_sha _remote_ref _remote_sha; do
  [ -z "${local_ref:-}" ] && continue
  # Deletion push: local_sha is all zeros.
  case "$local_sha" in 0000000000000000000000000000000000000000) continue ;; esac
  if [ "$local_ref" = "refs/heads/$TEST_ENGINE_BRANCH" ]; then
    target_sha="$local_sha"
    break
  fi
done

if [ -z "$target_sha" ]; then
  log "no push of refs/heads/$TEST_ENGINE_BRANCH in this invocation — skipping"
  exit 0
fi

pusher="$(git config user.name 2>/dev/null || echo local)"
message="$(git log -1 --format=%s "$target_sha" 2>/dev/null | head -c 200 || true)"

# A GitHub-shaped push payload so the webhook route treats it the same as a
# real GitHub delivery; signed with HMAC-SHA256 using the shared secret.
payload=$(printf '{"ref":"refs/heads/%s","after":"%s","head_commit":{"id":"%s","message":%s},"pusher":{"name":%s}}' \
  "$TEST_ENGINE_BRANCH" "$target_sha" "$target_sha" \
  "$(printf '%s' "$message" | python -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '"commit"')" \
  "$(printf '%s' "$pusher" | python -c 'import json,sys;print(json.dumps(sys.stdin.read()))' 2>/dev/null || echo '"local"')")

sig="sha256=$(printf '%s' "$payload" | openssl dgst -sha256 -hmac "$SAND_BENCH_WEBHOOK_SECRET" | awk '{print $2}')"

log "pushing to $TEST_ENGINE_URL — commit $target_sha pusher=$pusher"

# Fire-and-forget: the push should not wait for the engine to answer, and a
# network error here must not break the push. nohup + background detaches the
# curl, errors go to $LOG only.
url="$TEST_ENGINE_URL/api/v1/webhooks/git/$TEST_ENGINE_PROJECT_KEY"
(
  response=$(curl --silent --show-error --max-time 10 \
    -X POST "$url" \
    -H 'content-type: application/json' \
    -H "x-hub-signature-256: $sig" \
    -H 'x-github-event: push' \
    --data "$payload" 2>&1)
  log "engine response: $response"
) >/dev/null 2>&1 &
disown 2>/dev/null || true

exit 0
