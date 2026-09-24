import jwt from 'jsonwebtoken';
import type { Request, Response, RequestHandler } from 'express';
import type { ApiError } from '@youmart/shared-types';

/** Identity attached to `req.service` once a SERVICE (not user) token has
 * been verified. `name` is the calling service's own name (the token's
 * `sub` claim, e.g. "order-service") - purely for logging/audit, never
 * used for authorization decisions beyond "some legitimate internal
 * caller presented a valid service credential". */
export interface ServiceClaims {
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      service?: ServiceClaims;
    }
  }
}

const SERVICE_TOKEN_ISSUER = 'youmart-internal';
const SERVICE_TOKEN_TYP = 'service';

interface ServiceTokenClaims {
  sub: string;
  iss: string;
  typ: string;
  iat: number;
  exp: number;
}

export interface MintServiceTokenOptions {
  /** DEDICATED secret for service-to-service tokens - SEPARATE from the
   * user-auth RS256 keypair (never the auth-service private key). A
   * leaked service secret can only mint tokens `requireServiceAuth`
   * accepts; it can never forge a user login (different alg + secret +
   * `typ`, verified by `requireAuth`/`requireServiceAuth` respectively). */
  serviceSecret: string;
  /** Seconds until expiry - short-lived by design (default 300s
   * recommended at the call site). Minted fresh per outbound call
   * (@youmart/service-client) rather than cached, which is the simplest
   * correct approach given the tiny signing cost of HS256. */
  ttlSeconds: number;
}

/**
 * Self-minted by ANY service, no runtime dependency on auth-service (unlike
 * user RS256 tokens, which only auth-service can sign). HS256 with a
 * shared symmetric `serviceSecret` - every service holds the SAME secret
 * (by design: it's a shared internal-network credential, not a per-service
 * keypair), read from that service's own config, never hardcoded here.
 */
export function mintServiceToken(
  callerServiceName: string,
  options: MintServiceTokenOptions,
): string {
  return jwt.sign({ typ: SERVICE_TOKEN_TYP }, options.serviceSecret, {
    algorithm: 'HS256',
    subject: callerServiceName,
    issuer: SERVICE_TOKEN_ISSUER,
    expiresIn: options.ttlSeconds,
  });
}

export interface CreateServiceAuthMiddlewareOptions {
  serviceSecret: string;
  /** Optional - if provided, verification failures are logged at debug level. */
  logger?: { debug: (obj: unknown, msg?: string) => void };
}

export interface ServiceAuthMiddleware {
  requireServiceAuth: RequestHandler;
  /** Accepts EITHER a valid service token (-> `req.service`) OR a valid
   * user token (delegates to `userRequireAuth`, e.g. the `requireAuth`
   * returned by `createAuthMiddleware` -> `req.auth`). For endpoints a
   * customer hits directly AND a backend service may also call (e.g.
   * invoice download). */
  requireServiceOrUser(userRequireAuth: RequestHandler): RequestHandler;
}

function sendUnauthorized(res: Response): void {
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
 * Builds `{ requireServiceAuth, requireServiceOrUser }` configured with a
 * single service's dedicated `serviceSecret`. Stateless factory - same
 * shape/spirit as `createAuthMiddleware`, deliberately living in the SAME
 * package (it already owns JWT verification for this repo) rather than a
 * new `@youmart/service-auth` package.
 *
 * DISTINGUISHING a service token from a user token (the actual security
 * boundary): user access tokens are RS256, `typ:"access"`, verified with
 * auth-service's PUBLIC key; service tokens are HS256, `typ:"service"`,
 * verified with the SEPARATE `serviceSecret`. `jsonwebtoken`'s
 * `algorithms` allowlist rejects a token whose header `alg` isn't in the
 * list BEFORE attempting verification, so an RS256 user token handed to
 * `requireServiceAuth` (HS256-only) - or an HS256 service token handed to
 * `requireAuth` (RS256-only) - is rejected immediately, never partially
 * processed.
 */
export function createServiceAuthMiddleware(
  options: CreateServiceAuthMiddlewareOptions,
): ServiceAuthMiddleware {
  const { serviceSecret, logger } = options;

  function verifyServiceToken(token: string): ServiceClaims | undefined {
    try {
      const decoded = jwt.verify(token, serviceSecret, {
        algorithms: ['HS256'],
        issuer: SERVICE_TOKEN_ISSUER,
      }) as ServiceTokenClaims;

      if (decoded.typ !== SERVICE_TOKEN_TYP) {
        logger?.debug({ typ: decoded.typ }, 'service-auth: rejected non-service token');
        return undefined;
      }

      return { name: decoded.sub };
    } catch (err) {
      logger?.debug({ err }, 'service-auth: token verification failed');
      return undefined;
    }
  }

  const requireServiceAuth: RequestHandler = (req, res, next) => {
    const token = extractBearerToken(req);
    if (!token) {
      sendUnauthorized(res);
      return;
    }
    const claims = verifyServiceToken(token);
    if (!claims) {
      sendUnauthorized(res);
      return;
    }
    req.service = claims;
    next();
  };

  function requireServiceOrUser(userRequireAuth: RequestHandler): RequestHandler {
    return (req, res, next) => {
      const token = extractBearerToken(req);
      if (token) {
        const claims = verifyServiceToken(token);
        if (claims) {
          req.service = claims;
          next();
          return;
        }
      }
      // Not a valid (or any) service token - fall through to user
      // verification, which sends its own 401 if that also fails.
      userRequireAuth(req, res, next);
    };
  }

  return { requireServiceAuth, requireServiceOrUser };
}
