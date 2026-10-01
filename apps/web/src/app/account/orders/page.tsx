import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { OrdersList } from '@/components/account/OrdersList';
import { RequireAuth } from '@/components/account/RequireAuth';

export const metadata: Metadata = { title: 'Orders - You Mart' };

export default function OrdersPage() {
  return (
    <RequireAuth>
      <AccountShell active="orders">
        <h1 className="sr-only">Orders</h1>
        <OrdersList />
      </AccountShell>
    </RequireAuth>
  );
}
