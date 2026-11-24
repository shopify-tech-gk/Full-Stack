import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RequireAuth } from '@/components/account/RequireAuth';
import { AdCreateView } from '@/components/account/AdCreateView';

export const metadata: Metadata = { title: 'Create an ad - You Mart' };

export default function AdCreatePage() {
  return (
    <RequireAuth>
      <AccountShell active="ads">
        <Suspense fallback={<div aria-busy="true" className="min-h-[480px]" />}>
          <AdCreateView />
        </Suspense>
      </AccountShell>
    </RequireAuth>
  );
}
