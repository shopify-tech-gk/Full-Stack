import type { Metadata } from 'next';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { TrackOrderForm } from '@/components/account/TrackOrderForm';
import { storeCategories } from '@/lib/categories';

export const metadata: Metadata = { title: 'Track Order - You Mart' };

interface TrackOrderPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

// Live: a centred 500px form. `?order=` pre-fills the Order ID (links from emails/receipts); the
// phone is always typed, never put in a URL.
export default function TrackOrderPage({ searchParams }: TrackOrderPageProps) {
  const raw = searchParams.order ?? searchParams.orderid;
  const orderNumber = ((Array.isArray(raw) ? raw[0] : raw) ?? '').trim().slice(0, 40);

  return (
    <>
      <CategoryMegaMenu categories={storeCategories} mobileGrid={false} />
      <div className="px-[10px] py-[10px]">
        <h1 className="sr-only">Track Order</h1>
        <TrackOrderForm initialOrderNumber={orderNumber} />
      </div>
    </>
  );
}
