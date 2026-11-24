'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlarmClock, Loader2, Trash2 } from 'lucide-react';
import { ApiError, formatMoney, type BuyReminder, type Money, type ReminderRepeat } from '@youmart/shared-client';
import { BTN_PRIMARY, BTN_SECONDARY, Dialog } from '@/components/account/ui';
import { api } from '@/lib/api';
import { REPEAT_LABEL, quickPicks, whenLabel } from '@/lib/reminder-time';

export interface RemindProduct {
  skuId: string;
  title: string;
  imageUrl?: string;
  price?: Money;
}

const REPEATS: ReminderRepeat[] = ['NONE', 'WEEKLY', 'MONTHLY'];
const pad = (n: number) => String(n).padStart(2, '0');
/** Date -> the value a <input type="date"> / "time" shows (local time). */
const dateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const timeValue = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/**
 * v1.18 "Remind me to buy" on the website: when (quick picks or any date and time), how often (once /
 * every week / every month for refills) and a note. At that time the customer gets a WhatsApp with
 * the product and its price then - and how much it dropped since.
 */
export function RemindDialog({
  open,
  product,
  existing,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: RemindProduct;
  existing: BuyReminder | null;
  onClose: () => void;
  onSaved: (reminder: BuyReminder | null) => void;
}) {
  const picks = useMemo(() => (open ? quickPicks() : []), [open]);
  const [when, setWhen] = useState<Date>(() => new Date());
  const [pickKey, setPickKey] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<ReminderRepeat>('NONE');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const upcoming = existing?.status === 'SCHEDULED' && new Date(existing.remindAt).getTime() > Date.now();
    if (existing && upcoming) {
      setWhen(new Date(existing.remindAt));
      setPickKey(null);
    } else {
      const first = quickPicks().find((p) => p.key === 'tomorrow') ?? quickPicks()[0]!;
      setWhen(first.at);
      setPickKey(first.key);
    }
    setRepeat(existing?.repeat ?? 'NONE');
    setNote(existing?.note ?? '');
    setError(null);
  }, [open, existing]);

  const setDate = (value: string) => {
    const [y, m, d] = value.split('-').map(Number);
    if (!y || !m || !d) return;
    const next = new Date(when);
    next.setFullYear(y, m - 1, d);
    setWhen(next);
    setPickKey(null);
  };
  const setTime = (value: string) => {
    const [h, min] = value.split(':').map(Number);
    if (h === undefined || min === undefined || Number.isNaN(h)) return;
    const next = new Date(when);
    next.setHours(h, min, 0, 0);
    setWhen(next);
    setPickKey(null);
  };

  const save = async () => {
    if (when.getTime() < Date.now() + 60_000) {
      setError('Pick a time in the future.');
      return;
    }
    setBusy('save');
    setError(null);
    try {
      const body = { remindAt: when.toISOString(), repeat };
      const saved = existing
        ? await api.reminders.update(existing.reminderId, { ...body, note: note.trim() || null })
        : await api.reminders.create({
            ...body,
            skuId: product.skuId,
            ...(product.imageUrl ? { imageUrl: product.imageUrl } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          });
      onSaved(saved);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save the reminder. Please try again.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setBusy('remove');
    try {
      await api.reminders.remove(existing.reminderId);
      onSaved(null);
    } catch {
      setError('Could not remove the reminder.');
    } finally {
      setBusy(null);
    }
  };

  const today = new Date();
  const max = new Date();
  max.setDate(max.getDate() + 365);

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      width={560}
      title={existing ? 'Change reminder' : 'Remind me to buy'}
      description="We’ll send you a WhatsApp at that time with the product and its price then."
      footer={
        <>
          {existing ? (
            <button type="button" onClick={() => void remove()} disabled={busy !== null} className={`${BTN_SECONDARY} mr-auto hover:!border-woo-error hover:!text-woo-error`}>
              {busy === 'remove' ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : <Trash2 aria-hidden="true" className="size-[16px]" />}
              Remove
            </button>
          ) : null}
          <button type="button" onClick={onClose} disabled={busy !== null} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button type="button" onClick={() => void save()} disabled={busy !== null} className={BTN_PRIMARY}>
            {busy === 'save' ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : <AlarmClock aria-hidden="true" className="size-[16px]" />}
            {existing ? 'Save changes' : 'Set reminder'}
          </button>
        </>
      }
    >
      <div className="mb-[16px] flex items-center gap-[12px] rounded-[12px] bg-[#f6f8fb] p-[10px]">
        {product.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt="" className="size-[52px] rounded-[8px] bg-white object-contain p-[4px]" />
        ) : null}
        <div className="min-w-0">
          <p className="line-clamp-2 text-[14px] font-semibold text-heading">{product.title}</p>
          {product.price ? <p className="text-[13px] text-ink-muted">Today {formatMoney(product.price)}</p> : null}
        </div>
      </div>

      <p className="mb-[8px] text-[13.5px] font-semibold text-heading">When</p>
      <div className="mb-[12px] flex flex-wrap gap-[8px]">
        {picks.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => {
              setWhen(p.at);
              setPickKey(p.key);
            }}
            className={`rounded-full border px-[14px] py-[6px] text-[13px] font-semibold transition-colors ${
              pickKey === p.key ? 'border-brand bg-[#eef3fc] text-brand' : 'border-catalog-rule text-heading hover:border-brand'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mb-[6px] grid grid-cols-2 gap-[10px]">
        <input
          type="date"
          aria-label="Date"
          value={dateValue(when)}
          min={dateValue(today)}
          max={dateValue(max)}
          onChange={(e) => setDate(e.target.value)}
          className="h-[42px] rounded-[10px] border border-catalog-rule px-[12px] text-[14.5px] text-ink-input focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
        <input
          type="time"
          aria-label="Time"
          step={900}
          value={timeValue(when)}
          onChange={(e) => setTime(e.target.value)}
          className="h-[42px] rounded-[10px] border border-catalog-rule px-[12px] text-[14.5px] text-ink-input focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
        />
      </div>
      <p className="mb-[16px] text-[13px] text-brand">{whenLabel(when)}</p>

      <p className="mb-[8px] text-[13.5px] font-semibold text-heading">Repeat</p>
      <div role="radiogroup" className="mb-[16px] flex rounded-[10px] bg-[#f1f5f9] p-[3px]">
        {REPEATS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={repeat === r}
            onClick={() => setRepeat(r)}
            className={`flex-1 rounded-[8px] py-[7px] text-[13.5px] font-semibold transition-colors ${
              repeat === r ? 'bg-white text-brand shadow-rail-card' : 'text-ink-muted hover:text-heading'
            }`}
          >
            {REPEAT_LABEL[r]}
          </button>
        ))}
      </div>

      <label htmlFor="remind-note" className="mb-[6px] block text-[13.5px] font-semibold text-heading">
        Note <span className="font-normal text-ink-muted">(optional)</span>
      </label>
      <input
        id="remind-note"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={80}
        placeholder="e.g. Refill for the kitchen"
        className="h-[42px] w-full rounded-[10px] border border-catalog-rule px-[12px] text-[14.5px] text-ink-input placeholder:text-ink-placeholder focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
      {error ? <p className="mt-[10px] text-[13.5px] text-woo-error">{error}</p> : null}
    </Dialog>
  );
}
