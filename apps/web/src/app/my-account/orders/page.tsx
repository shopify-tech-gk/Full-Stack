import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountShell } from '@/components/account/AccountShell';
import { Notice } from '@/components/account/Notice';
import { OrdersTable } from '@/components/account/OrdersTable';
import { getOrders } from '@/lib/account';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Orders - You Mart' };

export default async function OrdersPage() {
  if (!getSession()) {
    redirect('/my-account');
  }
  const orders = await getOrders();
  return (
    <AccountShell active="orders">
      <h1 className="sr-only">Orders</h1>
      {orders.length > 0 ? (
        <OrdersTable orders={orders} />
      ) : (
        <Notice tone="info">No order has been made yet.</Notice>
      )}
    </AccountShell>
  );
}
