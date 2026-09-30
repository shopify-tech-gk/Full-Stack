import {
  BEST_CATEGORIES_IMAGE,
  BRAND_OFFERS,
  FEATURE_CARDS,
  bestCategories,
} from '@youmart/shared-client';
import { BestCategoriesCarousel } from '@/components/home/BestCategoriesCarousel';
import { BrandStrip } from '@/components/home/BrandStrip';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { FeatureCards } from '@/components/home/FeatureCards';
import { ProductRails } from '@/components/home/ProductRails';
import { ProductShowcase } from '@/components/home/ProductShowcase';
import { PromoBanners } from '@/components/home/PromoBanners';
import { getHomeProducts } from '@/lib/catalog';
import { storeCategories } from '@/lib/categories';

export default async function HomePage() {
  const best = bestCategories(storeCategories);
  const { rails, showcase } = await getHomeProducts();

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
        {rails.length > 0 && <ProductRails rails={rails} />}
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
