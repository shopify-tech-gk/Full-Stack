import { AppError } from '@youmart/errors';
import type { ShippingProvider } from './provider.interface';
import { manualProvider } from './manual.provider';

/**
 * The multi-courier provider registry (Ch5.4 FOUNDATION). A real courier
 * adapter is added post-launch by writing ONE file implementing
 * `ShippingProvider` (see manual.provider.ts's doc comment) and calling
 * `registerProvider('delhivery', delhiveryProvider)` once at that
 * service's startup (index.ts) - no change to this file is needed, only
 * an additional registration call.
 */
const providers = new Map<string, ShippingProvider>();

export function registerProvider(name: string, impl: ShippingProvider): void {
  providers.set(name, impl);
}

export function getProvider(name: string): ShippingProvider {
  const provider = providers.get(name);
  if (!provider) {
    throw new AppError('INTERNAL_ERROR', 500, `No shipping provider registered for "${name}"`);
  }
  return provider;
}

// LAUNCH: only the manual provider is ever registered. Real courier
// adapters (Delhivery, Shiprocket, DTDC, Xpressbees, ...) register
// themselves here post-launch, one call each, alongside this line - never
// replacing it (manual fulfillment remains available as a fallback).
registerProvider('manual', manualProvider);
