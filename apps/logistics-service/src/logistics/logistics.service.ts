import { AppError } from '@youmart/errors';
import { enqueueNotification } from '@youmart/notifications-client';
import { prisma } from '../db';
import { config } from '../config';
import { orderClient, authClient } from '../serviceClients';
import { getProvider } from '../providers/registry';
import type { FulfillmentMode } from '../providers/provider.interface';
import type { CreateShipmentBody } from './logistics.schema';

export type ShipmentStatusValue =
  'CREATED' | 'PICKED_UP' | 'IN_TRANSIT' | 'DELIVERED' | 'RTO' | 'CANCELLED';

export interface ShipmentView {
  id: string;
  orderItemId: string;
  carrier: string | null;
  awbNumber: string | null;
  status: ShipmentStatusValue;
  /** `Shipment.shiprocketOrderId` at the DB layer (Ch2 column name,
   * unchanged) - reused as a GENERIC provider reference for any courier,
   * never renamed at the schema level, only in application-facing usage. */
  providerRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TrackingEventView {
  id: string;
  status: string;
  location: string | null;
  occurredAt: string;
}

export interface ShipmentDetailView extends ShipmentView {
  events: TrackingEventView[];
}

function toShipmentView(row: {
  id: string;
  orderItemId: string;
  carrier: string | null;
  awbNumber: string | null;
  status: ShipmentStatusValue;
  shiprocketOrderId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ShipmentView {
  return {
    id: row.id,
    orderItemId: row.orderItemId,
    carrier: row.carrier,
    awbNumber: row.awbNumber,
    status: row.status,
    providerRef: row.shiprocketOrderId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toTrackingEventView(row: {
  id: string;
  status: string;
  location: string | null;
  occurredAt: Date;
}): TrackingEventView {
  return {
    id: row.id,
    status: row.status,
    location: row.location,
    occurredAt: row.occurredAt.toISOString(),
  };
}

async function findActiveShipment(shipmentId: string) {
  const shipment = await prisma.shipment.findFirst({ where: { id: shipmentId, deletedAt: null } });
  if (!shipment) {
    throw new AppError('NOT_FOUND', 404, 'Shipment not found');
  }
  return shipment;
}

/**
 * Maps a raw tracking-event status string (courier-provided, or
 * hand-typed for the manual flow) onto our `ShipmentStatus` enum -
 * case-insensitive, a small fixed vocabulary today. Anything unrecognized
 * returns `null` (the tracking_event is still recorded verbatim - it just
 * doesn't drive a shipment/order_item status change). A real courier
 * adapter's OWN status vocabulary would be translated to this same set in
 * its own file, before ever reaching this function.
 */
function mapTrackingStatus(rawStatus: string): ShipmentStatusValue | null {
  const normalized = rawStatus.trim().toUpperCase();
  const known: Record<string, ShipmentStatusValue> = {
    CREATED: 'CREATED',
    PICKED_UP: 'PICKED_UP',
    'PICKED UP': 'PICKED_UP',
    IN_TRANSIT: 'IN_TRANSIT',
    'IN TRANSIT': 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    RTO: 'RTO',
    CANCELLED: 'CANCELLED',
  };
  return known[normalized] ?? null;
}

const ALLOWED_SHIPMENT_TRANSITIONS: Record<ShipmentStatusValue, ShipmentStatusValue[]> = {
  CREATED: ['PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['IN_TRANSIT', 'RTO', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'RTO'],
  DELIVERED: [],
  RTO: [],
  CANCELLED: [],
};

/**
 * Applies a shipment status change: validates the transition, records a
 * tracking_event for it, updates shipment.status, and - ONLY when the new
 * status is DELIVERED - drives order_item.seller_status SHIPPED->DELIVERED
 * via order-service's internal endpoint (Ch5.4). This is THE hand-off
 * that makes an item settleable (settlement-service, Ch5.3, settles
 * DELIVERED items) - so every path that can reach DELIVERED (manual
 * status update, or a tracking event that maps to DELIVERED) funnels
 * through this one function.
 */
async function applyShipmentStatus(
  shipmentId: string,
  nextStatus: ShipmentStatusValue,
  authToken: string,
  eventLocation?: string,
  occurredAt?: Date,
): Promise<ShipmentView> {
  const shipment = await findActiveShipment(shipmentId);

  if (shipment.status === nextStatus) {
    return toShipmentView(shipment);
  }

  const allowed = ALLOWED_SHIPMENT_TRANSITIONS[shipment.status];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot transition shipment status from ${shipment.status} to ${nextStatus}`,
    );
  }

  await prisma.trackingEvent.create({
    data: {
      shipmentId,
      status: nextStatus,
      location: eventLocation ?? null,
      occurredAt: occurredAt ?? new Date(),
    },
  });

  const updated = await prisma.shipment.update({
    where: { id: shipmentId },
    data: { status: nextStatus },
  });

  if (nextStatus === 'DELIVERED') {
    await orderClient.setSellerItemStatus(shipment.orderItemId, 'DELIVERED', authToken);
  }

  return toShipmentView(updated);
}

/**
 * Creates a shipment for an order_item currently PACKED (fetched via
 * order-client - 409 if it isn't). `awbNumber` uniqueness (when given) is
 * a hand-added partial unique index (WHERE deleted_at IS NULL) - checked
 * here (best-effort, documented small race, same convention as catalog/
 * seller-service's slug/display-name checks) with the DB index as the
 * real backstop. Advances order_item.seller_status PACKED->SHIPPED via
 * order-service's internal endpoint, and records an initial CREATED
 * tracking_event.
 *
 * `actorSellerId`, when provided (the seller-fulfilled path, Ch5.4
 * FOUNDATION, not exercised at launch), must match the order_item's own
 * `sellerId` - 404 (not 403) otherwise, so a seller can't learn that an
 * order_item belonging to someone else even exists. `undefined` (the
 * platform/admin path - what launch actually uses) skips this check
 * entirely, since YouMart itself may ship for any seller.
 */
export async function createShipment(
  input: CreateShipmentBody,
  authToken: string,
  actorSellerId?: string,
): Promise<ShipmentView> {
  const item = await orderClient.getInternalOrderItem(input.orderItemId, authToken);

  if (actorSellerId && item.sellerId !== actorSellerId) {
    throw new AppError('NOT_FOUND', 404, 'Order item not found');
  }

  if (item.sellerStatus !== 'PACKED') {
    throw new AppError(
      'CONFLICT',
      409,
      `Cannot create a shipment for an order item in status ${item.sellerStatus} - it must be PACKED`,
    );
  }

  if (input.awbNumber) {
    const clash = await prisma.shipment.findFirst({
      where: { awbNumber: input.awbNumber, deletedAt: null },
    });
    if (clash) {
      throw new AppError('CONFLICT', 409, `AWB "${input.awbNumber}" is already in use`);
    }
  }

  const fulfillmentMode: FulfillmentMode = input.fulfillmentMode ?? 'PLATFORM';
  const provider = getProvider(config.defaultShippingProvider);
  const providerResult = await provider.createShipment({
    orderItemId: input.orderItemId,
    carrier: input.carrier,
    awbNumber: input.awbNumber,
    fulfillmentMode,
  });

  const created = await prisma.$transaction(async (tx) => {
    const shipment = await tx.shipment.create({
      data: {
        orderItemId: input.orderItemId,
        carrier: input.carrier ?? null,
        awbNumber: input.awbNumber ?? null,
        status: 'CREATED',
        shiprocketOrderId: providerResult.providerRef ?? null,
      },
    });

    await tx.trackingEvent.create({
      data: { shipmentId: shipment.id, status: 'CREATED', occurredAt: new Date() },
    });

    return shipment;
  });

  await orderClient.setSellerItemStatus(input.orderItemId, 'SHIPPED', authToken);

  // Shipping-update notification (Ch6.2, channels rewired Ch6.2b to
  // WhatsApp+email - SMS dropped as a target) - BEST-EFFORT, NEVER blocks
  // or fails shipment creation: a notification problem must never undo a
  // real fulfillment action. The WhatsApp leg needs its OWN approved
  // template (MSG91_WHATSAPP_SHIPPING_TEMPLATE, not yet approved) - it
  // fails honestly until Vijesh sets one; email (buyer's email, resolved
  // via authClient - cross-schema isolation, logistics_svc cannot read
  // the auth schema directly) is the reliable leg meanwhile.
  try {
    const orderView = await orderClient.getInternalOrder(item.orderId, authToken);
    const notifyData = {
      orderNumber: orderView.orderNumber,
      awb: input.awbNumber ?? providerResult.providerRef ?? 'N/A',
      carrier: input.carrier ?? 'N/A',
    };
    if (orderView.shippingAddress?.phone) {
      await enqueueNotification({
        channel: 'WHATSAPP',
        to: orderView.shippingAddress.phone,
        templateKey: 'SHIPPING_UPDATE',
        data: notifyData,
        userId: orderView.userId,
      });
    }
    const contact = await authClient.getUserContact(orderView.userId, authToken);
    if (contact.email) {
      await enqueueNotification({
        channel: 'EMAIL',
        to: contact.email,
        templateKey: 'SHIPPING_UPDATE',
        data: notifyData,
        userId: orderView.userId,
      });
    }
  } catch (notifyErr: unknown) {
    // eslint-disable-next-line no-console
    console.error('failed to enqueue shipping-update notification(s)', notifyErr);
  }

  return toShipmentView(created);
}

/**
 * Records a tracking event. If its raw `status` maps (via
 * `mapTrackingStatus`) onto a KNOWN `ShipmentStatus`, this flows through
 * `applyShipmentStatus` - which validates the transition, advances
 * `shipment.status`, and records the tracking_event for it (so e.g. a
 * "PICKED_UP" event also moves the shipment's own status forward, not
 * just DELIVERED). ONLY when the mapped status is specifically DELIVERED
 * does this additionally drive order_item.seller_status
 * SHIPPED->DELIVERED (making the item settleable) - see
 * applyShipmentStatus's doc comment. Any unrecognized raw status is
 * recorded as a plain, non-driving tracking_event (the courier's own text
 * preserved verbatim) - it doesn't change anything.
 */
export async function addTrackingEvent(
  shipmentId: string,
  input: { status: string; location?: string; occurredAt?: Date },
  authToken: string,
): Promise<ShipmentDetailView> {
  await findActiveShipment(shipmentId);

  const mapped = mapTrackingStatus(input.status);

  if (mapped) {
    await applyShipmentStatus(shipmentId, mapped, authToken, input.location, input.occurredAt);
  } else {
    await prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: input.status,
        location: input.location ?? null,
        occurredAt: input.occurredAt ?? new Date(),
      },
    });
  }

  return getTracking(shipmentId);
}

/**
 * Admin manual status update (CREATED->PICKED_UP->IN_TRANSIT->DELIVERED,
 * or ->RTO/CANCELLED - see ALLOWED_SHIPMENT_TRANSITIONS). Records a
 * tracking_event for the transition and, when the new status is
 * DELIVERED, drives order_item.seller_status via applyShipmentStatus.
 */
export async function updateShipmentStatus(
  shipmentId: string,
  status: ShipmentStatusValue,
  authToken: string,
): Promise<ShipmentView> {
  return applyShipmentStatus(shipmentId, status, authToken);
}

/** Convenience wrapper - "mark this shipment DELIVERED right now". */
export async function markDelivered(shipmentId: string, authToken: string): Promise<ShipmentView> {
  return applyShipmentStatus(shipmentId, 'DELIVERED', authToken);
}

export async function getShipmentByOrderItem(orderItemId: string): Promise<ShipmentView> {
  const shipment = await prisma.shipment.findFirst({
    where: { orderItemId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  });
  if (!shipment) {
    throw new AppError('NOT_FOUND', 404, 'No shipment for this order item');
  }
  return toShipmentView(shipment);
}

export async function getTracking(shipmentId: string): Promise<ShipmentDetailView> {
  const shipment = await findActiveShipment(shipmentId);
  const events = await prisma.trackingEvent.findMany({
    where: { shipmentId, deletedAt: null },
    orderBy: { occurredAt: 'asc' },
  });
  return { ...toShipmentView(shipment), events: events.map(toTrackingEventView) };
}
