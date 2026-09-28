import Image from 'next/image';
import Link from 'next/link';
import { PROMO_BANNERS } from '@youmart/shared-client';

export function PromoBanners() {
  return (
    <section aria-label="Offers" className="px-3 pt-4 lg:px-[13px] lg:py-5">
      <ul className="scrollbar-none flex snap-x snap-mandatory gap-3 overflow-x-auto lg:grid lg:grid-cols-2 lg:gap-x-[14px] lg:gap-y-5 lg:overflow-visible">
        {PROMO_BANNERS.map((banner, index) => (
          <li key={banner.id} className="w-[calc(50%-6px)] shrink-0 snap-start lg:w-auto">
            <Link
              href={banner.href}
              className="block overflow-hidden rounded-[4px] focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
            >
              <Image
                src={banner.image}
                alt={banner.title}
                width={1314}
                height={410}
                priority={index < 2}
                sizes="(min-width: 1024px) 50vw, 46vw"
                className="h-auto w-full"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
