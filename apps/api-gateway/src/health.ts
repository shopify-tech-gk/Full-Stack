import type { Request, Response } from 'express';
import { config } from './config';

const HEALTH_CHECK_TIMEOUT_MS = 3_000;

/** Every downstream service, including inventory/notification (they still
 * get health-checked even though they have no PUBLIC proxy route - this
 * is an operational view, not a public API surface). */
const SERVICES: Record<string, string> = {
  auth: config.services.auth,
  catalog: config.services.catalog,
  inventory: config.services.inventory,
  cart: config.services.cart,
  order: config.services.order,
  payment: config.services.payment,
  seller: config.services.seller,
  settlement: config.services.settlement,
  logistics: config.services.logistics,
  returns: config.services.returns,
  address: config.services.address,
  notification: config.services.notification,
  search: config.services.search,
  invoice: config.services.invoice,
};

async function pingService(
  baseUrl: string,
): Promise<{ status: 'up' | 'down'; httpStatus?: number }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: controller.signal });
    return { status: res.ok ? 'up' : 'down', httpStatus: res.status };
  } catch {
    return { status: 'down' };
  } finally {
    clearTimeout(timeout);
  }
}

/** Gateway's OWN liveness - always 200 as long as the process is up (it
 * has no DB/queue dependency to be unhealthy about). */
export function gatewayHealth(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', service: 'api-gateway' });
}

/** Aggregated health of every downstream service - plain `fetch` with a
 * timeout per service (NOT routed through the proxy machinery), run in
 * parallel. Always responds 200 itself; the per-service `status` field is
 * what conveys up/down (this endpoint is a diagnostic summary, not itself
 * a health gate). */
export async function servicesHealth(_req: Request, res: Response): Promise<void> {
  const entries = Object.entries(SERVICES);
  const results = await Promise.all(
    entries.map(async ([name, baseUrl]) => [name, await pingService(baseUrl)] as const),
  );
  const services = Object.fromEntries(results);
  res.status(200).json({ status: 'ok', services });
}
