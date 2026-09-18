# @youmart/auth-service

The Auth service. This prompt is the SKELETON only - no auth features yet
(no OTP, no JWT, no login/register). It's the template every other service
in this repo copies: config, logger, db connection, health/ready, error
envelope + `AppError`, graceful shutdown.

## Run

```
pnpm --filter @youmart/auth-service dev
```

## Endpoints (so far)

- `GET /health` - liveness. Never touches the DB.
- `GET /ready` - readiness. Runs `SELECT 1` against the database.

## Database connection

Connects as the least-privilege `auth_svc` Postgres role (see Chapter 2's
roles/grants migration), not the migration/owner role - it can only
read/write the `auth` schema, enforced at the database level.
