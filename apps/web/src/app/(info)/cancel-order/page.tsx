import type { Metadata } from 'next';
import Link from 'next/link';
import { REFUND_POLICY, ROUTES, loginHref } from '@youmart/shared-client';
import { SignedInOnly } from '@/components/account/SignedInOnly';
import { BODY_TEXT, TEXT_LINK } from '@/components/account/formStyles';
import { OrderCancelForm } from '@/components/info/OrderCancelForm';
import { RichText } from '@/components/info/RichText';

export const metadata: Metadata = { title: 'Cancel an order - You Mart' };

const cancellation = REFUND_POLICY.sections.find((s) => s.heading?.endsWith('Cancellation Policy'));

// Live's "Order Cancel" link opens My Account (login only). Same rule here: customers cancel
// their own orders after logging in, so no order can be cancelled by someone who only knows its
// number.
export default function OrderCancelPage({
  searchParams,
}: {
  searchParams: { order?: string | string[] };
}) {
  const orderNumber = typeof searchParams.order === 'string' ? searchParams.order : undefined;
  return (
    <div className="px-[10px] py-[10px] lg:mb-[64px] lg:mt-[64px]">
      <div className="mx-auto my-[20px] max-w-[500px]">
        <h1 className="mb-[16px] font-ui text-[20px] font-semibold leading-[1.3] text-heading lg:text-[25px]">
          Cancel an order
        </h1>
        {cancellation?.blocks.map((block, index) =>
          block.type === 'p' ? (
            <p key={index} className={`${BODY_TEXT} mb-[16px]`}>
              <RichText text={block.text} />
            </p>
          ) : null,
        )}
        <p className={`${BODY_TEXT} mb-[25.6px]`}>
          Read the full{' '}
          <Link href="/refund-policy" className={TEXT_LINK}>
            Refund Policy
          </Link>
          .
        </p>
        <SignedInOnly
          fallback={
            <p className={BODY_TEXT}>
              Please{' '}
              <Link href={loginHref(ROUTES.cancelOrder)} className={TEXT_LINK}>
                log in
              </Link>{' '}
              to cancel one of your orders.
            </p>
          }
        >
          <OrderCancelForm orderNumber={orderNumber} />
        </SignedInOnly>
      </div>
    </div>
  );
}
