'use client';

import { useEffect, useId, useState } from 'react';
import {
  NOTIFY_CHANNELS,
  formatMoney,
  supportErrorMessage,
  type NotifyPreference,
} from '@youmart/shared-client';
import { Notice } from '@/components/account/Notice';
import {
  FIELD_HINT,
  FORM_BUTTON,
  FORM_INPUT,
  FORM_LABEL,
  FORM_ROW,
} from '@/components/account/formStyles';
import { api } from '@/lib/api';
import { Field } from './Field';
import { initialOrderId, useOwnOrders } from './useOwnOrders';

type Channels = Pick<NotifyPreference, 'whatsapp' | 'sms'>;

/** Per-order delivery-update preferences: GET/PUT /api/orders/:id/notify (own orders only). */
export function OrderNotifyForm({ orderNumber }: { orderNumber?: string }) {
  const id = useId();
  const { orders, failed } = useOwnOrders();
  const [orderId, setOrderId] = useState('');
  const [channels, setChannels] = useState<Channels | null>(null);
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (orders) setOrderId(initialOrderId(orders, orderNumber));
  }, [orders, orderNumber]);

  useEffect(() => {
    setChannels(null);
    setStatus(null);
    if (!orderId) return;
    let active = true;
    api.orders
      .getNotify(orderId)
      .then((pref) => active && setChannels({ whatsapp: pref.whatsapp, sms: pref.sms }))
      .catch(
        (error: unknown) =>
          active && setStatus({ tone: 'error', text: supportErrorMessage(error) }),
      );
    return () => {
      active = false;
    };
  }, [orderId]);

  const save = async () => {
    if (!channels) return;
    setPending(true);
    setStatus(null);
    try {
      const saved = await api.orders.setNotify(orderId, channels);
      setChannels({ whatsapp: saved.whatsapp, sms: saved.sms });
      setStatus({ tone: 'success', text: 'Your delivery update preferences have been saved.' });
    } catch (error) {
      setStatus({ tone: 'error', text: supportErrorMessage(error) });
    } finally {
      setPending(false);
    }
  };

  if (failed) return <Notice tone="error">We could not load your orders. Please refresh.</Notice>;
  if (!orders) return <div aria-busy="true" className="min-h-[200px]" />;

  const open = orders.filter((order) => order.status !== 'CANCELLED');
  if (open.length === 0) {
    return <Notice tone="info">You have no active orders to get updates for.</Notice>;
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {status && <Notice tone={status.tone}>{status.text}</Notice>}
      <Field id={`${id}-order`} label="Order" required>
        {(aria) => (
          <select
            {...aria}
            value={orderId}
            onChange={(e) => setOrderId(e.target.value)}
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
      {orderId && channels && (
        <>
          <fieldset className={FORM_ROW}>
            <legend className={FORM_LABEL}>Send me delivery updates on</legend>
            <div className="flex flex-wrap gap-x-[20px] gap-y-[8px]">
              {NOTIFY_CHANNELS.map((channel) => (
                <label
                  key={channel.key}
                  className="flex items-center gap-[6px] font-ui text-[15px] text-ink-body"
                >
                  <input
                    type="checkbox"
                    checked={channels[channel.key]}
                    onChange={(e) =>
                      setChannels((c) => (c ? { ...c, [channel.key]: e.target.checked } : c))
                    }
                    className="size-[16px] accent-brand"
                  />
                  {channel.label}
                </label>
              ))}
            </div>
          </fieldset>
          <p className="m-[3px]">
            <button type="submit" disabled={pending} className={FORM_BUTTON}>
              {pending ? 'Saving\u2026' : 'Save preferences'}
            </button>
          </p>
          <p className={`${FIELD_HINT} mx-[3px] mt-[10px]`}>
            Updates go to the mobile number on the order.
          </p>
        </>
      )}
    </form>
  );
}
