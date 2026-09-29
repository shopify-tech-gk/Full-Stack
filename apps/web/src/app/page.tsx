import {
  BEST_CATEGORIES_IMAGE,
  BRAND_OFFERS,
  DEMO_PRODUCT_RAILS,
  FEATURE_CARDS,
  bestCategories,
  demoProductsFor,
} from '@youmart/shared-client';
import { BestCategoriesCarousel } from '@/components/home/BestCategoriesCarousel';
import { BrandStrip } from '@/components/home/BrandStrip';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { FeatureCards } from '@/components/home/FeatureCards';
import { ProductRails } from '@/components/home/ProductRails';
import { ProductShowcase } from '@/components/home/ProductShowcase';
import { PromoBanners } from '@/components/home/PromoBanners';
import { storeCategories } from '@/lib/categories';

// DEMO content below the category grid until the catalog API is wired.
const showcase = {
  new: demoProductsFor('new'),
  all: demoProductsFor('all'),
  sale: demoProductsFor('sale'),
};

export default function HomePage() {
  const best = bestCategories(storeCategories);

  return (
    // Live order: banners above the category grid below 1025px; category strip first on desktop.
    <div className="flex flex-col">
      <div className="order-2 mt-[27px] lg:order-1 lg:mt-0">
        <CategoryMegaMenu categories={storeCategories} />
      </div>
      <div className="order-1 lg:order-2">
        <PromoBanners />
      </div>

      <div className="order-3">
        <ProductRails rails={DEMO_PRODUCT_RAILS} />
        <BrandStrip brands={BRAND_OFFERS} />
        <ProductShowcase productsFor={showcase} />
        {best && (
          <BestCategoriesCarousel
            title={best.title}
            image={BEST_CATEGORIES_IMAGE}
            items={best.items}
          />
        )}
        <FeatureCards cards={FEATURE_CARDS} />
      </div>
    </div>
  );
}
