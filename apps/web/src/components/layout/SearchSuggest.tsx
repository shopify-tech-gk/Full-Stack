'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Clock, Search, Tag, TrendingUp, X } from 'lucide-react';
import { formatMoney, type SearchSuggestions } from '@youmart/shared-client';
import { api } from '@/lib/api';

const RECENT_KEY = 'ym:recent-searches';
const RECENT_MAX = 8;

export function readRecent(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]).filter((s) => typeof s === 'string').slice(0, RECENT_MAX) : [];
  } catch {
    return [];
  }
}

export function rememberSearch(q: string) {
  const term = q.trim();
  if (!term) return;
  try {
    const next = [term, ...readRecent().filter((s) => s.toLowerCase() !== term.toLowerCase())].slice(0, RECENT_MAX);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // Storage blocked: recent searches just aren't kept.
  }
}

function forgetRecent(term: string): string[] {
  const next = readRecent().filter((s) => s !== term);
  try {
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

/** Bold the part of `text` after what was typed (Amazon-style completion highlight). */
function Completion({ text, typed }: { text: string; typed: string }) {
  const i = text.toLowerCase().indexOf(typed.toLowerCase());
  if (!typed || i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i + typed.length)}
      <strong className="font-semibold text-heading">{text.slice(i + typed.length)}</strong>
    </>
  );
}

const searchHref = (q: string, extra?: Record<string, string>) =>
  `/search?${new URLSearchParams({ q, ...(extra ?? {}) }).toString()}`;

/**
 * v1.17 suggestions under the header search box while typing (desktop): word completions, brands
 * with product counts, categories and the best products; recent searches when the box is empty.
 * `items` is the keyboard list (completions / recents) for up/down + Enter in the box.
 */
export function useSearchSuggest(query: string, open: boolean) {
  const [data, setData] = useState<SearchSuggestions | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const seq = useRef(0);

  useEffect(() => {
    if (open) setRecent(readRecent());
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    const mine = ++seq.current;
    if (!open || q.length < 2) {
      setData(null);
      return;
    }
    const t = setTimeout(() => {
      api.search
        .suggest(q, 6)
        .then((res) => mine === seq.current && setData(res))
        .catch(() => mine === seq.current && setData(null));
    }, 180);
    return () => clearTimeout(t);
  }, [query, open]);

  const items = query.trim().length >= 2 ? (data?.completions ?? []).slice(0, 7) : recent;
  return { data, recent, setRecent, items };
}

