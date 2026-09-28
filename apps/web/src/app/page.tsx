import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { PromoBanners } from '@/components/home/PromoBanners';
import { storeCategories } from '@/lib/categories';

export default function HomePage() {
  return (
    // Live order: banners above the category grid below 1025px; category strip first on desktop.
    <div className="flex flex-col">
      <div className="order-2 mt-[27px] lg:order-1 lg:mt-0">
        <CategoryMegaMenu categories={storeCategories} />
      </div>
      <div className="order-1 lg:order-2">
        <PromoBanners />
      </div>

      {/*
        NEXT PROMPT: homepage product rows go here, fed by the live catalog/search API -
        "Pick up where you left off", "Trending Products", "Top Deals | Up to 20% off",
        "Recommended for You", "More Items to Explore", etc.
      */}
    </div>
  );
}
