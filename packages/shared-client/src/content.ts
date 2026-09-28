export interface PromoBanner {
  id: string;
  title: string;
  /** Asset path convention; web serves it from /public. */
  image: string;
  href: string;
}

/**
 * Live homepage banners rotate as two PAIRS, swapping instantly about every 3 s
 * (measured on youmartshop.com). hrefs are the live WooCommerce category URLs.
 */
export const PROMO_BANNER_SLIDES: readonly (readonly [PromoBanner, PromoBanner])[] = [
  [
    {
      id: 'pet-products',
      title: 'Pet Products - 25% off',
      image: '/banners/pet-products.png',
      href: '/product-category/pet-products',
    },
    {
      id: 'sport-gear',
      title: 'Sport Gear - Top-quality equipment for champions',
      image: '/banners/sport-gear.png',
      href: '/product-category/sports-fitness',
    },
  ],
  [
    {
      id: 'kitchen-pro',
      title: 'Kitchen Pro - Smart, efficient, time-saving',
      image: '/banners/kitchen-pro.png',
      href: '/product-category/stainless-steel-vessels',
    },
    {
      id: 'tech-deals',
      title: 'Tech Deals - Fast, reliable, best prices',
      image: '/banners/tech-deals.png',
      href: '/product-category/mobile-accessories',
    },
  ],
];

export const PROMO_ROTATION_MS = 3000;

/** Live DOM text (rendered uppercase via CSS on the welcome marquee). */
export const WELCOME_MESSAGE = 'Welcome to YouMart \u2013 Shop Easy Live Better';
export const SEARCH_PLACEHOLDER = 'Search for Product and Brands.....';
