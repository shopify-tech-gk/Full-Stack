import type { Metadata } from 'next';
import { OFFERS_AND_COUPONS } from '@youmart/shared-client';
import { PolicyArticle } from '@/components/info/PolicyArticle';

export const metadata: Metadata = { title: `${OFFERS_AND_COUPONS.metaTitle} - You Mart` };

export default function OffersPage() {
  return <PolicyArticle page={OFFERS_AND_COUPONS} />;
}