export function SearchSuggestPanel({
  query,
  data,
  recent,
  onRecentChange,
  active,
  onPick,
  onNavigate,
}: {
  query: string;
  data: SearchSuggestions | null;
  recent: string[];
  onRecentChange: (next: string[]) => void;
  /** Index of the keyboard-highlighted completion / recent search. */
  active: number;
  onPick: (term: string) => void;
  onNavigate: () => void;
}) {
  const typed = query.trim();
  const showRecent = typed.length < 2;
  if (showRecent && recent.length === 0) return null;
  if (!showRecent && !data) return null;
  if (!showRecent && data && !data.completions.length && !data.items.length && !data.brands.length) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[60] rounded-[14px] border border-catalog-rule bg-white p-[16px] font-ui text-[14px] text-ink-muted shadow-[0_18px_44px_rgba(15,23,42,0.18)]">
        No suggestions for &ldquo;{typed}&rdquo; - press Enter to search everything.
      </div>
    );
  }

  return (
    <div
      role="listbox"
      aria-label="Search suggestions"
      onMouseDown={(e) => e.preventDefault()}
      className="absolute left-0 right-0 top-[calc(100%+8px)] z-[60] overflow-hidden rounded-[14px] border border-catalog-rule bg-white font-ui shadow-[0_18px_44px_rgba(15,23,42,0.18)] lg:min-w-[720px]"
    >
      {showRecent ? (
        <div className="p-[8px]">
          <p className="px-[10px] pb-[4px] pt-[6px] text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Recent searches</p>
          {recent.map((term, i) => (
            <div key={term} className={`group flex items-center rounded-[8px] ${active === i ? 'bg-[#eef3fc]' : 'hover:bg-[#f6f8fb]'}`}>
              <button type="button" role="option" aria-selected={active === i} onClick={() => onPick(term)} className="flex flex-1 items-center gap-[10px] px-[10px] py-[8px] text-left text-[14.5px] text-ink-body">
                <Clock aria-hidden="true" className="size-[15px] text-ink-muted" /> {term}
              </button>
              <button
                type="button"
                aria-label={`Remove ${term} from recent searches`}
                onClick={() => onRecentChange(forgetRecent(term))}
                className="mr-[6px] flex size-[26px] items-center justify-center rounded-full text-ink-muted opacity-0 hover:bg-white hover:text-heading group-hover:opacity-100"
              >
                <X aria-hidden="true" className="size-[14px]" />
              </button>
            </div>
          ))}
        </div>
      ) : data ? (
        <div className="grid lg:grid-cols-[1fr_1.25fr]">
          <div className="border-b border-catalog-rule p-[8px] lg:border-b-0 lg:border-r">
            {data.completions.slice(0, 7).map((c, i) => (
              <button
                key={c}
                type="button"
                role="option"
                aria-selected={active === i}
                onClick={() => onPick(c)}
                className={`flex w-full items-center gap-[10px] rounded-[8px] px-[10px] py-[8px] text-left text-[14.5px] text-ink-muted ${active === i ? 'bg-[#eef3fc]' : 'hover:bg-[#f6f8fb]'}`}
              >
                <Search aria-hidden="true" className="size-[15px] shrink-0" />
                <span className="truncate">
                  <Completion text={c} typed={typed} />
                </span>
              </button>
            ))}
            {data.brands.length ? (
              <>
                <p className="px-[10px] pb-[4px] pt-[10px] text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">Brands</p>
                <div className="flex flex-wrap gap-[6px] px-[10px] pb-[6px]">
                  {data.brands.slice(0, 6).map((b) => (
                    <Link
                      key={b.value}
                      href={searchHref(b.value, { brand: b.value })}
                      onClick={onNavigate}
                      className="inline-flex items-center gap-[6px] rounded-full border border-catalog-rule px-[10px] py-[4px] text-[13px] font-semibold text-heading hover:border-brand hover:text-brand"
                    >
                      <Tag aria-hidden="true" className="size-[12px]" /> {b.value}
                      <span className="font-normal text-ink-muted">{b.count.toLocaleString('en-IN')}</span>
                    </Link>
                  ))}
                </div>
              </>
            ) : null}
            {data.categories.length ? (
              <>
                <p className="px-[10px] pb-[4px] pt-[8px] text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">In categories</p>
                {data.categories.slice(0, 4).map((c) => (
                  <Link
                    key={c.value}
                    href={searchHref(typed, { categories: c.value })}
                    onClick={onNavigate}
                    className="flex items-center justify-between rounded-[8px] px-[10px] py-[6px] text-[14px] text-ink-body hover:bg-[#f6f8fb]"
                  >
                    <span>
                      <span className="text-ink-muted">{typed} in </span>
                      <span className="font-semibold text-brand">{c.value}</span>
                    </span>
                    <span className="text-[12px] text-ink-muted">{c.count.toLocaleString('en-IN')}</span>
                  </Link>
                ))}
              </>
            ) : null}
          </div>
          {data.items.length ? (
            <div className="p-[8px]">
              <p className="flex items-center gap-[6px] px-[10px] pb-[4px] pt-[6px] text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
                <TrendingUp aria-hidden="true" className="size-[13px]" /> Top products
              </p>
              {data.items.slice(0, 5).map((p) => (
                <Link key={p.id} href={`/product/${p.slug}`} onClick={onNavigate} className="flex items-center gap-[12px] rounded-[10px] px-[8px] py-[6px] hover:bg-[#f6f8fb]">
                  <span className="flex size-[48px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] border border-catalog-rule bg-white">
                    {p.primaryImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.primaryImageUrl} alt="" className="size-full object-contain p-[3px]" loading="lazy" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-1 text-[13.5px] font-medium text-heading">{p.title}</span>
                    <span className="text-[13px]">
                      <strong className="text-heading">{formatMoney(p.price)}</strong>
                      {p.mrp !== p.price ? <span className="ml-[6px] text-ink-muted line-through">{formatMoney(p.mrp)}</span> : null}
                    </span>
                  </span>
                </Link>
              ))}
              <Link href={searchHref(typed)} onClick={onNavigate} className="mt-[4px] block rounded-[8px] px-[10px] py-[8px] text-center text-[13.5px] font-semibold text-brand hover:bg-[#eef3fc]">
                See all results for &ldquo;{typed}&rdquo;
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
