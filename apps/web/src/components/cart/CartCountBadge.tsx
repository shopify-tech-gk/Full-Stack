'use client';

/**
 * Cart count on the header tile / bottom-nav tab (units, not lines; hidden at 0). Visual only -
 * the link carries `cartLinkLabel(count)` for screen readers.
 * POLISH (flagged): live's header shows no count; this is the brand-colour badge customers expect.
 */
export function CartCountBadge({ count, tone }: { count: number; tone: 'onBrand' | 'onWhite' }) {
  if (count === 0) return null;
  return (
    <span
      aria-hidden="true"
      className={`absolute -right-[7px] -top-[7px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-[5px] font-ui text-[11px] font-bold leading-none tabular-nums ring-2 ring-white ${
        tone === 'onBrand' ? 'bg-white text-brand shadow-rail-card' : 'bg-brand text-white'
      }`}
    >
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function cartLinkLabel(count: number): string {
  return count === 0 ? 'Cart, empty' : `Cart, ${count} ${count === 1 ? 'item' : 'items'}`;
}
