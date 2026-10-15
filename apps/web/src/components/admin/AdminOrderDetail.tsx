'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  CreditCard,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  Truck,
} from 'lucide-react';
import { formatMoney } from '@youmart/shared-client';
import {
  ITEM_STATUS_LABEL,
  adminFetch,
  can,
  fmtDateTime,
  orderStage,
  type AdminOrder,
  type ItemStatus,
  type Shipment,
  type Tone,
} from '@/lib/admin';
import { useAdmin } from './AdminShell';
import {
  Badge,
  Button,
  Card,
  ErrorNote,
  Field,
  Loading,
  inputClass,
  useAdminData,
  useToast,
} from './ui';

const ITEM_TONE: Record<ItemStatus, Tone> = {
  PENDING: 'grey',
  CONFIRMED: 'amber',
  PACKED: 'blue',
  SHIPPED: 'violet',
  DELIVERED: 'green',
  CANCELLED: 'red',
  RETURNED: 'grey',
};

const SHIPMENT_STEPS: Array<Shipment['status']> = ['CREATED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED'];

const SHIPMENT_LABEL: Record<Shipment['status'], string> = {
  CREATED: 'Waiting for pickup',
  PICKED_UP: 'Picked up',
  IN_TRANSIT: 'In transit',
  DELIVERED: 'Delivered',
  RTO: 'Returning to us',
  CANCELLED: 'Shipment cancelled',
};

function ShipmentLine({ shipment }: { shipment: Shipment }) {
  const last = shipment.events[shipment.events.length - 1];
  return (
    <p className="mt-[5px] flex flex-wrap items-center gap-x-[6px] text-[12.5px] text-[#5d6b85]">
      <Truck aria-hidden="true" className="size-[13px] text-[#7a86a0]" />
      <span className="font-semibold text-[#24324d]">{shipment.carrier ?? 'Courier'}</span>
      {shipment.awbNumber && <span>· AWB {shipment.awbNumber}</span>}
      <span>· {SHIPMENT_LABEL[shipment.status]}</span>
      {last && <span className="text-[#8a95ab]">· {fmtDateTime(last.occurredAt)}</span>}
    </p>
  );
}

const CARRIERS = ['Delhivery', 'Blue Dart', 'Ekart', 'DTDC', 'India Post', 'YouMart Express'];

type Item = AdminOrder['items'][number];

