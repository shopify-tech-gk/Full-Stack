import type { Money } from './types';
import { STORE_CATEGORIES, categoryHref, type StoreSubcategory } from './categories';

/** What a product card renders; the catalog API maps into this when real data is wired. */
export interface ProductCardData {
  id: string;
  href: string;
  title: string;
  image: string;
  mrp: Money;
  sellingPrice: Money;
  /** 0-5; the card fills stars proportionally. */
  rating: number;
}

export interface RailItem {
  id: string;
  href: string;
  title: string;
  image: string;
}

export interface ProductRail {
  title: string;
  items: readonly RailItem[];
}

/** Live rail titles, in order. */
export const PRODUCT_RAIL_TITLES = [
  'Pick up where you left off',
  'Up to 10% off | Trending Products',
  'Top Deals | Up to 20% off',
  'Recommended for You',
  'More Items to Explore',
] as const;

export type ProductFilter = 'new' | 'all' | 'sale';

/** Live grid filter tabs (graphic buttons above the product grid); first is active on load. */
export const PRODUCT_FILTER_TABS: readonly { key: ProductFilter; label: string; image: string }[] =
  [
    { key: 'new', label: 'New Arrival', image: '/placeholders/promo-new-arrival.svg' },
    { key: 'all', label: 'Hot Sale', image: '/placeholders/promo-hot-sale.svg' },
    { key: 'sale', label: 'Best Offer', image: '/placeholders/promo-best-offer.svg' },
  ];

export interface BrandOffer {
  id: string;
  name: string;
  href: string;
  image: string;
  /** Starburst badge, two lines. */
  badge: readonly [string, string];
}

// Offer ranges are live's copy; brand names/logos are placeholders until real assets arrive.
// Live's 7th badge reads "5% OFF / 60%" (lines swapped) - corrected to "5% to 60% / OFF".
const BRAND_BADGES: readonly (readonly [string, string])[] = [
  ['5% to 90%', 'OFF'],
  ['5% to 95%', 'OFF'],
  ['5% to 83%', 'OFF'],
  ['5% to 90%', 'OFF'],
  ['10% to 47%', 'OFF'],
  ['15% to 83%', 'OFF'],
  ['5% to 60%', 'OFF'],
  ['5% to 92%', 'OFF'],
];

export const BRAND_OFFERS: readonly BrandOffer[] = BRAND_BADGES.map((badge, index) => ({
  id: `brand-${index + 1}`,
  name: `Brand ${index + 1}`,
  href: '/shop',
  image: '/placeholders/brand.svg',
  badge,
}));

export interface FeatureCard {
  id: 'expertise' | 'quality' | 'guarantee';
  title: string;
  text: string;
}

/** Live site copy. */
export const FEATURE_CARDS: readonly FeatureCard[] = [
  {
    id: 'expertise',
    title: 'Expertise',
    text: 'Expert solutions for your shopping and shipping needs.',
  },
  { id: 'quality', title: 'Quality', text: 'Top-quality products for your satisfaction.' },
  { id: 'guarantee', title: 'Guarantee', text: 'Satisfaction guaranteed with every purchase.' },
];

export const BEST_CATEGORIES_SLUG = 'fashion-jewellery';
export const BEST_CATEGORIES_IMAGE = '/placeholders/category-card.svg';

/** Live shows the first nine subcategories alphabetically. */
export function bestCategories(
  categories = STORE_CATEGORIES,
  slug = BEST_CATEGORIES_SLUG,
): { title: string; items: readonly (StoreSubcategory & { href: string })[] } | null {
  const category = categories.find((c) => c.slug === slug);
  if (!category) {
    return null;
  }
  const items = [...category.subcategories]
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 9)
    .map((sub) => ({ ...sub, href: categoryHref(category.slug, sub.slug) }));
  return { title: `Best Categories Today \u2014 ${category.name}`, items };
}

export interface FooterLink {
  label: string;
  href: string;
}

/** Live footer copy and links (clean routes; live's WordPress paths redirect to these). */
export const FOOTER = {
  about: {
    heading: 'About us',
    /** `brand` renders bold. */
    lead: 'Welcome to',
    brand: 'You Mart',
    rest: ', your one-stop online shopping destination for everything you need! Inspired by the convenience and variety offered by leading e-commerce platforms.',
  },
  quickLinks: {
    heading: 'Quick links',
    links: [
      { label: 'Home', href: '/' },
      { label: 'About', href: '/about' },
      { label: 'Shop', href: '/shop' },
      { label: 'Contact', href: '/contact' },
      { label: 'Order Track', href: '/order-track' },
      { label: 'Order Cancel', href: '/order-cancel' },
      { label: 'Order Notify', href: '/order-notify' },
    ] satisfies FooterLink[],
  },
  policy: {
    heading: 'Consumer policy',
    links: [
      { label: 'Privacy Policy', href: '/privacy-policy' },
      { label: 'Terms & Conditions', href: '/terms' },
      { label: 'Refund Policy', href: '/refund-policy' },
      { label: 'Offers and Coupons', href: '/offers' },
      { label: 'Shipping Details', href: '/shipping' },
    ] satisfies FooterLink[],
  },
  mail: {
    heading: 'Mail us:',
    email: 'info@youmart.in',
  },
  social: {
    heading: 'Social:',
    links: [
      {
        id: 'youtube',
        label: 'YouTube',
        href: 'https://www.youtube.com/channel/UCDqptzz_WgUrVb22_rQr6VA',
      },
      {
        id: 'facebook',
        label: 'Facebook',
        href: 'https://www.facebook.com/profile.php?id=61571118823834',
      },
      { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/youmart21/' },
      {
        id: 'share',
        label: 'Share on WhatsApp',
        href: 'https://api.whatsapp.com/send?text=Shop%20Online:%20https://youmartshop.com/',
      },
    ] as const,
  },
  office: {
    heading: 'Registered office address:',
    address: 'OLD NO.251, NEW NO. 162, THAMBU CHETTY STREET, CHENNAI-600 001',
    phoneLabel: 'Call: +91 99445 57815',
    phoneHref: 'tel:+919944557815',
  },
  bottomLinks: [
    { id: 'shop', label: 'Shop', href: '/shop' },
    { id: 'account', label: 'My Account', href: '/my-account' },
    { id: 'cart', label: 'Cart', href: '/cart' },
    { id: 'faq', label: 'FAQ', href: '/faq' },
  ] as const,
  copyrightSite: 'youmart.in',
  payments: ['Mastercard', 'Visa', 'Apple Pay', 'Google Pay'] as const,
} as const;
