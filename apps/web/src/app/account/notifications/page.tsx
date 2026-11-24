import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { NotificationsPageView } from '@/components/account/NotificationsPageView';

export const metadata: Metadata = { title: 'Notifications - You Mart' };

export default function NotificationsPage() {
  return (
    <AccountShell active="notifications">
      <NotificationsPageView />
    </AccountShell>
  );
}
