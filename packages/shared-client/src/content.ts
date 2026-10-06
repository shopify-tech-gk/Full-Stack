import { categoryHref } from './categories';

export interface PromoBanner {
  id: string;
  title: string;
  /** Asset path convention; web serves it from /public. Below 1025px (the live layout). */
  image: string;
  /** Desktop slider: the live youmartshop.com poster (1536x480 WebP). */
  poster: string;
  href: string;
}

/**
 * Live homepage banners rotate as two PAIRS, swapping instantly about every 3 s
 * (measured on youmartshop.com). hrefs point at the same categories as live, on our clean URLs.
 */
export const PROMO_BANNER_SLIDES: readonly (readonly [PromoBanner, PromoBanner])[] = [
  [
    {
      id: 'pet-products',
      title: 'Pet Products - 25% off',
      image: '/banners/pet-products.png',
      poster: '/banners/desktop/pet-products.webp',
      href: categoryHref('pet-products'),
    },
    {
      id: 'sport-gear',
      title: 'Sport Gear - Top-quality equipment for champions',
      image: '/banners/sport-gear.png',
      poster: '/banners/desktop/sport-gear.webp',
      href: categoryHref('sports-fitness'),
    },
  ],
  [
    {
      id: 'kitchen-pro',
      title: 'Kitchen Pro - Smart, efficient, time-saving',
      image: '/banners/kitchen-pro.png',
      poster: '/banners/desktop/kitchen-pro.webp',
      href: categoryHref('stainless-steel-vessels'),
    },
    {
      id: 'tech-deals',
      title: 'Tech Deals - Fast, reliable, best prices',
      image: '/banners/tech-deals.png',
      poster: '/banners/desktop/tech-deals.webp',
      // Live links its mobile-accessories category, which 404s on live too.
      href: categoryHref('electronics', 'mobiles'),
    },
  ],
];

export const PROMO_ROTATION_MS = 3000;
/** Desktop promo slider (redesign): a slower, animated advance than live's instant 3 s swap. */
export const PROMO_SLIDER_INTERVAL_MS = 5500;

/** Live DOM text (rendered uppercase via CSS on the welcome marquee). */
export const WELCOME_MESSAGE = 'Welcome to YouMart \u2013 Shop Easy Live Better';
export const SEARCH_PLACEHOLDER = 'Search for Product and Brands.....';
