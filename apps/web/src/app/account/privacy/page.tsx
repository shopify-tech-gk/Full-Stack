import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RequireAuth } from '@/components/account/RequireAuth';
import { PrivacyAccountView } from '@/components/account/PrivacyAccountView';

export const metadata: Metadata = { title: 'Privacy & account - You Mart' };

export default function PrivacyPage() {
  return (
    <RequireAuth>
      <AccountShell active="privacy">
        <Suspense fallback={<div aria-busy="true" className="min-h-[480px]" />}>
          <PrivacyAccountView />
        </Suspense>
      </AccountShell>
    </RequireAuth>
  );
}
