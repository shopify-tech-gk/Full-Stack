import Image from 'next/image';
import Link from 'next/link';
import type { BrandOffer } from '@youmart/shared-client';
import { OfferBadge } from '@/components/ui/OfferBadge';

interface BrandStripProps {
  brands: readonly BrandOffer[];
}

// Live: static 8-column grid (20px gaps) from 768px, 2-up with 10px gaps on mobile; no auto-scroll.
export function BrandStrip({ brands }: BrandStripProps) {
  return (
    <section aria-label="Brand offers" className="px-[10px]">
      <ul className="grid grid-cols-2 gap-[10px] py-[10px] md:grid-cols-8 md:gap-[20px]">
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
    </section>
  );
}
