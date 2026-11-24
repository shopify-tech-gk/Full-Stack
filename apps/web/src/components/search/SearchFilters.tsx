'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Check, ChevronDown, SlidersHorizontal, Star, X } from 'lucide-react';
import type { SearchFilterGroup } from '@youmart/shared-client';

const RATINGS = [4, 3, 2];
const DISCOUNTS = [10, 25, 40, 50, 60];
const SORTS = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest first' },
] as const;

/** The URL param a filter group is sent back as. */
const paramOf = (g: SearchFilterGroup) => (g.key === 'brand' ? 'brand' : g.key === 'category' ? 'categories' : `f_${g.key}`);
const listOf = (v: string | null) => (v ? v.split(',').filter(Boolean) : []);

function useFilterUrl() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const set = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '') next.delete(k);
      else next.set(k, v);
    }
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  };
  return { params, set };
}

/** Sort dropdown + result count over the grid. */
export function SearchToolbar({ total, q }: { total: number; q: string }) {
  const { params, set } = useFilterUrl();
  const sort = params.get('sort') ?? 'relevance';
  return (
    <div className="mb-[16px] flex flex-wrap items-center justify-between gap-[12px] rounded-[12px] border border-catalog-rule bg-white px-[16px] py-[10px] font-ui shadow-rail-card">
      <p className="text-[14px] text-ink-muted">
        <strong className="text-heading">{total.toLocaleString('en-IN')}</strong> result{total === 1 ? '' : 's'} for{' '}
        <strong className="text-heading">&ldquo;{q}&rdquo;</strong>
      </p>
      <label className="flex items-center gap-[8px] text-[14px] text-ink-muted">
        Sort by
        <span className="relative">
          <select
            value={sort}
            onChange={(e) => set({ sort: e.target.value === 'relevance' ? null : e.target.value })}
            className="h-[36px] appearance-none rounded-[8px] border border-catalog-rule bg-white pl-[12px] pr-[32px] text-[14px] font-semibold text-heading focus:border-brand focus:outline-none"
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-[10px] top-1/2 size-[14px] -translate-y-1/2" />
        </span>
      </label>
    </div>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-catalog-rule py-[12px] last:border-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between text-left text-[13px] font-semibold uppercase tracking-[0.05em] text-heading"
      >
        {title}
        <ChevronDown aria-hidden="true" className={`size-[15px] text-ink-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="mt-[10px]">{children}</div> : null}
    </div>
  );
}

function CheckRow({ on, label, count, onClick }: { on: boolean; label: React.ReactNode; count?: number; onClick: () => void }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} onClick={onClick} className="group flex w-full items-center gap-[10px] py-[4px] text-left text-[14px]">
      <span
        className={`flex size-[17px] shrink-0 items-center justify-center rounded-[4px] border transition-colors ${
          on ? 'border-brand bg-brand text-white' : 'border-[#cbd5e1] bg-white group-hover:border-brand'
        }`}
      >
        {on ? <Check aria-hidden="true" className="size-[12px]" strokeWidth={3} /> : null}
      </span>
      <span className={`min-w-0 flex-1 truncate ${on ? 'font-semibold text-heading' : 'text-ink-body'}`}>{label}</span>
      {count !== undefined ? <span className="text-[12px] text-ink-muted">{count.toLocaleString('en-IN')}</span> : null}
    </button>
  );
}

function GroupFilter({ group, selected, onToggle }: { group: SearchFilterGroup; selected: string[]; onToggle: (v: string) => void }) {
  const [query, setQuery] = useState('');
  const [all, setAll] = useState(false);
  const values = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? group.values.filter((v) => v.value.toLowerCase().includes(q)) : group.values;
    // Selected values first, so they're visible when the list is collapsed.
    return [...list.filter((v) => selected.includes(v.value)), ...list.filter((v) => !selected.includes(v.value))];
  }, [group.values, query, selected]);
  const shown = all || query ? values : values.slice(0, 7);
  return (
    <>
      {group.values.length > 10 ? (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${group.label.toLowerCase()}`}
          className="mb-[8px] h-[34px] w-full rounded-[8px] border border-catalog-rule px-[10px] text-[13.5px] focus:border-brand focus:outline-none"
        />
      ) : null}
      <div className="max-h-[300px] overflow-y-auto pr-[2px]">
        {shown.map((v) => (
          <CheckRow
            key={v.value}
            on={selected.includes(v.value)}
            label={group.type === 'boolean' ? 'Yes' : `${v.value}${group.unit ? ` ${group.unit}` : ''}`}
            count={v.count}
            onClick={() => onToggle(v.value)}
          />
        ))}
      </div>
      {!query && values.length > 7 ? (
        <button type="button" onClick={() => setAll((a) => !a)} className="mt-[6px] text-[13px] font-semibold text-brand hover:underline">
          {all ? 'Show less' : `Show all ${values.length}`}
        </button>
      ) : null}
    </>
  );
}

