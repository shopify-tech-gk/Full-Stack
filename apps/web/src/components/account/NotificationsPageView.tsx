'use client';

import { useEffect, useState } from 'react';
import { Bell, Mail, MessageCircle, Settings2 } from 'lucide-react';
import type { NotificationSettings } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';
import { NotificationsView } from './NotificationsView';
import { Banner, PageHeader, Panel, Skeleton } from './ui';

type Group = keyof NotificationSettings;
type Channel = 'whatsapp' | 'email';

const GROUPS: { key: Group; title: string; sub: string }[] = [
  { key: 'orderUpdates', title: 'Order updates', sub: 'Order confirmed, shipped and delivered, refunds and wallet credits.' },
  { key: 'offers', title: 'Offers & promotions', sub: 'Deals, sales and new arrivals.' },
];
const CHANNELS: { key: Channel; label: string; Icon: typeof Mail }[] = [
  { key: 'whatsapp', label: 'WhatsApp', Icon: MessageCircle },
  { key: 'email', label: 'Email', Icon: Mail },
];

function Switch({ on, onChange, label, disabled }: { on: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative h-[24px] w-[44px] shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:opacity-60 ${on ? 'bg-brand' : 'bg-[#cbd5e1]'}`}
    >
      <span className={`absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-[left] ${on ? 'left-[23px]' : 'left-[3px]'}`} />
    </button>
  );
}

/** W9: which channels order updates and offers are sent on. Saves on every toggle. */
function NotificationSettingsPanel() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.auth
      .getNotificationSettings()
      .then(setSettings)
      .catch(() => setError('Could not load your settings. Please refresh the page.'));
  }, []);

  const toggle = async (group: Group, channel: Channel, value: boolean) => {
    if (!settings) return;
    const previous = settings;
    const next: NotificationSettings = { ...settings, [group]: { ...settings[group], [channel]: value } };
    setSettings(next);
    setError(null);
    setSaved(false);
    try {
      setSettings(await api.auth.setNotificationSettings(next));
      setSaved(true);
    } catch {
      setSettings(previous);
      setError('Could not save. Please try again.');
    }
  };

  return (
    <Panel title="How we contact you" aside={saved ? <span className="font-ui text-[13px] font-semibold text-[#15803d]">Saved</span> : null} padded={false}>
      {error ? (
        <div className="px-[20px] pt-[16px]">
          <Banner tone="error">{error}</Banner>
        </div>
      ) : null}
      <table className="w-full font-ui">
        <thead>
          <tr className="border-b border-catalog-rule bg-[#fafbfc] text-[12.5px] font-semibold uppercase tracking-[0.04em] text-ink-muted">
            <th scope="col" className="px-[20px] py-[10px] text-left">
              Messages
            </th>
            {CHANNELS.map(({ key, label, Icon }) => (
              <th key={key} scope="col" className="w-[120px] px-[12px] py-[10px]">
                <span className="inline-flex items-center gap-[6px]">
                  <Icon aria-hidden="true" className="size-[14px]" /> {label}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {GROUPS.map((g) => (
            <tr key={g.key} className="border-b border-catalog-rule last:border-0">
              <th scope="row" className="px-[20px] py-[16px] text-left font-normal">
                <span className="block text-[15px] font-semibold text-heading">{g.title}</span>
                <span className="block text-[13px] text-ink-muted">{g.sub}</span>
              </th>
              {CHANNELS.map((c) => (
                <td key={c.key} className="px-[12px] py-[16px] text-center">
                  {settings ? (
                    <span className="inline-flex">
                      <Switch on={settings[g.key][c.key]} onChange={(v) => void toggle(g.key, c.key, v)} label={`${g.title} on ${c.label}`} />
                    </span>
                  ) : (
                    <Skeleton className="mx-auto h-[24px] w-[44px] rounded-full" />
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-catalog-rule px-[20px] py-[12px] font-ui text-[13px] text-ink-muted">
        Your inbox here always gets every update. Security codes (OTP) are always sent.
      </p>
    </Panel>
  );
}

/** Notifications: the inbox, and (signed in) which channels messages go to. */
export function NotificationsPageView() {
  const session = useSession();
  const [tab, setTab] = useState<'inbox' | 'settings'>('inbox');
  const signedIn = session.status === 'authenticated';
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Order updates, refunds, returns and support replies."
        actions={
          signedIn ? (
            <div role="tablist" className="flex rounded-[10px] bg-[#f1f5f9] p-[3px]">
              {(
                [
                  ['inbox', 'Inbox', Bell],
                  ['settings', 'Settings', Settings2],
                ] as const
              ).map(([key, label, Icon]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={tab === key}
                  onClick={() => setTab(key)}
                  className={`inline-flex items-center gap-[6px] rounded-[8px] px-[14px] py-[6px] font-ui text-[13.5px] font-semibold transition-colors ${
                    tab === key ? 'bg-white text-brand shadow-rail-card' : 'text-ink-muted hover:text-heading'
                  }`}
                >
                  <Icon aria-hidden="true" className="size-[15px]" /> {label}
                </button>
              ))}
            </div>
          ) : null
        }
      />
      {tab === 'settings' && signedIn ? <NotificationSettingsPanel /> : <NotificationsView />}
    </>
  );
}
