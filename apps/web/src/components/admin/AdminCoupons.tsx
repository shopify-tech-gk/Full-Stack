'use client';

import { useState } from 'react';
import { BadgePercent, EyeOff, Plus } from 'lucide-react';
import { formatMoney } from '@youmart/shared-client';
import { adminFetch, fmtDate, type AdminCoupon } from '@/lib/admin';
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
  Table,
  inputClass,
  td,
  useAdminData,
  useToast,
} from './ui';

function couponState(c: AdminCoupon): { label: string; tone: 'green' | 'grey' | 'red' | 'amber' } {
  const now = Date.now();
  if (!c.isActive) return { label: 'Paused', tone: 'grey' };
  if (c.endsAt && new Date(c.endsAt).getTime() < now) return { label: 'Expired', tone: 'red' };
  if (c.startsAt && new Date(c.startsAt).getTime() > now) return { label: 'Scheduled', tone: 'amber' };
  if (c.usageLimit !== null && c.usedCount >= c.usageLimit) return { label: 'Used up', tone: 'red' };
  return { label: 'Running', tone: 'green' };
}

const discountText = (c: AdminCoupon) =>
  c.discountType === 'PERCENT'
    ? `${Number(c.discountValue)}% off${c.maxDiscount ? ` · max ${formatMoney(c.maxDiscount)}` : ''}`
    : `${formatMoney(c.discountValue)} off`;

