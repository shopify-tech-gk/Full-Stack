'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, CheckCircle2, Loader2, PackageSearch, Search, Send, Sparkles } from 'lucide-react';
import { ApiError, formatMoney, loginHref, type FinderMessage } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const POLL_MS = 4000;
const EXAMPLES = ['Organic vermicompost 5 kg', 'Steel lunch box for kids', 'Red saree under ₹1000', 'Birthday candles'];

function Avatar({ name, mine }: { name: string; mine: boolean }) {
  const letters = name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || '?';
  return (
    <span className={`flex size-[34px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-semibold ${mine ? 'bg-brand text-white' : 'bg-[#e2e8f0] text-heading'}`}>
      {letters}
    </span>
  );
}

const time = (iso: string) => new Intl.DateTimeFormat('en-IN', { hour: 'numeric', minute: '2-digit' }).format(new Date(iso));

/**
 * v1.18 YouFind Bot on the website: a public room like a Telegram product-bot group. Every shopper
 * sees every question and the bot's reply (matching products, or "not found" with Request restock).
 */
export function YouFindRoom() {
  const session = useSession();
  const pathname = usePathname();
  const signedIn = session.status === 'authenticated';
  // Oldest first (chat order); the feed API answers newest first.
  const [items, setItems] = useState<FinderMessage[]>([]);
  const [today, setToday] = useState(0);
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState<'idle' | 'loading' | 'done'>('idle');
  const [text, setText] = useState('');
  const [sending, setSending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [restocked, setRestocked] = useState<Record<string, 'busy' | 'done'>>({});
  const newest = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const merge = useCallback((fresh: FinderMessage[], atEnd: boolean) => {
    if (!fresh.length) return;
    setItems((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const add = [...fresh].reverse().filter((m) => !seen.has(m.id));
      const next = atEnd ? [...prev, ...add] : [...add, ...prev];
      newest.current = next[next.length - 1]?.id ?? newest.current;
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    const poll = async () => {
      try {
        const feed = await api.support.finder.list(newest.current ? { after: newest.current, limit: 50 } : { limit: 30 });
        if (!alive) return;
        setToday(feed.todayCount);
        if (!newest.current && feed.items.length < 30) setOlder('done');
        merge(feed.items, true);
      } catch {
        // Offline for a moment: the next tick tries again.
      } finally {
        if (alive) setLoading(false);
      }
    };
    void poll();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void poll();
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [merge]);

  // Keep the newest message in view unless the shopper scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [items, sending]);

  const loadOlder = async () => {
    const oldest = items[0]?.id;
    if (!oldest || older !== 'idle') return;
    setOlder('loading');
    const el = scroller.current;
    const before = el?.scrollHeight ?? 0;
    try {
      const feed = await api.support.finder.list({ before: oldest, limit: 30 });
      stick.current = false;
      merge(feed.items, false);
      setOlder(feed.items.length < 30 ? 'done' : 'idle');
      requestAnimationFrame(() => {
        if (el) el.scrollTop = el.scrollHeight - before;
      });
    } catch {
      setOlder('idle');
    }
  };

  const ask = async (value: string) => {
    const q = value.trim();
    if (q.length < 2 || sending) return;
    setError(null);
    setSending(q);
    setText('');
    stick.current = true;
    try {
      const reply = await api.support.finder.ask(q);
      merge([reply], true);
      setToday((n) => n + 1);
    } catch (err) {
      setText(q);
      setError(err instanceof ApiError ? err.message : 'Could not send. Please try again.');
    } finally {
      setSending(null);
    }
  };

  const restock = async (m: FinderMessage) => {
    setRestocked((r) => ({ ...r, [m.id]: 'busy' }));
    try {
      await api.support.requestRestock({ item: m.text, note: 'From YouFind Bot (website)' });
      setRestocked((r) => ({ ...r, [m.id]: 'done' }));
    } catch {
      setRestocked((r) => {
        const next = { ...r };
        delete next[m.id];
        return next;
      });
    }
  };

  return (
    <div className="grid items-start gap-[20px] font-ui lg:grid-cols-[1fr_320px]">
      <section className="flex h-[calc(100vh-220px)] min-h-[560px] flex-col overflow-hidden rounded-[18px] border border-catalog-rule bg-white shadow-rail-card">
        <header className="flex items-center gap-[12px] border-b border-catalog-rule bg-[linear-gradient(135deg,#064e3b,#059669_60%,#10b981)] px-[20px] py-[14px] text-white">
          <span className="flex size-[42px] items-center justify-center rounded-full bg-white/15">
            <Search aria-hidden="true" className="size-[20px]" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] font-semibold">YouFind Bot</h1>
            <p className="flex items-center gap-[6px] text-[13px] text-white/85">
              <span className="size-[8px] animate-pulse rounded-full bg-[#a7f3d0]" />
              Live · {today} {today === 1 ? 'question' : 'questions'} today · replies in seconds
            </p>
          </div>
        </header>

        <div
          ref={scroller}
          onScroll={(e) => {
            const el = e.currentTarget;
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            if (el.scrollTop < 40) void loadOlder();
          }}
          className="flex-1 space-y-[18px] overflow-y-auto bg-[#f6f8fb] px-[20px] py-[18px]"
        >
          {older === 'loading' ? (
            <p className="text-center text-[13px] text-ink-muted">
              <Loader2 aria-hidden="true" className="mr-[6px] inline size-[14px] animate-spin" /> Loading earlier questions…
            </p>
          ) : older === 'done' && items.length ? (
            <p className="text-center text-[12.5px] text-ink-muted">That&rsquo;s the start of the room.</p>
          ) : null}
          {loading ? (
            <p className="py-[40px] text-center text-[14px] text-ink-muted">
              <Loader2 aria-hidden="true" className="mr-[6px] inline size-[16px] animate-spin" /> Joining the room…
            </p>
          ) : null}
          {items.map((m) => (
            <div key={m.id} className="space-y-[8px]">
              <div className={`flex items-end gap-[10px] ${m.mine ? 'flex-row-reverse' : ''}`}>
                <Avatar name={m.name} mine={m.mine} />
                <div className={`max-w-[70%] rounded-[16px] px-[14px] py-[9px] text-[14.5px] leading-[1.45] ${m.mine ? 'rounded-br-[4px] bg-brand text-white' : 'rounded-bl-[4px] bg-white text-heading shadow-rail-card'}`}>
                  <p className={`mb-[2px] text-[12px] font-semibold ${m.mine ? 'text-white/80' : 'text-brand'}`}>
                    {m.mine ? 'You' : m.name} · {time(m.createdAt)}
                  </p>
                  {m.text}
                </div>
              </div>
              <div className="ml-[44px] max-w-[min(640px,85%)] rounded-[16px] rounded-tl-[4px] border border-[#bbf7d0] bg-white p-[12px] shadow-rail-card">
                <p className="mb-[6px] flex items-center gap-[6px] text-[12.5px] font-semibold text-[#047857]">
                  <Sparkles aria-hidden="true" className="size-[13px]" /> YouFind Bot
                  <span className="font-normal text-ink-muted">replying to “{m.text.length > 40 ? `${m.text.slice(0, 40)}…` : m.text}”</span>
                </p>
                {m.result === 'FOUND' ? (
                  <>
                    <p className="mb-[8px] text-[14px] text-heading">
                      Found <strong>{m.found.toLocaleString('en-IN')}</strong> matching product{m.found === 1 ? '' : 's'}:
                    </p>
                    <div className="grid gap-[8px] md:grid-cols-2 lg:grid-cols-3">
                      {m.products.slice(0, 6).map((p) => (
                        <Link key={p.id} href={`/product/${p.slug}`} className="flex gap-[8px] rounded-[10px] border border-catalog-rule p-[6px] transition-colors hover:border-brand">
                          <span className="flex size-[52px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-white">
                            {p.imageUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.imageUrl} alt="" className="size-full object-contain" loading="lazy" />
                            ) : (
                              <PackageSearch aria-hidden="true" className="size-[18px] text-[#cbd5e1]" />
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="line-clamp-2 text-[12.5px] font-medium leading-[1.35] text-heading">{p.title}</span>
                            <span className="text-[12.5px] font-semibold text-heading">{formatMoney(p.price)}</span>
                          </span>
                        </Link>
                      ))}
                    </div>
                    {m.found > 6 ? (
                      <Link href={`/search?q=${encodeURIComponent(m.text)}`} className="mt-[8px] inline-block text-[13px] font-semibold text-brand hover:underline">
                        See all {m.found.toLocaleString('en-IN')} results
                      </Link>
                    ) : null}
                  </>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-[10px]">
                    <p className="text-[14px] text-heading">Not in stock right now - we can try to get it for you.</p>
                    {restocked[m.id] === 'done' ? (
                      <span className="inline-flex items-center gap-[6px] text-[13px] font-semibold text-[#15803d]">
                        <CheckCircle2 aria-hidden="true" className="size-[15px]" /> Restock requested
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void restock(m)}
                        disabled={restocked[m.id] === 'busy'}
                        className="inline-flex h-[32px] items-center gap-[6px] rounded-[8px] bg-[#059669] px-[12px] text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
                      >
                        {restocked[m.id] === 'busy' ? <Loader2 aria-hidden="true" className="size-[14px] animate-spin" /> : <Bell aria-hidden="true" className="size-[14px]" />}
                        Request restock
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          {sending ? (
            <div className="space-y-[8px]">
              <div className="flex flex-row-reverse items-end gap-[10px]">
                <Avatar name="You" mine />
                <div className="max-w-[70%] rounded-[16px] rounded-br-[4px] bg-brand px-[14px] py-[9px] text-[14.5px] text-white">{sending}</div>
              </div>
              <p className="ml-[44px] flex items-center gap-[8px] text-[13px] text-[#047857]">
                <Loader2 aria-hidden="true" className="size-[14px] animate-spin" /> YouFind Bot is searching…
              </p>
            </div>
          ) : null}
        </div>

        <div className="border-t border-catalog-rule bg-white p-[12px]">
          {error ? <p className="mb-[8px] text-[13px] text-woo-error">{error}</p> : null}
          {signedIn ? (
            <form
              className="flex gap-[10px]"
              onSubmit={(e) => {
                e.preventDefault();
                void ask(text);
              }}
            >
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={200}
                placeholder="What are you looking for? e.g. “steel water bottle 1 litre”"
                className="h-[46px] flex-1 rounded-[12px] border border-catalog-rule px-[14px] text-[15px] text-ink-input placeholder:text-ink-placeholder focus:border-[#059669] focus:outline-none focus:ring-2 focus:ring-[#059669]/20"
              />
              <button type="submit" disabled={!!sending || text.trim().length < 2} className="inline-flex h-[46px] items-center gap-[8px] rounded-[12px] bg-[#059669] px-[18px] text-[14.5px] font-semibold text-white disabled:opacity-50">
                <Send aria-hidden="true" className="size-[16px]" /> Ask
              </button>
            </form>
          ) : (
            <p className="flex items-center justify-between gap-[10px] text-[14px] text-ink-muted">
              Anyone can read the room. Sign in to ask your own question.
              <Link href={loginHref(pathname)} className="inline-flex h-[38px] items-center rounded-[10px] bg-[#059669] px-[16px] font-semibold text-white">
                Sign in to ask
              </Link>
            </p>
          )}
        </div>
      </section>

      <aside className="space-y-[16px]">
        <div className="rounded-[16px] border border-catalog-rule bg-white p-[18px] shadow-rail-card">
          <h2 className="mb-[10px] text-[16px] font-semibold text-heading">How it works</h2>
          <ol className="space-y-[10px] text-[13.5px] leading-[1.5] text-ink-body">
            <li><strong className="text-heading">1. Ask</strong> - type what you&rsquo;re looking for, in your own words.</li>
            <li><strong className="text-heading">2. Bot replies</strong> - matching products from 5 lakh+ in seconds.</li>
            <li><strong className="text-heading">3. Not found?</strong> - tap Request restock and we&rsquo;ll try to stock it.</li>
          </ol>
          <p className="mt-[12px] text-[12.5px] text-ink-muted">Questions are public - only your first name and initial are shown.</p>
        </div>
        {signedIn ? (
          <div className="rounded-[16px] border border-catalog-rule bg-white p-[18px] shadow-rail-card">
            <h2 className="mb-[10px] text-[16px] font-semibold text-heading">Try asking</h2>
            <div className="flex flex-wrap gap-[8px]">
              {EXAMPLES.map((e) => (
                <button key={e} type="button" onClick={() => void ask(e)} disabled={!!sending} className="rounded-full border border-catalog-rule px-[12px] py-[5px] text-[13px] text-heading hover:border-[#059669] hover:text-[#047857]">
                  {e}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <Link href="/customer-care" className="flex items-center gap-[12px] rounded-[16px] bg-[linear-gradient(135deg,#4c1d95,#6d28d9_60%,#8b5cf6)] p-[16px] text-white shadow-[0_10px_28px_rgba(109,40,217,0.28)]">
          <Sparkles aria-hidden="true" className="size-[22px]" />
          <span>
            <span className="block text-[15px] font-semibold">Prefer a private chat?</span>
            <span className="block text-[12.5px] text-white/80">Ask YouMart AI one-to-one</span>
          </span>
        </Link>
      </aside>
    </div>
  );
}
