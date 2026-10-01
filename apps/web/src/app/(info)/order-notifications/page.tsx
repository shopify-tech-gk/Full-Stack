import type { Metadata } from 'next';
import Link from 'next/link';
import { ROUTES, loginHref } from '@youmart/shared-client';
import { SignedInOnly } from '@/components/account/SignedInOnly';
import { BODY_TEXT, TEXT_LINK } from '@/components/account/formStyles';
import { OrderNotifyForm } from '@/components/info/OrderNotifyForm';

export const metadata: Metadata = { title: 'Order notifications - You Mart' };

// Live: a login-only reminders page titled "notify" whose logged-out copy reads "Please to view
// your reminders." (missing link text). Same structure; the sentence is completed (flagged).
export default function OrderNotifyPage({
  searchParams,
}: {
  searchParams: { order?: string | string[] };
}) {
  const orderNumber = typeof searchParams.order === 'string' ? searchParams.order : undefined;
  return (
    <div className="px-[10px] py-[10px] lg:mb-[64px] lg:mt-[64px]">
      <div className="mx-auto my-[20px] max-w-[500px]">
        <h1 className="mb-[16px] font-ui text-[20px] font-semibold capitalize leading-[1.3] text-heading lg:text-[25px]">
          Notify
        </h1>
        <SignedInOnly
          fallback={
            <p className={BODY_TEXT}>
              Please{' '}
              <Link href={loginHref(ROUTES.orderNotifications)} className={TEXT_LINK}>
                log in
              </Link>{' '}
              to view your reminders.
            </p>
          }
        >
          <OrderNotifyForm orderNumber={orderNumber} />
        </SignedInOnly>
      </div>
    </div>
  );
}
