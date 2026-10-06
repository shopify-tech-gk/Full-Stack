import type { FeatureCard } from '@youmart/shared-client';
import { FaGem, FaLightbulb, FaShieldAlt } from '@/components/ui/FaIcons';

const STYLE: Record<
  FeatureCard['id'],
  { icon: typeof FaGem; card: string; glow: string; chip: string }
> = {
  // Live puts white text on #fee533 (~1.2:1 contrast, unreadable); dark text is the flagged fix.
  expertise: {
    icon: FaLightbulb,
    card: 'bg-feature-expertise text-heading',
    glow: 'shadow-[0_14px_30px_-14px_rgba(254,229,51,0.9)]',
    chip: 'bg-white/60 ring-heading/10 text-heading',
  },
  quality: {
    icon: FaGem,
    card: 'bg-feature-quality text-white',
    glow: 'shadow-[0_14px_30px_-14px_rgba(2,76,170,0.75)]',
    chip: 'bg-white/15 ring-white/25 text-white',
  },
  guarantee: {
    icon: FaShieldAlt,
    card: 'bg-feature-guarantee text-white',
    glow: 'shadow-[0_14px_30px_-14px_rgba(40,180,99,0.8)]',
    chip: 'bg-white/15 ring-white/25 text-white',
  },
};

interface FeatureCardsProps {
  cards: readonly FeatureCard[];
}

// Below 1025px: live's three flat cards, unchanged. Desktop: the same three (colours, icons, copy)
// as premium cards.
export function FeatureCards({ cards }: FeatureCardsProps) {
  return (
    <section aria-label="Why shop with us" className="px-[20px] pt-[30px] lg:px-[12px]">
      <ul className="grid gap-[5px] p-[10px] md:grid-cols-3 md:gap-0 lg:hidden">
        {cards.map((card) => {
          const { icon: Icon, card: tone } = STYLE[card.id];
          return (
            <li key={card.id} className="md:pr-[10px]">
              <div
                className={`flex h-full flex-col gap-[15px] rounded-feature-card p-[10px] text-center md:flex-row md:items-start md:text-left ${tone}`}
              >
                <span className="flex justify-center md:h-[40px] md:items-center">
                  <Icon className="size-[32px] md:size-[24px]" />
                </span>
                <div>
                  <h3 className="mb-[20px] font-ui text-[20px] font-semibold leading-[26px]">
                    {card.title}
                  </h3>
                  <p className="font-ui text-[14.6px] leading-[23.35px] lg:text-[16px] lg:leading-[25.6px]">
                    {card.text}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ul className="mx-auto hidden max-w-[1440px] grid-cols-3 gap-[18px] pb-[10px] lg:grid">
        {cards.map((card) => {
          const { icon: Icon, card: tone, glow, chip } = STYLE[card.id];
          return (
            <li
              key={card.id}
              className={`group/feature relative overflow-hidden rounded-[22px] ${tone} ${glow} transition-transform duration-300 hover:-translate-y-[4px] motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/15"
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -right-[60px] -top-[70px] size-[200px] rounded-full bg-white/10"
              />
              <Icon className="pointer-events-none absolute -bottom-[26px] right-[18px] size-[120px] opacity-[0.12] transition-transform duration-500 group-hover/feature:-rotate-6 group-hover/feature:scale-110 motion-reduce:transition-none" />
              <div className="relative flex items-start gap-[18px] py-[24px] pl-[26px] pr-[96px]">
                <span
                  className={`flex size-[56px] shrink-0 items-center justify-center rounded-[18px] ring-1 backdrop-blur-sm ${chip}`}
                >
                  <Icon className="size-[26px]" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-ui text-[22px] font-bold leading-[1.2]">{card.title}</h3>
                  <span
                    aria-hidden="true"
                    className="mt-[8px] block h-[3px] w-[34px] rounded-full bg-current opacity-50 transition-[width] duration-300 group-hover/feature:w-[56px] motion-reduce:transition-none"
                  />
                  <p className="mt-[10px] font-ui text-[15px] leading-[1.6] opacity-90">
                    {card.text}
                  </p>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
