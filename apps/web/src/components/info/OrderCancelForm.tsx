'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  CANCEL_REASONS,
  EMPTY_ORDER_CANCEL,
  formatMoney,
  orderHref,
  supportErrorMessage,
  validateOrderCancel,
  type CancelOrderResult,
  type FormErrors,
  type OrderCancelValues,
} from '@youmart/shared-client';
import { Notice } from '@/components/account/Notice';
import { FORM_BUTTON, FORM_INPUT, TEXT_LINK } from '@/components/account/formStyles';
import { api } from '@/lib/api';
import { Field } from './Field';
import { initialOrderId, useOwnOrders } from './useOwnOrders';

/**
 * POST /api/orders/:id/cancel on one of the customer's own orders: an unpaid order is cancelled
 * at once (stock released); a paid one becomes a request our team approves (refund on approval).
 */
export function OrderCancelForm({ orderNumber }: { orderNumber?: string }) {
  const id = useId();
  const { orders, failed } = useOwnOrders();
  const [values, setValues] = useState(EMPTY_ORDER_CANCEL);
  const [errors, setErrors] = useState<FormErrors<keyof OrderCancelValues>>({});
  const [result, setResult] = useState<CancelOrderResult | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (orders) setValues((v) => ({ ...v, orderId: initialOrderId(orders, orderNumber) }));
  }, [orders, orderNumber]);

  const set = (key: keyof OrderCancelValues, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const { data, errors: found } = validateOrderCancel(values);
    setErrors(found);
    setFailure(null);
    if (!data) return;
    setPending(true);
    try {
      const { orderId, ...body } = data;
      setResult(await api.orders.cancel(orderId, body));
      setValues(EMPTY_ORDER_CANCEL);
    } catch (error) {
      setFailure(supportErrorMessage(error));
    } finally {
      setPending(false);
    }
  };

  if (failed) return <Notice tone="error">We could not load your orders. Please refresh.</Notice>;
  if (!orders) return <div aria-busy="true" className="min-h-[200px]" />;

  const open = orders.filter((order) => order.status !== 'CANCELLED');
  if (result) {
    const number = result.order.orderNumber;
    return (
      <Notice tone="success">
        {result.outcome === 'CANCELLED'
          ? `Order #${number} has been cancelled.`
          : `We've received your request to cancel order #${number}. We'll confirm once it is reviewed; any payment is refunded to the original method.`}{' '}
        <Link href={orderHref(number)} className={TEXT_LINK}>
          View order
        </Link>
      </Notice>
    );
  }
  if (open.length === 0) {
    return <Notice tone="info">You have no orders that can be cancelled.</Notice>;
  }

  return (
    <form onSubmit={onSubmit} noValidate>
      {failure && <Notice tone="error">{failure}</Notice>}
      <Field id={`${id}-order`} label="Order" required error={errors.orderId}>
        {(aria) => (
          <select
            {...aria}
            value={values.orderId}
            onChange={(e) => set('orderId', e.target.value)}
            className={FORM_INPUT}
          >
            <option value="">Select an order&hellip;</option>
            {open.map((order) => (
              <option key={order.orderId} value={order.orderId}>
                #{order.orderNumber} &middot; {formatMoney(order.grandTotal)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field id={`${id}-reason`} label="Reason for cancellation" required error={errors.reason}>
        {(aria) => (
          <select
            {...aria}
            value={values.reason}
            onChange={(e) => set('reason', e.target.value)}
            className={FORM_INPUT}
          >
            <option value="">Select a reason&hellip;</option>
            {CANCEL_REASONS.map((reason) => (
              <option key={reason} value={reason}>
                {reason}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field id={`${id}-comments`} label="Comments" error={errors.comments}>
        {(aria) => (
          <textarea
            {...aria}
            rows={3}
            maxLength={1000}
            value={values.comments}
            onChange={(e) => set('comments', e.target.value)}
            className={`${FORM_INPUT} h-auto min-h-[90px] leading-[1.5] lg:h-auto`}
          />
        )}
      </Field>
      <p className="m-[3px]">
        <button type="submit" disabled={pending} className={FORM_BUTTON}>
          {pending ? 'Sending\u2026' : 'Cancel order'}
        </button>
      </p>
    </form>
  );
}
