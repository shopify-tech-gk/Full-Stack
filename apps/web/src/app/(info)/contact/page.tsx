import type { Metadata } from 'next';
import { Building2, MailOpen, PhoneCall } from 'lucide-react';
import { BUSINESS, CONTACT_PAGE, FOOTER } from '@youmart/shared-client';
import { ContactForm } from '@/components/info/ContactForm';
import { PageHero } from '@/components/info/PageHero';
import { RichText } from '@/components/info/RichText';
import { FaFacebook, FaInstagram, FaYoutube } from '@/components/ui/FaIcons';

export const metadata: Metadata = { title: 'Contact - You Mart' };

const ICONS = {
  meet: Building2,
  call: PhoneCall,
  email: MailOpen,
} as const;

const SOCIAL = [
  { id: 'youtube', icon: FaYoutube, bg: 'bg-social-youtube' },
  { id: 'facebook', icon: FaFacebook, bg: 'bg-social-facebook' },
  { id: 'instagram', icon: FaInstagram, bg: 'bg-instagram' },
] as const;

export default function ContactPage() {
  const socialLinks = SOCIAL.map((s) => ({
    ...s,
    link: FOOTER.social.links.find((l) => l.id === s.id),
  }));

  return (
    <>
      <PageHero title={CONTACT_PAGE.hero.title} text={CONTACT_PAGE.hero.text} />

      {/* Live: white panel with the social column, overlapping maroon card, shadowed map. */}
      <section className="mx-auto max-w-[1140px] px-[20px] py-[50px] lg:py-[100px]">
        <div className="flex flex-col bg-white shadow-info-map lg:flex-row lg:items-center">
          <ul
            aria-label="Follow us"
            className="order-3 flex justify-center gap-[8px] py-[16px] lg:order-none lg:w-[88px] lg:flex-col lg:items-center lg:py-0"
          >
            {socialLinks.map(({ id, icon: Icon, bg, link }) =>
              link ? (
                <li key={id}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={link.label}
                    className={`flex size-[39px] items-center justify-center rounded-full ${bg} transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand`}
                  >
                    <Icon className="size-[15px] text-white" />
                  </a>
                </li>
              ) : null,
            )}
          </ul>
          <div className="bg-info-maroon p-[30px] shadow-info-card lg:-my-[80px] lg:w-[440px] lg:shrink-0 lg:rounded-[5px] lg:p-[50px]">
            <h2 className="border-b border-info-muted/20 pb-[20px] font-ui text-[26px] font-normal uppercase leading-[1.3] text-white lg:text-[34px]">
              {CONTACT_PAGE.card.title}
            </h2>
            <ul className="mt-[30px] grid gap-[30px]">
              {CONTACT_PAGE.card.items.map((item) => {
                const Icon = ICONS[item.id];
                return (
                  <li key={item.id} className="flex items-center gap-[24px]">
                    <span className="flex size-[60px] shrink-0 items-center justify-center rounded-full bg-white text-heading">
                      <Icon aria-hidden="true" className="size-[24px]" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 font-ui">
                      <h3 className="text-[18px] font-semibold leading-[1.2] text-white lg:text-[20px]">
                        {item.title}
                      </h3>
                      <p className="mt-[5px] break-words text-[14.6px] leading-[1.6] text-info-muted lg:text-[16px]">
                        {item.href ? (
                          <a
                            href={item.href}
                            className="hover:text-white hover:underline focus:outline-none focus-visible:underline"
                          >
                            {item.text}
                          </a>
                        ) : (
                          item.text
                        )}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <iframe
            title={`Map: ${BUSINESS.address}`}
            src={BUSINESS.mapEmbedSrc}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            className="order-2 h-[300px] w-full border-0 lg:order-none lg:h-[380px] lg:flex-1"
          />
        </div>
      </section>

      <section className="mx-auto max-w-[800px] px-[20px] pb-[50px] lg:pb-[100px]">
        <ContactForm />
      </section>

      {/* Live paints this band with a photo; the crimson token stands in until assets exist. */}
      <section className="bg-gradient-to-r from-info-ctaBand to-info-maroon">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-[24px] px-[20px] py-[50px] lg:flex-row lg:items-center lg:justify-between lg:py-[60px]">
          <div className="lg:max-w-[620px]">
            <h2 className="font-ui text-[24px] font-semibold uppercase leading-[1.3] text-white lg:text-[34px]">
              {CONTACT_PAGE.cta.title}
            </h2>
            <p className="mt-[24px] font-ui text-[14.6px] leading-[1.6] text-white lg:mt-[40px] lg:text-[16px]">
              <RichText text={CONTACT_PAGE.cta.text} />
            </p>
          </div>
          <a
            href={CONTACT_PAGE.cta.href}
            className="inline-flex h-[48px] items-center self-start rounded-[5px] bg-heading px-[34px] font-ui text-[14px] font-semibold uppercase text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white lg:self-center"
          >
            {CONTACT_PAGE.cta.button}
          </a>
        </div>
      </section>
    </>
  );
}
