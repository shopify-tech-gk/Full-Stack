'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PROMO_BANNER_SLIDES, PROMO_ROTATION_MS } from '@youmart/shared-client';

// Below 1025px only (desktop: PromoSlider). Live: two banner pairs that swap instantly every ~3s.
// Pauses on hover/focus and never rotates for prefers-reduced-motion users.
export function PromoBanners() {
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const timer = window.setInterval(
      () => setSlide((current) => (current + 1) % PROMO_BANNER_SLIDES.length),
      PROMO_ROTATION_MS,
    );
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <section
      aria-label="Offers"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="pl-[15px] pr-[10px] pt-[20px] lg:hidden"
    >
      {PROMO_BANNER_SLIDES.map((pair, index) => (
        <ul
          key={pair[0].id}
          aria-hidden={index !== slide}
          className={`grid-cols-2 gap-[15px] lg:gap-[16px] ${index === slide ? 'grid' : 'hidden'}`}
        >
          {pair.map((banner) => (
            <li key={banner.id}>
              <Link
                href={banner.href}
                tabIndex={index === slide ? undefined : -1}
                className="block overflow-hidden rounded-banner focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <Image
                  src={banner.image}
                  alt={banner.title}
                  width={1536}
                  height={480}
                  priority={index === 0}
                  loading={index === 0 ? undefined : 'eager'}
                  sizes="(min-width: 1025px) 50vw, 45vw"
                  className="h-auto w-full"
                />
              </Link>
            </li>
          ))}
        </ul>
      ))}
    </section>
  );
}
