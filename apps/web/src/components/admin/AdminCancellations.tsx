'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CircleSlash } from 'lucide-react';
import { formatMoney } from '@youmart/shared-client';
import { adminFetch, can, fmtDateTime, type AdminCancelRequest, type Page } from '@/lib/admin';
import { useAdmin } from './AdminShell';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  Tabs,
  inputClass,
  useAdminData,
  useToast,
} from './ui';

type Status = 'REQUESTED' | 'APPROVED' | 'REJECTED';

export function AdminCancellations() {
  const { session, refreshCounts } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<Status>('REQUESTED');
  const list = useAdminData(
    () => adminFetch<Page<AdminCancelRequest>>(`/orders/admin/cancel-requests?limit=50&status=${status}`),
    [status],
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  const resolve = async (r: AdminCancelRequest, action: 'approve' | 'reject') => {
    setBusy(`${action}:${r.cancelRequestId}`);
    try {
      const note = notes[r.cancelRequestId]?.trim();
      await adminFetch(`/orders/admin/cancel-requests/${r.cancelRequestId}/${action}`, {
        method: 'POST',
        body: note ? { note } : {},
      });
      toast.ok(
        action === 'approve'
          ? r.paymentMethod === 'COD'
            ? `${r.orderNumber} cancelled`
            : `${r.orderNumber} cancelled · refund sent to the customer's wallet`
          : 'Request declined · the order goes ahead',
      );
      await list.reload();
      refreshCounts();
    } catch (failure) {
      toast.fail(failure);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader title="Cancellations" subtitle="Customers asking to cancel orders that were already paid or packed." />
      <div className="mb-[14px]">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'REQUESTED', label: 'Waiting' },
            { value: 'APPROVED', label: 'Approved' },
            { value: 'REJECTED', label: 'Declined' },
          ]}
        />
      </div>
      {list.error && <ErrorNote message={list.error} />}
      {!list.data ? (
        <Loading />
      ) : list.data.items.length === 0 ? (
        <Card>
          <Empty icon={CircleSlash} title={status === 'REQUESTED' ? 'No requests waiting' : 'Nothing here yet'} text={status === 'REQUESTED' ? 'New cancel requests from customers will appear here.' : undefined} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-[14px] lg:grid-cols-2">
          {list.data.items.map((r) => (
            <Card key={r.cancelRequestId}>
              <div className="px-[20px] py-[16px]">
                <div className="flex items-start justify-between gap-[10px]">
                  <div>
                    <Link href={`/admin/orders/${r.orderNumber}`} className="text-[15.5px] font-semibold text-[#0142aa] hover:underline">
                      {r.orderNumber}
                    </Link>
                    <p className="text-[13px] text-[#6b7891]">
                      {r.customerName ?? 'Customer'} · {formatMoney(r.grandTotal)} ·{' '}
                      {r.paymentMethod === 'COD' ? 'Cash on Delivery' : 'Paid online'}
                    </p>
                  </div>
                  <Badge tone={r.status === 'REQUESTED' ? 'amber' : r.status === 'APPROVED' ? 'red' : 'grey'}>
                    {r.status === 'REQUESTED' ? 'Waiting' : r.status === 'APPROVED' ? 'Cancelled' : 'Declined'}
                  </Badge>
                </div>
                <div className="mt-[12px] rounded-[10px] bg-[#f6f8fc] px-[14px] py-[10px]">
                  <p className="text-[14px] font-semibold text-[#0b1b3f]">{r.reason}</p>
                  {r.comment && <p className="mt-[2px] text-[13.5px] text-[#5d6b85]">&ldquo;{r.comment}&rdquo;</p>}
                  <p className="mt-[4px] text-[12px] text-[#8a95ab]">Asked {fmtDateTime(r.createdAt)}</p>
                </div>
                {r.resolutionNote && (
                  <p className="mt-[10px] text-[13px] text-[#5d6b85]">
                    <b>Note:</b> {r.resolutionNote}
                  </p>
                )}
                {r.status === 'REQUESTED' && (
                  <>
                    <input
                      value={notes[r.cancelRequestId] ?? ''}
                      onChange={(e) => setNotes((n) => ({ ...n, [r.cancelRequestId]: e.target.value }))}
                      placeholder="Note for the customer (optional)"
                      className={`${inputClass} mt-[12px]`}
                    />
                    <div className="mt-[12px] flex justify-end gap-[8px]">
                      <Button busy={busy === `reject:${r.cancelRequestId}`} onClick={() => void resolve(r, 'reject')}>
                        Decline
                      </Button>
                      <Button
                        variant="danger"
                        busy={busy === `approve:${r.cancelRequestId}`}
                        disabled={r.paymentMethod === 'ONLINE' && !can(session, 'refunds.manage')}
                        title={r.paymentMethod === 'ONLINE' && !can(session, 'refunds.manage') ? 'Needs refund permission' : undefined}
                        onClick={() => void resolve(r, 'approve')}
                      >
                        {r.paymentMethod === 'COD' ? 'Cancel order' : 'Cancel & refund'}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
      {toast.node}
    </>
  );
}
