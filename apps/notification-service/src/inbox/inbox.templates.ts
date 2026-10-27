// v1.15: the customer's in-app inbox (the bell) - what each event says. One entry per
// templateKey; `data` is what the producing service sent with the job.

export type InboxKind = 'ORDER' | 'REFUND' | 'RETURN' | 'SUPPORT' | 'OFFER' | 'ACCOUNT';

export interface InboxContent {
  kind: InboxKind;
  title: string;
  body: string;
}

const str = (v: unknown, fallback = ''): string =>
  typeof v === 'string' && v.trim() ? v.trim() : fallback;

/** "₹1,23,456" (Indian grouping, paise dropped when whole). */
function rupees(v: unknown): string {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `₹${n.toLocaleString('en-IN', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "iPhone 13 Pro" / "iPhone 13 Pro and 2 more" / "Your order". */
function what(d: Record<string, unknown>): string {
  const title = str(d.itemTitle);
  if (!title) return 'Your order';
  const short = title.length > 60 ? `${title.slice(0, 57)}…` : title;
  const more = Number(d.moreItems ?? 0);
  return more > 0 ? `${short} and ${more} more` : short;
}

const TEMPLATES: Record<string, (d: Record<string, unknown>) => InboxContent> = {
  ORDER_PLACED: (d) => ({
    kind: 'ORDER',
    title: 'Order confirmed',
    body:
      d.paymentMethod === 'COD'
        ? `${what(d)} - order ${str(d.orderNumber)} is confirmed. Pay ${rupees(d.amount)} in cash when it arrives.`
        : `${what(d)} - order ${str(d.orderNumber)} for ${rupees(d.amount)} is confirmed. We'll tell you when it ships.`,
  }),
  ORDER_PACKED: (d) => ({
    kind: 'ORDER',
    title: 'Packed and ready to ship',
    body: `${what(d)} from order ${str(d.orderNumber)} is packed and will be handed to the courier soon.`,
  }),
  ORDER_SHIPPED: (d) => {
    const carrier = str(d.carrier) && d.carrier !== 'N/A' ? ` with ${str(d.carrier)}` : '';
    const awb = str(d.awb) && d.awb !== 'N/A' ? ` Tracking no. ${str(d.awb)}.` : '';
    return {
      kind: 'ORDER',
      title: 'Shipped',
      body: `${what(d)} is on its way${carrier}.${awb}`,
    };
  },
  ORDER_DELIVERED: (d) => ({
    kind: 'ORDER',
    title: 'Delivered',
    body: `${what(d)} from order ${str(d.orderNumber)} was delivered. Liked it? Rate it and help other shoppers.`,
  }),
  ORDER_CANCELLED: (d) => ({
    kind: 'ORDER',
    title: 'Order cancelled',
    body:
      d.refundAmount && Number(d.refundAmount) > 0
        ? `Order ${str(d.orderNumber)} was cancelled. ${rupees(d.refundAmount)} is being refunded to your YouMart Wallet.`
        : `Order ${str(d.orderNumber)} was cancelled.${str(d.note) ? ` ${str(d.note)}` : ''}`,
  }),
  CANCEL_REQUEST_DECLINED: (d) => ({
    kind: 'ORDER',
    title: 'Cancellation not possible',
    body: `We couldn't cancel order ${str(d.orderNumber)}${
      str(d.note) ? `: ${str(d.note)}` : ' - it has already moved too far along.'
    } You can return it after delivery.`,
  }),
  REFUND_PROCESSED: (d) => ({
    kind: 'REFUND',
    title: `Refund of ${rupees(d.amount)} done`,
    body: `${rupees(d.amount)} for order ${str(d.orderNumber)} is in your YouMart Wallet - use it on your next order.`,
  }),
  RETURN_APPROVED: (d) => ({
    kind: 'RETURN',
    title: 'Return approved',
    body: `Your return of ${what(d)} is approved. Keep it packed - our courier will pick it up soon.`,
  }),
  RETURN_PICKED_UP: (d) => ({
    kind: 'RETURN',
    title: 'Return picked up',
    body: `We've collected ${what(d)}. Your refund follows once it reaches us.`,
  }),
  RETURN_REJECTED: (d) => ({
    kind: 'RETURN',
    title: 'Return not approved',
    body: `We couldn't accept the return of ${what(d)}${str(d.note) ? `: ${str(d.note)}` : '.'}`,
  }),
  // v1.17 Refer & Earn: a friend they referred got their order - 2.5% added to the wallet.
  // REFUND kind with no order, so tapping it opens the Wallet.
  REFERRAL_REWARD: (d) => ({
    kind: 'REFUND',
    title: `${rupees(d.amount)} referral reward added`,
    body: `A friend you referred got their order, so ${rupees(d.amount)} has been added to your YouMart Wallet. Keep sharing your code!`,
  }),
  // v1.17 Admin marked a "Request restock" as restocked.
  RESTOCK_AVAILABLE: (d) => ({
    kind: 'OFFER',
    title: 'Back in stock for you',
    body: `${str(d.label, str(d.item, 'What you asked for'))} is now available on YouMart. Tap to have a look.`,
  }),
  SUPPORT_REPLY: (d) => ({
    kind: 'SUPPORT',
    title: 'YouMart Support replied',
    body: `${str(d.reference)}: ${str(d.reply).slice(0, 180)}${str(d.reply).length > 180 ? '…' : ''}`,
  }),
};

/** null = this event has no inbox message. */
export function renderInbox(
  templateKey: string,
  data: Record<string, unknown>,
): InboxContent | null {
  const render = TEMPLATES[templateKey];
  return render ? render(data) : null;
}
