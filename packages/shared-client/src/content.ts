export interface PromoBanner {
  id: string;
  title: string;
  /** Asset path convention; web serves it from /public. */
  image: string;
  href: string;
}

// Homepage promo banners in site order. hrefs are placeholders until campaign pages exist.
export const PROMO_BANNERS: readonly PromoBanner[] = [
  {
    id: 'pet-products',
    title: 'Pet Products - 25% off',
    image: '/banners/pet-products.png',
    href: '/product-category/pet-supplies',
  },
  {
    id: 'sport-gear',
    title: 'Sport Gear - Top-quality equipment for champions',
    image: '/banners/sport-gear.png',
    href: '/product-category/sports-fitness',
  },
  {
    id: 'kitchen-pro',
    title: 'Kitchen Pro - Smart, efficient, time-saving',
    image: '/banners/kitchen-pro.png',
    href: '/product-category/kitchenware',
  },
  {
    id: 'tech-deals',
    title: 'Tech Deals - Fast, reliable, best prices',
    image: '/banners/tech-deals.png',
    href: '/product-category/electronics',
  },
];

export const WELCOME_MESSAGE = 'WELCOME TO YOUMART \u2013 SHOP EASY LIVE BETTER';
export const SEARCH_PLACEHOLDER = 'Search for Product and Brands.....';
