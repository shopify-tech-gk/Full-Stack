import type { Metadata } from 'next';
import { OFFERS_AND_COUPONS } from '@youmart/shared-client';
import { CouponsView } from '@/components/account/CouponsView';
import { PolicyArticle } from '@/components/info/PolicyArticle';

export const metadata: Metadata = { title: `${OFFERS_AND_COUPONS.metaTitle} - You Mart` };

// The offers running now (the same coupons as Account > Coupons) above the offers text.
export default function OffersPage() {
  return (
    <PolicyArticle page={OFFERS_AND_COUPONS}>
      <section aria-label="Coupons running now" className="mb-[20px]">
        <h2 className="mb-[12px] font-ui text-[20px] font-semibold text-heading">Coupons running now</h2>
        <CouponsView />
      </section>
    </PolicyArticle>
  );
}
