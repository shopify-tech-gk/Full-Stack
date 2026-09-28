import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { PromoBanners } from '@/components/home/PromoBanners';
import { storeCategories } from '@/lib/categories';

export default function HomePage() {
  return (
    // Mobile shows the banners above the category grid; desktop shows categories first.
    <div className="flex flex-col bg-sky-tint lg:bg-white">
      <div className="order-2 lg:order-1">
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
