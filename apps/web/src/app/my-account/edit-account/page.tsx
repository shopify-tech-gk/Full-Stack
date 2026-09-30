import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { EditAccountForm } from '@/components/account/EditAccountForm';
import { RequireAuth } from '@/components/account/RequireAuth';

export const metadata: Metadata = { title: 'Account details - You Mart' };

export default function EditAccountPage() {
  return (
    <RequireAuth>
      <AccountShell active="account">
        <h1 className="sr-only">Account details</h1>
        <EditAccountForm />
      </AccountShell>
    </RequireAuth>
  );
}
