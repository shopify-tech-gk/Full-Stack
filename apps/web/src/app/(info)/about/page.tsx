import type { Metadata } from 'next';
import Image from 'next/image';
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
      <section className="bg-info-heroBg lg:bg-[linear-gradient(90deg,theme(colors.info.heroBg)_50%,#feffff_50%)]">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-[30px] px-[20px] py-[50px] lg:min-h-[533px] lg:flex-row lg:items-center lg:gap-0 lg:py-[40px]">
          <div className="lg:w-1/2 lg:self-end lg:pb-[60px]">
            <p className={`${EYEBROW} text-white`}>{hero.eyebrow}</p>
            <h1 className="mt-[20px] font-ui text-[36px] font-semibold uppercase leading-[1.4] text-white lg:mt-[65px] lg:text-[52px]">
              {hero.title}
            </h1>
          </div>
          {/* Brand-photo placeholder - awaiting the store's own image. */}
          <Image
            src="/placeholders/photo.svg"
            alt=""
            width={547}
            height={547}
            unoptimized
            className="aspect-square h-auto w-full max-w-[547px] object-cover lg:ml-auto"
          />
        </div>
      </section>

      <section className="mx-auto flex max-w-[1240px] flex-col gap-[30px] px-[20px] py-[50px] lg:flex-row lg:items-center lg:gap-[48px] lg:py-[150px]">
        {/* Brand-photo placeholder - awaiting the store's own image. */}
        <Image
          src="/placeholders/photo.svg"
          alt=""
          width={628}
          height={419}
          unoptimized
          className="h-auto w-full lg:w-[628px] lg:shrink-0"
        />
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
