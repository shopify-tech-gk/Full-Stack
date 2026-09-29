import type { Metadata } from 'next';
import { TERMS_AND_CONDITIONS } from '@youmart/shared-client';
import { PolicyArticle } from '@/components/info/PolicyArticle';

export const metadata: Metadata = { title: `${TERMS_AND_CONDITIONS.metaTitle} - You Mart` };

export default function TermsPage() {
  return <PolicyArticle page={TERMS_AND_CONDITIONS} />;
}
