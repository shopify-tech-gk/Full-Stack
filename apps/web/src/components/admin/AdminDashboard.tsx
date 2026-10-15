'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CircleSlash,
  IndianRupee,
  PackageOpen,
  ReceiptText,
  ShoppingBag,
  Truck,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatMoney, type Money } from '@youmart/shared-client';
import {
  adminFetch,
  can,
  fmtDateTime,
  orderStage,
  type AdminOrderListItem,
  type AdminProduct,
  type AdminStats,
  type Page,
  type StockLevel,
} from '@/lib/admin';
import { useAdmin } from './AdminShell';
import { Badge, Card, ErrorNote, Loading, PageHeader, td, Table, useAdminData } from './ui';

const LOW_STOCK_AT = 5;

export function AdminDashboard() {
  const { session } = useAdmin();
  // A role without order access (e.g. Support) gets a short landing instead of the numbers.
  if (!can(session, 'orders.manage')) {
    return (
      <>
        <PageHeader title={`Welcome, ${session.admin.name.split(' ')[0]}`} subtitle="Pick up where the store needs you." />
        <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2">
          {can(session, 'support.manage') && (
            <Link href="/admin/support" className="rounded-[16px] border border-[#e4e9f2] bg-white p-[22px] hover:border-[#0142aa]">
              <p className="text-[16px] font-semibold text-[#0b1b3f]">Support inbox →</p>
              <p className="text-[13.5px] text-[#5d6b85]">Answer customers' help requests.</p>
            </Link>
          )}
          {can(session, 'customers.view') && (
            <Link href="/admin/customers" className="rounded-[16px] border border-[#e4e9f2] bg-white p-[22px] hover:border-[#0142aa]">
              <p className="text-[16px] font-semibold text-[#0b1b3f]">Customers →</p>
              <p className="text-[13.5px] text-[#5d6b85]">Look up a customer's account.</p>
            </Link>
          )}
        </div>
      </>
    );
  }
  return <Overview />;
}

