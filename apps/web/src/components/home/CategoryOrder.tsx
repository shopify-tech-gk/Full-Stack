'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, Loader2, RotateCcw } from 'lucide-react';
import { BTN_PRIMARY, BTN_SECONDARY, Dialog } from '@/components/account/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

// W8 on the website: the shopper's own home category order (like arranging a home screen). Signed
// in, it is saved to the account - the same order the app uses; otherwise kept in this browser.
const KEY = 'ym.categoryOrder.v1';

function readLocal(): string[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter((s): s is string => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocal(order: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(order));
  } catch {
    // ignore
  }
}

/** `all` in the saved order (unknown / new ones appended in their natural order) + a saver. */
export function useCategoryOrder<T extends { slug: string }>(all: readonly T[]) {
  const authed = useSession().status === 'authenticated';
  const [order, setOrder] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (authed) {
      api.auth
        .getPreferences()
        .then(({ categoryOrder }) => active && setOrder(categoryOrder))
        .catch(() => active && setOrder(readLocal()));
    } else {
      setOrder(readLocal());
    }
    return () => {
      active = false;
    };
  }, [authed]);

  const ordered = useMemo(() => {
    if (!order.length) return [...all];
    const bySlug = new Map(all.map((c) => [c.slug, c]));
    const out: T[] = [];
    for (const slug of order) {
      const c = bySlug.get(slug);
      if (c) {
        out.push(c);
        bySlug.delete(slug);
      }
    }
    return [...out, ...all.filter((c) => bySlug.has(c.slug))];
  }, [all, order]);

  const save = async (next: string[]) => {
    setOrder(next);
    writeLocal(next);
    if (authed) await api.auth.setCategoryOrder(next);
  };

  return { ordered, save, custom: order.length > 0 };
}

/** The arrange dialog: drag rows (or use the arrows), then Save. */
export function ArrangeCategories<T extends { slug: string; name: string }>({
  open,
  onClose,
  items,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  items: readonly T[];
  onSave: (slugs: string[]) => Promise<void>;
}) {
  const [list, setList] = useState<T[]>([...items]);
  const [drag, setDrag] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setList([...items]);
      setError(null);
    }
  }, [open, items]);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= list.length || from === to) return;
    setList((cur) => {
      const next = [...cur];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x!);
      return next;
    });
  };

  const save = async (slugs: string[]) => {
    setBusy(true);
    setError(null);
    try {
      await onSave(slugs);
      onClose();
    } catch {
      setError('Couldn’t save your order. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => !busy && onClose()}
      width={520}
      title="Arrange your categories"
      description="Drag to put your favourite categories first. Signed in, the app uses the same order."
      footer={
        <>
          <button type="button" onClick={() => void save([])} disabled={busy} className={`${BTN_SECONDARY} mr-auto`}>
            <RotateCcw aria-hidden="true" className="size-[15px]" /> Reset
          </button>
          <button type="button" onClick={onClose} disabled={busy} className={BTN_SECONDARY}>
            Cancel
          </button>
          <button type="button" onClick={() => void save(list.map((c) => c.slug))} disabled={busy} className={BTN_PRIMARY}>
            {busy ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
            Save order
          </button>
        </>
      }
    >
      <ol className="max-h-[52vh] space-y-[6px] overflow-y-auto pr-[4px]">
        {list.map((c, i) => (
          <li
            key={c.slug}
            draggable
            onDragStart={() => setDrag(i)}
            onDragOver={(e) => {
              e.preventDefault();
              if (drag !== null && drag !== i) {
                move(drag, i);
                setDrag(i);
              }
            }}
            onDragEnd={() => setDrag(null)}
            className={`flex cursor-grab items-center gap-[10px] rounded-[10px] border px-[10px] py-[8px] text-[14.5px] transition-colors active:cursor-grabbing ${
              drag === i ? 'border-brand bg-[#eef3fc] shadow-rail-card' : 'border-catalog-rule bg-white'
            }`}
          >
            <GripVertical aria-hidden="true" className="size-[16px] text-ink-muted" />
            <span className="w-[22px] text-right text-[12.5px] tabular-nums text-ink-muted">{i + 1}</span>
            <span className="flex-1 font-medium text-heading">{c.name}</span>
            <button type="button" aria-label={`Move ${c.name} up`} onClick={() => move(i, i - 1)} disabled={i === 0} className="flex size-[28px] items-center justify-center rounded-full text-ink-muted hover:bg-[#f1f5f9] hover:text-brand disabled:opacity-30">
              <ArrowUp aria-hidden="true" className="size-[15px]" />
            </button>
            <button type="button" aria-label={`Move ${c.name} down`} onClick={() => move(i, i + 1)} disabled={i === list.length - 1} className="flex size-[28px] items-center justify-center rounded-full text-ink-muted hover:bg-[#f1f5f9] hover:text-brand disabled:opacity-30">
              <ArrowDown aria-hidden="true" className="size-[15px]" />
            </button>
          </li>
        ))}
      </ol>
      {error ? <p className="mt-[10px] text-[13.5px] text-woo-error">{error}</p> : null}
    </Dialog>
  );
}
