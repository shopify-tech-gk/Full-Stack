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

/** Filters for garden fountains: what kind it is, what it's made of, solar / LED or not. */
const FOUNTAIN_FILTERS = [
  { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
  { key: 'product_type', label: 'Type', type: 'multi_select', order: 2 },
  { key: 'material', label: 'Material', type: 'multi_select', order: 3 },
  { key: 'color', label: 'Colour', type: 'multi_select', order: 4 },
  { key: 'solar', label: 'Solar Powered', type: 'boolean', order: 5 },
  { key: 'led', label: 'LED Lights', type: 'boolean', order: 6 },
  { key: 'discount_band', label: 'Discount', type: 'multi_select', order: 7 },
];

/** product_type / material / solar / led for fountains, pumps and their parts. */
function deriveFountain(product, text) {
  const title = String(product.Title ?? '').toLowerCase();
  const out = {
    weight_band: null,
    product_type: firstMatch(
      title,
      [
        [
          'Other Garden Items',
          [
            'penomatic',
            'alocasia',
            'gear drive sprinkler',
            'oscillating garden sprinkler',
            'spray bottle',
            'micro meal',
            'flora diet',
            'growth booster',
            'doctor series',
            'plant food',
            'pathway light',
            'disco ball',
            'fancy pebbles',
            'frog garden planter',
            'figurine',
            'cottage',
            'village house',
            'bird feeder',
          ],
        ],
        ['Solar Fountains', ['solar']],
        [
          'Wall Spouts & Cascades',
          [
            'cascade blade',
            'spillway',
            'wall-mount',
            'wall mount',
            'spout',
            'waterfall fountain with 5-inch',
          ],
        ],
        ['Buddha Fountains', ['buddha']],
        ['God Idol Fountains', ['ganesh', 'ganpati', 'radha', 'krishna']],
        [
          'Pumps & Nozzles',
          [
            'fountain pump',
            'water pump',
            'submersible fountain',
            'mini submersible',
            'w submersible pump',
            'nozzle',
            'mist maker',
            'mushroom',
            'balloon fountain',
            'shower set',
            'pool',
          ],
        ],
        ['Tabletop Fountains', ['tabletop', 'table top', 'table water', 'table décor']],
      ],
      'Indoor & Outdoor Fountains',
    ),
  };
  const materials = [
    ['Stainless Steel', ['stainless', 'ss304']],
    ['Brass', ['brass']],
    ['Fiberglass', ['fiberglass', 'fibreglass', 'fibre ', 'fiber ']],
    ['Polyresin', ['resin']],
    ['Stone', ['stone', 'rock', 'slate']],
    ['Bamboo', ['bamboo']],
    ['Plastic', ['plastic', 'abs ']],
    ['Metal', ['metal', 'iron']],
  ];
  out.material = firstMatch(title, materials) ?? firstMatch(text, materials);
  if (/solar/.test(text)) out.solar = true;
  if (/\bled\b|\brgb\b/.test(text)) out.led = true;
  return out;
}

/** For small categories that only need the basics. */
const BASIC_FILTERS = [
  { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
  { key: 'color', label: 'Colour', type: 'multi_select', order: 2 },
  { key: 'discount_band', label: 'Discount', type: 'multi_select', order: 3 },
];
const deriveBasic = () => ({ weight_band: null });
const AGRI = ['lawn-and-gardening', 'Agri and Gardening'];
const basicTarget = (...chain) => ({ chain, filters: BASIC_FILTERS, derive: deriveBasic });

/**
 * Products a delivery filed under the wrong "Target Name" (a pen in Garden Fountains, because of
 * the word "fountain"), keyed by Youmart_Product_ID: where they really belong. Re-importing the
 * delivery keeps them there.
 */
export const TARGET_OVERRIDES = {
  B0OB4726M9: 'Organic Fertilizers',
  B0DCSMM1JA: 'Organic Fertilizers',
  B0BXS9BY4H: 'Liquid Fertilizers',
  B0FRP29KXR: 'Liquid Fertilizers',
  B0L1CSSEY9: 'Chemical Fertilizers',
  B0IL99TJ8B: 'Garden Statues',
  B0L8E0767U: 'Garden Ornaments',
  B03QDU5VW4: 'Garden Ornaments',
  B06F2473ER: 'Garden Ornaments',
  B0U2CM8CV5: 'Garden Ornaments',
  B0M5M8ZMFT: 'Garden Lights',
  B08Y0DH304: 'Pots & Planters',
  B06LXVL4P9: 'Hanging Planters',
  B0N1RNN2X4: 'Sprinklers',
  B0YWYLXJRP: 'Sprinklers',
  B0G56TDMTO: 'Sprayers',
  B0JAR46EP7: 'Indoor Plants',
  B0KM1WBK5M: 'Fountain Pens',
};

/** Filters for garden lights: the kind of light, its power, light colour and motion sensor. */
const LIGHT_FILTERS = [
  { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
  { key: 'product_type', label: 'Light Type', type: 'multi_select', order: 2 },
  { key: 'power_source', label: 'Power Source', type: 'multi_select', order: 3 },
  { key: 'light_color', label: 'Light Colour', type: 'multi_select', order: 4 },
  { key: 'motion_sensor', label: 'Motion Sensor', type: 'boolean', order: 5 },
  { key: 'color', label: 'Body Colour', type: 'multi_select', order: 6 },
  { key: 'discount_band', label: 'Discount', type: 'multi_select', order: 7 },
];

/** product_type / power_source / light_color / motion_sensor for garden lights. */
function deriveLight(product, text) {
  const title = String(product.Title ?? '').toLowerCase();
  const colors = [
    [
      'Multicolour',
      ['multicolor', 'multicolour', 'rgb', 'color-chang', 'color chang', 'colour chang'],
    ],
    ['Warm White', ['warm white', 'warm yellow', 'warm led', 'warm light', '3000k']],
    ['Cool White', ['cool white', 'cool daylight', '6500k']],
  ];
  const out = {
    weight_band: null,
    product_type: firstMatch(
      title,
      [
        [
          'String & Fairy Lights',
          [
            'string light',
            'fairy light',
            'fairy string',
            'curtain',
            'rope light',
            'strip',
            'meteor',
            'icicle',
          ],
        ],
        ['Flood & Street Lights', ['flood', 'street']],
        ['Bollard Lights', ['bollard']],
        ['Gate & Pillar Lights', ['gate', 'pillar', 'pole mount']],
        ['Spike & Spot Lights', ['spike', 'spotlight', 'spot light']],
        ['Wall Lights', ['wall', 'sconce', 'bulkhead']],
        ['Step & Deck Lights', ['step light', 'deck', 'stair', 'fence']],
        [
          'Pathway & Stake Lights',
          ['pathway', 'stake', 'firefly', 'torch', 'ground', 'landscape', 'mushroom', 'stick'],
        ],
        ['Pendants & Lanterns', ['pendant', 'lantern']],
      ],
      'Decorative Garden Lights',
    ),
    power_source: /solar/.test(text) ? 'Solar' : 'Electric',
    light_color: firstMatch(title, colors) ?? firstMatch(text, colors),
  };
  if (/motion|pir sensor/.test(title)) out.motion_sensor = true;
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
  'Garden Fountains': {
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['garden-decor', 'Garden Decor'],
      ['garden-fountains', 'Garden Fountains'],
    ],
    filters: FOUNTAIN_FILTERS,
    derive: deriveFountain,
  },
  'Garden Ornaments': basicTarget(
    AGRI,
    ['garden-decor', 'Garden Decor'],
    ['garden-ornaments', 'Garden Ornaments'],
  ),
  'Garden Lights': {
    chain: [AGRI, ['garden-decor', 'Garden Decor'], ['garden-lights', 'Garden Lights']],
    filters: LIGHT_FILTERS,
    derive: deriveLight,
  },
  'Pots & Planters': basicTarget(AGRI, ['pots-and-planters', 'Pots & Planters']),
  'Hanging Planters': basicTarget(
    AGRI,
    ['pots-and-planters', 'Pots & Planters'],
    ['hanging-planters', 'Hanging Planters'],
  ),
  Sprinklers: basicTarget(
    AGRI,
    ['irrigation-equipment', 'Irrigation Equipment'],
    ['sprinklers', 'Sprinklers'],
  ),
  Sprayers: basicTarget(
    AGRI,
    ['agri-gardening-tools', 'Gardening Tools'],
    ['sprayers', 'Sprayers'],
  ),
  'Indoor Plants': basicTarget(
    AGRI,
    ['plant-saplings', 'Plant Saplings'],
    ['indoor-plants', 'Indoor Plants'],
  ),
  'Fountain Pens': basicTarget(
    ['stationary', 'Stationary'],
    ['pen', 'Pen'],
    ['fountain-pens', 'Fountain Pens'],
  ),
};
