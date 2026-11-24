import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RequireAuth } from '@/components/account/RequireAuth';
import { AdsView } from '@/components/account/AdsView';

export const metadata: Metadata = { title: 'Advertise - You Mart' };

export default function AdsPage() {
  return (
    <RequireAuth>
      <AccountShell active="ads">
        <Suspense fallback={<div aria-busy="true" className="min-h-[480px]" />}>
          <AdsView />
        </Suspense>
      </AccountShell>
    </RequireAuth>
  );
}
