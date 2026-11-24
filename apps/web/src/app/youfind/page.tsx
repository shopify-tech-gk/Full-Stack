import type { Metadata } from 'next';
import { CategoryBar } from '@/components/category/CategoryBar';
import { YouFindRoom } from '@/components/info/YouFindRoom';
import { categoryBarMains } from '@/lib/category-taxonomy';

export const metadata: Metadata = {
  title: 'YouFind Bot - ask for any product - You Mart',
  description: 'Ask YouFind Bot for any product and get matching products in seconds, or request a restock.',
};

export default function YouFindPage() {
  return (
    <>
      <CategoryBar mains={categoryBarMains()} />
      <div className="mx-auto max-w-[1240px] px-[16px] py-[20px] lg:mb-[48px] lg:mt-[24px]">
        <YouFindRoom />
      </div>
    </>
  );
}
