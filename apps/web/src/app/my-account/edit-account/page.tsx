import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountShell } from '@/components/account/AccountShell';
import { EditAccountForm } from '@/components/account/EditAccountForm';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Account details - You Mart' };

export default function EditAccountPage() {
  const session = getSession();
  if (!session) {
    redirect('/my-account');
  }
  return (
    <AccountShell active="account">
      <h1 className="sr-only">Account details</h1>
      <EditAccountForm user={session.user} />
    </AccountShell>
  );
}
