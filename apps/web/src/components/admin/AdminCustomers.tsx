'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { adminFetch, fmtDate, timeAgo, type AdminCustomer, type Page } from '@/lib/admin';
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  SearchInput,
  Table,
  td,
  useAdminData,
  useDebounced,
} from './ui';

export function AdminCustomers() {
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const [cursor, setCursor] = useState<string | null>(null);
  const list = useAdminData(
    () =>
      adminFetch<Page<AdminCustomer> & { total: number; joinedLast7Days: number }>(
        `/auth/admin/customers?limit=25${query ? `&q=${encodeURIComponent(query)}` : ''}${cursor ? `&cursor=${cursor}` : ''}`,
      ),
    [query, cursor],
  );

  return (
    <>
      <PageHeader
        title="Customers"
        subtitle={
          list.data
            ? `${list.data.total.toLocaleString('en-IN')} customers · ${list.data.joinedLast7Days} joined this week`
            : 'Everyone with a YouMart account.'
        }
        actions={<SearchInput value={q} onChange={(v) => { setQ(v); setCursor(null); }} placeholder="Name, phone or email" />}
      />
      {list.error && <ErrorNote message={list.error} />}
      <Card>
        {!list.data ? (
          <Loading label="Loading customers" />
        ) : list.data.items.length === 0 ? (
          <Empty icon={Users} title="No customers found" />
        ) : (
          <>
            <Table head={['Customer', 'Phone', 'Email', 'Joined', 'Last active', 'Status']}>
              {list.data.items.map((c) => {
                const name = c.name ?? (c.email ? c.email.split('@')[0] : null) ?? 'Customer';
                return (
                  <tr key={c.userId} className="hover:bg-[#fafbfe]">
                    <td className={td}>
                      <div className="flex items-center gap-[10px]">
                        <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#eef3ff] text-[13px] font-bold uppercase text-[#0142aa]">
                          {name.slice(0, 1)}
                        </span>
                        <span className={`font-medium ${c.name ? 'text-[#0b1b3f]' : 'italic text-[#7a86a0]'}`}>
                          {c.name ?? 'No name yet'}
                        </span>
                      </div>
                    </td>
                    <td className={`${td} whitespace-nowrap`}>{c.phone ?? '—'}</td>
                    <td className={`${td} max-w-[240px] truncate`}>{c.email ?? '—'}</td>
                    <td className={`${td} whitespace-nowrap text-[#5d6b85]`}>{fmtDate(c.joinedAt)}</td>
                    <td className={`${td} whitespace-nowrap text-[#5d6b85]`}>
                      {c.lastActiveAt ? timeAgo(c.lastActiveAt) : '—'}
                      {c.activeDevices > 0 && (
                        <span className="ml-[6px] text-[12px] text-[#8a95ab]">
                          · {c.activeDevices} device{c.activeDevices === 1 ? '' : 's'}
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      <Badge tone={c.status === 'ACTIVE' ? 'green' : 'red'}>
                        {c.status === 'ACTIVE' ? 'Active' : 'Blocked'}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </Table>
            {(cursor || list.data.nextCursor) && (
              <div className="flex justify-center gap-[8px] border-t border-[#eef1f6] p-[14px]">
                {cursor && <Button onClick={() => setCursor(null)}>First page</Button>}
                {list.data.nextCursor && (
                  <Button onClick={() => setCursor(list.data?.nextCursor ?? null)}>Next page</Button>
                )}
              </div>
            )}
          </>
        )}
      </Card>
    </>
  );
}
