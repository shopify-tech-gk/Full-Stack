import type { FeatureCard } from '@youmart/shared-client';
import { FaGem, FaLightbulb, FaShieldAlt } from '@/components/ui/FaIcons';

const STYLE: Record<FeatureCard['id'], { icon: typeof FaGem; card: string }> = {
  // Live puts white text on #fee533 (~1.2:1 contrast, unreadable); dark text is the flagged fix.
  expertise: { icon: FaLightbulb, card: 'bg-feature-expertise text-heading' },
  quality: { icon: FaGem, card: 'bg-feature-quality text-white' },
  guarantee: { icon: FaShieldAlt, card: 'bg-feature-guarantee text-white' },
};

interface FeatureCardsProps {
  cards: readonly FeatureCard[];
}

export function FeatureCards({ cards }: FeatureCardsProps) {
  return (
    <section aria-label="Why shop with us" className="px-[20px] pt-[30px]">
      <ul className="grid gap-[5px] p-[10px] md:grid-cols-3 md:gap-0">
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
    </section>
  );
}
