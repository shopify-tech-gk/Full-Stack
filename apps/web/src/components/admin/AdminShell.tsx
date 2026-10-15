'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BadgePercent,
  Boxes,
  CircleSlash,
  Headset,
  LayoutDashboard,
  Loader2,
  LockKeyhole,
  LogOut,
  Menu,
  PackageCheck,
  Undo2,
  Users,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  adminFetch,
  adminLogin,
  can,
  readAdminSession,
  signOutAdmin,
  type AdminOrderListItem,
  type AdminSession,
  type AdminStats,
  type Page,
} from '@/lib/admin';
import { formatMoney } from '@youmart/shared-client';
import { inputClass } from './ui';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  permission: string;
  count?: (c: NavCounts) => number;
}

interface NavCounts {
  toPack: number;
  cancelRequests: number;
  returns: number;
  tickets: number;
}

const NAV: Array<{ heading: string; items: NavItem[] }> = [
  {
    heading: 'Overview',
    items: [
      { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, permission: 'orders.manage' },
    ],
  },
  {
    heading: 'Sales',
    items: [
      {
        href: '/admin/orders',
        label: 'Orders',
        icon: PackageCheck,
        permission: 'orders.manage',
        count: (c) => c.toPack,
      },
      {
        href: '/admin/cancellations',
        label: 'Cancellations',
        icon: CircleSlash,
        permission: 'orders.manage',
        count: (c) => c.cancelRequests,
      },
      {
        href: '/admin/returns',
        label: 'Returns & refunds',
        icon: Undo2,
        permission: 'returns.manage',
        count: (c) => c.returns,
      },
    ],
  },
  {
    heading: 'Catalog',
    items: [
      { href: '/admin/products', label: 'Products & stock', icon: Boxes, permission: 'catalog.manage' },
      { href: '/admin/coupons', label: 'Coupons', icon: BadgePercent, permission: 'promotions.manage' },
    ],
  },
  {
    heading: 'People',
    items: [
      { href: '/admin/customers', label: 'Customers', icon: Users, permission: 'customers.view' },
      {
        href: '/admin/support',
        label: 'Support',
        icon: Headset,
        permission: 'support.manage',
        count: (c) => c.tickets,
      },
    ],
  },
];

const ROLE_LABEL: Record<AdminSession['admin']['role'], string> = {
  SUPER_ADMIN: 'Super admin',
  OPS: 'Operations',
  SUPPORT: 'Support',
  FINANCE: 'Finance',
};

const AdminContext = createContext<{
  session: AdminSession;
  refreshCounts: () => void;
} | null>(null);

