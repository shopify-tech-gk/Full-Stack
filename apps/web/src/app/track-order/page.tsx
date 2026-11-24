import type { Metadata } from 'next';
import { PackageSearch } from 'lucide-react';
import { CategoryBar } from '@/components/category/CategoryBar';
import { TrackOrderForm } from '@/components/account/TrackOrderForm';
import { categoryBarMains } from '@/lib/category-taxonomy';

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
      <CategoryBar mains={categoryBarMains()} />
      <div className="px-[10px] py-[10px] lg:pb-[56px] lg:pt-[40px]">
        <div className="mx-auto mb-[8px] mt-[16px] max-w-[560px] text-center font-ui">
          <span className="mx-auto mb-[12px] flex size-[64px] items-center justify-center rounded-full bg-[#eef3fc]">
            <PackageSearch aria-hidden="true" className="size-[30px] text-brand" />
          </span>
          <h1 className="text-[28px] font-semibold text-heading">Track your order</h1>
          <p className="mt-[4px] text-[15px] text-ink-muted">No sign-in needed - just your order ID and mobile number.</p>
        </div>
        <TrackOrderForm initialOrderNumber={orderNumber} />
      </div>
    </>
  );
}
