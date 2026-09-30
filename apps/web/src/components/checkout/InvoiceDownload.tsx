'use client';

import { useEffect, useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { ApiError, type InvoiceSummary } from '@youmart/shared-client';
import { TEXT_LINK } from '@/components/account/formStyles';
import { api } from '@/lib/api';

// invoice-service generates the GST invoice from a queue a moment after the order is confirmed.
const INVOICE_POLL = { intervalMs: 2000, attempts: 15 } as const;

type State =
  { kind: 'waiting' } | { kind: 'ready'; invoice: InvoiceSummary } | { kind: 'unavailable' };

/**
 * GET /api/invoices/order/:id until the invoice exists, then a download button. The PDF needs the
 * in-memory access token, so it is fetched as a blob rather than linked directly.
 */
export function InvoiceDownload({ orderId }: { orderId: string }) {
  const [state, setState] = useState<State>({ kind: 'waiting' });
  const [attempt, setAttempt] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const check = async (tries: number) => {
      try {
        const invoice = await api.invoices.getForOrder(orderId);
        if (active) setState({ kind: 'ready', invoice });
      } catch (error) {
        if (!active) return;
        const retryable =
          !(error instanceof ApiError) || error.status === 404 || error.status >= 500;
        if (retryable && tries + 1 < INVOICE_POLL.attempts) {
          timer = setTimeout(() => void check(tries + 1), INVOICE_POLL.intervalMs);
        } else {
          setState({ kind: 'unavailable' });
        }
      }
    };
    setState({ kind: 'waiting' });
    void check(0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [orderId, attempt]);

  const download = async (invoice: InvoiceSummary) => {
    setDownloading(true);
    setFailed(false);
    try {
      const blob = await api.invoices.downloadForOrder(orderId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${invoice.invoiceNumber.replace(/\//g, '-')}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch {
      setFailed(true);
    } finally {
      setDownloading(false);
    }
  };

  if (state.kind === 'waiting') {
    return (
      <p role="status" className="flex items-center gap-[8px] text-ink-muted">
        <Loader2 aria-hidden="true" className="size-[16px] animate-spin text-brand" />
        Preparing your GST invoice&hellip;
      </p>
    );
  }
  if (state.kind === 'unavailable') {
    return (
      <p className="text-ink-muted">
        Your invoice is still being prepared.{' '}
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={TEXT_LINK}>
          Check again
        </button>
      </p>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-x-[14px] gap-y-[6px]">
      <button
        type="button"
        onClick={() => void download(state.invoice)}
        disabled={downloading}
        className="inline-flex h-[40px] items-center gap-[8px] rounded-[30px] border-2 border-brand bg-white px-[22px] font-ui text-[14px] font-bold uppercase text-brand transition-colors hover:bg-cart-rowHover focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
      >
        {downloading ? (
          <Loader2 aria-hidden="true" className="size-[16px] animate-spin" />
        ) : (
          <FileDown aria-hidden="true" className="size-[16px]" />
        )}
        Download invoice
      </button>
      <span className="text-[14px] text-ink-muted">
        Tax invoice <strong className="text-heading">{state.invoice.invoiceNumber}</strong>
      </span>
      {failed && (
        <span role="alert" className="w-full text-[14px] text-woo-error">
          The download did not start. Please try again.
        </span>
      )}
    </div>
  );
}
