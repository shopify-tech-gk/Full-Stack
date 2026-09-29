// DEMO CONTENT ONLY - placeholder products for layout work. Replace with catalog API data.
import type { Money } from './types';
import { STORE_CATEGORIES, categoryHref } from './categories';
import type { ListingBrand, ListingProduct, ProductDetailData } from './catalog';
import {
  PRODUCT_RAIL_TITLES,
  type ProductCardData,
  type ProductFilter,
  type ProductRail,
} from './storefront';

export const DEMO_PRODUCT_IMAGE = '/placeholders/product.svg';

const demoHref = (n: number) => `/product/demo-product-${n}`;

const DEMO_TITLES = [
  'Demo Product Name',
  'Demo Product Name With a Longer Title to Show the Two-Line Clamp',
  'Demo Product',
  'Demo Product Name Two Lines',
] as const;

// [mrp, sellingPrice, rating]; equal prices render the non-sale card.
const DEMO_PRICES: readonly (readonly [Money, Money, number])[] = [
  ['495.00', '495.00', 5],
  ['3795.51', '2803.90', 0],
  ['1861.11', '1474.00', 4],
  ['77.00', '77.00', 5],
  ['1299.00', '999.00', 3.5],
  ['249.00', '249.00', 4.5],
  ['2499.00', '1749.00', 5],
  ['599.00', '449.00', 4],
  ['899.00', '899.00', 0],
  ['159.00', '119.00', 5],
  ['4999.00', '3999.00', 4],
  ['349.00', '349.00', 3],
  ['1199.00', '1079.00', 5],
  ['699.00', '699.00', 4],
  ['2199.00', '1539.00', 4.5],
  ['99.00', '99.00', 5],
];

export const DEMO_PRODUCTS: readonly ProductCardData[] = DEMO_PRICES.map(
  ([mrp, sellingPrice, rating], index) => ({
    id: `demo-${index + 1}`,
    href: demoHref(index + 1),
    title: DEMO_TITLES[index % DEMO_TITLES.length] ?? 'Demo Product',
    image: DEMO_PRODUCT_IMAGE,
    mrp,
    sellingPrice,
    rating,
  }),
);

/** 12 demo cards per grid filter tab. */
export function demoProductsFor(filter: ProductFilter): readonly ProductCardData[] {
  switch (filter) {
    case 'new':
      return DEMO_PRODUCTS.slice(0, 12);
    case 'all':
      return DEMO_PRODUCTS.slice(4, 16);
    case 'sale':
      return DEMO_PRODUCTS.filter((p) => p.mrp !== p.sellingPrice).slice(0, 12);
  }
}

export const DEMO_PRODUCT_RAILS: readonly ProductRail[] = PRODUCT_RAIL_TITLES.map(
  (title, rail) => ({
    title,
    items: [0, 1, 2, 3].map((item) => ({
      id: `rail-${rail + 1}-${item + 1}`,
      href: demoHref(rail * 4 + item + 1),
      title: item % 2 ? 'Demo Product Name With a Long Title' : 'Demo Product',
      image: DEMO_PRODUCT_IMAGE,
    })),
  }),
);

export const DEMO_BRANDS: readonly ListingBrand[] = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map(
  (letter) => ({
    slug: `brand-${letter}`,
    name: `Brand ${letter.toUpperCase()}`,
    logo: '/placeholders/brand-logo.svg',
  }),
);

const LISTING_TITLES = [
  'Demo Product',
  'Demo Product Name With a Longer Title That Gets Cut',
  'Demo Item',
  'Demo Product Name Two Words',
  'Demo Product Long Name For Wrapping Test Case',
] as const;

/** 70 demo listing products: two pages of 56, varied prices/ratings/brands for the filters. */
export const DEMO_LISTING_PRODUCTS: readonly ListingProduct[] = Array.from(
  { length: 70 },
  (_, index) => {
    const n = index + 1;
    const price = ((n * 7919) % 4900) + 12 + (n % 4) * 0.25;
    const onSale = n % 4 === 0;
    const selling = price.toFixed(2) as Money;
    return {
      id: `demo-listing-${n}`,
      href: demoHref(n),
      title: `${LISTING_TITLES[index % LISTING_TITLES.length] ?? 'Demo Product'} ${n}`,
      image: DEMO_PRODUCT_IMAGE,
      mrp: onSale ? ((price * 1.15).toFixed(2) as Money) : selling,
      sellingPrice: selling,
      rating: ((n * 3) % 11) / 2,
      brand: DEMO_BRANDS[index % DEMO_BRANDS.length]?.slug ?? 'brand-a',
    };
  },
);

export const DEMO_GALLERY_IMAGES = [1, 2, 3, 4].map((n) => `/placeholders/gallery-${n}.svg`);

const DEMO_REVIEWS = [
  ['Demo Customer A', '2026-02-17', 5, 'Demo review text - excellent quality.'],
  [
    'Demo Customer B',
    '2026-02-17',
    5,
    'Demo review text - a longer review that wraps onto a second line to show how multi-line reviews look in the list.',
  ],
  ['Demo Customer C', '2026-02-17', 4, 'Demo review text - great value.'],
  ['Demo Customer D', '2026-02-17', 5, 'Demo review text - colour as shown.'],
] as const;

/** Generic demo product for any slug; `demo-product-N` reuses listing product N's card data. */
export function demoProductDetail(slug: string): ProductDetailData {
  const n = Number(/^demo-product-(\d+)$/.exec(slug)?.[1] ?? 1);
  const card = DEMO_LISTING_PRODUCTS[(n - 1) % DEMO_LISTING_PRODUCTS.length];
  const category = STORE_CATEGORIES.find((c) => c.slug === 'cleaning-products');
  const sub = category?.subcategories.find((s) => s.slug === 'mops');
  const leaf = sub?.children.find((c) => c.slug === 'wiper-mops');
  return {
    id: `demo-detail-${n}`,
    slug,
    title: 'Demo Product Name Weight - 35 grams',
    rating: 5,
    shortDescription:
      'Demo short description - one or two lines summarising the product, shown under the rating.',
    description:
      'Demo description - the full product description appears here in the Description tab. It can run over several lines to describe materials, size, usage and care, just like the live product pages do. Replace with the catalog description when real data is wired.',
    mrp: card?.mrp ?? '12.10',
    sellingPrice: card?.sellingPrice ?? '12.10',
    images: DEMO_GALLERY_IMAGES,
    categories: [
      category && { name: category.name, href: categoryHref(category.slug) },
      category && sub && { name: sub.name, href: categoryHref(category.slug, sub.slug) },
      category &&
        sub &&
        leaf && { name: leaf.name, href: categoryHref(category.slug, sub.slug, leaf.slug) },
    ].filter((c): c is { name: string; href: string } => Boolean(c)),
    reviews: DEMO_REVIEWS.map(([author, date, rating, text], i) => ({
      id: `demo-review-${i + 1}`,
      author,
      date,
      rating,
      text,
      verified: true,
    })),
    related: DEMO_LISTING_PRODUCTS.slice(n % 60, (n % 60) + 4),
  };
}
