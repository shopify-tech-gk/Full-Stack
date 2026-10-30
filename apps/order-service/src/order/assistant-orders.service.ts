import { prisma } from '../db';
import { logisticsClient } from '../serviceClients';
import { decimalToMoney } from './order.service';

// v1.17 AI help: a customer's recent orders in a compact, model-friendly shape (SERVICE-ONLY -
// notification-service's assistant asks for the signed-in customer's OWN orders by user id).
// No addresses beyond city, no payment ids.

export interface AssistantOrderView {
  orderNumber: string;
  placedAt: string;
  /** What the customer sees: Awaiting payment / Processing / Packed / Shipped / Delivered / Cancelled. */
  status: string;
  paymentMethod: 'ONLINE' | 'COD';
  paid: boolean;
  total: string;
  deliveryCharge: string;
  couponDiscount: string;
  shipToCity: string | null;
  cancelRequest: { status: string; reason: string } | null;
  items: Array<{
    title: string;
    quantity: number;
    status: string;
    shipment: { carrier: string | null; trackingNumber: string | null; status: string } | null;
  }>;
}

const ITEM_LABEL: Record<string, string> = {
  PENDING: 'Awaiting payment',
  CONFIRMED: 'Processing (not packed yet)',
  PACKED: 'Packed, ready to ship',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

function orderLabel(status: string, items: string[]): string {
  if (status === 'PENDING_PAYMENT') return 'Awaiting payment';
  if (status === 'CANCELLED') return 'Cancelled';
  const live = items.filter((s) => s !== 'CANCELLED' && s !== 'RETURNED');
  if (live.length === 0) return items.includes('RETURNED') ? 'Returned' : 'Cancelled';
  if (live.includes('CONFIRMED')) return 'Processing';
  if (live.includes('PACKED')) return 'Packed';
  if (live.includes('SHIPPED')) return 'Shipped';
  return 'Delivered';
}

export async function listOrdersForAssistant(
  userId: string,
  limit = 8,
): Promise<AssistantOrderView[]> {
  const orders = await prisma.order.findMany({
    where: { userId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Math.max(limit, 1), 15),
    include: {
      items: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
      cancelRequests: {
        where: { deletedAt: null, orderItemId: null },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
  });

  return Promise.all(
    orders.map(async (o) => ({
      orderNumber: o.orderNumber,
      placedAt: o.createdAt.toISOString(),
      status: orderLabel(
        o.status,
        o.items.map((i) => i.sellerStatus),
      ),
      paymentMethod: o.paymentMethod,
      paid: o.status === 'CONFIRMED' && o.paymentMethod === 'ONLINE',
      total: decimalToMoney(o.grandTotal),
      deliveryCharge: decimalToMoney(o.shippingTotal),
      couponDiscount: decimalToMoney(o.discountTotal),
      shipToCity: o.shipCity,
      cancelRequest: o.cancelRequests[0]
        ? { status: o.cancelRequests[0].status, reason: o.cancelRequests[0].reason }
        : null,
      items: await Promise.all(
        o.items.map(async (i) => {
          const shipped = ['SHIPPED', 'DELIVERED', 'RETURNED'].includes(i.sellerStatus);
          const shipment = shipped
            ? await logisticsClient.getOrderItemTracking(i.id).catch(() => null)
            : null;
          return {
            title: i.titleSnapshot,
            quantity: i.quantity,
            status: ITEM_LABEL[i.sellerStatus] ?? i.sellerStatus,
            shipment: shipment
              ? {
                  carrier: shipment.carrier,
                  trackingNumber: shipment.awbNumber,
                  status: shipment.status,
                }
              : null,
          };
        }),
      ),
    })),
  );
}
