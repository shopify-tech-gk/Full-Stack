'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Headset, Mail, Phone, Send } from 'lucide-react';
import { adminFetch, fmtDateTime, timeAgo, type AdminTicket, type Page, type Tone } from '@/lib/admin';
import { useAdmin } from './AdminShell';
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

type Status = AdminTicket['status'];
const STATUS: Record<Status, { label: string; tone: Tone }> = {
  OPEN: { label: 'New', tone: 'amber' },
  IN_PROGRESS: { label: 'In progress', tone: 'blue' },
  RESOLVED: { label: 'Resolved', tone: 'green' },
};

export function AdminSupport() {
  const { refreshCounts } = useAdmin();
  const toast = useToast();
  const [status, setStatus] = useState<Status | 'ALL'>('OPEN');
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const list = useAdminData(
    () =>
      adminFetch<Page<AdminTicket> & { counts: Record<Status, number> }>(
        `/support/admin/tickets?limit=50${status === 'ALL' ? '' : `&status=${status}`}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      ),
    [status, query],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const items = list.data?.items ?? [];
  const selected = items.find((t) => t.ticketId === selectedId) ?? items[0] ?? null;
  const counts = list.data?.counts;

  const update = async (body: { status?: Status; reply?: string }, done: string) => {
    if (!selected) return;
    setBusy(body.reply ? (body.status ? 'reply-resolve' : 'reply') : (body.status ?? ''));
    try {
      await adminFetch(`/support/admin/tickets/${selected.ticketId}`, { method: 'PATCH', body });
      toast.ok(done);
      if (body.reply) setReply('');
      setSelectedId(selected.ticketId);
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
      <PageHeader
        title="Support"
        subtitle="Help requests from signed-in customers. Your reply shows under their Help Requests."
        actions={<SearchInput value={q} onChange={setQ} placeholder="Message, order no. or HLP- reference" />}
      />
      <div className="mb-[14px]">
        <Tabs
          value={status}
          onChange={(v) => {
            setStatus(v);
            setSelectedId(null);
          }}
          tabs={[
            { value: 'OPEN', label: 'New', count: counts?.OPEN },
            { value: 'IN_PROGRESS', label: 'In progress', count: counts?.IN_PROGRESS },
            { value: 'RESOLVED', label: 'Resolved', count: counts?.RESOLVED },
            { value: 'ALL', label: 'All' },
          ]}
        />
      </div>
      {list.error && <ErrorNote message={list.error} />}
      {!list.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Card>
          <Empty icon={Headset} title={status === 'OPEN' ? 'Inbox zero' : 'No requests here'} text={status === 'OPEN' ? 'No new help requests. Nice work.' : undefined} />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-[16px] lg:grid-cols-[380px_1fr]">
          <Card className="overflow-hidden">
            <ul className="max-h-[640px] divide-y divide-[#eef1f6] overflow-y-auto">
              {items.map((t) => {
                const active = selected?.ticketId === t.ticketId;
                return (
                  <li key={t.ticketId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(t.ticketId)}
                      className={`block w-full px-[18px] py-[14px] text-left transition ${
                        active ? 'bg-[#eef3ff] shadow-[inset_3px_0_0_#0142aa]' : 'hover:bg-[#fafbfe]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-[8px]">
                        <span className="text-[13.5px] font-semibold text-[#0b1b3f]">{t.topicLabel}</span>
                        <span className="text-[12px] text-[#8a95ab]">{timeAgo(t.createdAt)}</span>
                      </div>
                      <p className="mt-[3px] line-clamp-2 text-[13px] text-[#5d6b85]">{t.message}</p>
                      <div className="mt-[6px] flex items-center gap-[8px]">
                        <Badge tone={STATUS[t.status].tone}>{STATUS[t.status].label}</Badge>
                        <span className="text-[11.5px] font-semibold text-[#8a95ab]">{t.reference}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Card>

          {selected && (
            <Card>
              <div className="border-b border-[#eef1f6] px-[22px] py-[16px]">
                <div className="flex flex-wrap items-start justify-between gap-[10px]">
                  <div>
                    <p className="text-[12px] font-semibold tracking-[0.06em] text-[#8a95ab]">{selected.reference}</p>
                    <h2 className="text-[18px] font-semibold text-[#0b1b3f]">{selected.topicLabel}</h2>
                  </div>
                  <Badge tone={STATUS[selected.status].tone}>{STATUS[selected.status].label}</Badge>
                </div>
                <div className="mt-[10px] flex flex-wrap gap-x-[18px] gap-y-[6px] text-[13px] text-[#5d6b85]">
                  {selected.customer?.phone && (
                    <span className="flex items-center gap-[6px]">
                      <Phone aria-hidden="true" className="size-[14px]" /> {selected.customer.phone}
                    </span>
                  )}
                  {selected.customer?.email && (
                    <span className="flex items-center gap-[6px]">
                      <Mail aria-hidden="true" className="size-[14px]" /> {selected.customer.email}
                    </span>
                  )}
                  {selected.orderNumber && (
                    <Link href={`/admin/orders/${selected.orderNumber}`} className="font-semibold text-[#0142aa] hover:underline">
                      Order {selected.orderNumber}
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-[14px] px-[22px] py-[18px]">
                <div className="max-w-[85%] rounded-[14px] rounded-tl-[4px] bg-[#f1f4f9] px-[16px] py-[12px]">
                  <p className="whitespace-pre-wrap text-[14.5px] leading-[1.55] text-[#24324d]">{selected.message}</p>
                  <p className="mt-[6px] text-[11.5px] text-[#8a95ab]">Customer · {fmtDateTime(selected.createdAt)}</p>
                </div>
                {selected.adminReply && (
                  <div className="ml-auto max-w-[85%] rounded-[14px] rounded-tr-[4px] bg-[#0142aa] px-[16px] py-[12px] text-white">
                    <p className="whitespace-pre-wrap text-[14.5px] leading-[1.55]">{selected.adminReply}</p>
                    <p className="mt-[6px] text-[11.5px] text-[#c6d6fb]">
                      YouMart Support · {selected.repliedAt ? fmtDateTime(selected.repliedAt) : ''}
                    </p>
                  </div>
                )}
              </div>
              <div className="border-t border-[#eef1f6] px-[22px] py-[16px]">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  placeholder={selected.adminReply ? 'Update your reply…' : 'Write a reply to the customer…'}
                  className="w-full resize-y rounded-[12px] border border-[#d7deea] px-[14px] py-[10px] text-[14px] text-[#0b1b3f] placeholder:text-[#8a95ab] focus:border-[#0142aa] focus:outline-none focus:ring-2 focus:ring-[#0142aa]/15"
                />
                <div className="mt-[10px] flex flex-wrap justify-between gap-[8px]">
                  <div className="flex gap-[8px]">
                    {selected.status !== 'IN_PROGRESS' && (
                      <Button busy={busy === 'IN_PROGRESS'} onClick={() => void update({ status: 'IN_PROGRESS' }, 'Marked in progress')}>
                        In progress
                      </Button>
                    )}
                    {selected.status !== 'RESOLVED' ? (
                      <Button busy={busy === 'RESOLVED'} onClick={() => void update({ status: 'RESOLVED' }, 'Marked resolved')}>
                        Resolve
                      </Button>
                    ) : (
                      <Button busy={busy === 'OPEN'} onClick={() => void update({ status: 'OPEN' }, 'Reopened')}>
                        Reopen
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-[8px]">
                    <Button
                      disabled={reply.trim().length < 2}
                      busy={busy === 'reply-resolve'}
                      onClick={() => void update({ reply: reply.trim(), status: 'RESOLVED' }, 'Replied & resolved')}
                    >
                      Reply & resolve
                    </Button>
                    <Button
                      variant="primary"
                      icon={Send}
                      disabled={reply.trim().length < 2}
                      busy={busy === 'reply'}
                      onClick={() => void update({ reply: reply.trim() }, 'Reply sent')}
                    >
                      Send reply
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
      {toast.node}
    </>
  );
}
