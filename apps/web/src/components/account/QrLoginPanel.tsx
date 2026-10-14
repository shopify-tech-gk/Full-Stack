'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import QRCode from 'react-qr-code';
import { safeReturnTo, type QrLoginStart, type QrLoginStatus } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { loginWithQr } from '@/lib/session';

const POLL_MS = 2000;

/**
 * "Scan QR code" sign-in (WhatsApp Web / Amazon style): shows a 2-minute single-use QR, polls it,
 * and when the YouMart app has scanned and confirmed it, claims this browser's session.
 */
export function QrLoginPanel({ returnTo }: { returnTo?: string }) {
  const router = useRouter();
  const [qr, setQr] = useState<QrLoginStart | null>(null);
  const [status, setStatus] = useState<QrLoginStatus | 'LOADING' | 'ERROR'>('LOADING');
  const [scannedBy, setScannedBy] = useState<string | null>(null);
  const claiming = useRef(false);

  const fresh = useCallback(async () => {
    setStatus('LOADING');
    setScannedBy(null);
    claiming.current = false;
    try {
      const next = await api.auth.qrStart();
      setQr(next);
      setStatus('PENDING');
    } catch {
      setStatus('ERROR');
    }
  }, []);

  useEffect(() => {
    void fresh();
  }, [fresh]);

  useEffect(() => {
    if (!qr || (status !== 'PENDING' && status !== 'SCANNED' && status !== 'APPROVED')) return;
    let active = true;
    const timer = setInterval(async () => {
      try {
        const poll = await api.auth.qrPoll(qr.sessionId, qr.browserKey);
        if (!active) return;
        setScannedBy(poll.scannedBy);
        if (poll.status === 'APPROVED' && !claiming.current) {
          claiming.current = true;
          setStatus('APPROVED');
          await loginWithQr(qr.sessionId, qr.browserKey);
          router.replace(safeReturnTo(returnTo));
          return;
        }
        if (poll.status !== 'APPROVED') setStatus(poll.status);
      } catch {
        if (active) setStatus('ERROR');
      }
    }, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [qr, status, returnTo, router]);

  const dead = status === 'EXPIRED' || status === 'REJECTED' || status === 'ERROR' || status === 'USED';

  return (
    <div className="rounded-[18px] border border-cart-line bg-white p-[20px] shadow-rail-card">
      <div className="flex flex-col items-center gap-[18px] min-[520px]:flex-row min-[520px]:items-start">
        <div className="relative shrink-0 rounded-[16px] border-2 border-brand-popup-border bg-white p-[12px]">
          {qr && status !== 'LOADING' ? (
            <QRCode
              value={qr.qrValue}
              size={188}
              fgColor="#0b1f4b"
              className={dead || status === 'SCANNED' || status === 'APPROVED' ? 'opacity-15' : ''}
              aria-label="YouMart sign-in QR code"
            />
          ) : (
            <div className="h-[188px] w-[188px] animate-pulse rounded-[8px] bg-brand-popup-bg" />
          )}
          {dead ? (
            <button
              type="button"
              onClick={() => void fresh()}
              className="absolute inset-0 flex flex-col items-center justify-center gap-[6px] rounded-[16px] font-ui text-[14px] font-semibold text-brand"
            >
              <span className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-brand text-[22px] text-white shadow-brand-button">
                ↻
              </span>
              {status === 'REJECTED'
                ? 'Cancelled on phone - get a new code'
                : status === 'ERROR'
                  ? 'Something went wrong - try again'
                  : 'Code expired - click to refresh'}
            </button>
          ) : status === 'SCANNED' || status === 'APPROVED' ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-[6px] px-[12px] text-center font-ui">
              <span className="flex h-[48px] w-[48px] items-center justify-center rounded-full bg-feature-guarantee text-[22px] text-white">
                ✓
              </span>
              <span className="text-[14px] font-semibold text-ink-strong">
                {status === 'APPROVED' ? 'Signing you in…' : 'Scanned'}
              </span>
            </div>
          ) : null}
        </div>

        <div className="font-ui">
          <h3 className="text-[18px] font-bold text-heading">Sign in with the YouMart app</h3>
          {status === 'SCANNED' ? (
            <p className="mt-[8px] text-[14px] leading-[1.5] text-ink-body">
              Scanned by <strong className="text-ink-strong">{scannedBy ?? 'your phone'}</strong>.
              <br />
              Confirm on your phone to finish signing in.
            </p>
          ) : (
            <ol className="mt-[8px] list-decimal space-y-[6px] pl-[18px] text-[14px] leading-[1.5] text-ink-body">
              <li>Open the YouMart app on your phone.</li>
              <li>
                Tap the <strong className="text-brand">scan</strong> icon next to the mic in the search
                bar.
              </li>
              <li>Point your phone at this code and confirm.</li>
            </ol>
          )}
          <p className="mt-[12px] text-[12.5px] leading-[1.5] text-ink-muted">
            The code refreshes every 2 minutes and works only once. Only scan it from your own
            computer.
          </p>
        </div>
      </div>
    </div>
  );
}
