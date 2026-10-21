import { Bike, PartyPopper } from 'lucide-react';
import {
  FREE_DELIVERY_MIN,
  formatMoney,
  freeDeliveryProgress,
  type Money,
} from '@youmart/shared-client';

/**
 * v1.16: "Add ₹X more for FREE delivery" + a filling bar, or "You've unlocked FREE delivery"
 * once the cart reaches FREE_DELIVERY_MIN (₹2,000). Used by the cart totals and the add-to-cart
 * toast.
 */
export function FreeDeliveryProgress({ subtotal }: { subtotal: Money }) {
  const p = freeDeliveryProgress(subtotal);
  return (
    <div className="font-ui">
      <p className="flex items-center gap-[7px] text-[14px] font-medium text-heading">
        {p.unlocked ? (
          <>
            <PartyPopper aria-hidden="true" className="size-[17px] shrink-0 text-[#16a34a]" />
            <span>
              <strong className="text-[#16a34a]">Yay!</strong> You&rsquo;ve unlocked{' '}
              <strong className="text-[#16a34a]">FREE delivery</strong>
            </span>
          </>
        ) : (
          <>
            <Bike aria-hidden="true" className="size-[17px] shrink-0 text-brand" />
            <span>
              Add <strong className="text-brand">{formatMoney(p.remaining)}</strong> more for{' '}
              <strong className="text-brand">FREE delivery</strong>
            </span>
          </>
        )}
      </p>
      <div
        className="mt-[7px] h-[6px] overflow-hidden rounded-full bg-[#e6ecf5]"
        role="progressbar"
        aria-label="Progress to free delivery"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(p.ratio * 100)}
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 motion-reduce:transition-none ${
            p.unlocked ? 'bg-[#22c55e]' : 'bg-[#ffb800]'
          }`}
          style={{ width: `${p.ratio * 100}%` }}
        />
      </div>
      {!p.unlocked && (
        <p className="mt-[4px] text-[12px] text-ink-muted">
          Free delivery on orders of {formatMoney(FREE_DELIVERY_MIN)} or more
        </p>
      )}
    </div>
  );
}
