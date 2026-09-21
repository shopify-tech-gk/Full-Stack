import type { ShippingProvider } from './provider.interface';

/**
 * LAUNCH DEFAULT (see config.ts's `DEFAULT_SHIPPING_PROVIDER=manual`).
 * `createShipment` performs NO external call at all - it just echoes back
 * the admin/seller-entered `awbNumber` as both the AWB and the generic
 * provider reference; "creating a shipment" here means persisting that
 * hand-entered data (logistics.service.ts does the actual DB write).
 *
 * `getTracking` is intentionally a stub that is NEVER actually called for
 * the manual flow - logistics.service.ts's own `getTracking` reads OUR
 * OWN `tracking_event` rows directly (they're entered manually via
 * `addTrackingEvent`/`updateShipmentStatus`, not fetched from anywhere).
 * This method exists only to satisfy the `ShippingProvider` interface so a
 * real courier adapter has an identical shape to implement.
 *
 * A REAL courier adapter (e.g. `delhivery.provider.ts`) would instead call
 * that courier's actual API in `createShipment`/`getTracking`/
 * `cancelShipment`, and be registered under its own name via
 * `registerProvider('delhivery', delhiveryProvider)` (see `registry.ts`) -
 * no change to this file, the registry, or logistics.service.ts needed.
 */
export const manualProvider: ShippingProvider = {
  name: 'manual',

  async createShipment(input) {
    return {
      providerRef: input.awbNumber,
      awb: input.awbNumber,
      status: 'CREATED',
    };
  },

  async getTracking() {
    return { status: 'UNKNOWN', events: [] };
  },

  async cancelShipment() {
    // No external call - cancellation is just our own shipment.status
    // update (logistics.service.ts).
  },
};
