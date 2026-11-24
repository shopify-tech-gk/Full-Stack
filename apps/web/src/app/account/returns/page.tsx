import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RequireAuth } from '@/components/account/RequireAuth';
import { ReturnsView } from '@/components/account/ReturnsView';

export const metadata: Metadata = { title: 'Returns & refunds - You Mart' };

export default function ReturnsPage() {
  return (
    <RequireAuth>
      <AccountShell active="returns">
        <Suspense fallback={<div aria-busy="true" className="min-h-[480px]" />}>
          <ReturnsView />
        </Suspense>
      </AccountShell>
    </RequireAuth>
  );
}
