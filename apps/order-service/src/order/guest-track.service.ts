import { timingSafeEqual } from 'node:crypto';
import { AppError } from '@youmart/errors';
import { normalizePhoneE164 } from '@youmart/shared-utils';
import type { ShipmentStatusValue } from '@youmart/service-client';
import { prisma } from '../db';
import { logisticsClient } from '../serviceClients';
import type { OrderItemStatusValue, OrderStatusValue } from './order.service';

export interface GuestTrackingEvent {
  status: string;
  location: string | null;
  occurredAt: string;
}

export interface GuestTrackingItem {
  title: string;
  quantity: number;
  sellerStatus: OrderItemStatusValue;
  shipment: {
    status: ShipmentStatusValue;
    carrier: string | null;
    awbNumber: string | null;
    events: GuestTrackingEvent[];
  } | null;
}

/**
 * The PUBLIC guest view - deliberately limited: no order/item ids, no prices or totals, no
 * payment data, and of the address only city + state. Everything else needs the logged-in
 * `GET /orders/:id`.
 */
export interface GuestTrackingView {
  orderNumber: string;
  status: OrderStatusValue;
  placedAt: string;
  shipTo: { city: string; state: string } | null;
  items: GuestTrackingItem[];
  timeline: { status: OrderStatusValue; at: string }[];
}

const NOT_FOUND_MESSAGE = 'No order matches that order number and phone number';

const HAS_SHIPMENT: OrderItemStatusValue[] = ['SHIPPED', 'DELIVERED', 'RETURNED'];

function samePhone(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/**
 * Guest order tracking by orderNumber + phone. BOTH must match: the phone is compared against
 * the order's shipping-address snapshot (the number the customer typed at checkout, E.164).
 * Unknown order, wrong phone, unparsable phone and pre-Ch6.1 orders without a snapshot all
 * produce the identical 404, so the endpoint can't be used to discover which order numbers
 * exist. Brute-forcing the phone for a known order number is capped by the per-order-number
 * limiter on the route plus the gateway's per-IP limiter.
 */
export async function trackOrderAsGuest(
  orderNumber: string,
  phone: string,
): Promise<GuestTrackingView> {
  const normalizedPhone = normalizePhoneE164(phone);
  const order = await prisma.order.findFirst({
    where: { orderNumber: orderNumber.trim().toUpperCase(), deletedAt: null },
    include: {
      items: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      statusHistory: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
    },
  });

  if (
    !order ||
    !order.shipPhone ||
    !normalizedPhone ||
    !samePhone(order.shipPhone, normalizedPhone)
  ) {
    throw new AppError('NOT_FOUND', 404, NOT_FOUND_MESSAGE);
  }

  const items = await Promise.all(
    order.items.map(async (item): Promise<GuestTrackingItem> => {
      let shipment: GuestTrackingItem['shipment'] = null;
      if (HAS_SHIPMENT.includes(item.sellerStatus)) {
        try {
          const detail = await logisticsClient.getOrderItemTracking(item.id);
          shipment = {
            status: detail.status,
            carrier: detail.carrier,
            awbNumber: detail.awbNumber,
            events: detail.events.map((e) => ({
              status: e.status,
              location: e.location,
              occurredAt: e.occurredAt,
            })),
          };
        } catch {
          // Tracking is supplementary - a logistics hiccup must not hide the order status.
          shipment = null;
        }
      }
      return {
        title: item.titleSnapshot,
        quantity: item.quantity,
        sellerStatus: item.sellerStatus,
        shipment,
      };
    }),
  );

  return {
    orderNumber: order.orderNumber,
    status: order.status,
    placedAt: order.createdAt.toISOString(),
    shipTo:
      order.shipCity && order.shipState ? { city: order.shipCity, state: order.shipState } : null,
    items,
    timeline: order.statusHistory.map((h) => ({
      status: h.toStatus,
      at: h.createdAt.toISOString(),
    })),
  };
}
