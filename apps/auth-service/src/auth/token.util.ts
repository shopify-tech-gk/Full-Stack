import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
import { config } from '../config';

export interface AccessTokenClaims {
  sub: string;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
  typ: 'access';
  phone: string;
}

export interface SignedAccessToken {
  token: string;
  expiresIn: number;
}

/**
 * RS256 (asymmetric): the auth service signs with the private key; every
 * other service (and this one, for its own /auth/refresh flow) verifies
 * with the public key only - no other service ever holds a signing secret.
 */
export function signAccessToken(user: { id: string; phone: string }): SignedAccessToken {
  const expiresIn = config.accessTokenTtlSeconds;
  const token = jwt.sign({ typ: 'access', phone: user.phone }, config.jwtPrivateKey, {
    algorithm: 'RS256',
    subject: user.id,
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
    expiresIn,
  });
  return { token, expiresIn };
}

export function verifyAccessToken(token: string): AccessTokenClaims {
  return jwt.verify(token, config.jwtPublicKey, {
    algorithms: ['RS256'],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  }) as AccessTokenClaims;
}

/**
 * Raw refresh token: crypto.randomBytes(32) (256 bits), base64url-encoded.
 * This raw value is delivered ONLY in the httpOnly cookie and is never
 * stored - only its sha256 hash lives in refresh_token.token_hash.
 */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Matching approach: hash the incoming raw cookie value and look it up by
 * exact equality (`WHERE token_hash = ?`) rather than a manual
 * byte-by-byte constant-time comparison. A hash lookup doesn't leak a
 * usable timing side-channel here - sha256's avalanche effect means a
 * single differing input byte flips roughly half the output bits, so an
 * attacker gains no incremental information from comparing partial hash
 * matches the way they could from comparing partial raw-secret matches.
 */
export function hashRefreshToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}
