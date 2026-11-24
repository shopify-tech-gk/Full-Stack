'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Bike, Check, CheckCircle2, Clock, LayoutGrid, Loader2, ShieldCheck, Store, XCircle } from 'lucide-react';
import {
  ApiError,
  STORE_CATEGORIES,
  loginHref,
  type SellerApplication,
  type SellerApplicationStatus,
  type SellerBusinessType,
} from '@youmart/shared-client';
import { BTN_PRIMARY, INPUT, Skeleton } from '@/components/account/ui';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

const GOLD = '#ffd60a';
const OTHER = 'Other';
const TYPE_LABEL: Record<SellerBusinessType, string> = {
  INDIVIDUAL: 'Individual',
  SHOP: 'Shop / retailer',
  BRAND: 'Own brand',
  MANUFACTURER: 'Manufacturer',
  WHOLESALER: 'Wholesaler',
};
const STEPS = [
  { title: 'Register your business', text: 'Sign up with your GST, PAN and bank details.' },
  { title: 'List your products', text: 'Add photos, prices and stock from your phone or computer.' },
  { title: 'Receive orders', text: 'Customers across India discover and buy from your store.' },
  { title: 'Get paid', text: 'We deliver, and your earnings land in your bank account.' },
];
const PERKS = [
  { Icon: Store, title: 'Your brand store', text: 'A page for your brand and catalogue' },
  { Icon: LayoutGrid, title: 'Seller dashboard', text: 'Orders, stock and payouts in one place' },
  { Icon: Bike, title: 'Delivery handled', text: 'We pick up, pack and deliver' },
  { Icon: ShieldCheck, title: 'Secure payouts', text: 'Clear statements for every order' },
];
const TRACK: { status: SellerApplicationStatus; title: string; text: string }[] = [
  { status: 'NEW', title: 'Application received', text: 'Our seller team is reviewing it.' },
  { status: 'CONTACTED', title: 'Team in touch', text: 'We have reached out to you.' },
  { status: 'SHORTLISTED', title: 'Shortlisted', text: 'You’re on the launch list.' },
  { status: 'ONBOARDED', title: 'Ready to sell', text: 'We will set up your store at launch.' },
];
const digits = (v: string) => v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

