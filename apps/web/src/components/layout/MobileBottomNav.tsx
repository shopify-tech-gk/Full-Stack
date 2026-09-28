'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download, House, ShoppingBag, ShoppingCart, User, type LucideIcon } from 'lucide-react';

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  filled: boolean;
}

const TABS: Tab[] = [
  { href: '/', label: 'Home', icon: House, filled: true },
  { href: '/download-app', label: 'Install App', icon: Download, filled: false },
  { href: '/orders/buy-again', label: 'Buy Again', icon: ShoppingBag, filled: true },
  { href: '/cart', label: 'Cart', icon: ShoppingCart, filled: true },
  { href: '/account', label: 'Account', icon: User, filled: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function MobileBottomNav() {
  const pathname = usePathname() ?? '/';

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-divider bg-white pb-[env(safe-area-inset-bottom)] shadow-[0_-2px_8px_rgba(0,0,0,0.06)] lg:hidden"
    >
      <ul className="grid h-16 grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, filled }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex h-full flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-brand' : 'text-ink-body'}`}
              >
                <Icon
                  aria-hidden="true"
                  className="size-6"
                  fill={filled ? 'currentColor' : 'none'}
                  strokeWidth={filled ? 1.5 : 2}
                />
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
