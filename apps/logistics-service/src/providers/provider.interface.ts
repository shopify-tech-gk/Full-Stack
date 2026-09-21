/**
 * The multi-courier FOUNDATION (Ch5.4). Every real courier integration
 * (Delhivery, Shiprocket, DTDC, Xpressbees, ...) is added POST-LAUNCH as a
 * single file implementing this interface, registered under its own name
 * via the provider registry (`registry.ts`) - no change to
 * logistics.service.ts's business logic, routes, or the DB schema is
 * needed when that happens. At launch, ONLY `manual.provider.ts`
 * (`ManualProvider`) is registered - see config.ts's
 * `DEFAULT_SHIPPING_PROVIDER`.
 *
 * Method shapes are sized to fit what a real courier API actually needs
 * (a provider reference/AWB/label on creation, a raw tracking-event feed,
 * cancellation) WITHOUT forcing every provider to support rate-shopping -
 * `checkServiceability`/`getRate` are declared OPTIONAL specifically so
 * `ManualProvider` (which has no rates/serviceability to check) can omit
 * them entirely while the interface stays ready for a real courier that
 * does.
 */

/**
 * PLATFORM: YouMart itself ships the item (the only mode used at launch -
 * single-vendor). SELLER: the owning seller ships it themselves - kept as
 * a field on every shipment now so no schema/data migration is needed once
 * the marketplace opens; no routing/business logic branches on it yet.
 */
export type FulfillmentMode = 'PLATFORM' | 'SELLER';

export interface CreateShipmentInput {
  orderItemId: string;
  carrier?: string;
  awbNumber?: string;
  fulfillmentMode: FulfillmentMode;
}

export interface ProviderShipmentResult {
  /** Generic provider-side reference (Shipment.shiprocketOrderId reuses
   * this column name for any provider, per the Ch2 schema - see
   * logistics.service.ts's comment on that reuse). */
  providerRef?: string;
  awb?: string;
  labelUrl?: string;
  status: string;
}

export interface ProviderTrackingEvent {
  status: string;
  location?: string;
  occurredAt: string;
}

export interface ProviderTrackingResult {
  status: string;
  events: ProviderTrackingEvent[];
}

export interface ShipmentRef {
  awb?: string;
  providerRef?: string;
}

export interface ServiceabilityInput {
  pincode: string;
  weightGrams?: number;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  estimatedDays?: number;
}

export interface RateInput {
  pincode: string;
  weightGrams?: number;
}

export interface RateResult {
  amount: string;
  currency: string;
}

export interface ShippingProvider {
  readonly name: string;
  createShipment(input: CreateShipmentInput): Promise<ProviderShipmentResult>;
  getTracking(ref: ShipmentRef): Promise<ProviderTrackingResult>;
  cancelShipment(ref: ShipmentRef): Promise<void>;
  /** OPTIONAL - real couriers use these for rate-shopping; ManualProvider
   * doesn't implement them (no external rates to check). */
  checkServiceability?(input: ServiceabilityInput): Promise<ServiceabilityResult>;
  getRate?(input: RateInput): Promise<RateResult>;
}
