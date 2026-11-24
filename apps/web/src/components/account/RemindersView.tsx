'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlarmClock, CalendarClock, ImageOff, Pencil, Repeat2, RotateCw } from 'lucide-react';
import { formatMoney, type BuyReminder } from '@youmart/shared-client';
import { RemindDialog } from '@/components/product/RemindDialog';
import { api } from '@/lib/api';
import { REPEAT_LABEL, fromNow, whenLabel } from '@/lib/reminder-time';
import { BTN_PRIMARY, BTN_SMALL, EmptyState, PageHeader, Panel, Pill, Skeleton } from './ui';

type Tab = 'upcoming' | 'past';

/** v1.18 "Remind me to buy" on the website: upcoming and past reminders - change, remove, set again. */
export function RemindersView() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [items, setItems] = useState<BuyReminder[] | null>(null);
  const [editing, setEditing] = useState<BuyReminder | null>(null);

  const load = useCallback(async (which: Tab) => {
    setItems(null);
    try {
      setItems((await api.reminders.list(which)).items);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  return (
    <>
      <PageHeader
        title="Reminders"
        subtitle="Products you asked us to remind you about - we send a WhatsApp with the price at that time."
        actions={
          <div role="tablist" className="flex rounded-[10px] bg-[#f1f5f9] p-[3px]">
            {(['upcoming', 'past'] as const).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                onClick={() => setTab(t)}
                className={`rounded-[8px] px-[16px] py-[6px] font-ui text-[13.5px] font-semibold capitalize transition-colors ${
                  tab === t ? 'bg-white text-brand shadow-rail-card' : 'text-ink-muted hover:text-heading'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        }
      />

      {items === null ? (
        <div className="grid gap-[14px] lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-[120px] w-full rounded-[14px]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Panel>
          <EmptyState
            icon={AlarmClock}
            title={tab === 'upcoming' ? 'No upcoming reminders' : 'No past reminders'}
            action={
              <Link href="/" className={BTN_PRIMARY}>
                Start shopping
              </Link>
            }
          >
            On any product page, choose &ldquo;Remind me to buy&rdquo; to get a nudge later - once, every week or every month.
          </EmptyState>
        </Panel>
      ) : (
        <ul className="grid gap-[14px] lg:grid-cols-2">
          {items.map((r) => {
            const at = new Date(r.remindAt);
            return (
              <li key={r.reminderId} className="flex gap-[14px] rounded-[14px] border border-catalog-rule bg-white p-[14px] font-ui shadow-rail-card">
                <Link href={`/product/${r.slug}`} className="flex size-[88px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] border border-catalog-rule bg-white">
                  {r.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.imageUrl} alt="" className="size-full object-contain p-[6px]" />
                  ) : (
                    <ImageOff aria-hidden="true" className="size-[22px] text-[#cbd5e1]" />
                  )}
                </Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <Link href={`/product/${r.slug}`} className="line-clamp-2 text-[14.5px] font-semibold leading-[1.4] text-heading hover:text-brand">
                    {r.title}
                  </Link>
                  <p className="mt-[6px] flex items-center gap-[6px] text-[13px] text-heading">
                    <CalendarClock aria-hidden="true" className="size-[14px] text-brand" />
                    {whenLabel(at)}
                    {tab === 'upcoming' ? <span className="text-ink-muted">· {fromNow(at)}</span> : null}
                  </p>
                  <div className="mt-[6px] flex flex-wrap items-center gap-[6px]">
                    {r.repeat !== 'NONE' ? (
                      <Pill tone="violet">
                        <Repeat2 aria-hidden="true" className="-ml-[2px] size-[12px]" /> {REPEAT_LABEL[r.repeat]}
                      </Pill>
                    ) : null}
                    {r.status === 'SENT' ? <Pill tone="green">Sent{r.sentCount > 1 ? ` ${r.sentCount}×` : ''}</Pill> : null}
                    {r.status === 'CANCELLED' ? <Pill tone="grey">Cancelled</Pill> : null}
                    {r.priceAtSet ? <span className="text-[12.5px] text-ink-muted">Set at {formatMoney(r.priceAtSet)}</span> : null}
                  </div>
                  {r.note ? <p className="mt-[6px] truncate text-[12.5px] italic text-ink-muted">“{r.note}”</p> : null}
                  <div className="mt-auto flex justify-end pt-[8px]">
                    <button type="button" onClick={() => setEditing(r)} className={BTN_SMALL}>
                      {tab === 'upcoming' ? (
                        <>
                          <Pencil aria-hidden="true" className="size-[13px]" /> Change
                        </>
                      ) : (
                        <>
                          <RotateCw aria-hidden="true" className="size-[13px]" /> Remind again
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {editing && editing.skuId ? (
        <RemindDialog
          open
          product={{ skuId: editing.skuId, title: editing.title, imageUrl: editing.imageUrl ?? undefined }}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load(tab);
          }}
        />
      ) : null}
    </>
  );
}
