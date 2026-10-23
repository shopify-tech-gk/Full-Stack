'use client';

import { useState } from 'react';
import { CheckCircle2, Mail, PackageSearch, Phone, RotateCcw, Users, XCircle } from 'lucide-react';
import {
  adminFetch,
  fmtDateTime,
  timeAgo,
  type AdminProductRequest,
  type Page,
  type Tone,
} from '@/lib/admin';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  SearchInput,
  Tabs,
  useAdminData,
  useDebounced,
  useToast,
} from './ui';
import { RestockPanel, type RestockLink } from './RestockPanel';

// v1.17 Admin -> Product requests: things shoppers asked YouMart AI for that we don't stock, sent
// with its "Request restock" button. Mark them restocked (or closed) once handled.

type Status = AdminProductRequest['status'];
const STATUS: Record<Status, { label: string; tone: Tone }> = {
  OPEN: { label: 'New', tone: 'amber' },
  RESTOCKED: { label: 'Restocked', tone: 'green' },
  CLOSED: { label: 'Closed', tone: 'grey' },
};

export function AdminProductRequests() {
  const toast = useToast();
  const [status, setStatus] = useState<Status | 'ALL'>('OPEN');
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const list = useAdminData(
    () =>
      adminFetch<Page<AdminProductRequest> & { counts: Record<Status, number> }>(
        `/support/admin/product-requests?limit=100${status === 'ALL' ? '' : `&status=${status}`}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      ),
    [status, query],
  );
  const [busy, setBusy] = useState<string | null>(null);
  const items = list.data?.items ?? [];
  const counts = list.data?.counts;

  const [restocking, setRestocking] = useState<string | null>(null);

  const setRequestStatus = async (
    id: string,
    next: Status,
    done: string,
    extra: { link?: RestockLink; notifyAll?: boolean } = {},
  ) => {
    setBusy(`${id}:${next}`);
    try {
      const res = await adminFetch<{ notified: number; guests: number }>(
        `/support/admin/product-requests/${id}`,
        { method: 'PATCH', body: { status: next, ...extra } },
      );
      toast.ok(
        next === 'RESTOCKED'
          ? `Marked restocked · ${res.notified} ${res.notified === 1 ? 'shopper' : 'shoppers'} notified${
              res.guests
                ? ` (${res.guests} guest ${res.guests === 1 ? 'request' : 'requests'} can't be messaged)`
                : ''
            }`
          : done,
      );
      setRestocking(null);
      await list.reload();
    } catch (failure) {
      toast.fail(failure);
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Product requests"
        subtitle="What shoppers asked YouMart AI for that we don't have in stock (its “Request restock” button)."
        actions={<SearchInput value={q} onChange={setQ} placeholder="Search requested item" />}
      />
      <div className="mb-[14px]">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            { value: 'OPEN', label: 'New', count: counts?.OPEN },
            { value: 'RESTOCKED', label: 'Restocked', count: counts?.RESTOCKED },
            { value: 'CLOSED', label: 'Closed', count: counts?.CLOSED },
            { value: 'ALL', label: 'All' },
          ]}
        />
      </div>
      {list.error && <ErrorNote message={list.error} />}
      {!list.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Card>
          <Empty
            icon={PackageSearch}
            title={status === 'OPEN' ? 'No new requests' : 'Nothing here'}
            text={
              status === 'OPEN'
                ? 'When shoppers ask for something we don’t stock, it shows up here.'
                : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-[#eef1f6]">
            {items.map((r) => (
              <li key={r.requestId} className="px-[20px] py-[16px]">
                <div className="flex flex-wrap items-start justify-between gap-[12px]">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-[8px]">
                      <span className="text-[15px] font-semibold text-[#0b1b3f]">{r.item}</span>
                      <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                      {r.status === 'OPEN' && r.sameItemOpen > 1 && (
                        <Badge tone="violet">
                          <Users aria-hidden="true" className="size-[12px]" /> {r.sameItemOpen}{' '}
                          asking
                        </Badge>
                      )}
                    </div>
                    {r.note && <p className="mt-[4px] text-[13.5px] text-[#475569]">{r.note}</p>}
                    <div className="mt-[6px] flex flex-wrap gap-x-[16px] gap-y-[4px] text-[12.5px] text-[#5d6b85]">
                      <span>{timeAgo(r.createdAt)}</span>
                      {r.customer ? (
                        <>
                          {r.customer.phone && (
                            <span className="flex items-center gap-[5px]">
                              <Phone aria-hidden="true" className="size-[13px]" />{' '}
                              {r.customer.phone}
                            </span>
                          )}
                          {r.customer.email && (
                            <span className="flex items-center gap-[5px]">
                              <Mail aria-hidden="true" className="size-[13px]" /> {r.customer.email}
                            </span>
                          )}
                        </>
                      ) : (
                        <span>Guest (not signed in)</span>
                      )}
                    </div>
                    {r.chatTranscript && (
                      <details className="mt-[8px] rounded-[10px] border border-[#dfe6f3] bg-[#f8fafd] px-[12px] py-[8px]">
                        <summary className="cursor-pointer text-[12.5px] font-semibold text-[#0142aa]">
                          ✨ View the YouMart AI chat
                        </summary>
                        <p className="mt-[6px] max-h-[220px] overflow-y-auto whitespace-pre-wrap text-[13px] leading-[1.5] text-[#475569]">
                          {r.chatTranscript}
                        </p>
                      </details>
                    )}
                  </div>
                  <div className="flex gap-[8px]">
                    {r.status === 'OPEN' ? (
                      <>
                        <Button
                          variant="primary"
                          icon={CheckCircle2}
                          onClick={() =>
                            setRestocking(restocking === r.requestId ? null : r.requestId)
                          }
                        >
                          Restocked
                        </Button>
                        <Button
                          icon={XCircle}
                          busy={busy === `${r.requestId}:CLOSED`}
                          onClick={() => void setRequestStatus(r.requestId, 'CLOSED', 'Closed')}
                        >
                          Close
                        </Button>
                      </>
                    ) : (
                      <Button
                        icon={RotateCcw}
                        busy={busy === `${r.requestId}:OPEN`}
                        onClick={() => void setRequestStatus(r.requestId, 'OPEN', 'Reopened')}
                      >
                        Reopen
                      </Button>
                    )}
                  </div>
                </div>
                {restocking === r.requestId && (
                  <RestockPanel
                    item={r.item}
                    others={Math.max(0, r.sameItemOpen - 1)}
                    busy={busy === `${r.requestId}:RESTOCKED`}
                    onCancel={() => setRestocking(null)}
                    onConfirm={(link, notifyAll) =>
                      void setRequestStatus(r.requestId, 'RESTOCKED', 'Marked restocked', {
                        ...(link ? { link } : {}),
                        notifyAll,
                      })
                    }
                  />
                )}
                {r.status === 'RESTOCKED' && r.notifiedAt && (
                  <p className="mt-[8px] text-[12.5px] text-[#16a34a]">
                    ✓ Notified {fmtDateTime(r.notifiedAt)}
                    {r.restockLabel ? ` · linked to “${r.restockLabel}”` : ' · no link'}
                    {!r.customer ? ' (guest - no message sent)' : ''}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
