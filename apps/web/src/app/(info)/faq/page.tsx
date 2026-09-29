import type { Metadata } from 'next';
import Image from 'next/image';
import { FAQ_PAGE } from '@youmart/shared-client';
import { PageHero } from '@/components/info/PageHero';
import { RichText } from '@/components/info/RichText';

export const metadata: Metadata = { title: 'FAQ - You Mart' };

const TEXT = 'font-ui text-[14.6px] leading-[1.6] text-ink-body lg:text-[16px]';

// Live Elementor accordion: 1px #ececec rules, 16px bold titles, +/- icon, one item open at a time.
export default function FaqPage() {
  return (
    <>
      <PageHero title={FAQ_PAGE.title} text={FAQ_PAGE.subtitle} />
      <div className="mx-auto max-w-[1240px] px-[20px] py-[50px] lg:py-[100px]">
        <h2 className="mb-[24px] font-ui text-[24px] font-semibold uppercase leading-[1.3] text-info-faqHeading lg:mb-[30px] lg:text-[34px]">
          {FAQ_PAGE.heading}
        </h2>
        <div className="lg:flex lg:items-center lg:gap-[60px]">
          <div className="border-x border-t border-info-accordionLine lg:w-[calc(50%-30px)]">
            {FAQ_PAGE.items.map((item, index) => (
              <details
                key={item.question}
                name="faq"
                open={index === 0}
                className="group border-b border-info-accordionLine"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-[16px] p-[16px] font-ui text-[15px] font-bold leading-[1.3] text-ink-body group-open:text-info-accordionIcon lg:text-[16px] [&::-webkit-details-marker]:hidden">
                  {item.question}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-[22px] font-bold leading-none text-info-accordionIcon"
                  >
                    <span className="group-open:hidden">+</span>
                    <span className="hidden group-open:inline">&minus;</span>
                  </span>
                </summary>
                <div
                  className={`${TEXT} border-t border-info-accordionLine px-[16px] pb-[16px] pt-[5px]`}
                >
                  {item.answer.map((part, partIndex) =>
                    typeof part === 'string' ? (
                      <p key={partIndex} className="mt-[10px]">
                        <RichText text={part} />
                      </p>
                    ) : (
                      <ul key={partIndex} className="ml-[24px] mt-[6px] list-disc">
                        {part.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </details>
            ))}
          </div>
          {/* DEMO image - live shows a stock photo here. */}
          <Image
            src="/placeholders/photo.svg"
            alt=""
            width={544}
            height={385}
            unoptimized
            className="mt-[30px] hidden h-auto w-full lg:mt-0 lg:block lg:w-[calc(50%-30px)]"
          />
        </div>
      </div>
    </>
  );
}
