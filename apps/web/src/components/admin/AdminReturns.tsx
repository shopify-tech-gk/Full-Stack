'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Undo2 } from 'lucide-react';
import { formatMoney } from '@youmart/shared-client';
import { adminFetch, can, fmtDateTime, type AdminReturn, type Page, type Tone } from '@/lib/admin';
import { useAdmin } from './AdminShell';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  Table,
  Tabs,
  td,
  useAdminData,
  useToast,
} from './ui';

type Status = AdminReturn['status'];

const STATUS: Record<Status, { label: string; tone: Tone }> = {
  REQUESTED: { label: 'New request', tone: 'amber' },
  APPROVED: { label: 'Approved · awaiting pickup', tone: 'blue' },
  PICKED_UP: { label: 'Picked up · refund due', tone: 'violet' },
  REFUNDED: { label: 'Refunded', tone: 'green' },
  REJECTED: { label: 'Declined', tone: 'grey' },
};

export function AdminReturns() {
  const { session, refreshCounts } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<Status | 'ALL'>('REQUESTED');
  const list = useAdminData(
    () => adminFetch<Page<AdminReturn>>(`/admin/returns?limit=50${status === 'ALL' ? '' : `&status=${status}`}`),
    [status],
  );
  const [busy, setBusy] = useState<string | null>(null);

  const act = async (r: AdminReturn, action: 'approve' | 'reject' | 'picked-up' | 'process-refund', done: string) => {
    setBusy(`${action}:${r.id}`);
    try {
      await adminFetch(`/admin/returns/${r.id}/${action}`, { method: 'POST', body: {} });
      toast.ok(done);
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
      <PageHeader title="Returns & refunds" subtitle="Approve, collect and refund returns. Refunds go to the customer's YouMart Wallet." />
      <div className="mb-[14px]">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'REQUESTED', label: 'New' },
            { value: 'APPROVED', label: 'To pick up' },
            { value: 'PICKED_UP', label: 'To refund' },
            { value: 'REFUNDED', label: 'Refunded' },
            { value: 'REJECTED', label: 'Declined' },
            { value: 'ALL', label: 'All' },
          ]}
        />
      </div>
      {list.error && <ErrorNote message={list.error} />}
      <Card>
        {!list.data ? (
          <Loading />
        ) : list.data.items.length === 0 ? (
          <Empty icon={Undo2} title="No returns here" />
        ) : (
          <Table head={['Item', 'Order', 'Reason', 'Requested', 'Status', '']}>
            {list.data.items.map((r) => (
              <tr key={r.id} className="hover:bg-[#fafbfe]">
                <td className={td}>
                  <p className="max-w-[260px] truncate font-medium text-[#0b1b3f]">{r.title ?? 'Item'}</p>
                  {r.quantity && <p className="text-[12px] text-[#7a86a0]">Qty {r.quantity}</p>}
                </td>
                <td className={td}>
                  {r.orderNumber ? (
                    <Link href={`/admin/orders/${r.orderNumber}`} className="font-semibold text-[#0142aa] hover:underline">
                      {r.orderNumber}
                    </Link>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={`${td} max-w-[240px]`}>{r.reason}</td>
                <td className={`${td} whitespace-nowrap text-[#6b7891]`}>{fmtDateTime(r.createdAt)}</td>
                <td className={td}>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  {r.refundAmount && (
                    <p className="mt-[3px] text-[12px] font-semibold text-[#137a3f]">{formatMoney(r.refundAmount)}</p>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap text-right`}>
                  <div className="flex justify-end gap-[6px]">
                    {r.status === 'REQUESTED' && (
                      <>
                        <Button busy={busy === `reject:${r.id}`} onClick={() => void act(r, 'reject', 'Return declined')}>
                          Decline
                        </Button>
                        <Button variant="primary" busy={busy === `approve:${r.id}`} onClick={() => void act(r, 'approve', 'Return approved · schedule the pickup')}>
                          Approve
                        </Button>
                      </>
                    )}
                    {r.status === 'APPROVED' && (
                      <Button variant="primary" busy={busy === `picked-up:${r.id}`} onClick={() => void act(r, 'picked-up', 'Marked as picked up')}>
                        Picked up
                      </Button>
                    )}
                    {r.status === 'PICKED_UP' && can(session, 'refunds.manage') && (
                      <Button variant="gold" busy={busy === `process-refund:${r.id}`} onClick={() => void act(r, 'process-refund', 'Refund sent to the wallet')}>
                        Refund
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>
      {toast.node}
    </>
  );
}
