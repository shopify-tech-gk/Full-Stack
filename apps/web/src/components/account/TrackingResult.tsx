import { Check } from 'lucide-react';
import {
  TRACKING_STEPS,
  addressLines,
  formatMoney,
  orderStatusLabel,
  trackingProgress,
  type AccountOrder,
} from '@youmart/shared-client';
import { Notice } from './Notice';
import { formatOrderDate } from './OrdersTable';
import { BODY_TEXT } from './formStyles';

const timeFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

const HEADING = 'mb-[12px] font-ui text-[20px] font-semibold leading-[26px] text-heading';

/** WooCommerce order-tracking result, extended with a fulfilment timeline + tracking updates. */
export function TrackingResult({ order }: { order: AccountOrder }) {
  const { step, cancelled } = trackingProgress(order);
  const status = orderStatusLabel(order);

  return (
    <section aria-labelledby="tracking-result" className="mt-[32px]">
      <h2 id="tracking-result" className="sr-only">
        Tracking result
      </h2>
      <p className={`${BODY_TEXT} mb-[24px]`}>
        Order <mark className="bg-transparent font-bold text-brand">#{order.orderNumber}</mark> was
        placed on{' '}
        <mark className="bg-transparent font-bold text-brand">
          {formatOrderDate(order.createdAt)}
        </mark>{' '}
        and is currently <mark className="bg-transparent font-bold text-brand">{status}</mark>.
      </p>

      {cancelled ? (
        <Notice tone="error">This order was cancelled.</Notice>
      ) : (
        <ol aria-label="Order progress" className="relative mb-[32px] flex">
          <span
            aria-hidden="true"
            className="absolute left-[12.5%] right-[12.5%] top-[11.5px] h-[2px] rounded-[4px] bg-steps-line"
          />
          <span
            aria-hidden="true"
            className="absolute left-[12.5%] top-[11.5px] h-[2px] rounded-[4px] bg-brand"
            style={{ width: `${(Math.max(step, 0) / (TRACKING_STEPS.length - 1)) * 75}%` }}
          />
          {TRACKING_STEPS.map((label, index) => {
            const done = index < step;
            const current = index === step;
            return (
              <li
                key={label}
                aria-current={current ? 'step' : undefined}
                className="relative flex flex-1 flex-col items-center text-center"
              >
                <span
                  className={`flex size-[25px] items-center justify-center rounded-full border-2 font-ui text-[13px] font-semibold ${
                    current
                      ? 'border-white bg-gradient-to-b from-steps-dark to-steps-glow text-white shadow-step-glow'
                      : done
                        ? 'border-brand bg-brand text-white'
                        : 'border-page bg-steps-idle text-black'
                  }`}
                >
                  {done ? (
                    <Check aria-hidden="true" className="size-[14px]" strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`mt-[8px] font-ui text-[11px] leading-[1.2] text-black md:text-[13px] ${current ? 'font-semibold' : 'font-medium'}`}
                >
                  {label}
                  <span className="sr-only">
                    {done ? ' (completed)' : current ? ' (current)' : ''}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
      )}

      {order.events.length > 0 && (
        <div className="mb-[32px]">
          <h3 className={HEADING}>Order updates</h3>
          <ol className="border-l-2 border-brand pl-[16px]">
            {[...order.events].reverse().map((event) => (
              <li key={`${event.status}-${event.occurredAt}`} className="mb-[12px] last:mb-0">
                <p className="font-ui text-[13px] leading-[1.4] text-ink-muted">
                  <time dateTime={event.occurredAt}>
                    {timeFormat.format(new Date(event.occurredAt))}
                  </time>
                </p>
                <p className={BODY_TEXT}>
                  <strong className="font-semibold">{event.status}</strong>
                  {event.location && ` \u2013 ${event.location}`}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

      <h3 className={HEADING}>Order details</h3>
      <table className={`${BODY_TEXT} mb-[32px] w-full border-collapse border border-catalog-rule`}>
        <thead>
          <tr>
            <th
              scope="col"
              className="border-b border-catalog-rule px-[16px] py-[10px] text-left font-semibold text-heading"
            >
              Product
            </th>
            <th
              scope="col"
              className="border-b border-catalog-rule px-[16px] py-[10px] text-right font-semibold text-heading"
            >
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.skuId}>
              <td className="border-b border-catalog-rule px-[16px] py-[10px]">
                {item.title}{' '}
                <strong className="whitespace-nowrap font-sans">
                  &times;&nbsp;{item.quantity}
                </strong>
              </td>
              <td className="border-b border-catalog-rule px-[16px] py-[10px] text-right font-sans">
                {formatMoney(item.lineTotal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          {[
            ['Subtotal:', formatMoney(order.subtotal)],
            [
              'Shipping:',
              Number(order.shippingTotal) === 0
                ? 'Free shipping'
                : formatMoney(order.shippingTotal),
            ],
            ['Total:', formatMoney(order.grandTotal)],
          ].map(([label, value], index, rows) => (
            <tr key={label}>
              <th
                scope="row"
                className="border-b border-catalog-rule px-[16px] py-[10px] text-left font-semibold text-heading"
              >
                {label}
              </th>
              <td
                className={`border-b border-catalog-rule px-[16px] py-[10px] text-right font-sans ${index === rows.length - 1 ? 'font-bold' : ''}`}
              >
                {value}
              </td>
            </tr>
          ))}
        </tfoot>
      </table>

      <h3 className={HEADING}>Shipping address</h3>
      <address className={`${BODY_TEXT} not-italic`}>
        {addressLines(order.shippingAddress).map((line) => (
          <span key={line} className="block">
            {line}
          </span>
        ))}
      </address>
    </section>
  );
}
