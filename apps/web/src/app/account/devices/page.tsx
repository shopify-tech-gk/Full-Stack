import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RequireAuth } from '@/components/account/RequireAuth';
import { DevicesView } from '@/components/account/DevicesView';

export const metadata: Metadata = { title: 'Signed-in devices - You Mart' };

export default function DevicesPage() {
  return (
    <RequireAuth>
      <AccountShell active="devices">
        <Suspense fallback={<div aria-busy="true" className="min-h-[480px]" />}>
          <DevicesView />
        </Suspense>
      </AccountShell>
    </RequireAuth>
  );
}