export function useAdmin() {
  const value = useContext(AdminContext);
  if (!value) throw new Error('useAdmin outside AdminShell');
  return value;
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession | null | undefined>(undefined);
  const [counts, setCounts] = useState<NavCounts>({
    toPack: 0,
    cancelRequests: 0,
    returns: 0,
    tickets: 0,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname() ?? '/admin';

  useEffect(() => {
    const sync = () => setSession(readAdminSession());
    sync();
    window.addEventListener('ym-admin-session', sync);
    return () => window.removeEventListener('ym-admin-session', sync);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  // Live updates: every few seconds a light check of what changed (new orders, statuses, queues,
  // help requests). When anything moved, every open page refreshes in place (`ym-admin-live`, see
  // useAdminData) and a brand-new order pops an alert with a chime.
  const [alert, setAlert] = useState<AdminOrderListItem | null>(null);
  const lastSignature = useRef<string | null>(null);
  const lastOrderId = useRef<string | null>(null);
  const polling = useRef(false);

  const refreshCounts = useCallback(async () => {
    const s = readAdminSession();
    if (!s || polling.current) return;
    polling.current = true;
    try {
      const [stats, latest, returns, tickets] = await Promise.all([
        can(s, 'orders.manage')
          ? adminFetch<AdminStats>('/orders/admin/stats').catch(() => null)
          : null,
        can(s, 'orders.manage')
          ? adminFetch<Page<AdminOrderListItem>>('/orders/admin/orders?limit=5').catch(() => null)
          : null,
        can(s, 'returns.manage')
          ? adminFetch<{ items: Array<{ id: string; status: string }> }>(
              '/admin/returns?limit=20',
            ).catch(() => null)
          : null,
        can(s, 'support.manage')
          ? adminFetch<{
              counts: Record<string, number>;
              items: Array<{ ticketId: string; updatedAt: string }>;
            }>('/support/admin/tickets?limit=5').catch(() => null)
          : null,
      ]);
      setCounts({
        toPack: stats?.queues.toPack ?? 0,
        cancelRequests: stats?.queues.cancelRequests ?? 0,
        returns: returns?.items.filter((r) => r.status === 'REQUESTED').length ?? 0,
        tickets: tickets?.counts.OPEN ?? 0,
      });

      const signature = JSON.stringify([
        stats?.today,
        stats?.queues,
        latest?.items.map((o) => [o.orderId, o.status, o.itemStatuses]),
        returns?.items.map((r) => [r.id, r.status]),
        tickets?.counts,
        tickets?.items.map((t) => [t.ticketId, t.updatedAt]),
      ]);
      if (lastSignature.current !== null && signature !== lastSignature.current) {
        window.dispatchEvent(new Event('ym-admin-live'));
      }
      lastSignature.current = signature;

      const newest = latest?.items[0];
      if (newest) {
        if (lastOrderId.current && newest.orderId !== lastOrderId.current) {
          setAlert(newest);
          chime();
        }
        lastOrderId.current = newest.orderId;
      }
    } finally {
      polling.current = false;
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    void refreshCounts();
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshCounts();
    }, 5_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshCounts();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session, refreshCounts]);

  // The alert stays a while, then goes away by itself.
  useEffect(() => {
    if (!alert) return;
    const t = setTimeout(() => setAlert(null), 9_000);
    return () => clearTimeout(t);
  }, [alert]);

  if (session === undefined) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#f4f6fb]">
        <Loader2 aria-label="Loading" className="size-[24px] animate-spin text-[#0142aa]" />
      </div>
    );
  }
  if (!session) return <AdminLogin />;

  const sidebar = (
    <nav aria-label="Admin" className="flex flex-1 flex-col gap-[18px] overflow-y-auto px-[14px] pb-[18px]">
      {NAV.map((group) => {
        const items = group.items.filter((item) => can(session, item.permission));
        if (items.length === 0) return null;
        return (
          <div key={group.heading}>
            <p className="mb-[6px] px-[12px] text-[11px] font-semibold uppercase tracking-[0.14em] text-[#7f8db0]">
              {group.heading}
            </p>
            <ul className="flex flex-col gap-[2px]">
              {items.map((item) => {
                const active =
                  item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);
                const n = item.count?.(counts) ?? 0;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex h-[40px] items-center gap-[11px] rounded-[10px] px-[12px] text-[14px] font-medium transition ${
                        active
                          ? 'bg-white/[0.09] text-white'
                          : 'text-[#c3cce0] hover:bg-white/[0.05] hover:text-white'
                      }`}
                    >
                      {active && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[-14px] top-[9px] h-[22px] w-[3px] rounded-r-full bg-[#ffc200]"
                        />
                      )}
                      <item.icon
                        aria-hidden="true"
                        className={`size-[17px] ${active ? 'text-[#ffc200]' : ''}`}
                      />
                      <span className="flex-1">{item.label}</span>
                      {n > 0 && (
                        <span className="min-w-[22px] rounded-full bg-[#ffc200] px-[7px] text-center text-[11.5px] font-bold leading-[20px] text-[#1d1500]">
                          {n > 99 ? '99+' : n}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-[10px] px-[18px] pb-[22px] pt-[20px]">
      <span className="flex h-[40px] items-center rounded-[10px] bg-white px-[10px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="YouMart" className="h-[30px] w-auto" />
      </span>
      <span className="rounded-[6px] border border-[#ffc200]/40 px-[7px] py-[2px] text-[10.5px] font-bold uppercase tracking-[0.16em] text-[#ffc200]">
        Admin
      </span>
    </div>
  );

  const initials = session.admin.name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <AdminContext.Provider value={{ session, refreshCounts: () => void refreshCounts() }}>
      <div className="fixed inset-0 z-[50] flex bg-[#f4f6fb] font-ui text-[#24324d]">
        <aside className="hidden w-[256px] shrink-0 flex-col bg-[linear-gradient(180deg,#0b1b3f_0%,#0a1633_100%)] lg:flex">
          {brand}
          {sidebar}
          <p className="px-[24px] pb-[16px] text-[11.5px] text-[#6f7c9c]">YouMart Admin · local</p>
        </aside>

        {menuOpen && (
          <div className="fixed inset-0 z-[60] flex lg:hidden">
            <aside className="flex w-[264px] flex-col bg-[#0b1b3f]">
              <div className="flex items-start justify-between">
                {brand}
                <button
                  type="button"
                  aria-label="Close menu"
                  onClick={() => setMenuOpen(false)}
                  className="mr-[10px] mt-[24px] flex size-[34px] items-center justify-center rounded-full text-white hover:bg-white/10"
                >
                  <X aria-hidden="true" className="size-[18px]" />
                </button>
              </div>
              {sidebar}
            </aside>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMenuOpen(false)}
              className="flex-1 bg-black/40"
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-[64px] shrink-0 items-center gap-[12px] border-b border-[#e4e9f2] bg-white/90 px-[16px] backdrop-blur lg:px-[28px]">
            <button
              type="button"
              aria-label="Open menu"
              onClick={() => setMenuOpen(true)}
              className="flex size-[38px] items-center justify-center rounded-[10px] text-[#0b1b3f] hover:bg-[#f1f4f9] lg:hidden"
            >
              <Menu aria-hidden="true" className="size-[20px]" />
            </button>
            <p className="hidden text-[13.5px] text-[#5d6b85] md:block">
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
            <div className="ml-auto flex items-center gap-[12px]">
              <Link
                href="/"
                target="_blank"
                className="hidden h-[34px] items-center rounded-[10px] px-[12px] text-[13px] font-semibold text-[#0142aa] hover:bg-[#eef3ff] md:flex"
              >
                View store ↗
              </Link>
              <div className="flex items-center gap-[10px] border-l border-[#e4e9f2] pl-[12px]">
                <span className="flex size-[36px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#0142aa,#2a6be0)] text-[13px] font-bold text-white">
                  {initials || 'A'}
                </span>
                <div className="hidden leading-tight md:block">
                  <p className="text-[13.5px] font-semibold text-[#0b1b3f]">{session.admin.name}</p>
                  <p className="text-[12px] text-[#7a86a0]">{ROLE_LABEL[session.admin.role]}</p>
                </div>
                <button
                  type="button"
                  onClick={signOutAdmin}
                  aria-label="Sign out"
                  title="Sign out"
                  className="flex size-[36px] items-center justify-center rounded-[10px] text-[#5d6b85] hover:bg-[#fdf1f0] hover:text-[#b42318]"
                >
                  <LogOut aria-hidden="true" className="size-[17px]" />
                </button>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1320px] px-[16px] py-[26px] lg:px-[32px]">
              {children}
            </div>
          </main>
        </div>
      </div>
      {alert && (
        <div
          role="alert"
          className="fixed right-[24px] top-[78px] z-[2300] w-[340px] max-w-[calc(100vw-32px)] overflow-hidden rounded-[16px] bg-white shadow-[0_18px_50px_rgba(11,27,63,0.28)] ring-1 ring-[#e4e9f2]"
        >
          <div className="flex items-center gap-[10px] bg-[linear-gradient(135deg,#0b1b3f,#0142aa)] px-[16px] py-[11px] text-white">
            <span className="relative flex size-[10px]">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#ffc200] opacity-75" />
              <span className="relative inline-flex size-[10px] rounded-full bg-[#ffc200]" />
            </span>
            <p className="flex-1 text-[14px] font-semibold">New order received</p>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setAlert(null)}
              className="flex size-[26px] items-center justify-center rounded-full hover:bg-white/10"
            >
              <X aria-hidden="true" className="size-[15px]" />
            </button>
          </div>
          <Link
            href={`/admin/orders/${alert.orderNumber}`}
            onClick={() => setAlert(null)}
            className="block px-[16px] py-[13px] hover:bg-[#fafbfe]"
          >
            <p className="text-[15px] font-semibold text-[#0142aa]">{alert.orderNumber}</p>
            <p className="mt-[2px] text-[13.5px] text-[#24324d]">
              {alert.customerName ?? 'Customer'}
              {alert.city ? ` · ${alert.city}` : ''} · {alert.itemCount} item
              {alert.itemCount === 1 ? '' : 's'}
            </p>
            <p className="mt-[6px] flex items-center justify-between text-[13px]">
              <span className="text-[18px] font-semibold text-[#0b1b3f]">
                {formatMoney(alert.grandTotal)}
              </span>
              <span
                className={`font-semibold ${alert.paymentMethod === 'COD' ? 'text-[#9a6200]' : 'text-[#137a3f]'}`}
              >
                {alert.paymentMethod === 'COD'
                  ? 'Cash on Delivery'
                  : alert.status === 'PENDING_PAYMENT'
                    ? 'Awaiting payment'
                    : 'Paid online'}
              </span>
            </p>
            <p className="mt-[8px] text-[12.5px] font-semibold text-[#0142aa]">Open order →</p>
          </Link>
        </div>
      )}
    </AdminContext.Provider>
  );
}

function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminLogin(email.trim(), password);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not sign in.');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[50] grid overflow-y-auto bg-[#f4f6fb] font-ui lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-[linear-gradient(150deg,#0b1b3f_0%,#0f2a63_60%,#0142aa_100%)] p-[56px] text-white lg:flex lg:flex-col">
        <div
          aria-hidden="true"
          className="absolute -right-[120px] -top-[120px] size-[420px] rounded-full border border-white/10"
        />
        <div
          aria-hidden="true"
          className="absolute -bottom-[160px] -left-[80px] size-[460px] rounded-full bg-[#ffc200]/10 blur-2xl"
        />
        <span className="flex h-[52px] w-fit items-center rounded-[12px] bg-white px-[14px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="YouMart" className="h-[38px] w-auto" />
        </span>
        <div className="relative mt-auto max-w-[440px]">
          <p className="mb-[14px] text-[12px] font-bold uppercase tracking-[0.2em] text-[#ffc200]">
            Store control room
          </p>
          <h1 className="text-[38px] font-semibold leading-[1.15]">
            Every order, every rupee, every customer: in one place.
          </h1>
          <p className="mt-[14px] text-[15px] leading-[1.6] text-[#c3cce0]">
            Pack and ship orders, settle returns, run offers and answer customers from the YouMart
            admin.
          </p>
        </div>
      </div>
      <div className="flex items-center justify-center p-[24px]">
        <form
          onSubmit={submit}
          className="w-full max-w-[400px] rounded-[20px] border border-[#e4e9f2] bg-white p-[32px] shadow-[0_20px_60px_rgba(11,27,63,0.08)]"
        >
          <span className="mb-[18px] flex size-[48px] items-center justify-center rounded-[14px] bg-[#eef3ff] text-[#0142aa]">
            <LockKeyhole aria-hidden="true" className="size-[22px]" />
          </span>
          <h2 className="text-[24px] font-semibold text-[#0b1b3f]">Admin sign in</h2>
          <p className="mb-[22px] mt-[4px] text-[14px] text-[#5d6b85]">
            For YouMart staff only.
          </p>
          <label className="mb-[14px] flex flex-col gap-[6px]">
            <span className="text-[13px] font-semibold text-[#24324d]">Work email</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass + ' h-[44px]'}
            />
          </label>
          <label className="mb-[18px] flex flex-col gap-[6px]">
            <span className="text-[13px] font-semibold text-[#24324d]">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClass + ' h-[44px]'}
            />
          </label>
          {error && (
            <p role="alert" className="mb-[14px] text-[13.5px] text-[#b42318]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="flex h-[46px] w-full items-center justify-center gap-[8px] rounded-[12px] bg-[#0142aa] text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(1,66,170,0.28)] transition hover:bg-[#013a95] disabled:opacity-60"
          >
            {busy && <Loader2 aria-hidden="true" className="size-[17px] animate-spin" />}
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}

/** Soft two-note chime for a new order (Web Audio - no file to load). Browsers only allow sound
 * after the admin has clicked somewhere on the page; before that it is silently skipped. */
function chime(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    [880, 1318.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.6);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    // No audio available - the alert still shows.
  }
}
