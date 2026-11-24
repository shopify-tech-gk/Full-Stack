import type { Metadata } from 'next';
import { SellView } from '@/components/info/SellView';

export const metadata: Metadata = {
  title: 'Sell on YouMart - early access - You Mart',
  description: 'Reach shoppers across India. Apply for early access to sell on YouMart.',
};

export default function SellPage() {
  return <SellView />;
}
