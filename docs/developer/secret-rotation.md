# Secret Rotation Runbook

## Scope
This runbook covers secrets required by Phase 1 security hardening:

- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `MT5_INTERNAL_API_KEY`
- MT5 account credentials (`MASTER_MT5_*`, `SLAVE_MT5_*`)

## Rotation policy

- Rotate JWT and MT5 internal API key every 90 days.
- Rotate immediately on any leak suspicion or unauthorized access event.
- Never commit real secret values to source control.

## Rotation procedure

1. Generate new values in a secure vault.
2. Update deployment secrets for all environments (dev/stage/prod).
3. Restart services in this order:
   - `mt5-server`
   - backend API
   - websocket clients/agents that call MT5 bridge
4. Invalidate old JWT sessions by clearing token sessions if emergency rotation is required.
5. Verify:
   - JWT login/refresh flow works.
   - MT5 internal REST calls return `200` with valid bearer and `401` without bearer.
   - MT5 websocket `/ws/mt5` closes unauthorized clients.

## Environment templates

Use placeholder-only templates:

- `backend/.env.example`
- `docker-compose.yml`

Keep local real values in untracked environment files or secret manager injection only.
