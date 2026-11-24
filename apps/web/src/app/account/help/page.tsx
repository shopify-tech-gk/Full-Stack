import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RequireAuth } from '@/components/account/RequireAuth';
import { HelpCenterView } from '@/components/account/HelpCenterView';

export const metadata: Metadata = { title: 'Help Center - You Mart' };

export default function HelpPage() {
  return (
    <RequireAuth>
      <AccountShell active="help">
        <Suspense fallback={<div aria-busy="true" className="min-h-[480px]" />}>
          <HelpCenterView />
        </Suspense>
      </AccountShell>
    </RequireAuth>
  );
}
