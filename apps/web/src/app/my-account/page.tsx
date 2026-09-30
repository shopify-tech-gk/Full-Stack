import type { Metadata } from 'next';
import { MyAccountView } from '@/components/account/MyAccountView';
import { getOrders } from '@/lib/account';

export const metadata: Metadata = { title: 'My account - You Mart' };

export default async function MyAccountPage({
  searchParams,
}: {
  searchParams: { returnTo?: string | string[] };
}) {
  const returnTo = typeof searchParams.returnTo === 'string' ? searchParams.returnTo : undefined;
  return <MyAccountView returnTo={returnTo} orders={await getOrders()} />;
}
