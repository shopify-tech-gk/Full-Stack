import { Suspense } from 'react';
import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { RequireAuth } from '@/components/account/RequireAuth';
import { RemindersView } from '@/components/account/RemindersView';

export const metadata: Metadata = { title: 'Reminders - You Mart' };

export default function RemindersPage() {
  return (
    <RequireAuth>
      <AccountShell active="reminders">
        <Suspense fallback={<div aria-busy="true" className="min-h-[480px]" />}>
          <RemindersView />
        </Suspense>
      </AccountShell>
    </RequireAuth>
  );
}
