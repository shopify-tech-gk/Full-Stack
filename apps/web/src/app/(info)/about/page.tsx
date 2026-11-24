import type { Metadata } from 'next';
import { Home, Package, PartyPopper, ShieldCheck, Sparkles, Sprout, Tags, Truck } from 'lucide-react';
import Link from 'next/link';
import { ABOUT_PAGE } from '@youmart/shared-client';
import { RichText } from '@/components/info/RichText';

export const metadata: Metadata = { title: 'About - You Mart' };

const EYEBROW = 'font-ui text-[14px] font-semibold uppercase leading-[1.25] lg:text-[15px]';
const H2 = 'font-ui text-[26px] font-semibold uppercase leading-[1.3] text-heading lg:text-[34px]';
const BODY = 'font-ui text-[14.6px] leading-[1.6] lg:text-[16px]';

// Live About template: split dark/white hero, image + intro, Mission & Vision band, "Talk to us"
// band. Stock photos are placeholders until YouMart supplies its own.
export default function AboutPage() {
  const { hero, intro, missionVision, cta } = ABOUT_PAGE;
  return (
    <>
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#061a45_0%,#0142aa_55%,#1e88e5_100%)]">
        <span aria-hidden="true" className="absolute -right-[120px] -top-[140px] size-[460px] rounded-full bg-white/[0.06]" />
        <div className="relative mx-auto flex max-w-[1240px] flex-col gap-[36px] px-[20px] py-[56px] lg:flex-row lg:items-center lg:gap-[48px] lg:py-[96px]">
          <div className="lg:w-1/2">
            <p className={`${EYEBROW} text-[#ffd60a]`}>{hero.eyebrow}</p>
            <h1 className="mt-[14px] font-ui text-[36px] font-bold leading-[1.15] text-white lg:text-[56px]">
              {hero.title}
            </h1>
            <p className="mt-[16px] max-w-[480px] font-ui text-[16px] leading-[1.6] text-white/80">
              Shop easy, live better - everything for your home, garden, family and celebrations, delivered to your door.
            </p>
          </div>
          <ul className="grid flex-1 grid-cols-2 gap-[14px]">
            {[
              { Icon: Package, value: '5 lakh+', label: 'Products' },
              { Icon: Tags, value: '8,000+', label: 'Brands' },
              { Icon: Truck, value: 'Fast', label: 'Delivery across India' },
              { Icon: ShieldCheck, value: '100%', label: 'Secure payments' },
            ].map(({ Icon, value, label }) => (
              <li key={label} className="rounded-[18px] bg-white/[0.08] p-[20px] text-white ring-1 ring-white/15 backdrop-blur-[2px]">
                <Icon aria-hidden="true" className="size-[26px] text-[#ffd60a]" />
                <p className="mt-[14px] font-ui text-[30px] font-bold leading-none">{value}</p>
                <p className="mt-[6px] font-ui text-[14px] text-white/75">{label}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto flex max-w-[1240px] flex-col gap-[30px] px-[20px] py-[50px] lg:flex-row lg:items-center lg:gap-[56px] lg:py-[96px]">
        <ul className="grid w-full shrink-0 grid-cols-2 gap-[14px] lg:w-[560px]">
          {[
            { Icon: Sprout, title: 'Home & garden', text: 'Seeds, plants, fertilisers and tools' },
            { Icon: Sparkles, title: 'Beauty & care', text: 'Cosmetics, skin and hair care' },
            { Icon: PartyPopper, title: 'Celebrations', text: 'Party, gifts and festival decor' },
            { Icon: Home, title: 'Everyday needs', text: 'Kitchen, cleaning and stationery' },
          ].map(({ Icon, title, text }) => (
            <li key={title} className="rounded-[18px] border border-catalog-rule bg-white p-[20px] shadow-rail-card">
              <span className="flex size-[46px] items-center justify-center rounded-[14px] bg-[#eef3fc] text-brand">
                <Icon aria-hidden="true" className="size-[22px]" />
              </span>
              <p className="mt-[12px] font-ui text-[16px] font-semibold text-heading">{title}</p>
              <p className="mt-[2px] font-ui text-[13.5px] text-ink-muted">{text}</p>
            </li>
          ))}
        </ul>
        <div>
          <p className={`${EYEBROW} text-heading`}>{intro.eyebrow}</p>
          <h2 className={`${H2} mt-[10px]`}>{intro.title}</h2>
          <h3 className="mt-[30px] font-ui text-[16px] font-semibold uppercase leading-[1.2] text-heading lg:text-[17px]">
            {intro.subtitle}
          </h3>
          {intro.paragraphs.map((text) => (
            <p key={text.slice(0, 24)} className={`${BODY} mt-[10px] text-ink-body`}>
              <RichText text={text} />
            </p>
          ))}
        </div>
      </section>

      {/* Live sets white copy on #a79d9e (about 2.6:1); the copy is dark here for contrast. */}
      <section className="bg-info-missionBg">
        <div className="mx-auto flex max-w-[1000px] flex-col gap-[30px] px-[20px] py-[50px] lg:flex-row lg:py-[85px]">
          <div className="lg:w-[229px] lg:shrink-0">
            <p className={`${EYEBROW} text-heading`}>{missionVision.eyebrow}</p>
            <h2 className="mt-[4px] font-ui text-[24px] font-semibold uppercase leading-[1.3] text-heading">
              {missionVision.title}
            </h2>
          </div>
          <div className="grid gap-[40px]">
            {missionVision.items.map((item) => (
              <div key={item.title}>
                <h3 className={H2}>{item.title}</h3>
                <p className={`${BODY} mt-[10px] text-heading`}>
                  <RichText text={item.text} />
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-heading">
        <div className="mx-auto flex max-w-[1240px] flex-col items-center px-[20px] py-[60px] text-center lg:min-h-[330px] lg:justify-center">
          <h2 className="font-ui text-[26px] font-semibold uppercase leading-[1.3] tracking-[3.3px] text-white lg:text-[34px]">
            {cta.title}
          </h2>
          <p className="mt-[15px] font-ui text-[16px] leading-[1.35] text-info-ctaText lg:text-[19px]">
            {cta.text}
          </p>
          <Link
            href={cta.href}
            className="mt-[30px] inline-flex h-[48px] items-center rounded-[5px] bg-brand px-[34px] font-ui text-[14px] font-semibold uppercase text-white transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
          >
            {cta.button}
          </Link>
        </div>
      </section>
    </>
  );
}
