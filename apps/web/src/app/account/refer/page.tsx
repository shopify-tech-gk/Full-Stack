import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RequireAuth } from '@/components/account/RequireAuth';
import { ReferView } from '@/components/account/ReferView';

export const metadata: Metadata = { title: 'Refer & Earn - You Mart' };

export default function ReferPage() {
  return (
    <RequireAuth>
      <AccountShell active="refer">
        <Suspense fallback={<div aria-busy="true" className="min-h-[480px]" />}>
          <ReferView />
        </Suspense>
      </AccountShell>
    </RequireAuth>
  );
}
