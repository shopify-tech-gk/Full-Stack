// Where each "Target Name" in a product JSON (scripts/import-products-json.mjs) goes in the catalog,
// which filters its listing offers (W3 filter definition - docs/catalog/IMPORT-SPEC.md §2), and how
// to derive the filterable attributes from each product's title / description. Add one entry per
// new category delivery - the importer itself stays the same.
//
// `chain`: catalog categories from the root down to the target, as [slug, name]. Slugs match the
// storefront tree (packages/shared-client/src/categories.ts) so the app's category menu links to
// them. `filters`: Brand first, then what Amazon / Flipkart offer for this kind of product (price,
// rating and discount are universal / generic). `derive(product, text)` adds category-specific
// attributes; `text` is the lower-cased title + start of the description.

/** First rule whose keywords appear in `text` wins. */
function firstMatch(text, rules, fallback = null) {
  for (const [value, words] of rules) if (words.some((w) => text.includes(w))) return value;
  return fallback;
}

/** Filters for garden fertilizer / soil-care categories (Compost, Organic Manure...). */
const FERTILIZER_FILTERS = [
  { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
  { key: 'product_type', label: 'Product Type', type: 'multi_select', order: 2 },
  { key: 'weight_band', label: 'Pack Weight', type: 'multi_select', order: 3 },
  { key: 'form', label: 'Item Form', type: 'multi_select', order: 4 },
  { key: 'organic', label: 'Organic', type: 'boolean', order: 5 },
  { key: 'discount_band', label: 'Discount', type: 'multi_select', order: 6 },
  { key: 'color', label: 'Colour', type: 'multi_select', order: 7 },
];

/** Not sold by weight / not a fertilizer: no pack-weight band or item form for them. */
const NON_FERTILIZER = new Set(['Composters & Bins', 'Garden Tool Kits']);

/** product_type / form / organic for fertilizer-like products, from the title + description. */
function deriveFertilizer(_product, text) {
  const type = firstMatch(
    text,
    [
      [
        'Garden Tool Kits',
        [
          'tool set',
          'tool kit',
          'tools set',
          'trowel',
          'khurpi',
          'cultivator',
          'weeder',
          'pruner',
          'gardening kit',
        ],
      ],
      [
        'Composters & Bins',
        [
          'composter',
          'compost bin',
          'bokashi',
          'composting bin',
          'compost maker',
          'khamba',
          'tumbler',
          'trash bin',
          'dustbin',
        ],
      ],
      [
        'Compost Accelerator',
        [
          'accelerator',
          'decomposer',
          'compost culture',
          'microb',
          'enzyme',
          'activator',
          'bio culture',
        ],
      ],
      ['Vermicompost', ['vermicompost', 'vermi compost', 'vermi-compost', 'vermi']],
      ['Cow Dung Manure', ['cow dung', 'cowdung', 'gobar']],
      ['Neem Cake', ['neem cake', 'neem khali', 'neem']],
      ['Bone Meal', ['bone meal']],
      ['Seaweed', ['seaweed']],
      ['Cocopeat', ['cocopeat', 'coco peat', 'coir']],
      ['Potting Mix', ['potting mix', 'potting soil', 'soil mix', 'garden soil', 'perlite']],
      ['Mustard Cake', ['mustard cake']],
      ['Plant Booster', ['booster', 'growth promoter', 'humic', 'fulvic']],
      ['Organic Compost', ['compost']],
      ['Organic Manure', ['manure']],
    ],
    'Plant Food & Fertilizer',
  );
  const out = { product_type: type, ...(NON_FERTILIZER.has(type) ? { weight_band: null } : {}) };
  if (!NON_FERTILIZER.has(type)) {
    out.form = /\bliquid\b|\d+\s?ml\b|\blit(re|er)s?\b/.test(text)
      ? 'Liquid'
      : /granul|pellet/.test(text)
        ? 'Granules'
        : /powder/.test(text)
          ? 'Powder'
          : /stick/.test(text)
            ? 'Sticks'
            : 'Solid';
  }
  if (/organic|natural/.test(text)) out.organic = true;
  return out;
}

export const TARGETS = {
  Compost: {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['fertilizer', 'Fertilizer'],
      ['compost', 'Compost'],
    ],
    filters: FERTILIZER_FILTERS,
    derive: deriveFertilizer,
  },
  'Organic Manure': {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['fertilizer', 'Fertilizer'],
      ['organic-manure', 'Organic Manure'],
    ],
    filters: FERTILIZER_FILTERS,
    derive: deriveFertilizer,
  },
};
