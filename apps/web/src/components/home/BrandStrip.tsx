import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { BrandOffer } from '@youmart/shared-client';
import { OfferBadge } from '@/components/ui/OfferBadge';

interface BrandStripProps {
  brands: readonly BrandOffer[];
}

// Live: static 8-column grid (20px gaps) from 768px, 2-up with 10px gaps on mobile; no auto-scroll.
// Below 1025px that is unchanged; desktop gets the redesign's premium tiles (same row, same badges).
export function BrandStrip({ brands }: BrandStripProps) {
  return (
    <section aria-label="Brand offers" className="px-[10px] lg:px-[12px]">
      <ul className="grid grid-cols-2 gap-[10px] py-[10px] md:grid-cols-8 md:gap-[20px] lg:hidden">
        {brands.map((brand) => (
          <li key={brand.id} className="relative">
            <Link href={brand.href} className="block">
              <Image
                src={brand.image}
                alt={`${brand.name}: ${brand.badge.join(' ')}`}
                width={300}
                height={300}
                unoptimized={brand.image.endsWith('.svg')}
                sizes="(min-width: 768px) 12vw, 46vw"
                className="aspect-square w-full rounded-brand-tile object-cover"
              />
            </Link>
            <OfferBadge lines={brand.badge} />
          </li>
        ))}
      </ul>

      <div className="mx-auto hidden max-w-[1440px] pb-[10px] pt-[18px] lg:block">
        <div className="mb-[14px] flex items-end justify-between gap-[20px] px-[4px]">
          <h2 className="flex items-center gap-[12px] font-ui text-[24px] font-bold leading-none text-heading">
            <span aria-hidden="true" className="h-[4px] w-[30px] rounded-full bg-brand" />
            <span>
              Top Brands, <span className="text-brand">Big Offers</span>
            </span>
          </h2>
          <p className="font-sans text-[12.5px] text-ink-body">
            Pick a brand to shop its offers &mdash; biggest discounts first
          </p>
        </div>
        <ul className="grid grid-cols-8 gap-[18px] pb-[20px]">
          {brands.map((brand) => (
            <li key={brand.id} className="group/brand relative">
              <Link
                href={brand.href}
                aria-label={`${brand.name}, ${brand.badge.join(' ')}: shop the offers`}
                className="relative block aspect-square overflow-hidden rounded-[22px] shadow-[0_10px_24px_-12px_rgba(1,66,170,0.55)] ring-1 ring-brand/10 transition-[transform,box-shadow] duration-500 hover:-translate-y-[4px] hover:shadow-[0_20px_36px_-14px_rgba(1,66,170,0.6)] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <Image
                  src={brand.poster}
                  alt=""
                  fill
                  sizes="(min-width: 1440px) 165px, 12vw"
                  className="object-cover transition-transform duration-700 ease-out group-hover/brand:scale-[1.06] motion-reduce:transition-none motion-reduce:group-hover/brand:scale-100"
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover/brand:opacity-100"
                />
                <span
                  aria-hidden="true"
                  className="absolute bottom-[10px] right-[10px] inline-flex translate-y-[6px] items-center gap-[4px] rounded-full bg-white px-[10px] py-[5px] font-ui text-[11.5px] font-semibold text-brand opacity-0 shadow-[0_6px_16px_rgba(0,0,0,0.2)] transition-[opacity,transform] duration-300 group-hover/brand:translate-y-0 group-hover/brand:opacity-100 group-focus-within/brand:translate-y-0 group-focus-within/brand:opacity-100"
                >
                  Shop
                  <ArrowRight className="size-[12px]" strokeWidth={2.5} />
                </span>
              </Link>
              <OfferBadge
                lines={brand.badge}
                className="transition-transform duration-300 ease-out group-hover/brand:-rotate-6 group-hover/brand:scale-110 motion-reduce:transition-none motion-reduce:group-hover/brand:rotate-0 motion-reduce:group-hover/brand:scale-100"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
