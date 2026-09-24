import jwt from 'jsonwebtoken';
import type { AdminRoleKey } from '@youmart/auth-middleware';
import { config } from '../config';

export interface AdminAccessTokenClaims {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  typ: 'admin';
  role: AdminRoleKey;
}

export interface SignedAdminToken {
  token: string;
  expiresIn: number;
}

/**
 * Key custody decision: admin-service holds the SAME RS256 private key as
 * auth-service (via its own `JWT_PRIVATE_KEY` env var, same value) and
 * signs its own admin tokens directly, rather than calling auth-service
 * over HTTP to mint them. Simpler (no new internal endpoint/service-to-
 * service call on the login path) and equally secure - both services are
 * already trusted to hold this key (auth-service always has; admin-
 * service is the other first-party issuer of tokens verified against the
 * SAME public key). `typ:"admin"` (not `"access"`) is what keeps an admin
 * token from ever being accepted by `requireAuth` (customer-only) and
 * vice versa for `requireAdmin`.
 */
export function signAdminToken(admin: { id: string; role: AdminRoleKey }): SignedAdminToken {
  const expiresIn = config.accessTokenTtlSeconds;
  const token = jwt.sign({ typ: 'admin', role: admin.role }, config.jwtPrivateKey, {
    algorithm: 'RS256',
    subject: admin.id,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn,
  });
  return { token, expiresIn };
}
