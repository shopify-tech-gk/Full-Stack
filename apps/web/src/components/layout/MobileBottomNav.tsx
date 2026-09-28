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
      className="fixed inset-x-0 bottom-0 z-40 rounded-[8px] bg-white pb-[env(safe-area-inset-bottom)] pt-[3px] lg:hidden"
    >
      <ul className="grid h-[76px] grid-cols-5">
        {TABS.map(({ href, label, icon: Icon, filled }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              {/* Every tab shares one baseline (the live "Buy Again" tab sits 4px low). */}
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className="flex h-full flex-col items-center pt-[16px] font-ui text-[11px] leading-[20px]"
              >
                <Icon
                  aria-hidden="true"
                  className={`size-6 ${active ? 'text-brand' : 'text-nav-inactiveIcon'}`}
                  fill={filled ? 'currentColor' : 'none'}
                  strokeWidth={filled ? 1.5 : 2}
                />
                <span className={active ? 'text-brand' : 'text-nav-inactiveLabel'}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
