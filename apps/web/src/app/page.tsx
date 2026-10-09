import { BRAND_OFFERS, EXPLORE_FEATURES, FEATURE_CARDS } from '@youmart/shared-client';
import { BestCategoriesCarousel } from '@/components/home/BestCategoriesCarousel';
import { BestCategoriesShowcase } from '@/components/home/BestCategoriesShowcase';
import { BrandStrip } from '@/components/home/BrandStrip';
import { CategoryMegaMenu } from '@/components/home/CategoryMegaMenu';
import { ExploreCategories } from '@/components/home/ExploreCategories';
import { ExploreFeatureStrip } from '@/components/home/ExploreFeatureStrip';
import { FeatureCards } from '@/components/home/FeatureCards';
import { ProductRails } from '@/components/home/ProductRails';
import { ProductRailSliders } from '@/components/home/ProductRailSliders';
import { ProductShowcase } from '@/components/home/ProductShowcase';
import { PromoBanners } from '@/components/home/PromoBanners';
import { PromoSlider } from '@/components/home/PromoSlider';
import { getHomeProducts } from '@/lib/catalog';
import { storeCategories } from '@/lib/categories';
import { exploreCategories, taxonomyBestSlides } from '@/lib/category-taxonomy';

export default async function HomePage() {
  const bestSlides = taxonomyBestSlides();
  const featured = bestSlides[0];
  const { rails, sliders, showcase } = await getHomeProducts();

  return (
    // Live order: banners above the category grid below 1025px; category strip first on desktop.
    <div className="flex flex-col">
      <div className="order-2 mt-[27px] lg:order-1 lg:mt-0">
        {/* Below 1025px: the live category grid, unchanged. Desktop: the redesigned section. */}
        <CategoryMegaMenu categories={storeCategories} />
        <ExploreCategories mains={exploreCategories()} />
        <ExploreFeatureStrip features={EXPLORE_FEATURES} />
      </div>
      <div className="order-1 lg:order-2">
        {/* Below 1025px: live's banner pairs, unchanged. Desktop: the redesigned slider. */}
        <PromoBanners />
        <PromoSlider />
      </div>

      <div className="order-3">
        {rails.length > 0 && <ProductRails rails={rails} />}
        <ProductRailSliders rails={sliders} />
        <BrandStrip brands={BRAND_OFFERS} />
        <ProductShowcase productsFor={showcase} />
        {featured && (
          <BestCategoriesCarousel
            title={`Best Categories Today \u2014 ${featured.name}`}
            items={featured.items}
          />
        )}
        <BestCategoriesShowcase slides={bestSlides} />
        <FeatureCards cards={FEATURE_CARDS} />
      </div>
    </div>
  );
}
