import type { Metadata } from 'next';
import Link from 'next/link';
import { ROUTES } from '@youmart/shared-client';
import { TEXT_LINK } from '@/components/account/formStyles';
import { WishlistTable } from '@/components/wishlist/WishlistTable';

export const metadata: Metadata = { title: 'Wishlist - You Mart' };

// Live YITH wishlist table. Guests keep a wishlist on the device that merges into the account
// on login - the same pattern as the cart (lib/wishlist.ts).
export default function WishlistPage() {
  return (
    <div className="mx-auto max-w-[1040px] px-[20px] py-[30px] lg:mb-[64px] lg:mt-[64px] lg:py-0">
      <h1 className="mb-[20px] font-ui text-[26px] font-semibold leading-[1.3] text-heading lg:text-[34px]">
        My wishlist
      </h1>
      <WishlistTable />
      <p className="mt-[20px] font-ui text-[15px]">
        <Link href={ROUTES.shop} className={TEXT_LINK}>
          Continue shopping
        </Link>
      </p>
    </div>
  );
}