export function AdminOrderDetail({ orderNumber }: { orderNumber: string }) {
  const { session, refreshCounts } = useAdmin();
  const toast = useToast();
  const order = useAdminData(
    () => adminFetch<AdminOrder>(`/orders/admin/orders/${encodeURIComponent(orderNumber)}`),
    [orderNumber],
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [shipping, setShipping] = useState<Item[] | null>(null);
  // Each shipped / delivered line's shipment (courier, AWB, where it is).
  const shippedIds = (order.data?.items ?? [])
    .filter((i) => i.sellerStatus === 'SHIPPED' || i.sellerStatus === 'DELIVERED')
    .map((i) => i.orderItemId)
    .join();
  const shipments = useAdminData(async () => {
    const ids = shippedIds ? shippedIds.split(',') : [];
    const found = await Promise.all(
      ids.map((id) => adminFetch<Shipment>(`/logistics/order-item/${id}`).catch(() => null)),
    );
    return Object.fromEntries(found.flatMap((s) => (s ? [[s.orderItemId, s] as const] : [])));
  }, [shippedIds, order.data]);

  const o = order.data;
  if (order.error && !o) return <ErrorNote message={order.error} />;
  if (!o) return <Loading label="Loading the order" />;

  const canPack = can(session, 'orders.manage');
  const canShip = can(session, 'fulfillment.manage');
  const stage = orderStage({ status: o.status, itemStatuses: o.items.map((i) => i.sellerStatus) });
  const byStatus = (s: ItemStatus) => o.items.filter((i) => i.sellerStatus === s);

  const run = async (key: string, work: () => Promise<unknown>, done: string) => {
    setBusy(key);
    try {
      await work();
      toast.ok(done);
      await order.reload();
      refreshCounts();
    } catch (failure) {
      toast.fail(failure);
    } finally {
      setBusy(null);
    }
  };

  const pack = (items: Item[]) =>
    run(
      `pack:${items.map((i) => i.orderItemId).join()}`,
      async () => {
        for (const item of items) {
          await adminFetch(`/orders/admin/items/${item.orderItemId}/status`, {
            method: 'PATCH',
            body: { status: 'PACKED' },
          });
        }
      },
      items.length > 1 ? `${items.length} items packed` : 'Marked as packed',
    );

  /** Moves each item's shipment one step on (Picked up → In transit → Delivered), or all the way
   * to Delivered - every step is a tracking event the customer sees. */
  const advance = (items: Item[], to: 'NEXT' | 'DELIVERED') =>
    run(
      `${to === 'DELIVERED' ? 'deliver' : 'step'}:${items.map((i) => i.orderItemId).join()}`,
      async () => {
        for (const item of items) {
          const shipment = await adminFetch<Shipment>(`/logistics/order-item/${item.orderItemId}`);
          const path = SHIPMENT_STEPS.slice(SHIPMENT_STEPS.indexOf(shipment.status) + 1);
          for (const next of to === 'DELIVERED' ? path : path.slice(0, 1)) {
            await adminFetch(
              next === 'DELIVERED'
                ? `/logistics/shipments/${shipment.id}/delivered`
                : `/logistics/shipments/${shipment.id}/status`,
              next === 'DELIVERED'
                ? { method: 'POST' }
                : { method: 'PATCH', body: { status: next } },
            );
          }
        }
      },
      to === 'DELIVERED'
        ? o.paymentMethod === 'COD'
          ? 'Delivered · cash collected'
          : 'Marked as delivered'
        : 'Tracking updated',
    );

  const address = o.shippingAddress;

  return (
    <>
      <Link
        href="/admin/orders"
        className="mb-[14px] inline-flex items-center gap-[6px] text-[13.5px] font-semibold text-[#5d6b85] hover:text-[#0142aa]"
      >
        <ArrowLeft aria-hidden="true" className="size-[15px]" /> Orders
      </Link>
      <div className="mb-[20px] flex flex-wrap items-start justify-between gap-[14px]">
        <div>
          <div className="flex flex-wrap items-center gap-[10px]">
            <h1 className="text-[26px] font-semibold text-[#0b1b3f]">{o.orderNumber}</h1>
            <Badge tone={stage.tone}>{stage.label}</Badge>
          </div>
          <p className="mt-[3px] text-[14px] text-[#5d6b85]">
            Placed {fmtDateTime(o.createdAt)} ·{' '}
            {o.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online'}
          </p>
        </div>
        <div className="flex flex-wrap gap-[8px]">
          {canPack && byStatus('CONFIRMED').length > 1 && (
            <Button variant="primary" icon={PackageCheck} busy={busy?.startsWith('pack:')} onClick={() => void pack(byStatus('CONFIRMED'))}>
              Pack all ({byStatus('CONFIRMED').length})
            </Button>
          )}
          {canShip && byStatus('PACKED').length > 1 && (
            <Button variant="primary" icon={Truck} onClick={() => setShipping(byStatus('PACKED'))}>
              Ship all ({byStatus('PACKED').length})
            </Button>
          )}
          {canShip && byStatus('SHIPPED').length > 1 && (
            <Button variant="gold" icon={CheckCircle2} busy={busy?.startsWith('deliver:')} onClick={() => void advance(byStatus('SHIPPED'), 'DELIVERED')}>
              Deliver all ({byStatus('SHIPPED').length})
            </Button>
          )}
        </div>
      </div>

      {o.cancelRequest?.status === 'REQUESTED' && (
        <div className="mb-[16px] flex flex-wrap items-center justify-between gap-[10px] rounded-[12px] border border-[#f7c9c5] bg-[#fdf1f0] px-[16px] py-[12px] text-[14px] text-[#8a1c12]">
          <span>
            <b>The customer asked to cancel</b>: &ldquo;{o.cancelRequest.reason}&rdquo;
          </span>
          <Link href="/admin/cancellations" className="font-semibold underline">
            Review request
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[1.75fr_1fr]">
        <div className="flex flex-col gap-[16px]">
          <Card title={`Items (${o.items.length})`}>
            <ul className="divide-y divide-[#eef1f6]">
              {o.items.map((item) => (
                <li key={item.orderItemId} className="flex flex-wrap items-center gap-[14px] px-[20px] py-[16px]">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-medium text-[#0b1b3f]">{item.title}</p>
                    <p className="mt-[2px] text-[13px] text-[#6b7891]">
                      {formatMoney(item.unitPrice)} × {item.quantity}
                      {Number(item.discount) > 0 && (
                        <span className="text-[#137a3f]"> · −{formatMoney(item.discount ?? '0.00')} coupon</span>
                      )}
                    </p>
                    {shipments.data?.[item.orderItemId] && (
                      <ShipmentLine shipment={shipments.data[item.orderItemId]!} />
                    )}
                  </div>
                  <p className="w-[96px] text-right text-[14.5px] font-semibold text-[#0b1b3f]">
                    {formatMoney(item.lineTotal)}
                  </p>
                  <div className="flex w-full items-center justify-end gap-[10px] md:w-auto md:min-w-[230px]">
                    <Badge tone={ITEM_TONE[item.sellerStatus]}>{ITEM_STATUS_LABEL[item.sellerStatus]}</Badge>
                    {item.sellerStatus === 'CONFIRMED' && canPack && (
                      <Button variant="primary" icon={PackageCheck} busy={busy === `pack:${item.orderItemId}`} onClick={() => void pack([item])}>
                        Pack
                      </Button>
                    )}
                    {item.sellerStatus === 'PACKED' && canShip && (
                      <Button variant="primary" icon={Truck} onClick={() => setShipping([item])}>
                        Ship
                      </Button>
                    )}
                    {item.sellerStatus === 'SHIPPED' && canShip && (
                      <>
                        {shipments.data?.[item.orderItemId]?.status !== 'IN_TRANSIT' && (
                          <Button busy={busy === `step:${item.orderItemId}`} onClick={() => void advance([item], 'NEXT')}>
                            {shipments.data?.[item.orderItemId]?.status === 'PICKED_UP' ? 'In transit' : 'Picked up'}
                          </Button>
                        )}
                        <Button variant="gold" icon={CheckCircle2} busy={busy === `deliver:${item.orderItemId}`} onClick={() => void advance([item], 'DELIVERED')}>
                          Delivered
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Card>

          <Card title="Timeline">
            <ol className="px-[20px] py-[16px]">
              {o.timeline.map((t, i) => (
                <li key={`${t.status}-${t.at}`} className="relative flex gap-[12px] pb-[14px] last:pb-0">
                  {i < o.timeline.length - 1 && (
                    <span aria-hidden="true" className="absolute left-[6px] top-[16px] h-full w-[2px] bg-[#e4e9f2]" />
                  )}
                  <span
                    aria-hidden="true"
                    className={`relative mt-[3px] size-[14px] shrink-0 rounded-full border-[3px] ${
                      t.status === 'CANCELLED' ? 'border-[#f7c9c5] bg-[#b42318]' : 'border-[#c6d6fb] bg-[#0142aa]'
                    }`}
                  />
                  <div>
                    <p className="text-[14px] font-semibold text-[#0b1b3f]">
                      {{ PENDING_PAYMENT: 'Order placed', CONFIRMED: 'Confirmed', CANCELLED: 'Cancelled' }[t.status] ?? t.status}
                    </p>
                    <p className="text-[12.5px] text-[#7a86a0]">{fmtDateTime(t.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="flex flex-col gap-[16px]">
          <Card title="Customer">
            <div className="flex flex-col gap-[10px] px-[20px] py-[16px] text-[14px]">
              <p className="text-[15px] font-semibold text-[#0b1b3f]">{address?.fullName ?? 'Customer'}</p>
              {(o.customer?.phone ?? address?.phone) && (
                <p className="flex items-center gap-[8px] text-[#24324d]">
                  <Phone aria-hidden="true" className="size-[15px] text-[#7a86a0]" />
                  {o.customer?.phone ?? address?.phone}
                </p>
              )}
              {o.customer?.email && (
                <p className="flex items-center gap-[8px] break-all text-[#24324d]">
                  <Mail aria-hidden="true" className="size-[15px] shrink-0 text-[#7a86a0]" />
                  {o.customer.email}
                </p>
              )}
              {address && (
                <p className="flex gap-[8px] leading-[1.5] text-[#24324d]">
                  <MapPin aria-hidden="true" className="mt-[3px] size-[15px] shrink-0 text-[#7a86a0]" />
                  <span>
                    {[address.line1, address.line2, address.landmark].filter(Boolean).join(', ')}
                    <br />
                    {address.city}, {address.state} {address.pincode}
                    {address.phone && address.phone !== o.customer?.phone && (
                      <>
                        <br />
                        Phone: {address.phone}
                      </>
                    )}
                  </span>
                </p>
              )}
            </div>
          </Card>

          <Card title="Payment">
            <dl className="flex flex-col gap-[9px] px-[20px] py-[16px] text-[14px]">
              <Row label="Items" value={formatMoney(o.subtotal)} />
              {Number(o.discountTotal) > 0 && (
                <Row label={`Coupon ${o.couponCode ?? ''}`} value={`−${formatMoney(o.discountTotal ?? '0.00')}`} green />
              )}
              <Row label="Shipping" value={Number(o.shippingTotal) > 0 ? formatMoney(o.shippingTotal) : 'Free'} />
              <div className="my-[2px] border-t border-dashed border-[#e4e9f2]" />
              <Row label="Total" value={formatMoney(o.grandTotal)} bold />
              <p className="mt-[6px] flex items-center gap-[8px] rounded-[10px] bg-[#f6f8fc] px-[12px] py-[9px] text-[13px] font-semibold text-[#24324d]">
                {o.paymentMethod === 'COD' ? (
                  <>
                    <Banknote aria-hidden="true" className="size-[16px] text-[#9a6200]" />
                    {o.items.every((i) => i.sellerStatus === 'DELIVERED' || i.sellerStatus === 'CANCELLED' || i.sellerStatus === 'RETURNED') && o.status === 'CONFIRMED'
                      ? 'Cash collected on delivery'
                      : o.status === 'CANCELLED'
                        ? 'Cash on Delivery · cancelled'
                        : 'Collect cash on delivery'}
                  </>
                ) : (
                  <>
                    <CreditCard aria-hidden="true" className="size-[16px] text-[#137a3f]" />
                    {o.status === 'PENDING_PAYMENT' ? 'Waiting for online payment' : 'Paid online'}
                  </>
                )}
              </p>
            </dl>
          </Card>
        </div>
      </div>

      {shipping && (
        <ShipDialog
          items={shipping}
          onClose={() => setShipping(null)}
          onShip={(carrier, awb) => {
            const items = shipping;
            setShipping(null);
            void run(
              `ship:${items.map((i) => i.orderItemId).join()}`,
              async () => {
                for (const [i, item] of items.entries()) {
                  await adminFetch('/logistics/shipments', {
                    method: 'POST',
                    body: {
                      orderItemId: item.orderItemId,
                      carrier,
                      awbNumber: awb ? (items.length > 1 ? `${awb}-${i + 1}` : awb) : undefined,
                    },
                  });
                }
              },
              items.length > 1 ? `${items.length} items shipped with ${carrier}` : `Shipped with ${carrier}`,
            );
          }}
        />
      )}
      {toast.node}
    </>
  );
}

function Row({ label, value, bold, green }: { label: string; value: string; bold?: boolean; green?: boolean }) {
  return (
    <div className="flex justify-between gap-[10px]">
      <dt className={bold ? 'font-semibold text-[#0b1b3f]' : 'text-[#5d6b85]'}>{label}</dt>
      <dd className={`${bold ? 'text-[16px] font-semibold text-[#0b1b3f]' : ''} ${green ? 'font-semibold text-[#137a3f]' : ''}`}>
        {value}
      </dd>
    </div>
  );
}

function ShipDialog({
  items,
  onClose,
  onShip,
}: {
  items: Item[];
  onClose: () => void;
  onShip: (carrier: string, awb: string) => void;
}) {
  const [carrier, setCarrier] = useState(CARRIERS[0] ?? 'Delhivery');
  const [awb, setAwb] = useState('');
  return (
    <div className="fixed inset-0 z-[2100] flex items-center justify-center bg-[rgba(11,27,63,0.45)] p-[16px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onShip(carrier, awb.trim());
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Ship items"
        className="w-full max-w-[440px] rounded-[18px] bg-white p-[24px] shadow-[0_24px_60px_rgba(11,27,63,0.3)]"
      >
        <span className="mb-[12px] flex size-[44px] items-center justify-center rounded-[12px] bg-[#eef3ff] text-[#0142aa]">
          <Truck aria-hidden="true" className="size-[20px]" />
        </span>
        <h2 className="text-[19px] font-semibold text-[#0b1b3f]">
          Ship {items.length > 1 ? `${items.length} items` : 'this item'}
        </h2>
        <p className="mb-[18px] mt-[3px] text-[13.5px] text-[#5d6b85]">
          {items.length > 1 ? 'Each item gets its own shipment.' : items[0]?.title}
        </p>
        <div className="flex flex-col gap-[14px]">
          <Field label="Courier">
            <select value={carrier} onChange={(e) => setCarrier(e.target.value)} className={inputClass}>
              {CARRIERS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Tracking number (AWB)" hint="Optional: the customer sees it on their order.">
            <input value={awb} onChange={(e) => setAwb(e.target.value)} className={inputClass} placeholder="e.g. 1234567890" />
          </Field>
        </div>
        <div className="mt-[22px] flex justify-end gap-[8px]">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary" icon={Truck}>
            Mark shipped
          </Button>
        </div>
      </form>
    </div>
  );
}
