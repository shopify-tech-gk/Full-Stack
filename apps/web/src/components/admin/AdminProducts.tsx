'use client';

import { useState } from 'react';
import { Boxes, ExternalLink, Pencil, Star } from 'lucide-react';
import { formatMoney, type Money } from '@youmart/shared-client';
import {
  adminFetch,
  can,
  type AdminProduct,
  type Page,
  type StockLevel,
  type Tone,
} from '@/lib/admin';
import { useAdmin } from './AdminShell';
import {
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  ErrorNote,
  Field,
  Loading,
  PageHeader,
  SearchInput,
  Table,
  Tabs,
  inputClass,
  td,
  useAdminData,
  useDebounced,
  useToast,
} from './ui';

type Status = AdminProduct['status'];
const STATUS: Record<Status, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'Live', tone: 'green' },
  DRAFT: { label: 'Draft', tone: 'grey' },
  ARCHIVED: { label: 'Hidden', tone: 'red' },
};

type Row = AdminProduct & { stock: Record<string, number> };

export function AdminProducts() {
  const { session } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<Status | 'ALL'>('ALL');
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const [cursor, setCursor] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const canStock = can(session, 'inventory.manage');

  const list = useAdminData(async () => {
    const page = await adminFetch<Page<AdminProduct> & { counts: Record<Status, number> }>(
      `/catalog/admin/products?limit=25${status === 'ALL' ? '' : `&status=${status}`}${
        query ? `&q=${encodeURIComponent(query)}` : ''
      }${cursor ? `&cursor=${cursor}` : ''}`,
    );
    const skuIds = page.items.flatMap((p) => p.skus.map((s) => s.id));
    const levels =
      canStock && skuIds.length
        ? (await adminFetch<{ items: StockLevel[] }>('/inventory/admin/stock-levels', {
            method: 'POST',
            body: { skuIds },
          })).items
        : [];
    const bySku = Object.fromEntries(levels.map((l) => [l.skuId, l.available]));
    return {
      ...page,
      items: page.items.map((p): Row => ({
        ...p,
        stock: Object.fromEntries(p.skus.map((s) => [s.id, bySku[s.id] ?? 0])),
      })),
    };
  }, [status, query, cursor, canStock]);

  const counts = list.data?.counts;
  const total = counts ? counts.ACTIVE + counts.DRAFT + counts.ARCHIVED : undefined;

  return (
    <>
      <PageHeader
        title="Products & stock"
        subtitle="Prices, stock and whether a product shows in the store."
        actions={<SearchInput value={q} onChange={(v) => { setQ(v); setCursor(null); }} placeholder="Product name or SKU code" />}
      />
      <div className="mb-[14px]">
        <Tabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setCursor(null);
          }}
          tabs={[
            { value: 'ALL', label: 'All', count: total },
            { value: 'ACTIVE', label: 'Live', count: counts?.ACTIVE },
            { value: 'DRAFT', label: 'Draft', count: counts?.DRAFT },
            { value: 'ARCHIVED', label: 'Hidden', count: counts?.ARCHIVED },
          ]}
        />
      </div>
      {list.error && <ErrorNote message={list.error} />}
      <Card>
        {!list.data ? (
          <Loading label="Loading products" />
        ) : list.data.items.length === 0 ? (
          <Empty icon={Boxes} title="No products found" />
        ) : (
          <>
            <Table head={['Product', 'Category', 'Price', 'Stock', 'Rating', 'Status', '']}>
              {list.data.items.map((p) => {
                const stock = Object.values(p.stock).reduce((a, b) => a + b, 0);
                const prices = p.skus.map((s) => Number(s.sellingPrice));
                const min = Math.min(...prices);
                const max = Math.max(...prices);
                return (
                  <tr key={p.id} className="hover:bg-[#fafbfe]">
                    <td className={td}>
                      <div className="flex items-center gap-[12px]">
                        {p.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.imageUrl} alt="" className="size-[44px] shrink-0 rounded-[10px] border border-[#eef1f6] bg-white object-contain" />
                        ) : (
                          <span className="size-[44px] shrink-0 rounded-[10px] bg-[#f1f4f9]" />
                        )}
                        <div className="min-w-0">
                          <p className="max-w-[300px] truncate font-medium text-[#0b1b3f]">{p.title}</p>
                          <p className="text-[12px] text-[#7a86a0]">
                            {p.skus.length} variant{p.skus.length === 1 ? '' : 's'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className={`${td} text-[#5d6b85]`}>{p.category.name}</td>
                    <td className={`${td} whitespace-nowrap font-semibold text-[#0b1b3f]`}>
                      {prices.length === 0
                        ? '—'
                        : min === max
                          ? formatMoney(min.toFixed(2) as Money)
                          : `${formatMoney(min.toFixed(2) as Money)} – ${formatMoney(max.toFixed(2) as Money)}`}
                    </td>
                    <td className={td}>
                      {canStock ? (
                        <span className={`font-semibold ${stock === 0 ? 'text-[#b42318]' : stock <= 5 ? 'text-[#9a6200]' : 'text-[#137a3f]'}`}>
                          {stock === 0 ? 'Out of stock' : `${stock} in stock`}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={td}>
                      {p.rating ? (
                        <span className="inline-flex items-center gap-[4px] text-[13px]">
                          <Star aria-hidden="true" className="size-[13px] fill-[#ffc200] text-[#ffc200]" />
                          {p.rating}
                          <span className="text-[#8a95ab]">({p.ratingCount.toLocaleString('en-IN')})</span>
                        </span>
                      ) : (
                        <span className="text-[#8a95ab]">—</span>
                      )}
                    </td>
                    <td className={td}>
                      <Badge tone={STATUS[p.status].tone}>{STATUS[p.status].label}</Badge>
                    </td>
                    <td className={`${td} text-right`}>
                      <Button variant="ghost" icon={Pencil} onClick={() => setEditing(p)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Table>
            {(cursor || list.data.nextCursor) && (
              <div className="flex justify-center gap-[8px] border-t border-[#eef1f6] p-[14px]">
                {cursor && <Button onClick={() => setCursor(null)}>First page</Button>}
                {list.data.nextCursor && (
                  <Button onClick={() => setCursor(list.data?.nextCursor ?? null)}>Next page</Button>
                )}
              </div>
            )}
          </>
        )}
      </Card>
      {editing && (
        <ProductEditor
          product={editing}
          canStock={canStock}
          onClose={() => setEditing(null)}
          onSaved={async (message) => {
            setEditing(null);
            toast.ok(message);
            await list.reload();
          }}
          onError={toast.fail}
        />
      )}
      {toast.node}
    </>
  );
}

function ProductEditor({
  product,
  canStock,
  onClose,
  onSaved,
  onError,
}: {
  product: Row;
  canStock: boolean;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
  onError: (error: unknown) => void;
}) {
  const [status, setStatus] = useState<Status>(product.status);
  const [skus, setSkus] = useState(
    product.skus.map((s) => ({
      id: s.id,
      skuCode: s.skuCode,
      attributes: s.attributes,
      mrp: Number(s.mrp).toString(),
      price: Number(s.sellingPrice).toString(),
      stock: String(product.stock[s.id] ?? 0),
    })),
  );
  const [busy, setBusy] = useState(false);

  const save = async () => {
    for (const s of skus) {
      const price = Number(s.price);
      const mrp = Number(s.mrp);
      if (!(price > 0) || !(mrp > 0) || price > mrp) {
        onError(new Error(`${s.skuCode}: the price must be above zero and not more than the MRP.`));
        return;
      }
      if (canStock && !(Number.isInteger(Number(s.stock)) && Number(s.stock) >= 0)) {
        onError(new Error(`${s.skuCode}: stock must be a whole number.`));
        return;
      }
    }
    setBusy(true);
    try {
      if (status !== product.status) {
        await adminFetch(`/catalog/products/${product.id}`, { method: 'PATCH', body: { status } });
      }
      for (const s of skus) {
        const before = product.skus.find((x) => x.id === s.id);
        if (before && (Number(before.mrp) !== Number(s.mrp) || Number(before.sellingPrice) !== Number(s.price))) {
          await adminFetch(`/catalog/skus/${s.id}`, {
            method: 'PATCH',
            body: { mrp: Number(s.mrp).toFixed(2), sellingPrice: Number(s.price).toFixed(2) },
          });
        }
        if (canStock && Number(s.stock) !== (product.stock[s.id] ?? 0)) {
          await adminFetch(`/inventory/${s.id}/set`, {
            method: 'POST',
            body: { available: Number(s.stock) },
          });
        }
      }
      await onSaved('Product saved');
    } catch (failure) {
      onError(failure);
      setBusy(false);
    }
  };

  const variantLabel = (attributes: unknown) =>
    attributes && typeof attributes === 'object'
      ? Object.values(attributes as Record<string, unknown>).filter((v) => typeof v === 'string' || typeof v === 'number').join(' · ')
      : '';

  return (
    <Drawer
      open
      title="Edit product"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={() => void save()}>
            Save changes
          </Button>
        </>
      }
    >
      <div className="mb-[18px] flex items-center gap-[14px]">
        {product.imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="size-[64px] rounded-[12px] border border-[#eef1f6] object-contain" />
        )}
        <div className="min-w-0">
          <p className="text-[15.5px] font-semibold text-[#0b1b3f]">{product.title}</p>
          <a
            href={`/product/${product.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mt-[2px] inline-flex items-center gap-[4px] text-[13px] font-semibold text-[#0142aa] hover:underline"
          >
            View in store <ExternalLink aria-hidden="true" className="size-[13px]" />
          </a>
        </div>
      </div>

      <Field label="Visibility">
        <div className="grid grid-cols-3 gap-[6px]">
          {(['ACTIVE', 'DRAFT', 'ARCHIVED'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`h-[38px] rounded-[10px] text-[13.5px] font-semibold ring-1 ring-inset transition ${
                status === s ? 'bg-[#0142aa] text-white ring-[#0142aa]' : 'bg-white text-[#24324d] ring-[#d7deea] hover:bg-[#f6f8fc]'
              }`}
            >
              {STATUS[s].label}
            </button>
          ))}
        </div>
      </Field>
      <p className="mt-[6px] text-[12.5px] text-[#8a95ab]">Only Live products show in the store and search.</p>

      <h3 className="mb-[10px] mt-[24px] text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#5d6b85]">
        Variants
      </h3>
      <div className="flex flex-col gap-[12px]">
        {skus.map((s, i) => (
          <div key={s.id} className="rounded-[12px] border border-[#e4e9f2] p-[14px]">
            <p className="text-[13.5px] font-semibold text-[#0b1b3f]">
              {s.skuCode}
              {variantLabel(s.attributes) && (
                <span className="font-normal text-[#7a86a0]"> · {variantLabel(s.attributes)}</span>
              )}
            </p>
            <div className={`mt-[10px] grid gap-[10px] ${canStock ? 'grid-cols-3' : 'grid-cols-2'}`}>
              {(
                [
                  ['mrp', 'MRP ₹'],
                  ['price', 'Price ₹'],
                  ...(canStock ? [['stock', 'In stock'] as const] : []),
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex flex-col gap-[4px]">
                  <span className="text-[12px] font-semibold text-[#6b7891]">{label}</span>
                  <input
                    inputMode={key === 'stock' ? 'numeric' : 'decimal'}
                    value={s[key]}
                    onChange={(e) =>
                      setSkus((all) => all.map((x, j) => (j === i ? { ...x, [key]: e.target.value } : x)))
                    }
                    className={inputClass}
                  />
                </label>
              ))}
            </div>
            {Number(s.mrp) > Number(s.price) && Number(s.price) > 0 && (
              <p className="mt-[8px] text-[12.5px] font-semibold text-[#137a3f]">
                {Math.round(((Number(s.mrp) - Number(s.price)) / Number(s.mrp)) * 100)}% off shown in the store
              </p>
            )}
          </div>
        ))}
      </div>
    </Drawer>
  );
}
