'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ChevronRight, FileText, Loader2, RotateCcw, ShieldCheck, Trash2, Truck } from 'lucide-react';
import { ApiError, ROUTES, formatMoney, type AccountDeletionCheck } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { logout } from '@/lib/session';
import { BTN_DANGER, BTN_SECONDARY, Banner, Dialog, INPUT, PageHeader, Panel, Skeleton } from './ui';

const POLICIES = [
  { href: '/privacy-policy', label: 'Privacy Policy', sub: 'What we collect and why', Icon: ShieldCheck },
  { href: '/terms', label: 'Terms & Conditions', sub: 'Including YouMart Wallet terms', Icon: FileText },
  { href: '/refund-policy', label: 'Refund Policy', sub: 'Returns, refunds and the wallet', Icon: RotateCcw },
  { href: '/shipping', label: 'Shipping Policy', sub: 'Delivery areas and charges', Icon: Truck },
];

/**
 * W9 on the website: Privacy & account - the policies and account deletion. Deletion waits for
 * orders in progress; a wallet balance must be explicitly given up (Terms: forfeited on deletion).
 */
export function PrivacyAccountView() {
  const router = useRouter();
  const [check, setCheck] = useState<AccountDeletionCheck | null | 'error'>(null);
  const [open, setOpen] = useState(false);
  const [forfeit, setForfeit] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.auth
      .deletionCheck()
      .then(setCheck)
      .catch(() => setCheck('error'));
  }, []);

  const ready = check && check !== 'error' ? check : null;
  const hasBalance = ready ? ready.walletBalance !== '0.00' : false;
  const canConfirm = confirmText.trim().toUpperCase() === 'DELETE' && (!hasBalance || forfeit);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.auth.deleteAccount(hasBalance && forfeit);
      await logout().catch(() => undefined);
      router.replace('/?account=deleted');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete your account. Please try again.');
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Privacy & account" subtitle="Our policies, and control over your account and data." />

      <Panel title="Policies">
        <ul className="grid gap-[10px] md:grid-cols-2">
          {POLICIES.map(({ href, label, sub, Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="group flex items-center gap-[12px] rounded-[12px] border border-catalog-rule p-[14px] font-ui transition-colors hover:border-brand"
              >
                <span className="flex size-[40px] items-center justify-center rounded-[10px] bg-[#eef3fc] text-brand">
                  <Icon aria-hidden="true" className="size-[19px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[14.5px] font-semibold text-heading">{label}</span>
                  <span className="block text-[12.5px] text-ink-muted">{sub}</span>
                </span>
                <ChevronRight aria-hidden="true" className="size-[16px] text-ink-muted transition-transform group-hover:translate-x-[2px] group-hover:text-brand" />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Your data">
        <p className="font-ui text-[14.5px] leading-[1.6] text-ink-body">
          We use your name, contact details and addresses only to deliver your orders and support you.
          Manage what we send you under{' '}
          <Link href={ROUTES.notifications} className="font-semibold text-brand hover:underline">
            Notifications
          </Link>{' '}
          and which devices are signed in under{' '}
          <Link href={ROUTES.devices} className="font-semibold text-brand hover:underline">
            Signed-in devices
          </Link>
          .
        </p>
      </Panel>

      <section className="rounded-[14px] border border-[#f5c2c2] bg-white shadow-rail-card">
        <div className="flex items-center gap-[10px] border-b border-[#f5c2c2] bg-[#fdf6f6] px-[20px] py-[14px] rounded-t-[14px]">
          <Trash2 aria-hidden="true" className="size-[18px] text-woo-error" />
          <h2 className="font-ui text-[16.5px] font-semibold text-[#991b1b]">Delete account</h2>
        </div>
        <div className="p-[20px] font-ui text-[14.5px] leading-[1.6] text-ink-body">
          <p>
            Deleting your account permanently removes your profile, saved addresses, wishlist and
            reviews. Order and invoice records we must keep by law are kept, without your contact
            details. This can&rsquo;t be undone.
          </p>
          {check === null ? (
            <Skeleton className="mt-[16px] h-[44px] w-[220px]" />
          ) : check === 'error' ? (
            <Banner tone="error">Couldn&rsquo;t check your account right now. Please refresh the page.</Banner>
          ) : check.openOrders > 0 ? (
            <div className="mt-[16px]">
              <Banner tone="info">
                You have {check.openOrders} order{check.openOrders === 1 ? '' : 's'} in progress. You can
                delete your account once {check.openOrders === 1 ? 'it is' : 'they are'} delivered or
                cancelled.{' '}
                <Link href={ROUTES.orders} className="font-semibold underline">
                  View orders
                </Link>
              </Banner>
            </div>
          ) : (
            <>
              {hasBalance ? (
                <div className="mt-[16px] flex items-start gap-[10px] rounded-[10px] border border-[#fde2b8] bg-[#fff8ec] px-[14px] py-[12px] text-[14px] text-[#92400e]">
                  <AlertTriangle aria-hidden="true" className="mt-[2px] size-[16px] shrink-0" />
                  <span>
                    Your YouMart Wallet has <strong>{formatMoney(check.walletBalance)}</strong>. Wallet
                    money is store credit and is <strong>lost</strong> when the account is deleted.{' '}
                    <Link href="/" className="font-semibold underline">
                      Spend it first
                    </Link>
                    .
                  </span>
                </div>
              ) : null}
              <button type="button" onClick={() => setOpen(true)} disabled={!check.canDelete && !hasBalance} className={`${BTN_DANGER} mt-[16px]`}>
                <Trash2 aria-hidden="true" className="size-[16px]" />
                Delete my account
              </button>
            </>
          )}
        </div>
      </section>

      <Dialog
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Delete your YouMart account?"
        description="This is permanent. You’ll be signed out everywhere."
        footer={
          <>
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className={BTN_SECONDARY}>
              Keep my account
            </button>
            <button type="button" onClick={() => void remove()} disabled={!canConfirm || busy} className={BTN_DANGER}>
              {busy ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : <Trash2 aria-hidden="true" className="size-[16px]" />}
              Delete permanently
            </button>
          </>
        }
      >
        {hasBalance && ready ? (
          <label className="mb-[16px] flex cursor-pointer items-start gap-[10px] rounded-[10px] border border-[#fde2b8] bg-[#fff8ec] px-[14px] py-[12px] font-ui text-[14px] text-[#92400e]">
            <input type="checkbox" checked={forfeit} onChange={(e) => setForfeit(e.target.checked)} className="mt-[3px] size-[16px] accent-woo-error" />
            <span>
              I understand my wallet balance of <strong>{formatMoney(ready.walletBalance)}</strong> will be
              lost and can&rsquo;t be refunded.
            </span>
          </label>
        ) : null}
        <label htmlFor="delete-confirm" className="mb-[6px] block font-ui text-[13.5px] font-semibold text-heading">
          Type <span className="font-mono text-woo-error">DELETE</span> to confirm
        </label>
        <input
          id="delete-confirm"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          autoComplete="off"
          className={INPUT}
        />
        {error ? <p className="mt-[10px] font-ui text-[13.5px] text-woo-error">{error}</p> : null}
      </Dialog>
    </>
  );
}
