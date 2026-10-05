import type { Metadata } from 'next';
import { CategoryBar } from '@/components/category/CategoryBar';
import { CheckoutSteps } from '@/components/listing/CheckoutSteps';
import { CartView } from '@/components/cart/CartView';
import { categoryBarMains } from '@/lib/category-taxonomy';

export const metadata: Metadata = { title: 'Cart - You Mart' };

export default function CartPage() {
  return (
    <>
      <CategoryBar mains={categoryBarMains()} />
      {/* Live stepper tops: 143 (390), 169.2 (768), 167.2 (900), 605 (1366). */}
      <div className="mx-auto mt-[12px] max-w-[1240px] px-[20px] min-[768px]:mt-[68px] min-[769px]:mt-[66px] min-[1025px]:mb-[64px] min-[1025px]:mt-[20px]">
        <CheckoutSteps current="Shop" active={1} centered />
        <h1 className="sr-only">Cart</h1>
        <div className="lg:px-[20px]">
          <CartView />
        </div>
      </div>
    </>
  );
}
