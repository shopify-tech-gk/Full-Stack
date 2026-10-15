import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { NotificationsView } from '@/components/account/NotificationsView';

export const metadata: Metadata = { title: 'Notifications - You Mart' };

export default function NotificationsPage() {
  return (
    <AccountShell active="notifications">
      <h1 className="mb-[16px] font-ui text-[22px] font-semibold text-heading">Notifications</h1>
      <NotificationsView />
    </AccountShell>
  );
}