/** v1.17 search filters as a desktop sidebar: price, rating, discount, brand, category, specs. */
export function SearchFilters({ groups, price }: { groups: SearchFilterGroup[]; price: { min: number; max: number } | null }) {
  const { params, set } = useFilterUrl();
  const [min, setMin] = useState(params.get('minPrice') ?? '');
  const [max, setMax] = useState(params.get('maxPrice') ?? '');
  const minRating = Number(params.get('minRating') ?? 0);
  const minDiscount = Number(params.get('minDiscount') ?? 0);

  const toggle = (param: string, value: string) => {
    const cur = listOf(params.get(param));
    const next = cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value];
    set({ [param]: next.join(',') || null });
  };

  const chips: { label: string; clear: () => void }[] = [];
  for (const g of groups) {
    for (const v of listOf(params.get(paramOf(g)))) {
      chips.push({ label: g.type === 'boolean' ? g.label : v, clear: () => toggle(paramOf(g), v) });
    }
  }
  if (params.get('minPrice') || params.get('maxPrice')) {
    chips.push({
      label: `₹${params.get('minPrice') ?? '0'} – ${params.get('maxPrice') ? `₹${params.get('maxPrice')}` : 'any'}`,
      clear: () => {
        setMin('');
        setMax('');
        set({ minPrice: null, maxPrice: null });
      },
    });
  }
  if (minRating) chips.push({ label: `${minRating}★ & up`, clear: () => set({ minRating: null }) });
  if (minDiscount) chips.push({ label: `${minDiscount}% off or more`, clear: () => set({ minDiscount: null }) });

  const clearAll = () => {
    const keep: Record<string, string | null> = {};
    params.forEach((_, k) => {
      if (k !== 'q' && k !== 'sort') keep[k] = null;
    });
    setMin('');
    setMax('');
    set(keep);
  };

  return (
    <aside aria-label="Filters" className="rounded-[14px] border border-catalog-rule bg-white px-[16px] py-[6px] font-ui shadow-rail-card">
      <div className="flex items-center justify-between border-b border-catalog-rule py-[12px]">
        <p className="flex items-center gap-[8px] text-[16px] font-semibold text-heading">
          <SlidersHorizontal aria-hidden="true" className="size-[17px] text-brand" /> Filters
        </p>
        {chips.length ? (
          <button type="button" onClick={clearAll} className="text-[13px] font-semibold text-brand hover:underline">
            Clear all
          </button>
        ) : null}
      </div>
      {chips.length ? (
        <div className="flex flex-wrap gap-[6px] border-b border-catalog-rule py-[12px]">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.clear}
              className="inline-flex items-center gap-[4px] rounded-full bg-[#eef3fc] px-[10px] py-[4px] text-[12.5px] font-semibold text-brand hover:bg-[#dfe9fb]"
            >
              {c.label} <X aria-hidden="true" className="size-[12px]" />
            </button>
          ))}
        </div>
      ) : null}

      <Section title="Price">
        {price ? (
          <p className="mb-[8px] text-[12.5px] text-ink-muted">
            ₹{Math.floor(price.min).toLocaleString('en-IN')} – ₹{Math.ceil(price.max).toLocaleString('en-IN')} in these results
          </p>
        ) : null}
        <form
          className="flex items-center gap-[6px]"
          onSubmit={(e) => {
            e.preventDefault();
            set({ minPrice: min.trim() || null, maxPrice: max.trim() || null });
          }}
        >
          <input value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Min" aria-label="Minimum price" className="h-[34px] w-full min-w-0 rounded-[8px] border border-catalog-rule px-[8px] text-[13.5px] focus:border-brand focus:outline-none" />
          <span className="text-ink-muted">–</span>
          <input value={max} onChange={(e) => setMax(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="Max" aria-label="Maximum price" className="h-[34px] w-full min-w-0 rounded-[8px] border border-catalog-rule px-[8px] text-[13.5px] focus:border-brand focus:outline-none" />
          <button type="submit" className="h-[34px] shrink-0 rounded-[8px] bg-brand px-[10px] text-[13px] font-semibold text-white">
            Go
          </button>
        </form>
      </Section>

      <Section title="Customer rating">
        {RATINGS.map((r) => (
          <CheckRow
            key={r}
            on={minRating === r}
            label={
              <span className="inline-flex items-center gap-[4px]">
                {r}
                <Star aria-hidden="true" className="size-[13px] fill-[#f5a400] text-[#f5a400]" /> & up
              </span>
            }
            onClick={() => set({ minRating: minRating === r ? null : String(r) })}
          />
        ))}
      </Section>

      <Section title="Discount">
        {DISCOUNTS.map((d) => (
          <CheckRow key={d} on={minDiscount === d} label={`${d}% off or more`} onClick={() => set({ minDiscount: minDiscount === d ? null : String(d) })} />
        ))}
      </Section>

      {groups.map((g, i) => (
        <Section key={g.key} title={g.label} defaultOpen={i < 4}>
          <GroupFilter group={g} selected={listOf(params.get(paramOf(g)))} onToggle={(v) => toggle(paramOf(g), v)} />
        </Section>
      ))}
    </aside>
  );
}
