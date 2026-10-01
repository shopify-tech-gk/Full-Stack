'use client';

import { useCallback, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Download, Heart, Menu, PackageSearch, ShoppingCart } from 'lucide-react';
import { BUSINESS, ROUTES } from '@youmart/shared-client';
import { useSession } from '@/lib/session';
import { useCartCount } from '@/lib/cart';
import { useWishlistCount } from '@/lib/wishlist';
import { CartCountBadge, cartLinkLabel } from '@/components/cart/CartCountBadge';
import { Logo } from './Logo';
import { SearchBar } from './SearchBar';
import { MobileCategoryDrawer } from './MobileCategoryDrawer';
import { FaMapMarkerAlt, FaUser, FaWhatsapp } from '@/components/ui/FaIcons';
import { storeCategories } from '@/lib/categories';

interface DesktopAction {
  href: string;
  lines: [string, string?];
  icon: React.ReactNode;
}

const TILE_ICON = 'size-6';

// Order, labels and glyphs as measured on the live desktop header; targets as live links them.
const DESKTOP_ACTIONS: DesktopAction[] = [
  {
    href: ROUTES.addresses,
    lines: ['Delivery', 'location'],
    icon: <FaMapMarkerAlt className={TILE_ICON} />,
  },
  { href: ROUTES.account, lines: ['My', 'Account'], icon: <FaUser className={TILE_ICON} /> },
  {
    href: ROUTES.trackOrder,
    lines: ['Order', 'Track'],
    icon: <PackageSearch aria-hidden="true" className={TILE_ICON} strokeWidth={2.25} />,
  },
  {
    href: BUSINESS.appStoreHref,
    lines: ['Download', 'App'],
    icon: <Download aria-hidden="true" className={TILE_ICON} strokeWidth={2.5} />,
  },
  {
    href: ROUTES.wishlist,
    lines: ['My', 'Wishlist'],
    icon: <Heart aria-hidden="true" className={TILE_ICON} strokeWidth={2.5} />,
  },
  {
    href: ROUTES.customerCare,
    lines: ['Customer', 'Care'],
    icon: <FaWhatsapp className={TILE_ICON} />,
  },
  {
    href: ROUTES.cart,
    lines: ['Cart'],
    icon: <ShoppingCart aria-hidden="true" className={TILE_ICON} strokeWidth={2.5} />,
  },
];

function TwoLineLabel({ lines, className }: { lines: [string, string?]; className: string }) {
  return (
    <span className={className}>
      {lines[0]}
      {lines[1] ? (
        <>
          <br />
          {lines[1]}
        </>
      ) : null}
    </span>
  );
}

/** Small icon + stacked 10px Outfit label used by the mobile and tablet headers. */
function CompactLink({
  href,
  lines,
  icon,
  align,
}: {
  href: string;
  lines: [string, string];
  icon: React.ReactNode;
  align: 'left' | 'center';
}) {
  return (
    <Link href={href} className="flex items-center gap-[6px]">
      {icon}
      <TwoLineLabel
        lines={lines}
        className={`font-ui text-[10px] font-semibold leading-[10.5px] text-ink-strong ${align === 'center' ? 'text-center' : 'text-left'}`}
      />
    </Link>
  );
}

const trackOrderIcon = (
  <Image src="/icons/track-order.png" alt="" width={34} height={34} className="size-[34px]" />
);
const customerCareIcon = (
  <Image src="/icons/customer-care.png" alt="" width={34} height={34} className="size-[34px]" />
);

