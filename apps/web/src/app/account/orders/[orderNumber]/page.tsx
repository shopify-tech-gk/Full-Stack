import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { OrderDetail } from '@/components/account/OrderDetail';
import { RequireAuth } from '@/components/account/RequireAuth';

interface OrderPageProps {
  params: { orderNumber: string };
}

export function generateMetadata({ params }: OrderPageProps): Metadata {
  return { title: `Order ${decodeURIComponent(params.orderNumber)} - You Mart` };
}

// Orders are read client-side with the in-memory access token; the API only returns the
// signed-in customer's own order (anything else is a 404).
export default function OrderPage({ params }: OrderPageProps) {
  return (
    <RequireAuth>
      <AccountShell active="orders">
        <OrderDetail orderNumber={decodeURIComponent(params.orderNumber)} />
      </AccountShell>
    </RequireAuth>
  );
}
