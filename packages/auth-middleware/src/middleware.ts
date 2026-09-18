import { verify } from 'jsonwebtoken';
import type { Request, Response, RequestHandler } from 'express';
import type { ApiError } from '@youmart/shared-types';

/** Identity attached to `req.auth` once a token has been verified. */
export interface AuthClaims {
  userId: string;
  phone: string;
}

// Ambient augmentation: importing anything from this package makes `req.auth`
// available on Express's Request type across the consuming service, without
// that service needing to redeclare it itself.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthClaims;
    }
  }
}

/** Convenience type for handlers that only run after `requireAuth`, where `req.auth` is guaranteed. */
export interface AuthenticatedRequest extends Request {
  auth: AuthClaims;
}

export interface CreateAuthMiddlewareOptions {
  /** RS256 PUBLIC key PEM - this package never sees or handles the private key. */
  publicKey: string;
  issuer: string;
  audience: string;
  /** Optional - if provided, verification failures are logged at debug level. */
  logger?: { debug: (obj: unknown, msg?: string) => void };
}

export interface AuthMiddleware {
  requireAuth: RequestHandler;
  optionalAuth: RequestHandler;
}

interface AccessTokenClaims {
  sub: string;
  iss: string;
  aud: string;
  typ: string;
  phone?: string;
}

function sendUnauthorized(res: Response): void {
  // Generic message - never reveals which check (missing/expired/bad sig/
  // wrong iss/aud/typ) actually failed.
  const body: ApiError = {
    error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' },
  };
  res.status(401).json(body);
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header) {
    return undefined;
  }
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return undefined;
  }
  return token;
}

/**
 * Builds `{ requireAuth, optionalAuth }` middleware configured with a single
 * service's RS256 public key. Stateless factory - no process.env access, no
 * DB access, no per-request network call. The consuming service owns config
 * (loads its own JWT_PUBLIC_KEY) and passes it in.
 */
export function createAuthMiddleware(options: CreateAuthMiddlewareOptions): AuthMiddleware {
  const { publicKey, issuer, audience, logger } = options;

  function verifyToken(token: string): AuthClaims | undefined {
    try {
      // algorithms: ['RS256'] rejects 'none' and any other alg (e.g. HS256)
      // outright - jsonwebtoken refuses to even attempt verification with an
      // alg not in this allowlist, regardless of what the token header claims.
      const decoded = verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer,
        audience,
      }) as AccessTokenClaims;

      // A refresh token (or any other typ) must never be accepted here.
      if (decoded.typ !== 'access') {
        logger?.debug({ typ: decoded.typ }, 'auth-middleware: rejected non-access token');
        return undefined;
      }

      return { userId: decoded.sub, phone: decoded.phone ?? '' };
    } catch (err) {
      logger?.debug({ err }, 'auth-middleware: token verification failed');
      return undefined;
    }
  }

  const requireAuth: RequestHandler = (req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
      sendUnauthorized(res);
      return;
    }
    const claims = verifyToken(token);
    if (!claims) {
      sendUnauthorized(res);
      return;
    }
    req.auth = claims;
    next();
  };

  const optionalAuth: RequestHandler = (req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
      next();
      return;
    }
    const claims = verifyToken(token);
    if (!claims) {
      sendUnauthorized(res);
      return;
    }
    req.auth = claims;
    next();
  };

  return { requireAuth, optionalAuth };
}
