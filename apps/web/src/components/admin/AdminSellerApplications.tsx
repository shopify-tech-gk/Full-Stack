'use client';

import { useEffect, useState } from 'react';
import { BadgeCheck, Mail, MapPin, Phone, Store } from 'lucide-react';
import {
  adminFetch,
  fmtDateTime,
  timeAgo,
  type AdminSellerApplication,
  type Tone,
} from '@/lib/admin';
import {
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  ErrorNote,
  Loading,
  PageHeader,
  SearchInput,
  Table,
  Tabs,
  td,
  useAdminData,
  useDebounced,
  useToast,
} from './ui';

// v1.19 Admin -> Seller applications: customers who applied for "Sell on YouMart" early access
// from the app. The customer sees the status you set here (app: Account -> Sell on YouMart).

type Status = AdminSellerApplication['status'];

const STATUS: Record<Status, { label: string; tone: Tone; hint: string }> = {
  NEW: { label: 'New', tone: 'amber', hint: 'Not contacted yet' },
  CONTACTED: { label: 'Contacted', tone: 'blue', hint: 'Customer sees “Team in touch”' },
  SHORTLISTED: { label: 'Shortlisted', tone: 'violet', hint: 'Customer sees “Shortlisted”' },
  ONBOARDED: { label: 'Onboarded', tone: 'green', hint: 'Customer sees “Ready to sell”' },
  DECLINED: { label: 'Declined', tone: 'grey', hint: 'Customer sees a polite “closed” note' },
};
const ORDER: Status[] = ['NEW', 'CONTACTED', 'SHORTLISTED', 'ONBOARDED', 'DECLINED'];

const TYPE_LABEL: Record<AdminSellerApplication['businessType'], string> = {
  INDIVIDUAL: 'Individual',
  SHOP: 'Shop / retailer',
  BRAND: 'Own brand',
  MANUFACTURER: 'Manufacturer',
  WHOLESALER: 'Wholesaler',
};

const phoneText = (p: string) => `+91 ${p.replace(/(\d{5})(\d{5})/, '$1 $2')}`;

