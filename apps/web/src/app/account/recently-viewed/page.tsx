import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RecentlyViewedView } from '@/components/account/RecentlyViewedView';

export const metadata: Metadata = { title: 'Recently viewed - You Mart' };

// Guests have a (this-browser) history too, so this page doesn't require signing in.
export default function RecentlyViewedPage() {
  return (
    <AccountShell active="recent">
      <h1 className="mb-[16px] font-ui text-[22px] font-semibold text-heading">Recently viewed</h1>
      <RecentlyViewedView />
    </AccountShell>
  );
}
