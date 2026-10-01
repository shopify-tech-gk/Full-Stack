import { orderStatusLabel, shipmentEvents, type GuestTrackingView } from '@youmart/shared-client';
import { OrderProgress } from './OrderProgress';
import { formatOrderDate } from './OrdersTable';
import { BODY_TEXT } from './formStyles';

const HEADING = 'mb-[12px] font-ui text-[20px] font-semibold leading-[26px] text-heading';

const ITEM_STATUS: Record<GuestTrackingView['items'][number]['sellerStatus'], string> = {
  PENDING: 'Awaiting payment',
  CONFIRMED: 'Processing',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURNED: 'Returned',
};

/** Public tracking result (POST /api/orders/track): no prices, ids or full address by design. */
export function TrackingResult({ result }: { result: GuestTrackingView }) {
  return (
    <section aria-labelledby="tracking-result" className="mt-[32px]">
      <h2 id="tracking-result" className="sr-only">
        Tracking result
      </h2>
      <p className={`${BODY_TEXT} mb-[24px]`}>
        Order <mark className="bg-transparent font-bold text-brand">#{result.orderNumber}</mark> was
        placed on{' '}
        <mark className="bg-transparent font-bold text-brand">
          {formatOrderDate(result.placedAt)}
        </mark>{' '}
        and is currently{' '}
        <mark className="bg-transparent font-bold text-brand">{orderStatusLabel(result)}</mark>.
        {result.shipTo && (
          <>
            {' '}
            Delivering to {result.shipTo.city}, {result.shipTo.state}.
          </>
        )}
      </p>

      <OrderProgress
        order={result}
        timeline={result.timeline}
        events={shipmentEvents(result.items)}
      />

      <h3 className={HEADING}>Items</h3>
      <ul className={`${BODY_TEXT} mb-[32px] border border-catalog-rule`}>
        {result.items.map((item, index) => (
          <li
            key={`${item.title}-${index}`}
            className="flex flex-wrap items-center justify-between gap-x-[16px] border-b border-catalog-rule px-[16px] py-[10px] last:border-b-0"
          >
            <span>
              {item.title}{' '}
              <strong className="whitespace-nowrap font-sans">&times;&nbsp;{item.quantity}</strong>
            </span>
            <span className="text-[14px] font-semibold text-brand">
              {ITEM_STATUS[item.sellerStatus]}
              {item.shipment?.awbNumber &&
                ` \u00b7 ${item.shipment.carrier ?? 'Courier'} ${item.shipment.awbNumber}`}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
