'use client';

import { useEffect, useState } from 'react';

const SECTIONS = [
  { id: 'product-details', label: 'Product Details' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'more-to-explore', label: 'More to Explore' },
] as const;

/** Sticky in-page nav: jumps to (and highlights) the Product Details / Reviews / More to Explore sections. */
export function ProductSectionNav() {
  const [active, setActive] = useState<string>('product-details');

  useEffect(() => {
    const els = SECTIONS.map((s) => document.getElementById(s.id)).filter((el): el is HTMLElement =>
      Boolean(el),
    );
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-100px 0px -62% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'reviews') window.dispatchEvent(new CustomEvent('ym:show-reviews'));
    const top = el.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <nav
      aria-label="Product sections"
      className="sticky top-0 z-30 -mx-[20px] mb-[12px] flex gap-[8px] border-b border-cart-line bg-white/95 px-[20px] py-[10px] backdrop-blur"
    >
      {SECTIONS.map((s) => (
        <a
          key={s.id}
          href={`#${s.id}`}
          onClick={go(s.id)}
          className={`rounded-full px-[16px] py-[7px] font-ui text-[14px] font-semibold transition-colors ${
            active === s.id
              ? 'bg-brand text-white'
              : 'text-ink-body hover:bg-brand-popup-bg hover:text-brand'
          }`}
        >
          {s.label}
        </a>
      ))}
    </nav>
  );
}
