import type { Metadata } from 'next';
import { REFUND_POLICY } from '@youmart/shared-client';
import { PolicyArticle } from '@/components/info/PolicyArticle';

export const metadata: Metadata = { title: `${REFUND_POLICY.metaTitle} - You Mart` };

export default function RefundPolicyPage() {
  return <PolicyArticle page={REFUND_POLICY} />;
}
