import { AdminOrderDetail } from '@/components/admin/AdminOrderDetail';

export default function AdminOrderPage({ params }: { params: { orderNumber: string } }) {
  return <AdminOrderDetail orderNumber={decodeURIComponent(params.orderNumber)} />;
}
