import type { Express, Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { buildApiError } from '@youmart/errors';
import { config } from './config';
import { logger } from './logger';

/**
 * PUBLIC gateway routing table - `/api/<prefix>` -> the owning service's
 * base URL. `pathRewrite` strips ONLY the leading `/api` (every downstream
 * service already mounts its own routers at a path matching this prefix,
 * e.g. catalog-service's own `app.use('/catalog', catalogRouter)`), so
 * `/api/catalog/products` reaches catalog-service's real
 * `/catalog/products` unchanged.
 *
 * `notification-service` is DELIBERATELY NOT routed here at all - it
 * exposes no HTTP surface whatsoever (pure BullMQ consumer), nothing for
 * a frontend to call. `inventory-service` (4003) IS routed as of Ch6.7a:
 * its one admin endpoint (`POST /:skuId/set`) is now real-RBAC-gated
 * (`requireAdmin('inventory.manage')`) and an admin dashboard needs to
 * reach it; its OTHER route (`GET /:skuId`) stays SERVICE-ONLY
 * (`requireServiceAuth`, Ch6.5, HS256) - reachable BY PATH through the
 * gateway but still rejects any customer/admin RS256 token, since that's
 * a completely different alg+secret the service itself verifies. No
 * `/internal/*` segment guards THIS one (it was never under `/internal`),
 * but the service's own auth boundary still holds regardless.
 *
 * FIVE extra `/api/admin/<x>` prefixes exist because admin/seller/
 * settlement/returns/invoice-service each mount an admin sub-router at a
 * literal `/admin/<service>` path (not `/<service>/admin`) - a real,
 * pre-existing backend inconsistency this table simply mirrors rather
 * than "fixing" (fixing it would mean renaming real routes in 4
 * services, out of scope). `/api/admin` (admin-service itself - login/
 * me/admin management) is registered LAST in this array so it never
 * swallows the four more specific `/api/admin/<x>` prefixes above it
 * (http-proxy-middleware tries routes in registration order; the first
 * `pathFilter` match wins).
 */
const ROUTES: Array<{ prefix: string; target: string }> = [
  { prefix: '/api/auth', target: config.services.auth },
  { prefix: '/api/catalog', target: config.services.catalog },
  { prefix: '/api/inventory', target: config.services.inventory },
  { prefix: '/api/cart', target: config.services.cart },
  { prefix: '/api/orders', target: config.services.order },
  { prefix: '/api/payments', target: config.services.payment },
  { prefix: '/api/sellers', target: config.services.seller },
  { prefix: '/api/logistics', target: config.services.logistics },
  { prefix: '/api/returns', target: config.services.returns },
  { prefix: '/api/addresses', target: config.services.address },
  { prefix: '/api/search', target: config.services.search },
  { prefix: '/api/invoices', target: config.services.invoice },
  { prefix: '/api/settlements', target: config.services.settlement },
  { prefix: '/api/admin/sellers', target: config.services.seller },
  { prefix: '/api/admin/settlements', target: config.services.settlement },
  { prefix: '/api/admin/returns', target: config.services.returns },
  { prefix: '/api/admin/invoices', target: config.services.invoice },
  { prefix: '/api/admin', target: config.services.admin },
];

/**
 * `/internal/*` service-to-service endpoints (requireServiceAuth, Ch6.5)
 * must NEVER be reachable through this PUBLIC gateway, regardless of which
 * prefix a request otherwise matches - checked as a path-segment match
 * (`/internal` anywhere in the path, not just a prefix) so it can't be
 * bypassed by prefix trickery. This runs BEFORE any proxy is registered.
 */
function blockInternalPaths(req: Request, res: Response, next: NextFunction): void {
  if (/(^|\/)internal(\/|$)/.test(req.path)) {
    res.status(404).json(buildApiError('NOT_FOUND', 'Route not found'));
    return;
  }
  next();
}

/**
 * HYBRID auth (locked design, documented): the gateway does NOT verify
 * tokens itself (no JWT library dependency here at all) - every service
 * keeps doing real verification (defense in depth, per the task). This is
 * a CHEAP, OPTIONAL fast-fail: for prefixes where EVERY route requires a
 * logged-in user (no public reads at all - orders/cart/addresses, and the
 * four `/admin/*` prefixes), reject a request with NO `Authorization`
 * header at all before even proxying it. Mixed-auth prefixes (catalog,
 * search, sellers, logistics, returns, invoices, payments, settlements)
 * are deliberately left to PURE ROUTING - they have real public/optional-
 * auth reads alongside protected writes, so a path-prefix-level check
 * can't safely distinguish the two; the service's own `requireAuth`/
 * `optionalAuth` remains the actual security boundary there.
 */
const ALWAYS_AUTHENTICATED_PREFIXES = [
  '/api/orders',
  '/api/cart',
  '/api/addresses',
  '/api/inventory',
  '/api/admin/sellers',
  '/api/admin/settlements',
  '/api/admin/returns',
  '/api/admin/invoices',
];

function fastFailMissingAuth(req: Request, res: Response, next: NextFunction): void {
  const needsAuth = ALWAYS_AUTHENTICATED_PREFIXES.some((prefix) => req.path.startsWith(prefix));
  if (needsAuth && !req.headers.authorization) {
    res.status(401).json(buildApiError('UNAUTHORIZED', 'Invalid or missing authentication token'));
    return;
  }
  next();
}

/**
 * Downstream-unreachable -> a clean 502 ApiError, never a raw proxy
 * error/stack trace. `http-proxy-middleware` v3's error handler receives
 * the underlying Node error - logged for diagnosis, never echoed to the
 * client.
 */
function onProxyError(err: unknown, req: Request, res: Response): void {
  logger.error({ err, path: req.path }, 'downstream service unreachable');
  if (!res.headersSent) {
    res.status(502).json(buildApiError('INTERNAL_ERROR', 'Upstream service unavailable'));
  }
}

export function registerProxyRoutes(app: Express): void {
  app.use(blockInternalPaths);
  app.use(fastFailMissingAuth);

  for (const route of ROUTES) {
    // IMPORTANT: mounted with `pathFilter` (matched INSIDE the proxy
    // middleware) rather than `app.use(route.prefix, proxy)` - Express
    // strips the mount prefix from `req.url` for path-mounted middleware,
    // which would make `pathRewrite`'s `^/api` never match (the `/api/...`
    // part is already gone by the time the proxy sees it) and silently
    // send the WRONG path upstream (proved live: 404s from the target
    // service, not the gateway, since a route like `/products` doesn't
    // exist there - only `/catalog/products` does). Mounting at the
    // gateway root with `pathFilter` keeps `req.url` intact so
    // `pathRewrite: {'^/api': ''}` operates on the FULL original path.
    app.use(
      createProxyMiddleware({
        target: route.target,
        changeOrigin: true,
        pathFilter: route.prefix,
        pathRewrite: { '^/api': '' },
        on: {
          error: onProxyError as never,
        },
      }),
    );
  }
}

export { ROUTES };
