import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { LoginSecurityPanel, ProfileCard } from '@/components/account/AccountExtras';
import { EditAccountForm } from '@/components/account/EditAccountForm';
import { RequireAuth } from '@/components/account/RequireAuth';
import { PageHeader, Panel } from '@/components/account/ui';

export const metadata: Metadata = { title: 'Account details - You Mart' };

export default function EditAccountPage() {
  return (
    <RequireAuth>
      <AccountShell active="account">
        <PageHeader title="Account details" subtitle="Your profile, contact details and how you sign in." />
        <ProfileCard />
        <Panel title="Personal details">
          <EditAccountForm />
        </Panel>
        <LoginSecurityPanel />
      </AccountShell>
    </RequireAuth>
  );
}
