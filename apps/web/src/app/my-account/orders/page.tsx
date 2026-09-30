import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { Notice } from '@/components/account/Notice';
import { OrdersTable } from '@/components/account/OrdersTable';
import { RequireAuth } from '@/components/account/RequireAuth';
import { getOrders } from '@/lib/account';

export const metadata: Metadata = { title: 'Orders - You Mart' };

export default async function OrdersPage() {
  const orders = await getOrders();
  return (
    <RequireAuth>
      <AccountShell active="orders">
        <h1 className="sr-only">Orders</h1>
        {orders.length > 0 ? (
          <OrdersTable orders={orders} />
        ) : (
          <Notice tone="info">No order has been made yet.</Notice>
        )}
      </AccountShell>
    </RequireAuth>
  );
}