export function AdminCoupons() {
  const toast = useToast();
  const list = useAdminData(() => adminFetch<{ items: AdminCoupon[] }>('/orders/coupons/admin'), []);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const patch = async (c: AdminCoupon, body: Partial<Pick<AdminCoupon, 'isActive' | 'isPublic'>>, done: string) => {
    setBusy(c.code);
    try {
      await adminFetch(`/orders/coupons/admin/${encodeURIComponent(c.code)}`, { method: 'PATCH', body });
      toast.ok(done);
      await list.reload();
    } catch (failure) {
      toast.fail(failure);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Coupons"
        subtitle="Offers customers can apply at checkout. YouMart pays the discount; sellers are paid in full."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            New coupon
          </Button>
        }
      />
      {list.error && <ErrorNote message={list.error} />}
      <Card>
        {!list.data ? (
          <Loading />
        ) : list.data.items.length === 0 ? (
          <Empty icon={BadgePercent} title="No coupons yet" text="Create your first offer." />
        ) : (
          <Table head={['Code', 'Offer', 'Min. order', 'Used', 'Valid till', 'Status', '']}>
            {list.data.items.map((c) => {
              const state = couponState(c);
              const pct = c.usageLimit ? Math.min(100, (c.usedCount / c.usageLimit) * 100) : 0;
              return (
                <tr key={c.id} className="hover:bg-[#fafbfe]">
                  <td className={td}>
                    <span className="rounded-[7px] border border-dashed border-[#0142aa]/50 bg-[#eef3ff] px-[9px] py-[3px] text-[13px] font-bold tracking-[0.06em] text-[#0142aa]">
                      {c.code}
                    </span>
                    {!c.isPublic && (
                      <span className="ml-[6px] inline-flex items-center gap-[3px] text-[11.5px] font-semibold text-[#7a86a0]" title="Not listed: only customers who know the code can use it">
                        <EyeOff aria-hidden="true" className="size-[12px]" /> Secret
                      </span>
                    )}
                  </td>
                  <td className={td}>
                    <p className="font-medium text-[#0b1b3f]">{c.title}</p>
                    <p className="text-[12px] text-[#7a86a0]">{discountText(c)}</p>
                  </td>
                  <td className={td}>{c.minOrderValue ? formatMoney(c.minOrderValue) : '—'}</td>
                  <td className={`${td} min-w-[120px]`}>
                    <p className="text-[13px]">
                      <b className="text-[#0b1b3f]">{c.usedCount}</b>
                      {c.usageLimit ? ` / ${c.usageLimit}` : ' · no limit'}
                    </p>
                    {c.usageLimit && (
                      <div className="mt-[5px] h-[4px] w-[100px] rounded-full bg-[#eef1f6]">
                        <div className="h-full rounded-full bg-[#0142aa]" style={{ width: `${pct}%` }} />
                      </div>
                    )}
                  </td>
                  <td className={`${td} whitespace-nowrap text-[#5d6b85]`}>{c.endsAt ? fmtDate(c.endsAt) : 'No end date'}</td>
                  <td className={td}>
                    <Badge tone={state.tone}>{state.label}</Badge>
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <div className="flex justify-end gap-[6px]">
                      <Button
                        variant="ghost"
                        disabled={busy === c.code}
                        onClick={() => void patch(c, { isPublic: !c.isPublic }, c.isPublic ? `${c.code} is now secret` : `${c.code} is now listed`)}
                      >
                        {c.isPublic ? 'Make secret' : 'List it'}
                      </Button>
                      <Button
                        variant={c.isActive ? 'danger' : 'primary'}
                        busy={busy === c.code}
                        onClick={() => void patch(c, { isActive: !c.isActive }, c.isActive ? `${c.code} paused` : `${c.code} is live again`)}
                      >
                        {c.isActive ? 'Pause' : 'Resume'}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      {creating && (
        <CouponForm
          onClose={() => setCreating(false)}
          onCreated={async (code) => {
            setCreating(false);
            toast.ok(`${code} created`);
            await list.reload();
          }}
        />
      )}
      {toast.node}
    </>
  );
}

function CouponForm({ onClose, onCreated }: { onClose: () => void; onCreated: (code: string) => Promise<void> }) {
  const [f, setF] = useState({
    code: '',
    title: '',
    description: '',
    discountType: 'PERCENT' as 'PERCENT' | 'FLAT',
    discountValue: '',
    maxDiscount: '',
    minOrderValue: '',
    usageLimit: '',
    perUserLimit: '1',
    endsAt: '',
    isPublic: true,
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof f>(key: K, value: (typeof f)[K]) => setF((x) => ({ ...x, [key]: value }));
  const num = (v: string) => (v.trim() ? Number(v) : null);

  const submit = async () => {
    setError(null);
    if (!/^[A-Z0-9]{3,20}$/.test(f.code)) {
      setError('The code needs 3–20 letters or numbers (no spaces).');
      return;
    }
    if (!(Number(f.discountValue) > 0)) {
      setError('Enter how much the coupon takes off.');
      return;
    }
    setBusy(true);
    try {
      await adminFetch('/orders/coupons/admin', {
        method: 'POST',
        body: {
          code: f.code,
          title: f.title.trim() || null,
          description: f.description.trim() || null,
          discountType: f.discountType,
          discountValue: Number(f.discountValue),
          maxDiscount: f.discountType === 'PERCENT' ? num(f.maxDiscount) : null,
          minOrderValue: num(f.minOrderValue),
          usageLimit: num(f.usageLimit),
          perUserLimit: num(f.perUserLimit),
          endsAt: f.endsAt ? new Date(`${f.endsAt}T23:59:59+05:30`).toISOString() : null,
          isPublic: f.isPublic,
          isActive: true,
        },
      });
      await onCreated(f.code);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not create the coupon.');
      setBusy(false);
    }
  };

  return (
    <Drawer
      open
      title="New coupon"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" busy={busy} onClick={() => void submit()}>
            Create coupon
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-[16px]">
        <Field label="Code" hint="What customers type at checkout.">
          <input
            value={f.code}
            onChange={(e) => set('code', e.target.value.toUpperCase().replace(/\s/g, ''))}
            placeholder="DIWALI20"
            className={`${inputClass} font-bold uppercase tracking-[0.08em]`}
          />
        </Field>
        <Field label="Headline" hint="Optional. Left empty, it reads like “20% off up to ₹500”.">
          <input value={f.title} onChange={(e) => set('title', e.target.value)} placeholder="Diwali special" className={inputClass} />
        </Field>
        <Field label="Details">
          <input value={f.description} onChange={(e) => set('description', e.target.value)} placeholder="On everything in the store" className={inputClass} />
        </Field>
        <Field label="Discount">
          <div className="grid grid-cols-2 gap-[6px]">
            {(['PERCENT', 'FLAT'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => set('discountType', t)}
                className={`h-[38px] rounded-[10px] text-[13.5px] font-semibold ring-1 ring-inset ${
                  f.discountType === t ? 'bg-[#0142aa] text-white ring-[#0142aa]' : 'bg-white text-[#24324d] ring-[#d7deea]'
                }`}
              >
                {t === 'PERCENT' ? 'Percentage (%)' : 'Flat amount (₹)'}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-[12px]">
          <Field label={f.discountType === 'PERCENT' ? 'Percent off' : 'Rupees off'}>
            <input inputMode="decimal" value={f.discountValue} onChange={(e) => set('discountValue', e.target.value)} className={inputClass} />
          </Field>
          {f.discountType === 'PERCENT' && (
            <Field label="Max discount ₹">
              <input inputMode="decimal" value={f.maxDiscount} onChange={(e) => set('maxDiscount', e.target.value)} placeholder="No cap" className={inputClass} />
            </Field>
          )}
          <Field label="Min. order ₹">
            <input inputMode="decimal" value={f.minOrderValue} onChange={(e) => set('minOrderValue', e.target.value)} placeholder="Any" className={inputClass} />
          </Field>
          <Field label="Valid till">
            <input type="date" value={f.endsAt} onChange={(e) => set('endsAt', e.target.value)} className={inputClass} />
          </Field>
          <Field label="Total uses">
            <input inputMode="numeric" value={f.usageLimit} onChange={(e) => set('usageLimit', e.target.value)} placeholder="Unlimited" className={inputClass} />
          </Field>
          <Field label="Uses per customer">
            <input inputMode="numeric" value={f.perUserLimit} onChange={(e) => set('perUserLimit', e.target.value)} placeholder="Unlimited" className={inputClass} />
          </Field>
        </div>
        <label className="flex items-start gap-[10px] rounded-[12px] border border-[#e4e9f2] p-[12px]">
          <input type="checkbox" checked={f.isPublic} onChange={(e) => set('isPublic', e.target.checked)} className="mt-[3px] size-[16px] accent-[#0142aa]" />
          <span>
            <span className="block text-[14px] font-semibold text-[#0b1b3f]">Show in the offers list</span>
            <span className="text-[12.5px] text-[#7a86a0]">Off = a secret code you share yourself (e.g. with VIP customers).</span>
          </span>
        </label>
        {error && <ErrorNote message={error} />}
      </div>
    </Drawer>
  );
}
