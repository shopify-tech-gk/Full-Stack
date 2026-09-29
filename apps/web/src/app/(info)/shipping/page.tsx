import type { Metadata } from 'next';
import { SHIPPING_DETAILS } from '@youmart/shared-client';
import { PolicyArticle } from '@/components/info/PolicyArticle';

export const metadata: Metadata = { title: `${SHIPPING_DETAILS.metaTitle} - You Mart` };

export default function ShippingPage() {
  return <PolicyArticle page={SHIPPING_DETAILS} />;
}
