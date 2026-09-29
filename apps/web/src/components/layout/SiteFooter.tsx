import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { FOOTER } from '@youmart/shared-client';
import {
  FaCopyright,
  FaFacebook,
  FaInstagram,
  FaQuestionCircle,
  FaShareAlt,
  FaStore,
  FaUser,
  FaYoutube,
} from '@/components/ui/FaIcons';

const SOCIAL = {
  youtube: { icon: FaYoutube, bg: 'bg-social-youtube' },
  facebook: { icon: FaFacebook, bg: 'bg-social-facebook' },
  instagram: { icon: FaInstagram, bg: 'bg-instagram' },
  share: { icon: FaShareAlt, bg: 'bg-social-share' },
} as const;

const BOTTOM_ICON_CLASS = 'mr-[4px] size-[12px] text-footer-icon';
const BOTTOM_ICONS = {
  shop: <FaStore className={BOTTOM_ICON_CLASS} />,
  account: <FaUser className={BOTTOM_ICON_CLASS} />,
  cart: <ShoppingCart aria-hidden="true" className={BOTTOM_ICON_CLASS} strokeWidth={3} />,
  faq: <FaQuestionCircle className={BOTTOM_ICON_CLASS} />,
} as const;

const LINK =
  'rounded-sm hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-white';

interface FooterColumnProps {
  heading: string;
  className: string;
  children: React.ReactNode;
}

// <1025px each column is a row (heading | content), 1-up on mobile and 2-up on tablet, as live.
function FooterColumn({ heading, className, children }: FooterColumnProps) {
  return (
    <section
      className={`grid grid-cols-2 items-center gap-x-[14px] md:px-[10px] md:pb-[10px] md:pt-0 lg:block ${className}`}
    >
      <h2 className="pb-[16px] pt-[2px] font-ui text-[16px] font-extrabold uppercase leading-[35px] text-footer-heading">
        {heading}
      </h2>
      <div>{children}</div>
    </section>
  );
}

function LinkList({ links }: { links: readonly { label: string; href: string }[] }) {
  return (
    <ul className="lg:ml-[11px]">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className={`flex px-[10px] py-[5px] font-ui text-[12px] leading-[12px] ${LINK}`}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Site-wide footer, measured from the live youmartshop.com footer template. */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-[40px] bg-brand text-white">
      <div className="px-[30px] pt-[40px] md:grid md:grid-cols-2 lg:flex">
        <FooterColumn heading={FOOTER.about.heading} className="pb-[10px] pr-[10px] lg:w-[19%]">
          <p className="mb-[21px] font-ui text-[12px] leading-[23.35px] lg:leading-[25.6px]">
            {FOOTER.about.lead}&nbsp;<strong>{FOOTER.about.brand}</strong>
            {FOOTER.about.rest}
          </p>
        </FooterColumn>

        <FooterColumn heading={FOOTER.quickLinks.heading} className="pb-[10px] lg:w-[17%]">
          <LinkList links={FOOTER.quickLinks.links} />
        </FooterColumn>

        <FooterColumn
          heading={FOOTER.policy.heading}
          className="pb-[10px] pr-[10px] pt-[20px] lg:w-[17.18%]"
        >
          <LinkList links={FOOTER.policy.links} />
        </FooterColumn>

        {/* Live squeezes email, "SOCIAL:" and the icons side by side on mobile (icons stack
            vertically); they stack in the content cell here. */}
        <FooterColumn
          heading={FOOTER.mail.heading}
          className="pb-[10px] pr-[10px] pt-[20px] lg:w-[22.48%] lg:border-l lg:border-footer-divider lg:pl-[30px]"
        >
          <div className="lg:pl-[15px]">
            <p className="mb-[12px] font-ui text-[12px] leading-[25.6px] lg:mb-[41px] lg:pt-[25.6px]">
              <a href={`mailto:${FOOTER.mail.email}`} className={LINK}>
                {FOOTER.mail.email}
              </a>
            </p>
            <h3 className="font-ui text-[13px] font-semibold uppercase leading-[16.9px] text-footer-subheading">
              {FOOTER.social.heading}
            </h3>
            <ul className="mt-[12px] flex gap-[3px] lg:mt-[20px]">
              {FOOTER.social.links.map((social) => {
                const { icon: Icon, bg } = SOCIAL[social.id];
                return (
                  <li key={social.id}>
                    <a
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={social.label}
                      className={`flex size-[32.4px] items-center justify-center rounded-full ${bg} transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white`}
                    >
                      <Icon className="size-[18px] text-white" />
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        </FooterColumn>

        <FooterColumn
          heading={FOOTER.office.heading}
          className="pb-[10px] pr-[10px] pt-[20px] lg:w-[24.33%]"
        >
          <p className="font-sans text-[12px] leading-[23.35px] lg:leading-[25.6px]">
            {FOOTER.office.address}
            <br />
            <br />
            <a href={FOOTER.office.phoneHref} className={`font-ui font-bold ${LINK}`}>
              {FOOTER.office.phoneLabel}
            </a>
          </p>
        </FooterColumn>
      </div>

      <div className="h-[20px]" />

      <div className="border-y border-footer-rule px-[30px] py-[10px] md:flex md:items-start">
        <nav aria-label="Footer" className="p-[10px] md:w-[80%]">
          <ul className="-mx-[10.5px] flex flex-wrap justify-center font-ui text-[12px] leading-[23.35px] md:-mx-[20px] lg:-mx-[25px] lg:leading-[25.6px]">
            {FOOTER.bottomLinks.map((link) => (
              <li
                key={link.id}
                className="relative mx-[10.5px] after:absolute after:-right-[10.5px] after:top-0 after:h-full after:border-l after:border-footer-separator md:mx-[20px] md:after:-right-[20px] lg:mx-[25px] lg:after:-right-[25px]"
              >
                <Link href={link.href} className={`flex items-center ${LINK}`}>
                  {BOTTOM_ICONS[link.id]}
                  <span className="pl-[5px]">{link.label}</span>
                </Link>
              </li>
            ))}
            <li className="mx-[10.5px] flex items-center md:mx-[20px] lg:mx-[25px]">
              <FaCopyright className={BOTTOM_ICON_CLASS} />
              <span className="pl-[5px]">
                <span className="sr-only">Copyright </span>
                {year} - {FOOTER.copyrightSite}
              </span>
            </li>
          </ul>
        </nav>
        <div className="flex justify-center p-[10px] md:w-[20%]">
          <Image
            src="/placeholders/payments.svg"
            alt={`We accept ${FOOTER.payments.join(', ')}`}
            width={200}
            height={33}
            unoptimized
            className="h-auto max-w-full"
          />
        </div>
      </div>
    </footer>
  );
}
