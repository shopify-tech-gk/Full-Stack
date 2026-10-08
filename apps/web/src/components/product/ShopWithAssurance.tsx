import { Truck, ShieldCheck, RotateCcw } from 'lucide-react';

const POINTS = [
  { Icon: Truck, title: 'On-time delivery', text: 'Delivered within the promised date.' },
  { Icon: ShieldCheck, title: 'Quality assured', text: '100% genuine, quality-checked products.' },
  { Icon: RotateCcw, title: 'Easy returns', text: 'Hassle-free returns & secure payments.' },
] as const;

/** Trust badges on the product page — "Shop with Assurance" (desktop). */
export function ShopWithAssurance() {
  return (
    <section
      aria-labelledby="shop-assurance"
      className="mb-[16px] rounded-[12px] border border-brand-popup-border bg-brand-popup-bg p-[16px]"
    >
      <h2 id="shop-assurance" className="mb-[12px] font-ui text-[16px] font-bold text-heading">
        Shop with Assurance
      </h2>
      <ul className="grid gap-[12px] sm:grid-cols-3">
        {POINTS.map(({ Icon, title, text }) => (
          <li key={title} className="flex items-start gap-[10px] sm:flex-col sm:items-start">
            <span className="flex size-[38px] shrink-0 items-center justify-center rounded-[11px] bg-white text-brand">
              <Icon aria-hidden className="size-[19px]" strokeWidth={2} />
            </span>
            <span className="min-w-0">
              <span className="block font-ui text-[13.5px] font-semibold text-heading">
                {title}
              </span>
              <span className="block font-sans text-[12px] leading-[1.35] text-ink-body">
                {text}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