export function AdminSellerApplications() {
  const toast = useToast();
  const [status, setStatus] = useState<Status | 'ALL'>('NEW');
  const [q, setQ] = useState('');
  const query = useDebounced(q.trim());
  const list = useAdminData(
    () =>
      adminFetch<{ items: AdminSellerApplication[]; counts: Record<Status, number> }>(
        `/admin/sellers/early-access?limit=200${status === 'ALL' ? '' : `&status=${status}`}${query ? `&q=${encodeURIComponent(query)}` : ''}`,
      ),
    [status, query],
  );
  const items = list.data?.items ?? [];
  const counts = list.data?.counts;
  const total = counts ? ORDER.reduce((n, s) => n + counts[s], 0) : undefined;

  // The open record is kept here (not looked up in the list), so the panel stays open when a
  // status change moves it out of the current tab.
  const [selected, setSelected] = useState<AdminSellerApplication | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(
    () => setNote(selected?.adminNote ?? ''),
    [selected?.applicationId, selected?.adminNote],
  );

  const update = async (body: { status?: Status; adminNote?: string | null }, done: string) => {
    if (!selected) return;
    setBusy(body.status ?? 'note');
    try {
      const res = await adminFetch<{ application: AdminSellerApplication }>(
        `/admin/sellers/early-access/${selected.applicationId}`,
        { method: 'PATCH', body },
      );
      setSelected(res.application);
      toast.ok(done);
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
        title="Seller applications"
        subtitle="Customers who applied in the app to sell on YouMart (early access). Call them, then move each one along; they see the status in their app."
        actions={
          <SearchInput value={q} onChange={setQ} placeholder="Business, name, city, phone, ref" />
        }
      />

      <div className="mb-[14px]">
        <Tabs
          value={status}
          onChange={setStatus}
          tabs={[
            ...ORDER.map((s) => ({ value: s, label: STATUS[s].label, count: counts?.[s] })),
            { value: 'ALL' as const, label: 'All', count: total },
          ]}
        />
      </div>

      {list.error && <ErrorNote message={list.error} />}
      {!list.data ? (
        <Loading />
      ) : items.length === 0 ? (
        <Card>
          <Empty
            icon={Store}
            title={status === 'NEW' ? 'No new applications' : 'Nothing here'}
            text={
              status === 'NEW'
                ? 'When a customer taps “Apply for early access” under Account › Sell on YouMart, it shows up here.'
                : undefined
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table head={['Business', 'Sells', 'Contact', 'Applied', 'Status']}>
            {items.map((a) => (
              <tr
                key={a.applicationId}
                onClick={() => setSelected(a)}
                className="cursor-pointer hover:bg-[#f8fafd]"
              >
                <td className={td}>
                  <div className="font-semibold text-[#0b1b3f]">{a.businessName}</div>
                  <div className="mt-[2px] text-[12.5px] text-[#5d6b85]">
                    {TYPE_LABEL[a.businessType]} · {a.city} · {a.referenceCode}
                  </div>
                </td>
                <td className={td}>
                  <div>{a.category}</div>
                  <div className="mt-[2px] text-[12.5px] text-[#5d6b85]">
                    {a.hasGstin ? 'GST registered' : 'No GSTIN yet'}
                  </div>
                </td>
                <td className={td}>
                  <div>{a.contactName}</div>
                  <div className="mt-[2px] text-[12.5px] text-[#5d6b85]">{phoneText(a.phone)}</div>
                </td>
                <td className={`${td} whitespace-nowrap text-[#5d6b85]`}>{timeAgo(a.createdAt)}</td>
                <td className={td}>
                  <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                </td>
              </tr>
            ))}
          </Table>
        </Card>
      )}

      <Drawer
        open={!!selected}
        title={selected ? selected.businessName : ''}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <div className="flex flex-col gap-[18px]">
            <div className="flex flex-wrap items-center gap-[8px]">
              <Badge tone={STATUS[selected.status].tone}>{STATUS[selected.status].label}</Badge>
              <span className="rounded-[8px] bg-[#f1f4f9] px-[8px] py-[3px] font-mono text-[12.5px] font-semibold text-[#0b1b3f]">
                {selected.referenceCode}
              </span>
              <span className="text-[12.5px] text-[#5d6b85]">
                Applied {fmtDateTime(selected.createdAt)}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-[16px] gap-y-[12px] rounded-[14px] border border-[#eef1f6] bg-[#f8fafd] p-[16px] text-[13.5px]">
              {[
                ['Business type', TYPE_LABEL[selected.businessType]],
                ['Sells', selected.category],
                ['City', selected.city],
                ['GST', selected.hasGstin ? 'Registered (has GSTIN)' : 'Not yet'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[11.5px] font-semibold uppercase tracking-[0.06em] text-[#6b7891]">
                    {k}
                  </dt>
                  <dd className="mt-[2px] text-[#0b1b3f]">{v}</dd>
                </div>
              ))}
            </dl>

            <div>
              <h3 className="mb-[8px] text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#5d6b85]">
                Contact
              </h3>
              <div className="font-semibold text-[#0b1b3f]">{selected.contactName}</div>
              <div className="mt-[8px] flex flex-wrap gap-[8px]">
                <a
                  href={`tel:+91${selected.phone}`}
                  className="inline-flex h-[36px] items-center gap-[7px] rounded-[10px] bg-[#0142aa] px-[14px] text-[13.5px] font-semibold text-white hover:bg-[#013a95]"
                >
                  <Phone aria-hidden="true" className="size-[15px]" /> {phoneText(selected.phone)}
                </a>
                {selected.email && (
                  <a
                    href={`mailto:${selected.email}`}
                    className="inline-flex h-[36px] items-center gap-[7px] rounded-[10px] border border-[#d7deea] px-[14px] text-[13.5px] font-semibold text-[#0b1b3f] hover:bg-[#f8fafd]"
                  >
                    <Mail aria-hidden="true" className="size-[15px]" /> {selected.email}
                  </a>
                )}
              </div>
              <div className="mt-[8px] flex items-center gap-[6px] text-[12.5px] text-[#5d6b85]">
                <MapPin aria-hidden="true" className="size-[13px]" /> {selected.city}
              </div>
            </div>

            {selected.note && (
              <div>
                <h3 className="mb-[6px] text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#5d6b85]">
                  Their message
                </h3>
                <p className="whitespace-pre-wrap rounded-[12px] border border-[#eef1f6] px-[14px] py-[10px] text-[14px] leading-[1.5] text-[#24324d]">
                  {selected.note}
                </p>
              </div>
            )}

            <div>
              <h3 className="mb-[8px] text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#5d6b85]">
                Status
              </h3>
              <div className="grid grid-cols-1 gap-[6px]">
                {ORDER.map((s) => {
                  const on = selected.status === s;
                  return (
                    <button
                      key={s}
                      type="button"
                      disabled={on || busy !== null}
                      onClick={() =>
                        void update({ status: s }, `Marked ${STATUS[s].label.toLowerCase()}`)
                      }
                      className={`flex items-center justify-between rounded-[11px] border px-[14px] py-[10px] text-left transition disabled:cursor-default ${
                        on
                          ? 'border-[#0142aa] bg-[#eef3ff]'
                          : 'border-[#e6ebf3] hover:border-[#0142aa]/40 hover:bg-[#f8fafd]'
                      }`}
                    >
                      <span>
                        <span className="text-[14px] font-semibold text-[#0b1b3f]">
                          {STATUS[s].label}
                        </span>
                        <span className="ml-[8px] text-[12.5px] text-[#6b7891]">
                          {STATUS[s].hint}
                        </span>
                      </span>
                      {on ? (
                        <BadgeCheck aria-hidden="true" className="size-[17px] text-[#0142aa]" />
                      ) : busy === s ? (
                        <span className="text-[12px] text-[#6b7891]">Saving…</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {selected.contactedAt && (
                <p className="mt-[8px] text-[12.5px] text-[#16a34a]">
                  ✓ First contacted {fmtDateTime(selected.contactedAt)}
                </p>
              )}
            </div>

            <div>
              <h3 className="mb-[6px] text-[12.5px] font-semibold uppercase tracking-[0.06em] text-[#5d6b85]">
                Team note (private)
              </h3>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                maxLength={1000}
                placeholder="e.g. Called on 14 Nov, has 40 SKUs, sells on Instagram"
                className="w-full resize-y rounded-[12px] border border-[#d7deea] px-[14px] py-[10px] text-[14px] text-[#0b1b3f] placeholder:text-[#8a95ab] focus:border-[#0142aa] focus:outline-none focus:ring-2 focus:ring-[#0142aa]/15"
              />
              <div className="mt-[8px] flex justify-end">
                <Button
                  variant="primary"
                  busy={busy === 'note'}
                  disabled={note.trim() === (selected.adminNote ?? '')}
                  onClick={() => void update({ adminNote: note.trim() || null }, 'Note saved')}
                >
                  Save note
                </Button>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}
