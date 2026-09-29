import type { Metadata } from 'next';
import Link from 'next/link';
import { REFUND_POLICY } from '@youmart/shared-client';
import { BODY_TEXT, TEXT_LINK } from '@/components/account/formStyles';
import { OrderCancelForm } from '@/components/info/OrderCancelForm';
import { RichText } from '@/components/info/RichText';

export const metadata: Metadata = { title: 'Order Cancel - You Mart' };

const cancellation = REFUND_POLICY.sections.find((s) => s.heading?.endsWith('Cancellation Policy'));

// Live's "Order Cancel" link opens My Account > Orders (login only). This page keeps that route
// one click away and adds a form for customers who are not logged in (flagged).
export default function OrderCancelPage() {
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
          Logged in? Cancel directly from{' '}
          <Link href="/my-account/orders" className={TEXT_LINK}>
            My Account &rsaquo; Orders
          </Link>
          . Read the full{' '}
          <Link href="/refund-policy" className={TEXT_LINK}>
            Refund Policy
          </Link>
          .
        </p>
        <OrderCancelForm />
      </div>
    </div>
  );
}
