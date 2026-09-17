# Releasing

## Tag current main (example v0.2.3)

```bash
git checkout main
git pull origin main
git tag -a v0.2.3 -m "GAVRIQ Test Engine 0.2.3 — evidence viewer, SIT worker, CI helpers"
git push origin v0.2.3

# Optional GitHub release:
# gh release create v0.2.3 --title "v0.2.3" --notes-file CHANGELOG.md
```

## Live Sand Bench validation checklist

```bash
export TARGET_BASE_URL=http://127.0.0.1:8001   # your deploy URL
chmod +x scripts/validate-target.sh
./scripts/validate-target.sh

./scripts/up.sh
WITH_WORKERS=1 TARGET_BASE_URL=$TARGET_BASE_URL ./scripts/up.sh

# Dashboard → Run full smoke suite
# Or API:
curl -s -X POST localhost:8787/api/v1/executions \
  -H 'content-type: application/json' \
  -d '{"test_suite_id":"<smoke-suite-uuid>","environment_id":"local-dev","trigger_source":"manual"}'
```

## JWT (staging/production)

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
export RBAC_ENABLED=true
npm run mint-token -- test_admin ops-alice
```

Payload claims: `sub` (actor id), `roles` (string or string[]).
