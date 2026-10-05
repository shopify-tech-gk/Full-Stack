import Link from 'next/link';
import { CHECKOUT_STEPS } from '@youmart/shared-client';

interface CheckoutStepsProps {
  /** Step 1 label: the current category name (listing) or "Shop". */
  current: string;
  /** 0 = Shop/category, 1 = Cart, 2 = Checkout. */
  active?: 0 | 1 | 2;
  /** Cart/checkout: live caps the bar at 900px and centres it. */
  centered?: boolean;
}

// Live "royal progress" bar: 3 steps, a 2px line joining the circles, the active step glowing.
// Live's compact rules are `max-width: 768px`, so 768 itself is still compact.
export function CheckoutSteps({ current, active = 0, centered = false }: CheckoutStepsProps) {
  return (
    <nav
      aria-label="Shopping steps"
      className="bg-page px-[10px] pb-[10px] min-[769px]:px-[20px] min-[769px]:py-[10px]"
    >
      <ol className={`relative flex ${centered ? 'mx-auto max-w-[900px]' : ''}`}>
        <span
          aria-hidden="true"
          className="absolute left-[calc(100%/6+20px)] right-[calc(100%/6+20px)] top-[10.8px] h-[2px] rounded-[4px] bg-steps-line"
        />
        {CHECKOUT_STEPS.map((step, index) => {
          const isActive = index === active;
          return (
            <li key={step.href} className="relative flex-1">
              <Link
                href={step.href}
                aria-current={isActive ? 'step' : undefined}
                className="flex flex-col items-center text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span
                  className={`relative flex size-[25px] items-center justify-center rounded-full border-2 font-ui text-[15px] font-semibold leading-none ${
                    isActive
                      ? 'border-white bg-gradient-to-b from-steps-dark to-steps-glow text-white shadow-step-glow'
                      : 'border-page bg-steps-idle text-black'
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`mt-[8px] max-w-[70px] font-ui text-[10px] leading-[1.2] text-black min-[769px]:max-w-none min-[769px]:text-[12px] ${
                    isActive ? 'font-semibold' : 'font-medium'
                  }`}
                >
                  {step.label ?? current}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
