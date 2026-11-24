'use client';

import { useCallback, useEffect, useState } from 'react';
import { Globe, Loader2, LogOut, MonitorSmartphone, ShieldCheck, Smartphone } from 'lucide-react';
import { ApiError, type LoggedInDevice } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { BTN_DANGER, BTN_SECONDARY, BTN_SMALL, Banner, Dialog, EmptyState, PageHeader, Panel, Skeleton, dateTime } from './ui';

const KIND_ICON = { APP: Smartphone, BROWSER: Globe, UNKNOWN: MonitorSmartphone } as const;
const KIND_LABEL = { APP: 'YouMart app', BROWSER: 'Web browser', UNKNOWN: 'Device' } as const;

/** "5 min ago" for recent activity, the date beyond a day. */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'Active now';
  if (mins < 60) return `Active ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Active ${hours} h ago`;
  return `Last active ${dateTime(iso)}`;
}

/** Every phone and browser signed in to this account, with sign-out (WhatsApp-style). */
export function DevicesView() {
  const [devices, setDevices] = useState<LoggedInDevice[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const { items } = await api.auth.devices();
      setDevices(items);
    } catch {
      setDevices((cur) => cur ?? []);
      setMessage({ tone: 'error', text: 'Couldn’t load your devices. Please refresh the page.' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const signOut = async (device: LoggedInDevice) => {
    setBusy(device.deviceId);
    setMessage(null);
    try {
      await api.auth.signOutDevice(device.deviceId);
      setDevices((cur) => (cur ?? []).filter((d) => d.deviceId !== device.deviceId));
      setMessage({ tone: 'success', text: `${device.label} was signed out.` });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof ApiError ? error.message : 'Could not sign that device out.' });
    } finally {
      setBusy(null);
    }
  };

  const signOutOthers = async () => {
    setBusy('others');
    setMessage(null);
    try {
      const { signedOut } = await api.auth.signOutOtherDevices();
      setConfirmAll(false);
      await load();
      setMessage({
        tone: 'success',
        text: signedOut === 1 ? '1 other device was signed out.' : `${signedOut} other devices were signed out.`,
      });
    } catch (error) {
      setMessage({ tone: 'error', text: error instanceof ApiError ? error.message : 'Could not sign the other devices out.' });
    } finally {
      setBusy(null);
    }
  };

  const others = (devices ?? []).filter((d) => !d.current);
  const current = (devices ?? []).find((d) => d.current);

  const row = (d: LoggedInDevice) => {
    const Icon = KIND_ICON[d.kind];
    return (
      <li key={d.deviceId} className="flex items-center gap-[14px] border-b border-catalog-rule px-[20px] py-[14px] last:border-0">
        <span
          className={`flex size-[44px] shrink-0 items-center justify-center rounded-[12px] ${
            d.current ? 'bg-brand text-white' : 'bg-[#eef3fc] text-brand'
          }`}
        >
          <Icon aria-hidden="true" className="size-[20px]" />
        </span>
        <div className="min-w-0 flex-1 font-ui">
          <p className="flex flex-wrap items-center gap-[8px] text-[15px] font-semibold text-heading">
            {d.label}
            {d.current ? (
              <span className="rounded-full bg-[#e8f7ee] px-[8px] py-[1px] text-[11.5px] font-semibold text-[#15803d]">
                This browser
              </span>
            ) : null}
          </p>
          <p className="text-[13px] text-ink-muted">
            {KIND_LABEL[d.kind]} · {d.current ? 'Active now' : ago(d.lastActiveAt)}
          </p>
        </div>
        {!d.current ? (
          <button type="button" onClick={() => void signOut(d)} disabled={busy !== null} className={BTN_SMALL}>
            {busy === d.deviceId ? <Loader2 aria-hidden="true" className="size-[14px] animate-spin" /> : <LogOut aria-hidden="true" className="size-[14px]" />}
            Sign out
          </button>
        ) : null}
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title="Signed-in devices"
        subtitle="Phones and browsers signed in to your YouMart account. Sign out any you don’t recognise."
        actions={
          others.length > 0 ? (
            <button type="button" onClick={() => setConfirmAll(true)} className={BTN_SECONDARY}>
              <LogOut aria-hidden="true" className="size-[16px]" />
              Sign out all other devices
            </button>
          ) : null
        }
      />
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}

      {devices === null ? (
        <Panel>
          <div className="space-y-[12px]">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-[52px] w-full" />
            ))}
          </div>
        </Panel>
      ) : (
        <>
          {current ? (
            <Panel title="This device" padded={false}>
              <ul>{row(current)}</ul>
            </Panel>
          ) : null}
          <Panel title={`Other devices (${others.length})`} padded={false}>
            {others.length === 0 ? (
              <EmptyState icon={ShieldCheck} title="No other devices">
                Your account is only signed in here.
              </EmptyState>
            ) : (
              <ul>{others.map(row)}</ul>
            )}
          </Panel>
        </>
      )}

      <div className="flex items-start gap-[10px] rounded-[12px] border border-catalog-rule bg-[#fafbfc] px-[16px] py-[12px] font-ui text-[13.5px] leading-[1.55] text-ink-muted">
        <ShieldCheck aria-hidden="true" className="mt-[2px] size-[16px] shrink-0 text-woo-success" />
        Signing a device out ends its session at once - it will need a new OTP (or the QR code) to sign in again.
      </div>

      <Dialog
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title="Sign out all other devices?"
        description={`${others.length} device${others.length === 1 ? '' : 's'} will be signed out. You stay signed in on this browser.`}
        footer={
          <>
            <button type="button" onClick={() => setConfirmAll(false)} className={BTN_SECONDARY}>
              Cancel
            </button>
            <button type="button" onClick={() => void signOutOthers()} disabled={busy !== null} className={BTN_DANGER}>
              {busy === 'others' ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
              Sign out others
            </button>
          </>
        }
      />
    </>
  );
}