function Status({ app }: { app: SellerApplication }) {
  if (app.status === 'DECLINED') {
    return (
      <div className="flex items-start gap-[12px] rounded-[14px] border border-[#f5c2c2] bg-[#fdf6f6] p-[16px]">
        <XCircle aria-hidden="true" className="mt-[2px] size-[20px] text-[#b91c1c]" />
        <p className="text-[14.5px] text-heading">
          Your application ({app.referenceCode}) was closed. You&rsquo;re welcome to apply again when selling opens to everyone.
        </p>
      </div>
    );
  }
  const at = TRACK.findIndex((t) => t.status === app.status);
  return (
    <div>
      <p className="mb-[14px] text-[14px] text-ink-muted">
        Reference <strong className="text-heading">{app.referenceCode}</strong> · {app.businessName}
      </p>
      <ol className="space-y-[2px]">
        {TRACK.map((t, i) => {
          const done = i <= at;
          return (
            <li key={t.status} className="relative flex gap-[14px] pb-[16px] last:pb-0">
              {i < TRACK.length - 1 ? (
                <span aria-hidden="true" className={`absolute left-[13px] top-[28px] h-[calc(100%-28px)] w-[2px] ${i < at ? 'bg-brand' : 'bg-[#e2e8f0]'}`} />
              ) : null}
              <span className={`relative z-[1] flex size-[28px] shrink-0 items-center justify-center rounded-full ${done ? 'bg-brand text-white' : 'border-2 border-[#cbd5e1] bg-white'}`}>
                {done ? <Check aria-hidden="true" className="size-[15px]" strokeWidth={3} /> : null}
              </span>
              <span>
                <span className={`block text-[15px] font-semibold ${done ? 'text-heading' : 'text-ink-muted'}`}>{t.title}</span>
                <span className="block text-[13px] text-ink-muted">
                  {t.status === 'NEW' ? `Submitted ${fmtDate(app.createdAt)}. ` : ''}
                  {t.text}
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * v1.19 "Sell on YouMart" on the website: what's coming for sellers, and the early-access
 * application (seller-service; the admin team works through Admin -> Seller applications). Once
 * applied, the application's live status shows instead of the form.
 */
export function SellView() {
  const session = useSession();
  const pathname = usePathname();
  const signedIn = session.status === 'authenticated';
  const [app, setApp] = useState<SellerApplication | null | undefined>(undefined);
  const [businessName, setBusinessName] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState<SellerBusinessType | null>(null);
  const [category, setCategory] = useState('');
  const [otherCategory, setOtherCategory] = useState('');
  const [hasGstin, setHasGstin] = useState<boolean | null>(null);
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const categories = useMemo(() => [...STORE_CATEGORIES.map((c) => c.name), OTHER], []);

  useEffect(() => {
    if (!signedIn) {
      setApp(null);
      return;
    }
    if (session.status === 'authenticated') {
      setContactName((n) => n || session.user.name || '');
      setPhone((p) => p || (session.user.phone ? digits(session.user.phone) : ''));
      setEmail((e) => e || session.user.email || '');
    }
    api.sellers
      .myApplication()
      .then((r) => setApp(r.application))
      .catch(() => setApp(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  const finalCategory = category === OTHER ? otherCategory.trim() : category;
  const errors = {
    businessName: businessName.trim() ? null : 'Enter your business or store name',
    city: city.trim() ? null : 'Enter your city',
    type: type ? null : 'Choose one',
    category: finalCategory ? null : category === OTHER ? 'Tell us what you sell' : 'Choose one',
    gst: hasGstin === null ? 'Choose one' : null,
    contactName: contactName.trim() ? null : 'Enter your name',
    phone: /^[6-9]\d{9}$/.test(digits(phone)) ? null : 'Enter a valid 10-digit mobile number',
    email: !email.trim() || EMAIL_RE.test(email.trim()) ? null : 'Enter a valid email',
  };
  const valid = Object.values(errors).every((e) => e === null);
  const err = (e: string | null) => (tried && e ? <p className="mt-[4px] text-[12.5px] text-woo-error">{e}</p> : null);

  const submit = async () => {
    setTried(true);
    setServerError(null);
    if (!valid || !type || hasGstin === null) return;
    setSending(true);
    try {
      const res = await api.sellers.apply({
        businessName: businessName.trim(),
        contactName: contactName.trim(),
        phone: digits(phone),
        ...(email.trim() ? { email: email.trim() } : {}),
        city: city.trim(),
        businessType: type,
        category: finalCategory,
        hasGstin,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      setApp(res.application);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setServerError(e instanceof ApiError ? e.message : 'Could not send your application. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const label = 'mb-[6px] block text-[13.5px] font-semibold text-heading';
  const chip = (on: boolean) =>
    `rounded-full border px-[14px] py-[6px] text-[13.5px] font-semibold transition-colors ${on ? 'border-brand bg-[#eef3fc] text-brand' : 'border-catalog-rule text-heading hover:border-brand'}`;

  return (
    <div className="font-ui">
      <section className="relative overflow-hidden bg-[linear-gradient(160deg,#050f26_0%,#0a2463_55%,#0142aa_100%)] text-white">
        <span aria-hidden="true" className="absolute -right-[120px] -top-[120px] size-[420px] rounded-full bg-white/[0.06]" />
        <span aria-hidden="true" className="absolute bottom-[-160px] left-[30%] size-[360px] rounded-full bg-[#ffd60a]/[0.07]" />
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-[40px] px-[20px] py-[56px] lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="inline-flex items-center gap-[8px] rounded-full bg-white/10 px-[12px] py-[5px] text-[12.5px] font-semibold uppercase tracking-[0.1em]" style={{ color: GOLD }}>
              <span className="size-[7px] animate-pulse rounded-full" style={{ background: GOLD }} /> Coming soon · early access open
            </span>
            <h1 className="mt-[16px] text-[40px] font-bold leading-[1.15]">
              Sell on <span style={{ color: GOLD }}>YouMart</span>
            </h1>
            <p className="mt-[12px] max-w-[520px] text-[16.5px] leading-[1.6] text-white/80">
              Reach shoppers across India with 5 lakh+ products already on YouMart. We handle delivery and payments - you
              focus on your products.
            </p>
            <div className="mt-[24px] grid max-w-[520px] grid-cols-2 gap-[12px]">
              {PERKS.map(({ Icon, title, text }) => (
                <div key={title} className="rounded-[14px] bg-white/[0.07] p-[14px] ring-1 ring-white/10">
                  <Icon aria-hidden="true" className="mb-[6px] size-[20px]" style={{ color: GOLD }} />
                  <p className="text-[14.5px] font-semibold">{title}</p>
                  <p className="text-[12.5px] text-white/70">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[20px] bg-white p-[24px] text-heading shadow-[0_30px_70px_rgba(0,0,0,0.35)]">
            {app === undefined ? (
              <Skeleton className="h-[320px] w-full" />
            ) : app ? (
              <>
                <p className="mb-[4px] flex items-center gap-[8px] text-[18px] font-semibold">
                  {app.status === 'DECLINED' ? <Clock aria-hidden="true" className="size-[20px] text-ink-muted" /> : <CheckCircle2 aria-hidden="true" className="size-[20px] text-[#15803d]" />}
                  Your application
                </p>
                <div className="mt-[14px]">
                  <Status app={app} />
                </div>
              </>
            ) : !signedIn ? (
              <div className="py-[16px] text-center">
                <BarChart3 aria-hidden="true" className="mx-auto mb-[10px] size-[40px] text-brand" />
                <p className="text-[18px] font-semibold">Get early access</p>
                <p className="mt-[6px] text-[14px] text-ink-muted">Sign in to apply - it takes about a minute.</p>
                <Link href={loginHref(pathname)} className={`${BTN_PRIMARY} mt-[16px]`}>
                  Sign in to apply
                </Link>
              </div>
            ) : (
              <>
                <p className="text-[18px] font-semibold">Apply for early access</p>
                <p className="mb-[16px] text-[13.5px] text-ink-muted">We&rsquo;ll contact you before we open to sellers.</p>
                <div className="grid gap-[12px] md:grid-cols-2">
                  <div className="md:col-span-2">
                    <label htmlFor="s-biz" className={label}>Business or store name</label>
                    <input id="s-biz" value={businessName} onChange={(e) => setBusinessName(e.target.value)} maxLength={120} placeholder="e.g. Green Leaf Agro Store" className={INPUT} />
                    {err(errors.businessName)}
                  </div>
                  <div>
                    <label htmlFor="s-city" className={label}>City</label>
                    <input id="s-city" value={city} onChange={(e) => setCity(e.target.value)} maxLength={80} placeholder="e.g. Coimbatore" className={INPUT} />
                    {err(errors.city)}
                  </div>
                  <div>
                    <label htmlFor="s-cat" className={label}>What do you sell?</label>
                    <select id="s-cat" value={category} onChange={(e) => setCategory(e.target.value)} className={INPUT}>
                      <option value="">Choose a category</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    {err(errors.category)}
                  </div>
                  {category === OTHER ? (
                    <div className="md:col-span-2">
                      <label htmlFor="s-other" className={label}>Your products</label>
                      <input id="s-other" value={otherCategory} onChange={(e) => setOtherCategory(e.target.value)} maxLength={80} placeholder="e.g. Handmade candles" className={INPUT} />
                    </div>
                  ) : null}
                  <div className="md:col-span-2">
                    <p className={label}>You are a</p>
                    <div className="flex flex-wrap gap-[8px]">
                      {(Object.keys(TYPE_LABEL) as SellerBusinessType[]).map((t) => (
                        <button key={t} type="button" aria-pressed={type === t} onClick={() => setType(t)} className={chip(type === t)}>
                          {TYPE_LABEL[t]}
                        </button>
                      ))}
                    </div>
                    {err(errors.type)}
                  </div>
                  <div className="md:col-span-2">
                    <p className={label}>GST registered?</p>
                    <div className="flex gap-[8px]">
                      <button type="button" aria-pressed={hasGstin === true} onClick={() => setHasGstin(true)} className={chip(hasGstin === true)}>Yes</button>
                      <button type="button" aria-pressed={hasGstin === false} onClick={() => setHasGstin(false)} className={chip(hasGstin === false)}>Not yet</button>
                    </div>
                    {err(errors.gst)}
                  </div>
                  <div>
                    <label htmlFor="s-name" className={label}>Your name</label>
                    <input id="s-name" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={100} className={INPUT} />
                    {err(errors.contactName)}
                  </div>
                  <div>
                    <label htmlFor="s-phone" className={label}>Mobile number</label>
                    <input id="s-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="10-digit mobile number" className={INPUT} />
                    {err(errors.phone)}
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="s-email" className={label}>Email <span className="font-normal text-ink-muted">(optional)</span></label>
                    <input id="s-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" className={INPUT} />
                    {err(errors.email)}
                  </div>
                  <div className="md:col-span-2">
                    <label htmlFor="s-note" className={label}>Anything else we should know <span className="font-normal text-ink-muted">(optional)</span></label>
                    <textarea id="s-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="e.g. number of products, where you sell today" className="w-full resize-none rounded-[10px] border border-catalog-rule px-[14px] py-[10px] text-[15px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20" />
                  </div>
                </div>
                {serverError ? <p className="mt-[10px] text-[13.5px] text-woo-error">{serverError}</p> : null}
                <button type="button" onClick={() => void submit()} disabled={sending} className="mt-[16px] inline-flex h-[46px] w-full items-center justify-center gap-[8px] rounded-[12px] text-[15px] font-semibold text-[#1f1300] transition-[filter] hover:brightness-95 disabled:opacity-60" style={{ background: GOLD }}>
                  {sending ? <Loader2 aria-hidden="true" className="size-[16px] animate-spin" /> : null}
                  Apply for early access
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1240px] px-[20px] py-[48px]">
        <h2 className="mb-[24px] text-center text-[26px] font-semibold text-heading">How selling will work</h2>
        <ol className="grid gap-[16px] md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="rounded-[16px] border border-catalog-rule bg-white p-[20px] shadow-rail-card">
              <span className="mb-[12px] flex size-[38px] items-center justify-center rounded-full bg-brand text-[16px] font-bold text-white">{i + 1}</span>
              <p className="text-[16px] font-semibold text-heading">{s.title}</p>
              <p className="mt-[4px] text-[14px] leading-[1.55] text-ink-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
