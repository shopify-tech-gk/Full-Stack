import type { ApiCategory } from './types';

export interface StoreSubcategory {
  slug: string;
  name: string;
}

export interface StoreCategory {
  slug: string;
  name: string;
  /** `site` = copied from youmartshop.com; `placeholder` = stand-in until the real list is supplied. */
  subcategoriesSource: 'site' | 'placeholder';
  subcategories: StoreSubcategory[];
}

function subs(...names: string[]): StoreSubcategory[] {
  return names.map((name) => ({ name, slug: slugify(name) }));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * The homepage category strip, in the exact order shown on youmartshop.com.
 * Slugs match the old WooCommerce `/product-category/<slug>/` URLs so links keep working.
 */
export const STORE_CATEGORIES: readonly StoreCategory[] = [
  {
    slug: 'agri-and-gardening',
    name: 'Agri and Gardening',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Garden Tools', 'Planters & Pots', 'Seeds', 'Sprayers', 'Watering Cans'),
  },
  {
    slug: 'arts-and-crafts',
    name: 'Arts and Crafts',
    subcategoriesSource: 'site',
    subcategories: subs(
      'Art Sets',
      'Beads',
      'Boards',
      'Card Stocks',
      'Clay',
      'Coloured Paper',
      'Craft Kits',
      'Drawing Materials',
      'Magnets',
      'Painting Craft Kits',
      'Painting Materials',
      'Paper',
      'Paper Craft',
    ),
  },
  {
    slug: 'artificial-flowers-and-plants',
    name: 'Artificial Flowers and Plants',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Artificial Flowers', 'Artificial Plants', 'Bouquets', 'Hanging Plants'),
  },
  {
    slug: 'auto-accessories',
    name: 'Auto Accessories',
    subcategoriesSource: 'placeholder',
    subcategories: subs(
      'Car Care',
      'Car Covers',
      'Mobile Holders',
      'Seat Covers',
      'Bike Accessories',
    ),
  },
  {
    slug: 'baby-care',
    name: 'Baby Care',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Baby Bottles', 'Baby Toys', 'Bath & Skin Care', 'Diapers', 'Feeding'),
  },
  {
    slug: 'bath-fittings',
    name: 'Bath Fittings',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Bathroom Shelves', 'Shower Heads', 'Taps', 'Towel Holders'),
  },
  {
    slug: 'cleaning-products',
    name: 'Cleaning Products',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Brooms & Mops', 'Cleaning Cloths', 'Dustbins', 'Scrubbers'),
  },
  {
    slug: 'cosmetics',
    name: 'Cosmetics',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Face', 'Eyes', 'Lips', 'Nails', 'Makeup Tools'),
  },
  {
    slug: 'crockery',
    name: 'Crockery',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Bowls', 'Cups & Mugs', 'Dinner Sets', 'Plates', 'Serveware'),
  },
  {
    slug: 'disposable-items',
    name: 'Disposable Items',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Disposable Cups', 'Disposable Plates', 'Foil & Wraps', 'Tissues'),
  },
  {
    slug: 'electronics',
    name: 'Electronics',
    subcategoriesSource: 'placeholder',
    subcategories: subs(
      'Chargers & Cables',
      'Earphones',
      'Power Banks',
      'Speakers',
      'Smart Watches',
    ),
  },
  {
    slug: 'electrical-and-lights',
    name: 'Electrical and Lights',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Decorative Lights', 'Extension Boards', 'LED Bulbs', 'Switches'),
  },
  {
    slug: 'furniture',
    name: 'Furniture',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Chairs', 'Racks & Shelves', 'Stools', 'Tables'),
  },
  {
    slug: 'fashion-jewellery',
    name: 'Fashion Jewellery',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Bangles', 'Earrings', 'Necklaces', 'Rings', 'Hair Accessories'),
  },
  {
    slug: 'footwear',
    name: 'Footwear',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Men', 'Women', 'Kids', 'Slippers', 'Sports Shoes'),
  },
  {
    slug: 'gifts-frames',
    name: 'Gifts & Frames',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Gift Sets', 'Photo Frames', 'Showpieces', 'Soft Toys'),
  },
  {
    slug: 'hardware',
    name: 'Hardware',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Door Fittings', 'Fasteners', 'Hooks & Hangers', 'Locks'),
  },
  {
    slug: 'home-appliances',
    name: 'Home Appliances',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Fans', 'Irons', 'Kitchen Appliances', 'Mixers & Grinders'),
  },
  {
    slug: 'home-furnishing',
    name: 'Home Furnishing',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Bedsheets', 'Curtains', 'Cushion Covers', 'Doormats', 'Table Covers'),
  },
  {
    slug: 'kitchenware',
    name: 'Kitchenware',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Cookware', 'Kitchen Tools', 'Storage Containers', 'Water Bottles'),
  },
  {
    slug: 'musical-instruments',
    name: 'Musical Instruments',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Guitars', 'Keyboards', 'Percussion', 'Accessories'),
  },
  {
    slug: 'party-decorations',
    name: 'Party Decorations',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Balloons', 'Banners', 'Birthday Decor', 'Candles', 'Party Props'),
  },
  {
    slug: 'pet-supplies',
    name: 'Pet Supplies',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Pet Bowls', 'Pet Grooming', 'Pet Toys', 'Collars & Leashes'),
  },
  {
    slug: 'plastic-household',
    name: 'Plastic Household',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Baskets', 'Buckets & Mugs', 'Containers', 'Hangers'),
  },
  {
    slug: 'sports-fitness',
    name: 'Sports & Fitness',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Cricket', 'Badminton', 'Fitness Equipment', 'Yoga Mats'),
  },
  {
    slug: 'stationary',
    name: 'Stationary',
    subcategoriesSource: 'site',
    subcategories: subs(
      'A3 & A4 Drawing Note',
      'A4 White Paper',
      'Acrylic Paint',
      'Calculator',
      'Pen',
      'Pencil',
      'Eraser',
    ),
  },
  {
    slug: 'surgical-instruments',
    name: 'Surgical Instruments',
    subcategoriesSource: 'placeholder',
    subcategories: subs('BP Monitors', 'First Aid', 'Thermometers', 'Supports & Braces'),
  },
  {
    slug: 'tailoring-materials',
    name: 'Tailoring Materials',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Buttons', 'Needles', 'Scissors', 'Threads', 'Measuring Tapes'),
  },
  {
    slug: 'tools',
    name: 'Tools',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Hand Tools', 'Power Tools', 'Tool Kits', 'Measuring Tools'),
  },
  {
    slug: 'toys-games',
    name: 'Toys & Games',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Board Games', 'Educational Toys', 'Puzzles', 'Remote Control Toys'),
  },
  {
    slug: 'travel-accessories',
    name: 'Travel & Accessories',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Backpacks', 'Luggage', 'Travel Organisers', 'Travel Pillows'),
  },
  {
    slug: 'wall-clock-watches',
    name: 'Wall Clock & Watches',
    subcategoriesSource: 'placeholder',
    subcategories: subs('Wall Clocks', 'Table Clocks', 'Wrist Watches'),
  },
];

export function categoryHref(categorySlug: string): string {
  return `/product-category/${categorySlug}`;
}

export function subcategoryHref(categorySlug: string, subcategorySlug: string): string {
  return `/product-category/${categorySlug}/${subcategorySlug}`;
}

/** Asset path convention; the platform decides how to load it (web: /public, mobile: bundled). */
export function categoryImagePath(categorySlug: string): string {
  return `/categories/${categorySlug}.png`;
}

export const SUBCATEGORY_PLACEHOLDER_IMAGE = '/categories/subcategory-placeholder.png';

/**
 * Builds the category tree from `GET /api/catalog/categories` (flat list with `parentId`).
 * Top-level categories keep API order; children become subcategories.
 */
export function buildCategoryTree(items: readonly ApiCategory[]): StoreCategory[] {
  const roots = items.filter((c) => c.parentId === null);
  return roots.map((root) => ({
    slug: root.slug,
    name: root.name,
    subcategoriesSource: 'site' as const,
    subcategories: items
      .filter((c) => c.parentId === root.id)
      .map((c) => ({ slug: c.slug, name: c.name })),
  }));
}

/**
 * Uses the live catalog tree only once it actually carries the storefront categories
 * (at least as many roots as the static list); until then the static list is authoritative.
 */
export function resolveStoreCategories(
  apiItems?: readonly ApiCategory[],
): readonly StoreCategory[] {
  if (!apiItems) {
    return STORE_CATEGORIES;
  }
  const tree = buildCategoryTree(apiItems);
  return tree.length >= STORE_CATEGORIES.length ? tree : STORE_CATEGORIES;
}