export function SiteHeader() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const session = useSession();
  const cartCount = useCartCount();
  const wishlistCount = useWishlistCount();
  // Same tile as live's "My Account"; once signed in it greets the customer instead.
  const firstName = session.user?.name?.split(' ')[0];
  const accountLines: [string, string] =
    session.status === 'authenticated' ? ['Hi,', firstName ?? 'there'] : ['My', 'Account'];

  const hamburger = (width: string) => (
    <button
      type="button"
      aria-label="Open category menu"
      aria-expanded={drawerOpen}
      aria-controls="mobile-category-drawer"
      onClick={() => setDrawerOpen(true)}
      className={`flex h-[44px] shrink-0 items-center justify-center text-ink-icon ${width}`}
    >
      <Menu aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={2.5} />
    </button>
  );

  return (
    <header className="bg-white">
      {/* Mobile (< 768px): logo row 75px + search row 56px */}
      <div className="md:hidden">
        <div className="flex h-[75px] items-center pr-[2px]">
          {hamburger('w-[32px]')}
          <Logo variant="mobile" className="ml-[11px] w-[138px]" priority />
          <nav aria-label="Quick links" className="ml-auto flex items-center gap-[28px]">
            <CompactLink
              href={ROUTES.trackOrder}
              lines={['Track', 'Order']}
              icon={trackOrderIcon}
              align="left"
            />
            <CompactLink
              href={ROUTES.customerCare}
              lines={['Customer', 'Care']}
              icon={customerCareIcon}
              align="center"
            />
          </nav>
        </div>
        <div className="h-[56px] px-[10px] pt-[10px]">
          <SearchBar id="search-mobile" size="mobile" />
        </div>
      </div>

      {/* Tablet (768-1024px): single 101px row */}
      <div className="hidden h-[101px] items-center md:flex lg:hidden">
        {/* Live has no tablet navigation (defect); the hamburger sits inside live's 27px logo gutter. */}
        {hamburger('w-[27px]')}
        <Logo className="w-[144px]" priority />
        <SearchBar id="search-tablet" size="mobile" className="-mt-px ml-[16px] w-[41%] shrink-0" />
        <nav aria-label="Quick links" className="ml-auto mr-[12px] flex items-center gap-[24px]">
          <CompactLink
            href={ROUTES.addresses}
            lines={['Delivery', 'Location']}
            icon={<FaMapMarkerAlt className="h-[24px] w-[18px] text-brand" />}
            align="center"
          />
          <CompactLink
            href={ROUTES.customerCare}
            lines={['Customer', 'Care']}
            icon={customerCareIcon}
            align="center"
          />
        </nav>
      </div>

      {/* Desktop (>= 1025px): 121px row, geometry scaled exactly like the live Elementor columns */}
      <div className="hidden h-[121px] items-center pl-[clamp(20px,calc((100vw-1025px)*0.37+24px),119px)] pr-[clamp(16px,calc((100vw-1025px)*0.22+16px),73px)] pt-[5px] lg:flex">
        <Logo className="w-[max(120px,calc(15.3vw-39px))]" priority />
        <SearchBar
          id="search-desktop"
          className="ml-[20px] w-[calc(38.4vw-75px)] min-w-[220px] shrink"
        />
        <nav aria-label="Account and shopping" className="ml-auto shrink-0 pl-[16px]">
          <ul className="flex items-start gap-[14px]">
            {DESKTOP_ACTIONS.map(({ href, lines, icon }) => (
              <li key={href} className="last:ml-[3px]">
                <Link
                  href={href}
                  aria-label={
                    href === ROUTES.cart
                      ? cartLinkLabel(cartCount)
                      : href === ROUTES.wishlist
                        ? `My wishlist, ${wishlistCount} ${wishlistCount === 1 ? 'item' : 'items'}`
                        : href === ROUTES.account && session.status === 'authenticated'
                          ? 'My account (signed in)'
                          : undefined
                  }
                  className="group flex min-w-[38px] flex-col items-center"
                >
                  <span className="relative flex size-[38px] items-center justify-center rounded-tile bg-brand p-[7px] text-white">
                    {icon}
                    {href === ROUTES.cart && <CartCountBadge count={cartCount} tone="onBrand" />}
                    {href === ROUTES.wishlist && (
                      <CartCountBadge count={wishlistCount} tone="onBrand" />
                    )}
                  </span>
                  <TwoLineLabel
                    lines={href === ROUTES.account ? accountLines : lines}
                    className="mt-[1px] text-center font-ui text-[13px] font-semibold leading-[16.9px] text-ink-strong"
                  />
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
