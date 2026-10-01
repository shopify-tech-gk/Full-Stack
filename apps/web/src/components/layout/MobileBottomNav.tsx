'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Download, House, ShoppingBag, ShoppingCart, User, type LucideIcon } from 'lucide-react';
import { BUSINESS, ROUTES } from '@youmart/shared-client';
import { CartCountBadge, cartLinkLabel } from '@/components/cart/CartCountBadge';
import { useCartCount } from '@/lib/cart';

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
  filled: boolean;
}

// Targets as live links them ("Buy Again" opens the wishlist).
const TABS: Tab[] = [
  { href: ROUTES.home, label: 'Home', icon: House, filled: true },
  { href: BUSINESS.appStoreHref, label: 'Install App', icon: Download, filled: false },
  { href: ROUTES.wishlist, label: 'Buy Again', icon: ShoppingBag, filled: true },
  { href: ROUTES.cart, label: 'Cart', icon: ShoppingCart, filled: true },
  { href: ROUTES.account, label: 'Account', icon: User, filled: true },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function MobileBottomNav() {
  const pathname = usePathname() ?? '/';
  const cartCount = useCartCount();

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
                aria-label={href === '/cart' ? cartLinkLabel(cartCount) : undefined}
                className="flex h-full flex-col items-center pt-[16px] font-ui text-[11px] leading-[20px]"
              >
                <span className="relative">
                  <Icon
                    aria-hidden="true"
                    className={`size-6 ${active ? 'text-brand' : 'text-nav-inactiveIcon'}`}
                    fill={filled ? 'currentColor' : 'none'}
                    strokeWidth={filled ? 1.5 : 2}
                  />
                  {href === '/cart' && <CartCountBadge count={cartCount} tone="onWhite" />}
                </span>
                <span className={active ? 'text-brand' : 'text-nav-inactiveLabel'}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
