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
      ['Urea', ['urea']],
      ['DAP', ['dap ', 'diammonium', 'di-ammonium']],
      ['Potash', ['potash', 'mop ', 'potassium chloride']],
      [
        'Micronutrients',
        [
          'micronutrient',
          'micro nutrient',
          'zinc',
          'boron',
          'magnesium sulphate',
          'epsom',
          'calcium nitrate',
          'ferrous',
        ],
      ],
      ['NPK Fertilizer', ['npk', '19:19:19', '19-19-19', '20:20:20', 'n:p:k']],
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

/** Filters for garden decor categories (Garden Statues...): what the piece is and what it's made of. */
const DECOR_FILTERS = [
  { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
  { key: 'product_type', label: 'Statue Type', type: 'multi_select', order: 2 },
  { key: 'material', label: 'Material', type: 'multi_select', order: 3 },
  { key: 'color', label: 'Colour', type: 'multi_select', order: 4 },
  { key: 'solar', label: 'Solar Light', type: 'boolean', order: 5 },
  { key: 'hanging', label: 'Hanging', type: 'boolean', order: 6 },
  { key: 'discount_band', label: 'Discount', type: 'multi_select', order: 7 },
];

/** product_type / material / solar / hanging for garden decor, from the title + description. */
function deriveDecor(_product, text) {
  const title = text.slice(0, 160);
  const out = {
    weight_band: null,
    product_type: firstMatch(
      title,
      [
        ['Solar Lights', ['solar pathway', 'landscape light', 'lantern']],
        ['Planters & Stands', ['planter', 'pot hugger', 'plant stand', 'flower pot']],
        ['Buddha & Monks', ['buddha', 'monks']],
        ['God Idols', ['ganesh', 'ganpati', 'idol', 'murti']],
        ['Angels & Fairies', ['angel', 'fairy', 'fairies']],
        ['Gnomes', ['gnome']],
        ['Garden Stakes', ['stake', 'fence decoration']],
        [
          'Birds',
          [
            'bird',
            'parrot',
            'sparrow',
            'owl',
            'flamingo',
            'duck',
            'swan',
            'hen',
            'rooster',
            'pigeon',
            'heron',
            'crane',
          ],
        ],
        [
          'Animals',
          [
            'rabbit',
            'bunny',
            'frog',
            'turtle',
            'tortoise',
            'monkey',
            'squirrel',
            'deer',
            'fawn',
            'sheep',
            'puppy',
            'dog',
            'beagle',
            'cat',
            'elephant',
            'lion',
            'panda',
            'koala',
            'mushroom',
          ],
        ],
        ['Human Figures', ['girl', 'lady', 'couple', 'fisherman', 'yoga']],
        ['Miniatures', ['miniature', 'cottage', 'bench']],
      ],
      'Garden Ornaments',
    ),
  };
  out.material = firstMatch(
    title,
    [
      ['Brass', ['brass']],
      ['Fiberglass', ['fiberglass', 'fibreglass']],
      ['Stainless Steel', ['stainless']],
      ['Metal', ['metal', 'iron']],
      ['Stone', ['stone', 'rock']],
      ['Glass', ['glass']],
      ['Acrylic', ['acrylic']],
      ['PVC / Plastic', ['pvc', 'plastic']],
      ['Ceramic', ['ceramic', 'porcelain']],
      ['Resin', ['resin', 'polyresin', 'poly resin']],
    ],
    /resin/.test(text) ? 'Resin' : null,
  );
  if (/solar/.test(text)) out.solar = true;
  if (/hanging|on rope|swing|hammock|climbing/.test(title)) out.hanging = true;
  return out;
}

/** Filters for bird baths & feeders: what it is, what it's made of, solar or not. */
const BIRD_BATH_FILTERS = [
  { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
  { key: 'product_type', label: 'Type', type: 'multi_select', order: 2 },
  { key: 'material', label: 'Material', type: 'multi_select', order: 3 },
  { key: 'color', label: 'Colour', type: 'multi_select', order: 4 },
  { key: 'solar', label: 'Solar Powered', type: 'boolean', order: 5 },
  { key: 'discount_band', label: 'Discount', type: 'multi_select', order: 6 },
];

/** product_type / material / solar for bird baths, feeders, nests and fountains. */
function deriveBirdBath(_product, text) {
  const title = text.slice(0, 160);
  const out = {
    weight_band: null,
    product_type: firstMatch(
      title,
      [
        [
          'Bird Care & Supplements',
          [
            'supplement',
            'vitamin',
            'tonic',
            'amino',
            'cuttle',
            'anti-tick',
            'waterless',
            'dry bath',
          ],
        ],
        ['Solar Fountains', ['solar', 'fountain pump', 'water fountain']],
        ['Bird Nests & Houses', ['nest', 'bird house', 'birdhouse']],
        [
          'Garden Bird Baths',
          [
            'outdoor bird bath',
            'polyresin',
            'pedestal',
            'deck mounted',
            'statue',
            'support stand',
            '28-inch',
            '30-inch',
          ],
        ],
        [
          'Cage Bird Baths',
          [
            'cage',
            'bath box',
            'bath tub',
            'bathtub',
            'bathing box',
            'parrot shower',
            'bath fountain for small',
            'parakeet',
            'budgie',
          ],
        ],
        [
          'Feeder & Bath Sets',
          [
            'feeder and',
            'feeder &',
            'bath set',
            'water feeder',
            'feeding station',
            'bath tray',
            'water bowl',
            'waterer',
          ],
        ],
        ['Bird Feeders & Bowls', ['feeder', 'bowl', 'cup']],
        ['Planters', ['planter']],
      ],
      'Bird Baths',
    ),
  };
  const materials = [
    ['Clay / Terracotta', ['terracotta', 'clay', 'earthen']],
    ['Stainless Steel', ['stainless']],
    ['Metal', ['metal', 'iron']],
    ['Wood', ['wood', 'bamboo']],
    ['Coir', ['coir', 'coconut shell']],
    ['Polyresin', ['resin']],
    ['Acrylic', ['acrylic', 'transparent', 'clear']],
    ['Plastic', ['plastic']],
  ];
  out.material = firstMatch(title, materials) ?? firstMatch(text, materials);
  if (/solar/.test(text)) out.solar = true;
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
  'Organic Fertilizers': {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['fertilizer', 'Fertilizer'],
      ['organic-fertilizers', 'Organic Fertilizers'],
    ],
    filters: FERTILIZER_FILTERS,
    derive: deriveFertilizer,
  },
  Vermicompost: {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['fertilizer', 'Fertilizer'],
      ['vermicompost', 'Vermicompost'],
    ],
    filters: FERTILIZER_FILTERS,
    derive: deriveFertilizer,
  },
  'Garden Statues': {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['garden-decor', 'Garden Decor'],
      ['garden-statues', 'Garden Statues'],
    ],
    filters: DECOR_FILTERS,
    derive: deriveDecor,
  },
  'NPK Fertilizers': {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['fertilizer', 'Fertilizer'],
      ['npk-fertilizers', 'NPK Fertilizers'],
    ],
    filters: FERTILIZER_FILTERS,
    derive: deriveFertilizer,
  },
  'Liquid Fertilizers': {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['fertilizer', 'Fertilizer'],
      ['liquid-fertilizers', 'Liquid Fertilizers'],
    ],
    filters: FERTILIZER_FILTERS,
    derive: deriveFertilizer,
  },
  'Chemical Fertilizers': {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['fertilizer', 'Fertilizer'],
      ['chemical-fertilizers', 'Chemical Fertilizers'],
    ],
    filters: FERTILIZER_FILTERS,
    derive: deriveFertilizer,
  },
  'Bird Baths': {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['garden-decor', 'Garden Decor'],
      ['bird-baths', 'Bird Baths'],
    ],
    filters: BIRD_BATH_FILTERS,
    derive: deriveBirdBath,
  },
};
