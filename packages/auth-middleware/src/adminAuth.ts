import { verify } from 'jsonwebtoken';
import type { Request, Response, RequestHandler } from 'express';
import type { ApiError } from '@youmart/shared-types';

/**
 * Canonical RBAC model for this repo (single source of truth - both
 * admin-service, which seeds this SAME data into the `admin.role`/
 * `admin.permission`/`admin.role_permission` tables for auditability, and
 * every OTHER service's `requireAdmin` check import it from here).
 *
 * Permission naming: `<area>.<verb>`. `sellers.approve`/`sellers.kyc` are
 * MULTIVENDOR/DORMANT BASEMENT permissions - present so the schema/RBAC
 * shape is future-proof, granted to SUPER_ADMIN only, and not exercised at
 * single-vendor launch (seller self-registration is still hard-off, Ch6.1).
 */
export const PERMISSION_KEYS = [
  'catalog.manage',
  'orders.manage',
  'inventory.manage',
  'fulfillment.manage',
  'returns.manage',
  'search.manage',
  'invoices.view',
  'invoices.manage',
  'refunds.manage',
  'settlements.view',
  'settlements.manage',
  'sellers.approve',
  'sellers.kyc',
  'settings.manage',
  'admins.manage',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

export const ADMIN_ROLE_KEYS = ['SUPER_ADMIN', 'OPS', 'SUPPORT', 'FINANCE'] as const;
export type AdminRoleKey = (typeof ADMIN_ROLE_KEYS)[number];

/**
 * Role -> permission set, LOCKED per the Ch6.7a spec:
 *  - SUPER_ADMIN: every permission (incl. the dormant multivendor ones).
 *  - OPS: catalog/orders/inventory/fulfillment (the spec's literal list),
 *    PLUS returns.manage and search.manage - returns workflow and search
 *    reindexing are day-to-day store operations that don't fit FINANCE and
 *    would otherwise be unreachable by anyone but SUPER_ADMIN; documented
 *    as a deliberate extension beyond the literal 4-area description.
 *  - FINANCE: invoices (view+manage) + refunds.manage + settlements.view
 *    ONLY - settlements.manage (actually running a payout) is intentionally
 *    withheld per the spec's literal "settlements-view" wording for
 *    FINANCE; only SUPER_ADMIN can trigger a settlement run for now.
 *  - SUPPORT: no permissions yet - the enum value exists (Ch2 schema) but
 *    is dormant/unused, per the spec.
 */
export const ROLE_PERMISSIONS: Record<AdminRoleKey, readonly PermissionKey[]> = {
  SUPER_ADMIN: PERMISSION_KEYS,
  OPS: [
    'catalog.manage',
    'orders.manage',
    'inventory.manage',
    'fulfillment.manage',
    'returns.manage',
    'search.manage',
  ],
  FINANCE: ['invoices.view', 'invoices.manage', 'refunds.manage', 'settlements.view'],
  SUPPORT: [],
};

export function resolvePermissions(role: AdminRoleKey): readonly PermissionKey[] {
  return ROLE_PERMISSIONS[role];
}

export function adminHasPermission(role: AdminRoleKey, permission: PermissionKey): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}

/** Identity attached to `req.admin` once an ADMIN token has been verified. */
export interface AdminClaims {
  adminId: string;
  role: AdminRoleKey;
  permissions: readonly PermissionKey[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminClaims;
    }
  }
}

export interface CreateAdminAuthMiddlewareOptions {
  /** RS256 PUBLIC key PEM - the SAME keypair user access tokens use. This
   * package never sees or handles the private key (only admin-service,
   * which mints these tokens, holds it). */
  publicKey: string;
  issuer: string;
  audience: string;
  logger?: { debug: (obj: unknown, msg?: string) => void };
}

interface AdminTokenClaims {
  sub: string;
  iss: string;
  aud: string;
  typ: string;
  role?: string;
}

function sendUnauthorized(res: Response): void {
  const body: ApiError = {
    error: { code: 'UNAUTHORIZED', message: 'Invalid or missing authentication token' },
  };
  res.status(401).json(body);
}

function sendForbidden(res: Response): void {
  const body: ApiError = {
    error: { code: 'FORBIDDEN', message: 'Not authorized to perform this action' },
  };
  res.status(403).json(body);
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

function isAdminRoleKey(value: string | undefined): value is AdminRoleKey {
  return !!value && (ADMIN_ROLE_KEYS as readonly string[]).includes(value);
}

export interface AdminAuthMiddleware {
  /**
   * Verifies an RS256 `typ:"admin"` token (rejects `typ:"access"`/
   * `typ:"service"`/anything else - a customer or service token must
   * NEVER pass this check) and attaches `req.admin`. If `permission` is
   * given, additionally requires the admin's role to grant it (403
   * FORBIDDEN otherwise) - resolved from the IN-CODE `ROLE_PERMISSIONS`
   * map (no DB call per request), keyed by the token's own `role` claim.
   */
  requireAdmin(permission?: PermissionKey): RequestHandler;
}

/**
 * Builds `{ requireAdmin }` configured with the shared RS256 public key -
 * same stateless-factory shape as `createAuthMiddleware`/
 * `createServiceAuthMiddleware` in this package.
 */
export function createAdminAuthMiddleware(
  options: CreateAdminAuthMiddlewareOptions,
): AdminAuthMiddleware {
  const { publicKey, issuer, audience, logger } = options;

  function verifyAdminToken(token: string): AdminClaims | undefined {
    try {
      const decoded = verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer,
        audience,
      }) as AdminTokenClaims;

      // The actual admin/customer/service separation boundary: a customer
      // access token (typ:"access") or a service token presented here
      // (impossible anyway - services sign HS256, this verifies RS256
      // only, but the typ check is defense in depth) is rejected outright.
      if (decoded.typ !== 'admin' || !isAdminRoleKey(decoded.role)) {
        logger?.debug({ typ: decoded.typ }, 'admin-auth: rejected non-admin token');
        return undefined;
      }

      return {
        adminId: decoded.sub,
        role: decoded.role,
        permissions: resolvePermissions(decoded.role),
      };
    } catch (err) {
      logger?.debug({ err }, 'admin-auth: token verification failed');
      return undefined;
    }
  }

  function requireAdmin(permission?: PermissionKey): RequestHandler {
    return (req, res, next) => {
      const token = extractBearerToken(req);
      if (!token) {
        sendUnauthorized(res);
        return;
      }
      const claims = verifyAdminToken(token);
      if (!claims) {
        sendUnauthorized(res);
        return;
      }
      if (permission && !claims.permissions.includes(permission)) {
        sendForbidden(res);
        return;
      }
      req.admin = claims;
      next();
    };
  }

  return { requireAdmin };
}
