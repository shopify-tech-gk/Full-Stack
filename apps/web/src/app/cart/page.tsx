import type { Metadata } from 'next';
import { defaultCheckoutAddress } from '@youmart/shared-client';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { CheckoutSteps } from '@/components/listing/CheckoutSteps';
import { CartView } from '@/components/cart/CartView';
import { storeCategories } from '@/lib/categories';
import { getAddresses } from '@/lib/account';

export const metadata: Metadata = { title: 'Cart - You Mart' };

export default async function CartPage() {
  const destination = defaultCheckoutAddress(await getAddresses())?.state ?? null;

  return (
    <>
      <CategoryMegaMenu categories={storeCategories} mobileGrid={false} />
      {/* Live stepper tops: 143 (390), 169.2 (768), 167.2 (900), 605 (1366). */}
      <div className="mx-auto mt-[12px] max-w-[1240px] px-[20px] min-[768px]:mt-[68px] min-[769px]:mt-[66px] min-[1025px]:mb-[64px] min-[1025px]:mt-[20px]">
        <CheckoutSteps current="Shop" active={1} centered />
        <h1 className="sr-only">Cart</h1>
        <div className="lg:px-[20px]">
          <CartView destination={destination} />
        </div>
      </div>
    </>
  );
}