function Overview() {
  const { session } = useAdmin();
  const stats = useAdminData(() => adminFetch<AdminStats>('/orders/admin/stats'), []);
  const recent = useAdminData(
    () => adminFetch<Page<AdminOrderListItem>>('/orders/admin/orders?limit=6'),
    [],
  );
  const showStock = can(session, 'inventory.manage') && can(session, 'catalog.manage');
  const lowStock = useAdminData(async () => {
    if (!showStock) return [];
    const levels = await adminFetch<{ items: StockLevel[] }>(
      `/inventory/admin/reports/low-stock?threshold=${LOW_STOCK_AT}&limit=8`,
    );
    if (levels.items.length === 0) return [];
    const products = await adminFetch<Page<AdminProduct>>(
      `/catalog/admin/products?limit=50&skuIds=${levels.items.map((l) => l.skuId).join(',')}`,
    );
    return levels.items.flatMap((level) => {
      const product = products.items.find((p) => p.skus.some((s) => s.id === level.skuId));
      const sku = product?.skus.find((s) => s.id === level.skuId);
      return product && sku ? [{ product, sku, available: level.available }] : [];
    });
  }, [showStock]);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const s = stats.data;

  return (
    <>
      <PageHeader
        title={`${greeting}, ${session.admin.name.split(' ')[0]}`}
        subtitle="Here's how YouMart is doing today."
      />
      {stats.error && <ErrorNote message={stats.error} />}
      {!s ? (
        stats.loading && <Loading label="Loading the numbers" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-[16px] md:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={IndianRupee}
              label="Today's sales"
              value={formatMoney(s.today.revenue)}
              note={`${s.today.orders} order${s.today.orders === 1 ? '' : 's'} today`}
              accent
            />
            <Stat
              icon={ShoppingBag}
              label="Orders · 30 days"
              value={s.last30Days.orders.toLocaleString('en-IN')}
              note="Confirmed orders"
            />
            <Stat
              icon={ReceiptText}
              label="Sales · 30 days"
              value={formatMoney(s.last30Days.revenue)}
              note="Including shipping, after discounts"
            />
            <Stat
              icon={Wallet}
              label="Average order"
              value={formatMoney(s.last30Days.averageOrder)}
              note="Last 30 days"
            />
          </div>

          <div className="mt-[18px] grid grid-cols-1 gap-[16px] lg:grid-cols-[1.7fr_1fr]">
            <Card title="Sales · last 14 days">
              <SalesChart daily={s.daily} />
            </Card>
            <Card title="Needs your attention">
              <ul className="divide-y divide-[#eef1f6]">
                <Queue href="/admin/orders?stage=TO_PACK" icon={PackageOpen} label="To pack" n={s.queues.toPack} tone="amber" />
                <Queue href="/admin/orders?stage=TO_SHIP" icon={Truck} label="Packed · to ship" n={s.queues.toShip} tone="blue" />
                <Queue href="/admin/orders?stage=IN_TRANSIT" icon={Truck} label="In transit" n={s.queues.inTransit} tone="violet" />
                <Queue href="/admin/cancellations" icon={CircleSlash} label="Cancel requests" n={s.queues.cancelRequests} tone="red" />
                <Queue href="/admin/orders?payment=COD" icon={Banknote} label="Cash on Delivery to collect" n={s.queues.codToCollect} tone="green" />
              </ul>
            </Card>
          </div>

          <div className="mt-[18px] grid grid-cols-1 gap-[16px] lg:grid-cols-3">
            <Card title="Best sellers · 30 days" className="lg:col-span-2">
              {s.topProducts.length === 0 ? (
                <p className="px-[20px] py-[24px] text-[14px] text-[#5d6b85]">No sales yet.</p>
              ) : (
                <ol className="divide-y divide-[#eef1f6]">
                  {s.topProducts.map((p, i) => {
                    const max = s.topProducts[0]?.quantity || 1;
                    return (
                      <li key={p.productId} className="flex items-center gap-[14px] px-[20px] py-[12px]">
                        <span className="flex size-[28px] shrink-0 items-center justify-center rounded-full bg-[#f1f4f9] text-[12.5px] font-bold text-[#0b1b3f]">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[14px] font-medium text-[#0b1b3f]">{p.title}</p>
                          <div className="mt-[6px] h-[5px] rounded-full bg-[#eef1f6]">
                            <div
                              className="h-full rounded-full bg-[linear-gradient(90deg,#0142aa,#4c86ef)]"
                              style={{ width: `${Math.max(6, (p.quantity / max) * 100)}%` }}
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-[14px] font-semibold text-[#0b1b3f]">{formatMoney(p.revenue)}</p>
                          <p className="text-[12px] text-[#7a86a0]">{p.quantity} sold</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </Card>
            <Card title="How customers pay">
              <PaymentSplit online={s.paymentSplit.online} cod={s.paymentSplit.cod} />
            </Card>
          </div>
        </>
      )}

      <div className="mt-[18px] grid grid-cols-1 gap-[16px] lg:grid-cols-3">
        <Card
          title="Latest orders"
          className={showStock ? 'lg:col-span-2' : 'lg:col-span-3'}
          action={
            <Link href="/admin/orders" className="flex items-center gap-[3px] text-[13px] font-semibold text-[#0142aa] hover:underline">
              All orders <ArrowUpRight aria-hidden="true" className="size-[14px]" />
            </Link>
          }
        >
          {!recent.data ? (
            <Loading />
          ) : (
            <Table head={['Order', 'Customer', 'Amount', 'Status', 'Placed']}>
              {recent.data.items.map((o) => {
                const stage = orderStage(o);
                return (
                  <tr key={o.orderId} className="hover:bg-[#fafbfe]">
                    <td className={td}>
                      <Link href={`/admin/orders/${o.orderNumber}`} className="font-semibold text-[#0142aa] hover:underline">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className={td}>{o.customerName ?? '—'}</td>
                    <td className={`${td} font-semibold`}>{formatMoney(o.grandTotal)}</td>
                    <td className={td}>
                      <Badge tone={stage.tone}>{stage.label}</Badge>
                    </td>
                    <td className={`${td} text-[#6b7891]`}>{fmtDateTime(o.createdAt)}</td>
                  </tr>
                );
              })}
            </Table>
          )}
        </Card>
        {showStock && (
          <Card
            title="Running low"
            action={
              <Link href="/admin/products" className="text-[13px] font-semibold text-[#0142aa] hover:underline">
                Manage stock
              </Link>
            }
          >
            {!lowStock.data ? (
              <Loading />
            ) : lowStock.data.length === 0 ? (
              <p className="px-[20px] py-[24px] text-[14px] text-[#5d6b85]">
                Everything has more than {LOW_STOCK_AT} in stock.
              </p>
            ) : (
              <ul className="divide-y divide-[#eef1f6]">
                {lowStock.data.map(({ product, sku, available }) => (
                  <li key={sku.id} className="flex items-center gap-[12px] px-[20px] py-[11px]">
                    {product.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={product.imageUrl} alt="" className="size-[38px] rounded-[8px] border border-[#eef1f6] object-contain" />
                    ) : (
                      <span className="size-[38px] rounded-[8px] bg-[#f1f4f9]" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-[#0b1b3f]">{product.title}</p>
                      <p className="text-[12px] text-[#7a86a0]">{sku.skuCode}</p>
                    </div>
                    <span
                      className={`flex items-center gap-[4px] text-[13px] font-bold ${
                        available === 0 ? 'text-[#b42318]' : 'text-[#9a6200]'
                      }`}
                    >
                      {available === 0 && <AlertTriangle aria-hidden="true" className="size-[14px]" />}
                      {available === 0 ? 'Out' : `${available} left`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      </div>
    </>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  note,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-[16px] p-[20px] ${
        accent
          ? 'bg-[linear-gradient(135deg,#0b1b3f_0%,#0f2a63_55%,#0142aa_100%)] text-white shadow-[0_14px_30px_rgba(11,27,63,0.22)]'
          : 'border border-[#e4e9f2] bg-white shadow-[0_1px_2px_rgba(11,27,63,0.04),0_8px_24px_rgba(11,27,63,0.04)]'
      }`}
    >
      {accent && (
        <span aria-hidden="true" className="absolute -right-[40px] -top-[40px] size-[140px] rounded-full bg-[#ffc200]/15" />
      )}
      <div className="flex items-center justify-between">
        <p className={`text-[13px] font-semibold ${accent ? 'text-[#c3cce0]' : 'text-[#5d6b85]'}`}>{label}</p>
        <span
          className={`flex size-[34px] items-center justify-center rounded-[10px] ${
            accent ? 'bg-white/10 text-[#ffc200]' : 'bg-[#eef3ff] text-[#0142aa]'
          }`}
        >
          <Icon aria-hidden="true" className="size-[17px]" />
        </span>
      </div>
      <p className={`mt-[10px] text-[27px] font-semibold tracking-[-0.01em] ${accent ? 'text-white' : 'text-[#0b1b3f]'}`}>
        {value}
      </p>
      <p className={`mt-[2px] text-[12.5px] ${accent ? 'text-[#aab6d3]' : 'text-[#7a86a0]'}`}>{note}</p>
    </div>
  );
}

function Queue({
  href,
  icon: Icon,
  label,
  n,
  tone,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  n: number;
  tone: 'amber' | 'blue' | 'violet' | 'red' | 'green';
}) {
  const colors = {
    amber: 'bg-[#fff6e0] text-[#9a6200]',
    blue: 'bg-[#e9f0ff] text-[#0142aa]',
    violet: 'bg-[#f2edff] text-[#5b35c4]',
    red: 'bg-[#fdecec] text-[#b42318]',
    green: 'bg-[#e8f7ee] text-[#137a3f]',
  }[tone];
  return (
    <li>
      <Link href={href} className="group flex items-center gap-[12px] px-[20px] py-[12px] hover:bg-[#fafbfe]">
        <span className={`flex size-[34px] items-center justify-center rounded-[10px] ${colors}`}>
          <Icon aria-hidden="true" className="size-[16px]" />
        </span>
        <span className="flex-1 text-[14px] font-medium text-[#24324d]">{label}</span>
        <span className={`text-[18px] font-semibold ${n > 0 ? 'text-[#0b1b3f]' : 'text-[#b2bacb]'}`}>{n}</span>
        <ArrowUpRight aria-hidden="true" className="size-[15px] text-[#b2bacb] group-hover:text-[#0142aa]" />
      </Link>
    </li>
  );
}

function SalesChart({ daily }: { daily: Array<{ date: string; orders: number; revenue: Money }> }) {
  const values = daily.map((d) => Number(d.revenue));
  const max = Math.max(1, ...values);
  const W = 640;
  const H = 210;
  const pad = { l: 8, r: 8, t: 14, b: 30 };
  const bw = (W - pad.l - pad.r) / daily.length;
  const total = values.reduce((a, b) => a + b, 0);
  return (
    <div className="px-[16px] pb-[14px] pt-[12px]">
      <p className="px-[4px] text-[13px] text-[#5d6b85]">
        <span className="text-[20px] font-semibold text-[#0b1b3f]">
          {formatMoney(total.toFixed(2) as Money)}
        </span>{' '}
        in 14 days · {daily.reduce((a, d) => a + d.orders, 0)} orders
      </p>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-[8px] h-auto w-full" role="img" aria-label="Daily sales for the last 14 days">
        <defs>
          <linearGradient id="ym-bar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2a6be0" />
            <stop offset="100%" stopColor="#0142aa" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75, 1].map((f) => (
          <line
            key={f}
            x1={pad.l}
            x2={W - pad.r}
            y1={pad.t + (H - pad.t - pad.b) * (1 - f)}
            y2={pad.t + (H - pad.t - pad.b) * (1 - f)}
            stroke="#eef1f6"
          />
        ))}
        {daily.map((d, i) => {
          const v = Number(d.revenue);
          const h = ((H - pad.t - pad.b) * v) / max;
          const x = pad.l + i * bw + bw * 0.18;
          const isToday = i === daily.length - 1;
          return (
            <g key={d.date}>
              <title>{`${new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${formatMoney(d.revenue)} · ${d.orders} orders`}</title>
              <rect
                x={x}
                y={H - pad.b - Math.max(h, v > 0 ? 3 : 2)}
                width={bw * 0.64}
                height={Math.max(h, v > 0 ? 3 : 2)}
                rx={5}
                fill={v > 0 ? (isToday ? '#ffc200' : 'url(#ym-bar)') : '#e4e9f2'}
              />
              {(i % 2 === 1 || isToday) && (
                <text x={x + bw * 0.32} y={H - 10} textAnchor="middle" fontSize="11" fill={isToday ? '#0b1b3f' : '#8a95ab'} fontWeight={isToday ? 700 : 400}>
                  {isToday ? 'Today' : new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function PaymentSplit({ online, cod }: { online: number; cod: number }) {
  const total = online + cod;
  const pct = total ? Math.round((online / total) * 100) : 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center px-[20px] py-[22px]">
      <svg viewBox="0 0 140 140" className="size-[150px]" role="img" aria-label={`${pct}% paid online`}>
        <circle cx="70" cy="70" r={r} fill="none" stroke="#ffe7a1" strokeWidth="16" />
        {total > 0 && (
          <circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#0142aa"
            strokeWidth="16"
            strokeDasharray={`${(c * pct) / 100} ${c}`}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
          />
        )}
        <text x="70" y="68" textAnchor="middle" fontSize="24" fontWeight="700" fill="#0b1b3f">
          {pct}%
        </text>
        <text x="70" y="88" textAnchor="middle" fontSize="11" fill="#7a86a0">
          online
        </text>
      </svg>
      <div className="mt-[14px] flex w-full justify-around text-[13px]">
        <span className="flex items-center gap-[6px]">
          <span className="size-[10px] rounded-full bg-[#0142aa]" /> Online <b className="text-[#0b1b3f]">{online}</b>
        </span>
        <span className="flex items-center gap-[6px]">
          <span className="size-[10px] rounded-full bg-[#ffc200]" /> Cash on Delivery <b className="text-[#0b1b3f]">{cod}</b>
        </span>
      </div>
    </div>
  );
}
