import Link from 'next/link';
import {
  AlarmClock,
  Bell,
  Megaphone,
  Gift,
  Clock,
  Heart,
  House,
  LifeBuoy,
  LogOut,
  MapPin,
  MonitorSmartphone,
  RotateCcw,
  ShieldCheck,
  ShoppingBasket,
  Star,
  TicketPercent,
  Truck,
  UserRound,
  Wallet,
} from 'lucide-react';
import { ACCOUNT_NAV, type AccountNavGroup, type AccountSection } from '@youmart/shared-client';
import { LogoutButton } from './LogoutButton';

const ICONS: Record<AccountSection, typeof House> = {
  dashboard: House,
  orders: ShoppingBasket,
  returns: RotateCcw,
  track: Truck,
  addresses: MapPin,
  account: UserRound,
  wishlist: Heart,
  recent: Clock,
  reviews: Star,
  wallet: Wallet,
  coupons: TicketPercent,
  notifications: Bell,
  devices: MonitorSmartphone,
  privacy: ShieldCheck,
  help: LifeBuoy,
  refer: Gift,
  reminders: AlarmClock,
  ads: Megaphone,
  logout: LogOut,
};

const GROUPS: AccountNavGroup[] = ['Shopping', 'Money', 'Account', 'Support'];

interface AccountShellProps {
  active: AccountSection;
  children: React.ReactNode;
}

const LINK =
  'group flex w-full items-center rounded-[8px] px-[12px] py-[9px] font-ui text-[15px] font-medium leading-[22px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand';

// Desktop account layout: a sticky side menu grouped by what it's for (Shopping, Money, Account,
// Support) as a 27% column from 922px, stacked full-width above the content below it.
export function AccountShell({ active, children }: AccountShellProps) {
  return (
    <div className="mx-auto max-w-[1240px] px-[20px] py-[20px] lg:pb-[64px] lg:pt-[56px] min-[922px]:flex min-[922px]:items-start min-[922px]:justify-between">
      <nav
        aria-label="Account pages"
        className="mb-[20px] rounded-[14px] border border-catalog-rule bg-white p-[12px] shadow-account-nav min-[922px]:sticky min-[922px]:top-[96px] min-[922px]:w-[27%]"
      >
        {GROUPS.map((group) => (
          <div key={group} className="mb-[6px] border-b border-catalog-rule pb-[8px] last:mb-0 last:border-0 last:pb-0">
            <p className="px-[12px] pb-[4px] pt-[8px] font-ui text-[11.5px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              {group}
            </p>
            <ul>
              {ACCOUNT_NAV.filter((item) => item.group === group).map((item) => {
                const Icon = ICONS[item.key];
                const current = item.key === active;
                const tone = current
                  ? 'bg-brand text-white shadow-brand-button'
                  : 'text-woo-navText hover:bg-[#eef3fc] hover:text-brand';
                const icon = (
                  <Icon
                    aria-hidden="true"
                    className={`mr-[10px] size-[17px] shrink-0 ${current ? '' : 'text-ink-muted group-hover:text-brand'}`}
                  />
                );
                return (
                  <li key={item.key} className="mb-[2px] last:mb-0">
                    {item.key === 'logout' ? (
                      <LogoutButton className={`${LINK} ${tone}`}>
                        {icon}
                        {item.label}
                      </LogoutButton>
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
          </div>
        ))}
      </nav>
      <div className="min-w-0 min-[922px]:w-[70%]">{children}</div>
    </div>
  );
}
