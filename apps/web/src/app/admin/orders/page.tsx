import { Suspense } from 'react';
import { AdminOrders } from '@/components/admin/AdminOrders';

export default function AdminOrdersPage() {
  return (
    <Suspense>
      <AdminOrders />
    </Suspense>
  );
}
