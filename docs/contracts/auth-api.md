# Auth API Contract

**FROZEN as of `chapter-3-complete` (2026-09-18).** This is the stable
surface other services and the frontend build against. Changes after this
freeze must be additive where possible (new optional fields, new endpoints)
or require a version bump communicated to all consumers - do not silently
change a shape or status code of an endpoint listed here.

## Base URL

Auth service (`@youmart/auth-service`), port **4001** in dev
(`http://localhost:4001`). No path prefix beyond what's listed below.

## Common envelope

All error responses use this shape (`@youmart/shared-types` `ApiError`):

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "string", "details": /* optional, unknown */ } }
```

`ApiErrorCode` (`@youmart/shared-types`): `VALIDATION_ERROR`, `UNAUTHORIZED`,
`FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `INTERNAL_ERROR`.

Unmatched routes → `404` with `code: "NOT_FOUND"`.

Malformed JSON body or a Zod validation failure → `400` with
`code: "VALIDATION_ERROR"` (Zod failures include `details: issues[]`).

Unknown/internal errors → `500` `INTERNAL_ERROR`; in production the
`message` is always the generic `"Internal server error"` (dev may show the
real `err.message`) - internals are never leaked.

## Endpoints

### `GET /health`

Liveness only - never touches the database.

- **200**: `{ "status": "ok", "service": "auth", "uptime": number, "timestamp": string (ISO) }`

### `GET /ready`

Readiness - runs `SELECT 1` against Postgres as the `auth_svc` role.

- **200**: `{ "status": "ready" }`
- **503**: `ApiError`, `code: "INTERNAL_ERROR"`, `message: "Database is not reachable"`

### `POST /auth/otp/request`

Request an OTP for phone login/verification. Same response shape whether
or not the phone maps to an existing user - no enumeration.

Request body (Zod):

```
{
  phone: string     // ^\+[1-9]\d{7,14}$ (E.164-ish)
  purpose?: "LOGIN" | "PHONE_VERIFY"   // default "LOGIN"
}
```

- **200**: `{ "status": "otp_sent", "expiresInSeconds": 300 }` (default TTL; configurable via `OTP_TTL_SECONDS`)
- **400** `VALIDATION_ERROR`: malformed body (bad phone format, etc.)
- **429** `RATE_LIMITED`: an active challenge already exists within the resend cooldown (`OTP_RESEND_COOLDOWN_SECONDS`, default 60s), OR the hourly cap was hit (`OTP_RATE_LIMIT_PER_HOUR`, default 5)

The OTP itself is never present in this response - it is only ever
delivered out-of-band (SMS in production; a dev-only log line today).

### `POST /auth/otp/verify`

Verify the OTP; on success, logs the user in - creates the user record if
this is their first verified login, and issues a session.

Request body (Zod):

```
{
  phone: string       // same pattern as /otp/request
  purpose?: "LOGIN" | "PHONE_VERIFY"   // default "LOGIN"
  code: string        // digits only, e.g. "123456"
}
```

- **200**:
  ```json
  {
    "accessToken": "<RS256 JWT>",
    "expiresIn": 900,
    "user": { "id": "<uuid>", "phone": "+91...", "isPhoneVerified": true }
  }
  ```
  Plus a `Set-Cookie` header issuing the refresh token (see "Refresh
  cookie" below). **The refresh token is never present in the response
  body** - only in the cookie.
- **400** `VALIDATION_ERROR`: malformed body, OR no active/matching
  challenge, OR wrong code (generic message either way - "Invalid or
  expired code" - never reveals which)
- **429** `RATE_LIMITED`: too many wrong attempts on the current challenge (`OTP_MAX_ATTEMPTS`, default 5) - even a correct code is rejected once this cap is hit; a fresh `/otp/request` is required
- **403** `FORBIDDEN`: the resolved user account is `BLOCKED`

### `POST /auth/refresh`

Rotates the session: the refresh token in the `ym_rt` cookie is exchanged
for a new access token AND a new refresh token (old one revoked
atomically). No request body - the refresh token is read only from the
cookie, never from the body.

- **200**:
  ```json
  { "accessToken": "<RS256 JWT>", "expiresIn": 900 }
  ```
  Plus a new `Set-Cookie` replacing `ym_rt`.
- **401** `UNAUTHORIZED`: missing cookie, OR the token doesn't match any
  active (non-revoked, non-expired) `refresh_token` row - this includes
  replaying an already-rotated (old) refresh token
- **403** `FORBIDDEN`: the session's user is `BLOCKED`

### `POST /auth/logout`

Revokes the current refresh token and clears the cookie. **Always returns
200**, whether or not the cookie was present or valid - never reveals
whether a session existed (idempotent).

- **200**: `{ "status": "logged_out" }`, plus a `Set-Cookie` clearing `ym_rt`

### `GET /auth/public-key`

Returns the RS256 **public** key (PEM, `Content-Type: text/plain`) other
services use to verify access tokens locally via `@youmart/auth-middleware`

- no request body, no auth required (the key is public by design).

- **200**: PEM text, e.g.
  ```
  -----BEGIN PUBLIC KEY-----
  ...
  -----END PUBLIC KEY-----
  ```

## Refresh cookie (`ym_rt`)

| Flag       | Value                                                                           |
| ---------- | ------------------------------------------------------------------------------- |
| Name       | `ym_rt` (`REFRESH_COOKIE_NAME`)                                                 |
| `httpOnly` | always `true`                                                                   |
| `secure`   | `COOKIE_SECURE` (dev: `false`; **MUST be `true`** in every non-dev environment) |
| `sameSite` | `lax`                                                                           |
| `path`     | `/auth`                                                                         |
| `maxAge`   | `REFRESH_TOKEN_TTL_SECONDS * 1000` (default 1,209,600s = 14 days)               |

The raw refresh token exists only in this cookie; only its sha256 hash is
ever persisted (`auth.refresh_token.token_hash`). It is rotated (revoked +
reissued) on every successful `/auth/refresh` call.

## Auth model for OTHER services

1. The frontend/client sends the access token on every authenticated
   request: `Authorization: Bearer <accessToken>`.
2. Every other service verifies it **locally**, using
   `@youmart/auth-middleware`'s `createAuthMiddleware({ publicKey, issuer, audience })`
   with the PUBLIC key fetched from `GET /auth/public-key` (or injected via
   that service's own config) - never the private key, and never a
   per-request network call back to the auth service.
3. Verification requires: `alg: RS256` only, `iss === "youmart-auth"`,
   `aud === "youmart"`, and `typ === "access"` (a refresh token is a raw
   cookie value, never a JWT, and could never pass this check anyway).
4. Access tokens are short-lived: `ACCESS_TOKEN_TTL_SECONDS` = **900s (15
   min)** by default. There is no server-side revocation of access tokens
   before expiry - a client must call `/auth/refresh` to get a new one.
5. Refresh happens via the `ym_rt` httpOnly cookie against the auth service
   itself (`POST /auth/refresh`), scoped to `path=/auth` - other services
   never see or handle the refresh cookie.

## JWT claims (access token)

```json
{
  "sub": "<userId, uuid>",
  "iss": "youmart-auth",
  "aud": "youmart",
  "typ": "access",
  "phone": "+91...",
  "iat": 1234567890,
  "exp": 1234568790
}
```
