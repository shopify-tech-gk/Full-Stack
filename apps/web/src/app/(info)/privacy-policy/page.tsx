import type { Metadata } from 'next';
import { PRIVACY_POLICY } from '@youmart/shared-client';
import { PolicyArticle } from '@/components/info/PolicyArticle';

export const metadata: Metadata = { title: `${PRIVACY_POLICY.metaTitle} - You Mart` };

export default function PrivacyPolicyPage() {
  return <PolicyArticle page={PRIVACY_POLICY} />;
}
