import type { Metadata } from 'next';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { storeCategories } from '@/lib/categories';
import { Notice } from '@/components/account/Notice';
import { TrackingResult } from '@/components/account/TrackingResult';
import {
  BODY_TEXT,
  FIELD_HINT,
  FORM_BUTTON,
  FORM_INPUT,
  FORM_LABEL,
  FORM_ROW,
} from '@/components/account/formStyles';
import { trackOrder } from '@/lib/account';

export const metadata: Metadata = { title: 'Order Track - You Mart' };

interface OrderTrackPageProps {
  searchParams: Record<string, string | string[] | undefined>;
}

// Live: a centred 500px form with a single Order ID field. GET (not live's POST) keeps the
// result linkable from the Orders table and works without JavaScript.
export default async function OrderTrackPage({ searchParams }: OrderTrackPageProps) {
  const raw = searchParams.orderid;
  const orderId = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? '';
  const valid = /^[A-Za-z0-9-]{1,40}$/.test(orderId);
  const order = orderId && valid ? await trackOrder(orderId) : null;

  return (
    <>
      <CategoryMegaMenu categories={storeCategories} mobileGrid={false} />
      <div className="px-[10px] py-[10px]">
        <h1 className="sr-only">Order Track</h1>
        <form method="get" action="/order-track" className="mx-auto my-[20px] max-w-[500px]">
          <p className={`${BODY_TEXT} mb-[25.6px]`}>Enter your Order ID and click Track.</p>
          <p className={FORM_ROW}>
            <label htmlFor="orderid" className={FORM_LABEL}>
              Order ID
            </label>
            <input
              id="orderid"
              name="orderid"
              required
              maxLength={40}
              defaultValue={orderId}
              placeholder="Enter Order ID"
              aria-describedby="orderid-demo"
              className={FORM_INPUT}
            />
            {/* DEMO hint - remove when the order API is wired. */}
            <span id="orderid-demo" className={FIELD_HINT}>
              Demo: try YM-DEMO-1001, YM-DEMO-1002 or YM-DEMO-1003.
            </span>
          </p>
          <p className="m-[3px]">
            <button type="submit" className={FORM_BUTTON}>
              Track Order
            </button>
          </p>
        </form>

        {orderId &&
          (order ? (
            <div className="mx-auto max-w-[800px]">
              <TrackingResult order={order} />
            </div>
          ) : (
            <div className="mx-auto max-w-[500px]">
              {/* Live shows nothing for an unknown ID; WooCommerce's own message is the flagged fix. */}
              <Notice tone="error">
                Sorry, the order could not be found. Please contact us if you are having difficulty
                finding your order details.
              </Notice>
            </div>
          ))}
      </div>
    </>
  );
}
