import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { CouponsView } from '@/components/account/CouponsView';

export const metadata: Metadata = { title: 'Coupons - You Mart' };

// Offers are public, so this page works signed out too (signed in, used-up ones are left out).
export default function CouponsPage() {
  return (
    <AccountShell active="coupons">
      <h1 className="mb-[16px] font-ui text-[22px] font-semibold text-heading">Coupons</h1>
      <CouponsView />
    </AccountShell>
  );
}
