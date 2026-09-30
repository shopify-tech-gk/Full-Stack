import type { Metadata } from 'next';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { CheckoutView } from '@/components/checkout/CheckoutView';
import { storeCategories } from '@/lib/categories';
import { getAddresses } from '@/lib/account';

export const metadata: Metadata = { title: 'Checkout - You Mart' };

// The cart, checkout and payment APIs all need a customer token, so checkout asks for the
// OTP login first (live allows guest checkout with an OTP-verified phone).
export default async function CheckoutPage() {
  const addresses = await getAddresses();

  return (
    <>
      <CategoryMegaMenu categories={storeCategories} mobileGrid={false} />
      {/* Same offsets as /cart: live's steps bar sits at 143 / 169.2 / 167.2 / 605. */}
      <div className="mx-auto mt-[12px] max-w-[1240px] px-[20px] min-[768px]:mt-[68px] min-[769px]:mt-[66px] min-[1025px]:mb-[32px] min-[1025px]:mt-[20px]">
        <h1 className="sr-only">Checkout</h1>
        <CheckoutView addresses={addresses} />
      </div>
    </>
  );
}
