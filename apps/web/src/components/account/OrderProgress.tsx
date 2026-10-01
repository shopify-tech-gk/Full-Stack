import { Check } from 'lucide-react';
import {
  TRACKING_STEPS,
  orderEventLabel,
  trackingProgress,
  type OrderProgressSource,
  type OrderTimelineEntry,
  type TrackingEvent,
} from '@youmart/shared-client';
import { Notice } from './Notice';
import { BODY_TEXT } from './formStyles';

const timeFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

export function formatDateTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

const HEADING = 'mb-[12px] font-ui text-[20px] font-semibold leading-[26px] text-heading';

interface OrderProgressProps {
  order: OrderProgressSource;
  /** Order-level status history (placed, paid, cancelled). */
  timeline: readonly OrderTimelineEntry[];
  /** Courier scans across every shipment, newest first. */
  events: readonly TrackingEvent[];
}

/** The fulfilment stepper + one merged "Order updates" feed - shared by account + guest tracking. */
export function OrderProgress({ order, timeline, events }: OrderProgressProps) {
  const { step, cancelled } = trackingProgress(order);
  const updates = [
    ...events.map((e) => ({ label: e.status, location: e.location, at: e.occurredAt })),
    ...timeline.map((t) => ({ label: orderEventLabel(t.status), location: null, at: t.at })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
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

      {updates.length > 0 && (
        <div className="mb-[32px]">
          <h3 className={HEADING}>Order updates</h3>
          <ol className="border-l-2 border-brand pl-[16px]">
            {updates.map((update) => (
              <li key={`${update.label}-${update.at}`} className="mb-[12px] last:mb-0">
                <p className="font-ui text-[13px] leading-[1.4] text-ink-muted">
                  <time dateTime={update.at}>{formatDateTime(update.at)}</time>
                </p>
                <p className={BODY_TEXT}>
                  <strong className="font-semibold">{update.label}</strong>
                  {update.location && ` \u2013 ${update.location}`}
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}
    </>
  );
}
