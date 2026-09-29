import Link from 'next/link';
import { Heart, House, LogOut, MapPin, ShoppingBasket, Truck, UserRound } from 'lucide-react';
import { ACCOUNT_NAV, type AccountSection } from '@youmart/shared-client';
import { logout } from '@/app/my-account/actions';

const ICONS: Record<AccountSection, typeof House> = {
  dashboard: House,
  orders: ShoppingBasket,
  track: Truck,
  addresses: MapPin,
  account: UserRound,
  wishlist: Heart,
  logout: LogOut,
};

interface AccountShellProps {
  active: AccountSection;
  children: React.ReactNode;
}

const LINK =
  'group flex w-full items-center rounded-[5px] px-[15px] py-[12px] font-sans text-[16px] font-medium leading-[25.6px] transition-colors hover:bg-brand hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

// Live account CSS: nav card (radius 8, shadow, 15px padding) as a 30% column from 922px
// (woocommerce-smallscreen breakpoint), stacked full-width above the content below it.
export function AccountShell({ active, children }: AccountShellProps) {
  return (
    <div className="mx-auto max-w-[1240px] px-[20px] py-[20px] lg:pb-[64px] lg:pt-[88px] min-[922px]:flex min-[922px]:items-start min-[922px]:justify-between">
      <nav
        aria-label="Account pages"
        className="mb-[20px] rounded-[8px] p-[15px] shadow-account-nav min-[922px]:w-[30%]"
      >
        <ul>
          {ACCOUNT_NAV.map((item) => {
            const Icon = ICONS[item.key];
            const current = item.key === active;
            const tone = current ? 'bg-brand text-white' : 'bg-white text-woo-navText';
            const icon = (
              <Icon
                aria-hidden="true"
                className={`mr-[10px] size-[16px] shrink-0 ${current ? '' : 'text-black group-hover:text-white'}`}
              />
            );
            return (
              <li key={item.key} className="mb-[10px] last:mb-0">
                {item.key === 'logout' ? (
                  <form action={logout}>
                    <button type="submit" className={`${LINK} ${tone}`}>
                      {icon}
                      {item.label}
                    </button>
                  </form>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={current ? 'page' : undefined}
                    className={`${LINK} ${tone}`}
                  >
                    {icon}
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="min-w-0 min-[922px]:w-[68%]">{children}</div>
    </div>
  );
}
