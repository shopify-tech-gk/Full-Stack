'use client';

import Link from 'next/link';
import { Wallet } from 'lucide-react';
import { ROUTES, formatMoney, walletSplit, type Money, type WalletSummary } from '@youmart/shared-client';

interface WalletOptionProps {
  wallet: WalletSummary;
  total: Money;
  on: boolean;
  onChange: (on: boolean) => void;
  disabled?: boolean;
  /** Cash on Delivery is chosen: the wallet can't be combined with it. */
  cod?: boolean;
}

/** W9 on the website: "Use YouMart Wallet" at checkout - wallet first, Razorpay for any rest. */
export function WalletOption({ wallet, total, on, onChange, disabled, cod }: WalletOptionProps) {
  const has = wallet.available !== '0.00';
  const split = walletSplit(total, wallet.available);
  const active = on && has && !cod;
  return (
    <div
      className={`mt-[20px] rounded-[12px] border p-[14px] font-ui transition-colors ${
        active ? 'border-brand bg-[#f3f7fe]' : 'border-catalog-rule bg-white'
      }`}
    >
      <label className={`flex items-start gap-[12px] ${has && !cod ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
        <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[10px] bg-brand text-white">
          <Wallet aria-hidden="true" className="size-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-heading">YouMart Wallet</span>
          <span className="block text-[13px] text-ink-muted">
            {has ? (
              <>
                Available <strong className="text-heading">{formatMoney(wallet.available)}</strong>
              </>
            ) : (
              <>
                No balance yet ·{' '}
                <Link href={`${ROUTES.wallet}?add=1`} className="font-semibold text-brand hover:underline">
                  Add money
                </Link>
              </>
            )}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Use YouMart Wallet"
          checked={active}
          disabled={disabled || !has || cod}
          onChange={(e) => onChange(e.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={`relative mt-[8px] h-[22px] w-[40px] shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-brand ${
            active ? 'bg-brand' : 'bg-[#cbd5e1]'
          } ${!has || cod ? 'opacity-50' : ''}`}
        >
          <span
            className={`absolute top-[3px] size-[16px] rounded-full bg-white shadow transition-[left] ${active ? 'left-[21px]' : 'left-[3px]'}`}
          />
        </span>
      </label>
      {cod && has ? (
        <p className="mt-[10px] text-[12.5px] text-ink-muted">
          The wallet can&rsquo;t be combined with Cash on Delivery - choose online payment to use it.
        </p>
      ) : active ? (
        <div className="mt-[12px] space-y-[4px] border-t border-[#d6e2f7] pt-[10px] text-[13.5px]">
          <p className="flex justify-between">
            <span className="text-ink-muted">From wallet</span>
            <strong className="tabular-nums text-[#15803d]">−{formatMoney(split.wallet)}</strong>
          </p>
          <p className="flex justify-between">
            <span className="text-ink-muted">{split.online === '0.00' ? 'Left to pay' : 'Pay by Razorpay'}</span>
            <strong className="tabular-nums text-heading">{formatMoney(split.online)}</strong>
          </p>
          {split.online === '0.00' ? (
            <p className="pt-[2px] text-[12.5px] font-semibold text-[#15803d]">Your wallet covers this whole order.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
