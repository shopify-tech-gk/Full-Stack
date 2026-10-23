import type { Metadata } from 'next';
import Link from 'next/link';
import {
  ArrowRight,
  Bike,
  CircleHelp,
  Headset,
  Mail,
  MapPin,
  MessagesSquare,
  Navigation,
  PhoneCall,
  Receipt,
  Undo2,
} from 'lucide-react';
import { BUSINESS, CUSTOMER_CARE_PAGE } from '@youmart/shared-client';
import { FaWhatsapp } from '@/components/ui/FaIcons';
import { AssistantChat } from '@/components/info/AssistantChat';

export const metadata: Metadata = { title: 'Customer Care - You Mart' };

// v1.17 Customer Care: YouMart AI, then WhatsApp / call / email with the real number and address
// shown (the same number as our WhatsApp updates and the address our emails come from), quick
// self-help links and the store address.
const CONTACT = {
  whatsapp: {
    icon: <FaWhatsapp className="size-[24px] text-white" />,
    tint: 'bg-[#25D366]',
    text: 'text-[#128C4B]',
    detail: BUSINESS.whatsapp,
    action: 'Chat on WhatsApp',
    external: true,
  },
  call: {
    icon: <PhoneCall aria-hidden="true" className="size-[22px] text-white" />,
    tint: 'bg-brand',
    text: 'text-brand',
    detail: BUSINESS.phone,
    action: 'Call now',
    external: false,
  },
  email: {
    icon: <Mail aria-hidden="true" className="size-[22px] text-white" />,
    tint: 'bg-[#7c3aed]',
    text: 'text-[#7c3aed]',
    detail: BUSINESS.email,
    action: 'Write an email',
    external: false,
  },
} as const;

const QUICK = [
  { icon: Navigation, label: 'Track an order', href: '/track-order' },
  { icon: Receipt, label: 'My orders', href: '/account/orders' },
  { icon: Undo2, label: 'Returns & refunds', href: '/refund-policy' },
  { icon: Bike, label: 'Delivery charges', href: '/shipping' },
  { icon: MessagesSquare, label: 'Contact form', href: '/contact' },
  { icon: CircleHelp, label: 'FAQs', href: '/faq' },
] as const;

export default function CustomerCarePage() {
  return (
    <div className="mx-auto max-w-[1240px] px-[20px] pb-[48px] pt-[20px] lg:pb-[70px]">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(145deg,#0b1b3f_0%,#0142aa_60%,#3b6fe0_100%)] px-[24px] py-[30px] text-white lg:px-[48px] lg:py-[44px]">
        <span
          aria-hidden="true"
          className="absolute -right-[60px] -top-[90px] size-[260px] rounded-full bg-white/[0.07]"
        />
        <span className="flex size-[52px] items-center justify-center rounded-[16px] border border-white/30 bg-white/15">
          <Headset aria-hidden="true" className="size-[26px]" />
        </span>
        <h1 className="mt-[16px] font-ui text-[26px] font-bold leading-[1.2] lg:text-[36px]">
          {CUSTOMER_CARE_PAGE.title}
        </h1>
        <p className="mt-[10px] max-w-[640px] font-ui text-[14.6px] leading-[1.6] text-white/80 lg:text-[16px]">
          {CUSTOMER_CARE_PAGE.text}
        </p>
        <div className="mt-[16px] flex flex-wrap gap-[8px] font-ui text-[12.5px] font-semibold">
          <span className="rounded-full bg-white/15 px-[12px] py-[5px]">✨ AI help 24×7</span>
          <span className="rounded-full bg-white/15 px-[12px] py-[5px]">
            Real people on WhatsApp, call &amp; email
          </span>
        </div>
      </section>

      {/* v1.17 AI help - hides itself when the assistant is switched off. */}
      <AssistantChat />

      {/* Talk to our team */}
      <h2 className="mt-[40px] font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-[#8a95ab]">
        Talk to our team
      </h2>
      <ul className="mt-[14px] grid gap-[16px] md:grid-cols-3">
        {CUSTOMER_CARE_PAGE.cards.map((card) => {
          const c = CONTACT[card.id];
          return (
            <li key={card.id}>
              <a
                href={card.href}
                target={c.external ? '_blank' : undefined}
                rel={c.external ? 'noopener noreferrer' : undefined}
                className="group flex h-full flex-col rounded-[22px] bg-white p-[20px] shadow-[0_8px_24px_rgba(11,27,63,0.08)] ring-1 ring-[#e6ecf6] transition hover:-translate-y-[2px] hover:shadow-[0_14px_32px_rgba(11,27,63,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span
                  className={`flex size-[48px] items-center justify-center rounded-[15px] ${c.tint}`}
                >
                  {c.icon}
                </span>
                <span className="mt-[14px] font-ui text-[18px] font-semibold text-heading">
                  {card.title}
                </span>
                <span
                  className={`mt-[4px] font-ui text-[16px] font-bold tracking-[0.01em] ${c.text}`}
                >
                  {c.detail}
                </span>
                <span className="mt-[8px] flex-1 font-ui text-[14px] leading-[1.6] text-ink-body">
                  {card.text}
                </span>
                <span
                  className={`mt-[14px] inline-flex items-center gap-[6px] font-ui text-[14px] font-bold ${c.text}`}
                >
                  {c.action}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-[15px] transition group-hover:translate-x-[3px]"
                  />
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      {/* Quick help */}
      <h2 className="mt-[40px] font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-[#8a95ab]">
        Quick help
      </h2>
      <ul className="mt-[14px] grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-6">
        {QUICK.map(({ icon: Icon, label, href }) => (
          <li key={label}>
            <Link
              href={href}
              className="flex h-full flex-col items-center gap-[10px] rounded-[18px] bg-white px-[10px] py-[18px] text-center ring-1 ring-[#e2e9f6] transition hover:ring-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <span className="flex size-[42px] items-center justify-center rounded-[14px] bg-[#eaf1ff]">
                <Icon aria-hidden="true" className="size-[20px] text-brand" />
              </span>
              <span className="font-ui text-[13.5px] font-semibold text-heading">{label}</span>
            </Link>
          </li>
        ))}
      </ul>

      {/* Visit us */}
      <h2 className="mt-[40px] font-ui text-[13px] font-bold uppercase tracking-[0.12em] text-[#8a95ab]">
        Visit us
      </h2>
      <div className="mt-[14px] flex flex-col gap-[14px] rounded-[22px] bg-white p-[20px] ring-1 ring-[#e2e9f6] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-[12px]">
          <span className="flex size-[44px] shrink-0 items-center justify-center rounded-[14px] bg-[#ffe4e6]">
            <MapPin aria-hidden="true" className="size-[22px] text-[#e11d48]" />
          </span>
          <p className="font-ui text-[14.5px] font-medium leading-[1.5] text-heading">
            {BUSINESS.address}
          </p>
        </div>
        <a
          href={BUSINESS.mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center justify-center gap-[6px] rounded-[12px] bg-[#eaf1ff] px-[16px] py-[10px] font-ui text-[14px] font-bold text-brand hover:bg-[#dfe9ff]"
        >
          Open in Maps
        </a>
      </div>
    </div>
  );
}
