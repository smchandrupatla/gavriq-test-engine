# Releasing

## Tag v0.2.0 (or next)

```bash
git checkout main
git pull origin main
git tag -a v0.2.0 -m "GAVRIQ Test Engine 0.2.0 — enterprise foundation"
git push origin v0.2.0

# Optional GitHub release from the UI or:
# gh release create v0.2.0 --title "v0.2.0" --notes-file CHANGELOG.md
```

## JWT (production / staging)

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
export RBAC_ENABLED=true

# Mint a token for a human operator
npx tsx apps/api/src/scripts/mint-token.ts test_admin ops-alice

curl -s http://localhost:8787/api/v1/dashboard \
  -H "Authorization: Bearer <token>"
```

Payload claims used: `sub` (actor id), `roles` (string or string[]).
