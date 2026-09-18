# @youmart/auth-middleware

Shared Express 5 middleware for verifying RS256 access tokens issued by the
auth service. Every OTHER service imports this instead of re-implementing
JWT verification.

## Why public-key-only, no per-request network call

- The auth service is the ONLY holder of the RS256 private key; it signs.
- This package only ever handles the PUBLIC key - it verifies signatures,
  it can never create valid tokens.
- Verification is 100% local (`jsonwebtoken.verify` with the injected public
  key) - no HTTP call to the auth service and no database lookup per
  request. This keeps auth checks fast and removes the auth service as a
  point of failure for every other service's request path.
- A JWKS/key-rotation strategy can replace the static PEM later without
  changing the `requireAuth`/`optionalAuth` call sites.

## Usage

```ts
import { createAuthMiddleware } from '@youmart/auth-middleware';
import { config } from './config'; // your service's own config, e.g. loaded via @youmart/config

const { requireAuth, optionalAuth } = createAuthMiddleware({
  publicKey: config.jwtPublicKey,
  issuer: 'youmart-auth',
  audience: 'youmart',
});

app.get('/protected', requireAuth, (req, res) => {
  res.json({ userId: req.auth!.userId });
});

app.get('/catalog', optionalAuth, (req, res) => {
  // req.auth is present only if a valid token was sent
  res.json({ personalized: Boolean(req.auth) });
});
```

## Design notes

- **Factory pattern, no `process.env` access**: `createAuthMiddleware({ publicKey, issuer, audience })`
  is a pure function - the consuming service loads its own `JWT_PUBLIC_KEY`
  (same base64-encoded-PEM approach as the auth service) and injects it.
  This keeps the package stateless and testable.
- **`express` is a peer dependency**, not a regular dependency - the
  middleware targets Express 5's `RequestHandler` types but doesn't bundle
  its own copy of Express; the consuming service supplies it.
- **`req.auth` typing**: importing anything from this package ambiently
  augments Express's `Request` type with an optional `auth?: AuthClaims`
  field - consuming services get it typed automatically, no redeclaration
  needed.
- Verification enforces `algorithms: ['RS256']` (rejects `none`/HS256
  outright), plus `iss`, `aud`, and `typ === "access"` - a refresh token (or
  any other token type) is never accepted here. All failures return a
  generic `401 UNAUTHORIZED` `ApiError` envelope - which check failed is
  never revealed to the caller.
