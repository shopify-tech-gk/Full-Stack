import Link from 'next/link';
import { CHECKOUT_STEPS } from '@youmart/shared-client';

interface CheckoutStepsProps {
  /** Step 1 label: the current category name. */
  current: string;
}

// Live "royal progress" bar: 3 steps, a 2px line joining the circles, step 1 glowing.
export function CheckoutSteps({ current }: CheckoutStepsProps) {
  return (
    <nav
      aria-label="Shopping steps"
      className="bg-page px-[10px] pb-[10px] md:px-[20px] md:py-[10px]"
    >
      <ol className="relative flex">
        <span
          aria-hidden="true"
          className="absolute left-[calc(100%/6+20px)] right-[calc(100%/6+20px)] top-[10.8px] h-[2px] rounded-[4px] bg-steps-line"
        />
        {CHECKOUT_STEPS.map((step, index) => {
          const active = index === 0;
          return (
            <li key={step.href} className="relative flex-1">
              <Link
                href={step.href}
                aria-current={active ? 'step' : undefined}
                className="flex flex-col items-center text-center focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                <span
                  className={`relative flex size-[25px] items-center justify-center rounded-full border-2 font-ui text-[15px] font-semibold leading-none ${
                    active
                      ? 'border-white bg-gradient-to-b from-steps-dark to-steps-glow text-white shadow-step-glow'
                      : 'border-page bg-steps-idle text-black'
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`mt-[8px] max-w-[70px] font-ui text-[10px] leading-[1.2] text-black md:max-w-none md:text-[12px] ${
                    active ? 'font-semibold' : 'font-medium'
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
