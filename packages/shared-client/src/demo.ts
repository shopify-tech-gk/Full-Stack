// DEMO CONTENT ONLY - placeholder products behind the demo cart (demo-cart.ts) until the cart API
// is wired. The catalog pages use the real catalog API since W3.
import type { Money } from './types';
import type { ProductCardData } from './storefront';

/** Also the storefront's fallback image for a product without one. */
export const DEMO_PRODUCT_IMAGE = '/placeholders/product.svg';

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
    href: `/product/demo-product-${index + 1}`,
    title: DEMO_TITLES[index % DEMO_TITLES.length] ?? 'Demo Product',
    image: DEMO_PRODUCT_IMAGE,
    mrp,
    sellingPrice,
    rating,
  }),
);
