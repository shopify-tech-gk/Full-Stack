import { Headset, RotateCcw, ShieldCheck, Truck, type LucideIcon } from 'lucide-react';
import type { ExploreFeature } from '@youmart/shared-client';

const ICONS: Record<ExploreFeature['id'], LucideIcon> = {
  delivery: Truck,
  genuine: ShieldCheck,
  returns: RotateCcw,
  support: Headset,
};

/** DESKTOP ONLY (>= 1025px): the trust strip under "Explore Categories" (client's redesign). */
export function ExploreFeatureStrip({ features }: { features: readonly ExploreFeature[] }) {
  return (
    <section
      aria-label="Why shop with YouMart"
      className="hidden px-[12px] pb-[14px] pt-[6px] lg:block"
    >
      <ul className="mx-auto grid max-w-[1440px] grid-cols-4 rounded-[14px] border border-brand-popup-border bg-white py-[14px] shadow-rail-card">
        {features.map(({ id, title, text }, index) => {
          const Icon = ICONS[id];
          return (
            <li
              key={id}
              className={`flex items-center justify-center gap-[16px] px-[20px] ${
                index > 0 ? 'border-l border-cart-line' : ''
              }`}
            >
              <Icon
                aria-hidden="true"
                className="size-[34px] shrink-0 text-brand"
                strokeWidth={1.9}
              />
              <span>
                <span className="block font-ui text-[13.5px] font-semibold leading-[1.3] text-heading">
                  {title}
                </span>
                <span className="block font-sans text-[12px] leading-[1.4] text-ink-body">
                  {text}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
