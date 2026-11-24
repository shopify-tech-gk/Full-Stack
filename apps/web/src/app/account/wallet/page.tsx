import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RequireAuth } from '@/components/account/RequireAuth';
import { WalletView } from '@/components/account/WalletView';

export const metadata: Metadata = { title: 'YouMart Wallet - You Mart' };

export default function WalletPage() {
  return (
    <RequireAuth>
      <AccountShell active="wallet">
        <Suspense fallback={<div aria-busy="true" className="min-h-[480px]" />}>
          <WalletView />
        </Suspense>
      </AccountShell>
    </RequireAuth>
  );
}
