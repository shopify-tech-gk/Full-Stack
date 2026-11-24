'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, Copy, Gift, Loader2, Share2, UserPlus, Users, Wallet } from 'lucide-react';
import { ApiError, formatMoney, type MyReferral, type MyReferralRewards } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { BTN_PRIMARY, Banner, EmptyState, INPUT, PageHeader, Panel, Pill, Skeleton, dateTime } from './ui';

const SITE = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://youmart.in').replace(/\/+$/, '');
const money = (m: string) => formatMoney(m).replace(/\.00$/, '');

const STEPS = [
  { Icon: Share2, title: 'Share your code', text: 'Send it to friends on WhatsApp, Instagram, Facebook or anywhere.' },
  { Icon: UserPlus, title: 'They join YouMart', text: 'Your friend signs up and enters your code under Refer & Earn.' },
  { Icon: Wallet, title: 'You earn 2.5%', text: 'On every order of ₹500 or more they get delivered - straight to your YouMart Wallet.' },
];

function shareText(code: string) {
  return [
    'I shop on YouMart - 5 lakh+ products at great prices. 🛍️',
    `Join with my code ${code} (enter it under Account > Refer & Earn after you sign up).`,
    `${SITE}/?ref=${code}`,
  ].join('\n');
}

/** v1.17 Refer & Earn on the website: code, share, friends + earnings, a friend's code, rewards. */
export function ReferView() {
  const [info, setInfo] = useState<MyReferral | null>(null);
  const [rewards, setRewards] = useState<MyReferralRewards | null>(null);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [friendCode, setFriendCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const [r, w] = await Promise.all([api.auth.referral(), api.orders.referralRewards().catch(() => null)]);
      setInfo(r);
      setRewards(w);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const copy = async (what: 'code' | 'link') => {
    if (!info) return;
    try {
      await navigator.clipboard.writeText(what === 'code' ? info.code : `${SITE}/?ref=${info.code}`);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // Clipboard blocked: nothing to do.
    }
  };

  const apply = async () => {
    const code = friendCode.trim().toUpperCase();
    if (!code) return;
    setApplying(true);
    setApplyMsg(null);
    try {
      const res = await api.auth.applyReferral(code);
      setApplyMsg({ ok: true, text: `Code added${res.referredBy.name ? ` - you were invited by ${res.referredBy.name}` : ''}.` });
      setFriendCode('');
      await load();
    } catch (err) {
      setApplyMsg({ ok: false, text: err instanceof ApiError ? err.message : 'Could not add that code.' });
    } finally {
      setApplying(false);
    }
  };

  const whatsapp = info ? `https://wa.me/?text=${encodeURIComponent(shareText(info.code))}` : '#';

  return (
    <>
      <PageHeader title="Refer & Earn" subtitle="Invite friends to YouMart and earn 2.5% of their delivered orders in your wallet." />
      {failed ? <Banner tone="error">Couldn&rsquo;t load your referral details. Please refresh the page.</Banner> : null}

      <div className="mb-[20px] grid gap-[20px] lg:grid-cols-[1.35fr_1fr]">
        <div className="relative overflow-hidden rounded-[18px] bg-[linear-gradient(140deg,#0b1b3f_0%,#0142aa_55%,#7c3aed_100%)] p-[26px] font-ui text-white shadow-[0_16px_40px_rgba(1,66,170,0.3)]">
          <span aria-hidden="true" className="absolute -right-[50px] -top-[50px] size-[200px] rounded-full bg-white/10" />
          <Gift aria-hidden="true" className="absolute bottom-[18px] right-[22px] size-[90px] text-white/10" />
          <p className="relative text-[13px] font-semibold uppercase tracking-[0.12em] text-white/75">Your referral code</p>
          {info ? (
            <div className="relative mt-[10px] flex flex-wrap items-center gap-[12px]">
              <span className="rounded-[12px] border-2 border-dashed border-white/50 bg-white/10 px-[18px] py-[8px] font-mono text-[28px] font-bold tracking-[0.12em]">
                {info.code}
              </span>
              <button
                type="button"
                onClick={() => void copy('code')}
                className="inline-flex h-[40px] items-center gap-[8px] rounded-[10px] bg-white px-[16px] text-[14px] font-semibold text-brand transition-transform hover:-translate-y-[1px]"
              >
                {copied === 'code' ? <Check aria-hidden="true" className="size-[16px]" /> : <Copy aria-hidden="true" className="size-[16px]" />}
                {copied === 'code' ? 'Copied' : 'Copy code'}
              </button>
            </div>
          ) : (
            <Skeleton className="relative mt-[10px] h-[52px] w-[260px] bg-white/20" />
          )}
          <div className="relative mt-[22px] flex flex-wrap gap-[10px]">
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-[40px] items-center gap-[8px] rounded-[10px] bg-[#25d366] px-[16px] text-[14px] font-semibold text-white"
            >
              <Share2 aria-hidden="true" className="size-[16px]" /> Share on WhatsApp
            </a>
            <button
              type="button"
              onClick={() => void copy('link')}
              className="inline-flex h-[40px] items-center gap-[8px] rounded-[10px] border border-white/40 px-[16px] text-[14px] font-semibold text-white hover:bg-white/10"
            >
              {copied === 'link' ? <Check aria-hidden="true" className="size-[16px]" /> : <Copy aria-hidden="true" className="size-[16px]" />}
              {copied === 'link' ? 'Link copied' : 'Copy invite link'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-[14px]">
          {[
            { label: 'Friends joined', value: info ? String(info.friendsJoined) : '—', Icon: Users },
            { label: 'Earned so far', value: rewards ? money(rewards.totalEarned) : '—', Icon: Wallet },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="flex flex-col justify-between rounded-[16px] border border-catalog-rule bg-white p-[18px] font-ui shadow-rail-card">
              <span className="flex size-[40px] items-center justify-center rounded-[12px] bg-[#eef3fc] text-brand">
                <Icon aria-hidden="true" className="size-[19px]" />
              </span>
              <div className="mt-[14px]">
                <p className="text-[28px] font-bold tabular-nums text-heading">{value}</p>
                <p className="text-[13px] text-ink-muted">{label}</p>
              </div>
            </div>
          ))}
          {info?.referredBy ? (
            <p className="col-span-2 rounded-[12px] bg-[#f6f8fb] px-[14px] py-[10px] font-ui text-[13.5px] text-ink-body">
              You joined with {info.referredBy.name ? <strong>{info.referredBy.name}</strong> : 'a friend'}&rsquo;s code.
            </p>
          ) : null}
        </div>
      </div>

      <Panel title="How it works">
        <ol className="grid gap-[16px] md:grid-cols-3">
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title} className="relative flex gap-[12px] font-ui">
              <span className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-brand text-white shadow-brand-button">
                <Icon aria-hidden="true" className="size-[20px]" />
              </span>
              <span>
                <span className="block text-[12px] font-semibold uppercase tracking-[0.06em] text-brand">Step {i + 1}</span>
                <span className="block text-[15px] font-semibold text-heading">{title}</span>
                <span className="mt-[2px] block text-[13.5px] leading-[1.5] text-ink-muted">{text}</span>
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-[16px] border-t border-catalog-rule pt-[12px] font-ui text-[12.5px] text-ink-muted">
          Rewards are 2.5% of each delivered item (after coupons) of a friend&rsquo;s order of ₹500 or more, and are
          taken back if that item is returned.
        </p>
      </Panel>

      {info?.canApplyCode ? (
        <Panel title="Got a friend’s code?">
          <p className="mb-[12px] font-ui text-[14px] text-ink-muted">
            New accounts can add a friend&rsquo;s code within {info.applyWindowDays} days of joining.
          </p>
          <div className="flex max-w-[480px] gap-[10px]">
            <input
              value={friendCode}
              onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              maxLength={20}
              className={`${INPUT} font-mono uppercase tracking-[0.08em]`}
              onKeyDown={(e) => e.key === 'Enter' && void apply()}
            />
            <button type="button" onClick={() => void apply()} disabled={applying || !friendCode.trim()} className={BTN_PRIMARY}>
              {applying ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
              Apply
            </button>
          </div>
          {applyMsg ? (
            <p className={`mt-[10px] font-ui text-[13.5px] ${applyMsg.ok ? 'text-[#15803d]' : 'text-woo-error'}`}>{applyMsg.text}</p>
          ) : null}
        </Panel>
      ) : null}

      <Panel title="Reward history" padded={false}>
        {!rewards ? (
          <div className="space-y-[10px] p-[20px]">
            {[0, 1].map((i) => (
              <Skeleton key={i} className="h-[40px] w-full" />
            ))}
          </div>
        ) : rewards.rewards.length === 0 ? (
          <EmptyState icon={Gift} title="No rewards yet">
            Share your code - you&rsquo;ll see each reward here once your friends&rsquo; orders are delivered.
          </EmptyState>
        ) : (
          <ul>
            {rewards.rewards.map((r) => (
              <li key={r.rewardId} className="flex items-center justify-between gap-[12px] border-b border-catalog-rule px-[20px] py-[12px] font-ui last:border-0">
                <span className="text-[14px] text-ink-muted">{dateTime(r.createdAt)}</span>
                <span className="flex items-center gap-[10px]">
                  <Pill tone={r.status === 'CREDITED' ? 'green' : 'grey'}>{r.status === 'CREDITED' ? 'Credited' : 'Reversed'}</Pill>
                  <strong className={`tabular-nums ${r.status === 'CREDITED' ? 'text-[#15803d]' : 'text-ink-muted line-through'}`}>
                    +{formatMoney(r.amount)}
                  </strong>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </>
  );
}
