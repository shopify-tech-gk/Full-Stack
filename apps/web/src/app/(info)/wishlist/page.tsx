import type { Metadata } from 'next';
import Link from 'next/link';
import { TEXT_LINK } from '@/components/account/formStyles';

export const metadata: Metadata = { title: 'Wishlist - You Mart' };

const TH =
  'border-b border-catalog-rule px-[12px] py-[11.2px] text-left font-ui text-[14.6px] font-bold text-ink-body lg:text-[16px]';

// Live YITH wishlist table, empty state. No wishlist API in the v1 contract yet (backend gap).
export default function WishlistPage() {
  return (
    <div className="mx-auto max-w-[1040px] px-[20px] py-[30px] lg:mb-[64px] lg:mt-[64px] lg:py-0">
      <h1 className="mb-[20px] font-ui text-[26px] font-semibold leading-[1.3] text-heading lg:text-[34px]">
        My wishlist
      </h1>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] border-separate border-spacing-0 rounded-[10px] border border-catalog-rule bg-white">
          <thead>
            <tr>
              <th scope="col" className={TH}>
                Picture
              </th>
              <th scope="col" className={TH}>
                Product Name
              </th>
              <th scope="col" className={TH}>
                Price
              </th>
              <th scope="col" className={TH}>
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={4}
                className="px-[12px] py-[16px] text-center font-ui text-[14.6px] text-ink-body lg:text-[16px]"
              >
                No products added to the wishlist
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-[20px] font-ui text-[15px]">
        <Link href="/shop" className={TEXT_LINK}>
          Continue shopping
        </Link>
      </p>
    </div>
  );
}
