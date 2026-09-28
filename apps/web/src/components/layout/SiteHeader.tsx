'use client';

import { useCallback, useState } from 'react';
import Link from 'next/link';
import {
  Download,
  Headset,
  Heart,
  MapPin,
  Menu,
  MessageCircle,
  PackageSearch,
  ShoppingCart,
  User,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from './Logo';
import { SearchBar } from './SearchBar';
import { MobileCategoryDrawer } from './MobileCategoryDrawer';
import { storeCategories } from '@/lib/categories';

interface HeaderAction {
  href: string;
  label: [string, string?];
  icon: LucideIcon;
}

const DESKTOP_ACTIONS: HeaderAction[] = [
  { href: '/delivery-location', label: ['Delivery', 'location'], icon: MapPin },
  { href: '/account', label: ['My', 'Account'], icon: User },
  { href: '/orders/track', label: ['Order', 'Track'], icon: PackageSearch },
  { href: '/download-app', label: ['Download', 'App'], icon: Download },
  { href: '/wishlist', label: ['My', 'Wishlist'], icon: Heart },
  { href: '/customer-care', label: ['Customer', 'Care'], icon: MessageCircle },
  { href: '/cart', label: ['Cart'], icon: ShoppingCart },
];

function ActionLabel({ label }: { label: HeaderAction['label'] }) {
  const [first, second] = label;
  return (
    <span className="text-[12px] font-semibold leading-[1.25] text-ink-strong">
      {first}
      {second ? (
        <>
          <br />
          {second}
        </>
      ) : null}
    </span>
  );
}

export function SiteHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <header className="bg-white">
      {/* Mobile / tablet (< 1024px) */}
      <div className="px-3 pb-3 pt-3 lg:hidden">
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Open category menu"
            aria-expanded={drawerOpen}
            aria-controls="mobile-category-drawer"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 flex size-10 items-center justify-center text-ink-strong"
          >
            <Menu aria-hidden="true" className="size-6" />
          </button>
          <Logo className="w-[124px]" priority />
          <nav aria-label="Quick links" className="ml-auto">
            <ul className="flex items-center gap-3">
              <li>
                <Link href="/orders/track" className="flex items-center gap-1.5">
                  <PackageSearch
                    aria-hidden="true"
                    className="size-8 text-brand"
                    strokeWidth={1.5}
                  />
                  <ActionLabel label={['Track', 'Order']} />
                </Link>
              </li>
              <li>
                <Link href="/customer-care" className="flex items-center gap-1.5">
                  <Headset aria-hidden="true" className="size-8 text-brand" strokeWidth={1.5} />
                  <ActionLabel label={['Customer', 'Care']} />
                </Link>
              </li>
            </ul>
          </nav>
        </div>
        <SearchBar id="search-mobile" className="mt-3" />
      </div>

      {/* Desktop (>= 1024px) */}
      <div className="mx-auto hidden max-w-[1180px] items-center gap-6 px-4 py-7 lg:flex">
        <Logo className="w-[166px] shrink-0" priority />
        <SearchBar id="search-desktop" className="w-full max-w-[457px] shrink" />
        <nav aria-label="Account and shopping" className="ml-auto">
          <ul className="flex items-start gap-3 xl:gap-4">
            {DESKTOP_ACTIONS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="group flex min-w-[48px] flex-col items-center gap-1.5 text-center"
                >
                  <span className="flex size-[34px] items-center justify-center rounded-lg bg-brand text-white transition-colors group-hover:bg-brand-700">
                    <Icon aria-hidden="true" className="size-5" strokeWidth={2} />
                  </span>
                  <ActionLabel label={label} />
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <MobileCategoryDrawer open={drawerOpen} onClose={closeDrawer} categories={storeCategories} />
    </header>
  );
}
