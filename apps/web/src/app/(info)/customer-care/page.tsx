import type { Metadata } from 'next';
import { PhoneCall } from 'lucide-react';
import { CUSTOMER_CARE_PAGE } from '@youmart/shared-client';
import { FaWhatsapp } from '@/components/ui/FaIcons';

export const metadata: Metadata = { title: 'Customer Care - You Mart' };

const ICONS = {
  whatsapp: <FaWhatsapp className="size-[26px] text-info-whatsapp" />,
  call: <PhoneCall aria-hidden="true" className="size-[26px] text-heading" strokeWidth={1.5} />,
} as const;

// Live: centred 34px uppercase heading and two 3px brand-bordered help cards.
export default function CustomerCarePage() {
  return (
    <div className="mx-auto max-w-[1240px] px-[20px] pb-[40px] pt-[20px] lg:pb-[60px] lg:pt-[10px]">
      <h1 className="text-center font-ui text-[24px] font-semibold uppercase leading-[1.3] text-heading lg:text-[34px]">
        {CUSTOMER_CARE_PAGE.title}
      </h1>
      <p className="mt-[20px] text-center font-ui text-[14.6px] leading-[1.6] text-ink-body lg:text-[16px]">
        {CUSTOMER_CARE_PAGE.text}
      </p>
      <ul className="mt-[40px] grid gap-[20px] md:grid-cols-2 lg:mt-[55px] lg:px-[10px]">
        {CUSTOMER_CARE_PAGE.cards.map((card) => (
          <li
            key={card.id}
            className="flex gap-[14px] border-[3px] border-brand p-[10px] pr-[14px] lg:gap-[14px]"
          >
            <span className="mt-[52px] shrink-0">{ICONS[card.id]}</span>
            <div className="font-ui">
              <h2 className="text-[20px] font-semibold leading-[1.3] text-heading lg:text-[24px]">
                <a
                  href={card.href}
                  target={card.id === 'whatsapp' ? '_blank' : undefined}
                  rel={card.id === 'whatsapp' ? 'noopener noreferrer' : undefined}
                  className="hover:text-brand focus:outline-none focus-visible:underline"
                >
                  {card.title}
                </a>
              </h2>
              <p className="mt-[16px] text-[14.6px] leading-[1.6] text-ink-body lg:text-[16px]">
                {card.text}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
