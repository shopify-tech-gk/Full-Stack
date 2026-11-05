// Where each "Target Name" in a product JSON (scripts/import-products-json.mjs) goes in the catalog,
// which filters its listing offers (W3 filter definition - docs/catalog/IMPORT-SPEC.md §2), and how
// to derive the filterable attributes from each product's title / description. Add one entry per
// new category delivery - the importer itself stays the same.
//
// `chain`: catalog categories from the root down to the target, as [slug, name]. Slugs match the
// storefront tree (packages/shared-client/src/categories.ts) so the app's category menu links to
// them. `filters`: Brand first, then what Amazon / Flipkart offer for this kind of product (price,
// rating and discount are universal / generic). `derive(product, text)` adds category-specific
// attributes; `text` is the lower-cased title + start of the description. `also` (optional): other
// targets the product is ALSO listed under (one product, several categories - never a copy).

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
  // Bird Netting delivery: mosquito / shade nets and fencing get their own Nets and Fence
  // categories; cages, cage covers and a sports net aren't garden netting at all.
  B0767OTFT3: 'Insect Netting',
  B0BMECRWC6: 'Insect Netting',
  B08NQCPX49: 'Insect Netting',
  B0NGPU1S4P: 'Insect Netting',
  B0ZXN30S9G: 'Insect Netting',
  B06D5QUZ2J: 'Insect Netting',
  B0LF2P1LXU: 'Insect Netting',
  B0XGXEK4UZ: 'Insect Netting',
  B0K4E0XCF7: 'Insect Netting',
  B0I537UO1T: 'Shade Netting',
  B05P1NQSKP: 'Shade Netting',
  B00CLNYHW4: 'Shade Netting',
  B0CFYCT5XD: 'Garden Fencing',
  B0Z69UTBLN: 'Garden Fencing',
  B089Y20HZV: 'Garden Fencing',
  B08M99WNR4: 'Garden Fencing',
  B0H4U5VVGN: 'Bird Cages & Covers',
  B0V3UAMLEV: 'Bird Cages & Covers',
  B0BPUGHPJ3: 'Bird Cages & Covers',
  B0WDVLFP61: 'Cricket',
  // Shade Netting delivery: a balcony safety net (not a shade net).
  B057L059KN: 'Bird Netting',
  // Plant Support Netting + Potting Mix deliveries: shade nets, tree guards / fencing, planters and
  // fertilizers filed with them.
  B0QMES0MV5: 'Shade Netting',
  B0JZN5GPXV: 'Shade Netting',
  B0Q56SYA4Z: 'Shade Netting',
  B0IGI11YMG: 'Shade Netting',
  B0M1AO0G7P: 'Shade Netting',
  B097JU5OO3: 'Garden Fencing',
  B0E912ESEL: 'Garden Fencing',
  B0KM2J7ZN4: 'Garden Fencing',
  B0YGQ8KHYV: 'Garden Fencing',
  B0WSBC6CAR: 'Garden Fencing',
  B0JQ6C48YK: 'Garden Fencing',
  B0IJ7ZTAUJ: 'Garden Fencing',
  B0K6TPE8AX: 'Insect Netting',
  B0E3NYGRQ7: 'Pots & Planters',
  B0SUQAH4GP: 'Pots & Planters',
  B0H1F67NVW: 'Organic Fertilizers',
  B08GYMH3X6: 'Vermicompost',
  B0CCJB8NPG: 'Vermicompost',
  B04X9EHBE8: 'Compost',
  // Vermiculite delivery: only about a third is vermiculite - perlite, potting mixes, soil
  // amendments, vermicompost, fertilizers, pots, air-freshener sachets and pet food came with it.
  B007AQ4SFW: 'Air Fresheners',
  B00MGUTXQ1: 'Air Fresheners',
  B03CN8ZK59: 'Air Fresheners',
  B04QF74RWR: 'Air Fresheners',
  B05XJ61RMY: 'Air Fresheners',
  B065AC58SK: 'Air Fresheners',
  B08MATE2B0: 'Air Fresheners',
  B08WOXXT98: 'Air Fresheners',
  B0DI8QE6TS: 'Air Fresheners',
  B0DVTVARGP: 'Air Fresheners',
  B0E7MJMJSY: 'Air Fresheners',
  B0GVG3WGUU: 'Air Fresheners',
  B0N9SQLYJO: 'Air Fresheners',
  B0SX57LXQR: 'Air Fresheners',
  B0THU3AY6J: 'Air Fresheners',
  B0VTJCY8G1: 'Air Fresheners',
  B0XBBSA7QB: 'Air Fresheners',
  B0Z4DEGXJ8: 'Air Fresheners',
  B0UJ11K5J1: 'Cat Health Supplies',
  B0MCYJ6P58: 'Cement & Mortar',
  B0JTWQISYW: 'Chemical Fertilizers',
  B0NRJA99LR: 'Chemical Fertilizers',
  B075GUGL2P: 'Compost',
  B0C6I5Q8WV: 'Compost',
  B0FMVY9KZS: 'Compost',
  B04DLCONDI: 'Fish Food',
  B0FAM3JPHI: 'Fish Food',
  B0Q3BWZU0C: 'Garden Ornaments',
  B0R785RS8W: 'Garden Ornaments',
  B0ZUBL9IZB: 'Garden Ornaments',
  B08BYUUQO7: 'Organic Fertilizers',
  B0G0VGHNF4: 'Organic Fertilizers',
  B0I917OTPX: 'Organic Fertilizers',
  B0KFWG9W88: 'Organic Fertilizers',
  B0TRFSKOE3: 'Organic Fertilizers',
  B0X0HAINUY: 'Organic Fertilizers',
  B04EWK3NOY: 'Pots & Planters',
  B0HQ2HMJB7: 'Pots & Planters',
  B0X6A10NYK: 'Pots & Planters',
  B016RWNE4K: 'Potting Mix',
  B01G6MI9UQ: 'Potting Mix',
  B01GA0N6NL: 'Potting Mix',
  B01GKKQPSB: 'Potting Mix',
  B01KFPXZ6B: 'Potting Mix',
  B02IDOJF4M: 'Potting Mix',
  B02PHCW72C: 'Potting Mix',
  B03IVBJB9Z: 'Potting Mix',
  B043F5ONTD: 'Potting Mix',
  B05M3J9T1S: 'Potting Mix',
  B064R7G6JW: 'Potting Mix',
  B06D9U2TJT: 'Potting Mix',
  B07EK146O7: 'Potting Mix',
  B0AI1RTOGC: 'Potting Mix',
  B0AMWU5XY9: 'Potting Mix',
  B0ANWN5TEN: 'Potting Mix',
  B0BQ36CJCL: 'Potting Mix',
  B0CMRQPN9J: 'Potting Mix',
  B0CYF3QJJR: 'Potting Mix',
  B0DME2ZUQJ: 'Potting Mix',
  B0F2720Y9G: 'Potting Mix',
  B0GKZHOVE5: 'Potting Mix',
  B0GWDES05A: 'Potting Mix',
  B0IU9745T0: 'Potting Mix',
  B0JI7U9SSN: 'Potting Mix',
  B0JLJ08TC0: 'Potting Mix',
  B0K0NM01RU: 'Potting Mix',
  B0KVMV1QKX: 'Potting Mix',
  B0LE2N4ZWF: 'Potting Mix',
  B0NC7M0HSV: 'Potting Mix',
  B0ND9ELPW1: 'Potting Mix',
  B0OO7WHP6G: 'Potting Mix',
  B0QUAAB99Q: 'Potting Mix',
  B0RDBT9G5B: 'Potting Mix',
  B0RE6EKAY4: 'Potting Mix',
  B0RW0PRJ2B: 'Potting Mix',
  B0SIFV9T2Q: 'Potting Mix',
  B0T766CNSW: 'Potting Mix',
  B0UJAKKF3U: 'Potting Mix',
  B0VTNT9ZV9: 'Potting Mix',
  B0VXW2RH23: 'Potting Mix',
  B0Z6H6NXGD: 'Potting Mix',
  B0ZYM8RSG6: 'Potting Mix',
  B02CX9M45V: 'Soil Amendments',
  B02MJQ6ET0: 'Soil Amendments',
  B02T9BY5UB: 'Soil Amendments',
  B049F5NKTE: 'Soil Amendments',
  B04DRTTWL1: 'Soil Amendments',
  B053YV5T7Q: 'Soil Amendments',
  B076B9V1G3: 'Soil Amendments',
  B09BNWUF7V: 'Soil Amendments',
  B0ATLEV25W: 'Soil Amendments',
  B0CDOWLOU3: 'Soil Amendments',
  B0F6H2GT2O: 'Soil Amendments',
  B0FJP6MBDO: 'Soil Amendments',
  B0IYA1UQ81: 'Soil Amendments',
  B03SYBSML4: 'Vermicompost',
  B0885C1ABO: 'Vermicompost',
  B0C7U2ZG6Q: 'Vermicompost',
  B0G6RQBV3A: 'Vermicompost',
  B0HOYKVN6W: 'Vermicompost',
  B0HZIGZI9I: 'Vermicompost',
  B0IKLNB1CK: 'Vermicompost',
  B0J0PMCOPQ: 'Vermicompost',
  B0JZIEREZL: 'Vermicompost',
  B0LO62UTY6: 'Vermicompost',
  B0O1Y5DBWA: 'Vermicompost',
  B0PTCSO8BJ: 'Vermicompost',
  B0QVZZABAF: 'Vermicompost',
  B0ZZFKBNJP: 'Vermicompost',
  // Insect Netting delivery: most of it is home mosquito nets (beds, windows, doors), plus
  // mosquito bats, bug zappers and a few shade / bird nets.
  B008AW6VHL: 'Bed Mosquito Nets',
  B00PFXSDTH: 'Bed Mosquito Nets',
  B0172BEA7E: 'Bed Mosquito Nets',
  B01RAKEA0O: 'Bed Mosquito Nets',
  B01TC0IXZ1: 'Bed Mosquito Nets',
  B02DL5YIWC: 'Bed Mosquito Nets',
  B02EAEMJJS: 'Bed Mosquito Nets',
  B03LH5DQLN: 'Bed Mosquito Nets',
  B04803AEEW: 'Bed Mosquito Nets',
  B04OTKZAHL: 'Bed Mosquito Nets',
  B04VFPHPO3: 'Bed Mosquito Nets',
  B052U2ISL1: 'Bed Mosquito Nets',
  B05HTZ1R7C: 'Bed Mosquito Nets',
  B05J40CDL4: 'Bed Mosquito Nets',
  B05P8FD34P: 'Bed Mosquito Nets',
  B05QHE08H6: 'Bed Mosquito Nets',
  B05X2MT8M3: 'Bed Mosquito Nets',
  B05XP775NE: 'Bed Mosquito Nets',
  B07SAKBVP0: 'Bed Mosquito Nets',
  B08FMZEN21: 'Bed Mosquito Nets',
  B08VG6QDII: 'Bed Mosquito Nets',
  B09KL0KR0E: 'Bed Mosquito Nets',
  B09TP4RJI6: 'Bed Mosquito Nets',
  B09ZS9J278: 'Bed Mosquito Nets',
  B0A6MIA63Z: 'Bed Mosquito Nets',
  B0A9U4RXNV: 'Bed Mosquito Nets',
  B0AZJQ6YLL: 'Bed Mosquito Nets',
  B0CI93JIF1: 'Bed Mosquito Nets',
  B0DUUR9JC1: 'Bed Mosquito Nets',
  B0EK3J7H50: 'Bed Mosquito Nets',
  B0FV7V73AH: 'Bed Mosquito Nets',
  B0G32UC654: 'Bed Mosquito Nets',
  B0GQUAQK9C: 'Bed Mosquito Nets',
  B0GTOQ1KN8: 'Bed Mosquito Nets',
  B0GW042ALT: 'Bed Mosquito Nets',
  B0H5MG3509: 'Bed Mosquito Nets',
  B0HVTE7PM6: 'Bed Mosquito Nets',
  B0HYXCLSMJ: 'Bed Mosquito Nets',
  B0I3XCOYS8: 'Bed Mosquito Nets',
  B0IAUMC2NO: 'Bed Mosquito Nets',
  B0JSXHXNDI: 'Bed Mosquito Nets',
  B0KBHG913A: 'Bed Mosquito Nets',
  B0KR8BSR01: 'Bed Mosquito Nets',
  B0L6USPNTJ: 'Bed Mosquito Nets',
  B0LK2L4L67: 'Bed Mosquito Nets',
  B0MN7KFPZM: 'Bed Mosquito Nets',
  B0OCZ3IO7Q: 'Bed Mosquito Nets',
  B0OQDCPZEK: 'Bed Mosquito Nets',
  B0OTHVZD65: 'Bed Mosquito Nets',
  B0PHI65XO4: 'Bed Mosquito Nets',
  B0QDNRJHY3: 'Bed Mosquito Nets',
  B0R44WCA8X: 'Bed Mosquito Nets',
  B0R94SNOM4: 'Bed Mosquito Nets',
  B0S8AIARRW: 'Bed Mosquito Nets',
  B0SHX1DKML: 'Bed Mosquito Nets',
  B0TEP1O3AH: 'Bed Mosquito Nets',
  B0TMIJJI7D: 'Bed Mosquito Nets',
  B0TRHG30I5: 'Bed Mosquito Nets',
  B0V3LRDLOP: 'Bed Mosquito Nets',
  B0VSCWSSH9: 'Bed Mosquito Nets',
  B0VVLC1NZX: 'Bed Mosquito Nets',
  B0W7AQJPXW: 'Bed Mosquito Nets',
  B0XB1W7JS0: 'Bed Mosquito Nets',
  B0NPYLCV1N: 'Bird Netting',
  B0RWSIHPGH: 'Bird Netting',
  B008L4IGBB: 'Insect Killers & Pest Control',
  B07NCFVNE0: 'Insect Killers & Pest Control',
  B09KXICRX2: 'Insect Killers & Pest Control',
  B0DGT87Z8W: 'Insect Killers & Pest Control',
  B0E3RUT9NG: 'Insect Killers & Pest Control',
  B0LLG127KL: 'Insect Killers & Pest Control',
  B0OTSKY9KK: 'Insect Killers & Pest Control',
  B0QYXKL28I: 'Insect Killers & Pest Control',
  B0Y26DPP21: 'Insect Killers & Pest Control',
  B07EJLDFUT: 'Mosquito Killer Racket',
  B07NT8Q5TY: 'Mosquito Killer Racket',
  B08UF5OWJP: 'Mosquito Killer Racket',
  B0DLHIYQ57: 'Mosquito Killer Racket',
  B0IBVCSVMX: 'Mosquito Killer Racket',
  B0PYQE3M7E: 'Mosquito Killer Racket',
  B0D0VYXU8B: 'Outdoor Toys',
  B00KQ300MV: 'Shade Netting',
  B0EK5OZX6Z: 'Shade Netting',
  B0HWAK13R7: 'Shade Netting',
  B0X5G2Z4QV: 'Shade Netting',
  B0E27VM4AS: 'Storage Containers',
  B00ZLUJ8SJ: 'Window & Door Mosquito Nets',
  B016SX9M00: 'Window & Door Mosquito Nets',
  B03C3J04F9: 'Window & Door Mosquito Nets',
  B04MYFE4ZS: 'Window & Door Mosquito Nets',
  B05XKGC9X2: 'Window & Door Mosquito Nets',
  B062EYQILX: 'Window & Door Mosquito Nets',
  B0640BHD9M: 'Window & Door Mosquito Nets',
  B06DTW40XJ: 'Window & Door Mosquito Nets',
  B06F4EK6L0: 'Window & Door Mosquito Nets',
  B06SZNHW6Q: 'Window & Door Mosquito Nets',
  B071V1KHDA: 'Window & Door Mosquito Nets',
  B07G9IXWTX: 'Window & Door Mosquito Nets',
  B08QWK55IM: 'Window & Door Mosquito Nets',
  B0AIGXFHDE: 'Window & Door Mosquito Nets',
  B0C8JU2ZOW: 'Window & Door Mosquito Nets',
  B0CCMTIZ7F: 'Window & Door Mosquito Nets',
  B0D9ALOZ4N: 'Window & Door Mosquito Nets',
  B0EWNK29SG: 'Window & Door Mosquito Nets',
  B0FXEY727Y: 'Window & Door Mosquito Nets',
  B0GIYR37CV: 'Window & Door Mosquito Nets',
  B0HG0T5CPE: 'Window & Door Mosquito Nets',
  B0HOJSFEP8: 'Window & Door Mosquito Nets',
  B0IHILQ571: 'Window & Door Mosquito Nets',
  B0II8O7NE5: 'Window & Door Mosquito Nets',
  B0J6QVEN26: 'Window & Door Mosquito Nets',
  B0JIFFTZG9: 'Window & Door Mosquito Nets',
  B0JLBJE09N: 'Window & Door Mosquito Nets',
  B0K1ZZXNC5: 'Window & Door Mosquito Nets',
  B0MAADPZPH: 'Window & Door Mosquito Nets',
  B0NSBXQHAK: 'Window & Door Mosquito Nets',
  B0O3KPD0ZC: 'Window & Door Mosquito Nets',
  B0OFI19G14: 'Window & Door Mosquito Nets',
  B0OXF1Z579: 'Window & Door Mosquito Nets',
  B0P06MNYXU: 'Window & Door Mosquito Nets',
  B0PWCKW0VM: 'Window & Door Mosquito Nets',
  B0RVTSTVH8: 'Window & Door Mosquito Nets',
  B0S0099NY7: 'Window & Door Mosquito Nets',
  B0SHOW2GXD: 'Window & Door Mosquito Nets',
  B0SI0P1KBV: 'Window & Door Mosquito Nets',
  B0SW5MSHSK: 'Window & Door Mosquito Nets',
  B0U65FVI62: 'Window & Door Mosquito Nets',
  B0V1QX9BH9: 'Window & Door Mosquito Nets',
  B0WPFED041: 'Window & Door Mosquito Nets',
  B0X3UWXI1L: 'Window & Door Mosquito Nets',
  B0X9KD7L5Y: 'Window & Door Mosquito Nets',
  B0XEWAFXG0: 'Window & Door Mosquito Nets',
  B0XZ156IIE: 'Window & Door Mosquito Nets',
  B0Y2HXLETA: 'Window & Door Mosquito Nets',
  B0ZT76DTDM: 'Window & Door Mosquito Nets',
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

/** Filters for garden nets: what kind of net, its size, material and UV protection. */
const NET_FILTERS = [
  { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
  { key: 'product_type', label: 'Net Type', type: 'multi_select', order: 2 },
  { key: 'size_band', label: 'Net Size', type: 'multi_select', order: 3 },
  { key: 'material', label: 'Material', type: 'multi_select', order: 4 },
  { key: 'uv_stabilized', label: 'UV Stabilised', type: 'boolean', order: 5 },
  { key: 'color', label: 'Colour', type: 'multi_select', order: 6 },
  { key: 'discount_band', label: 'Discount', type: 'multi_select', order: 7 },
];

/** Area in square feet from "10 x 20 ft", "10x20 Ft", "2M x 10M", "10' x 12'" (null for inches). */
function netAreaSqFt(title) {
  const m = title.match(
    /(\d+(?:\.\d+)?)\s*(ft|feet|foot|'|m\b)?\s*[x×]\s*(\d+(?:\.\d+)?)\s*(ft|feet|foot|'|m\b|inch|in\b|")?/i,
  );
  if (!m) return null;
  const unit = (m[4] ?? m[2] ?? '').toLowerCase();
  if (unit === 'inch' || unit === 'in' || unit === '"') return null;
  if (!unit && !/\bft\b|feet|foot/i.test(title)) return null;
  const area = Number(m[1]) * Number(m[3]);
  return unit === 'm' ? area * 10.764 : area;
}

/** product_type / size_band / material / uv_stabilized for garden nets. */
function deriveNet(product, text) {
  const title = String(product.Title ?? '').toLowerCase();
  const area = netAreaSqFt(String(product.Title ?? ''));
  const out = {
    weight_band: null,
    product_type: firstMatch(
      title,
      [
        ['Fruit Protection Bags', ['mesh bag', 'protection bag']],
        ['Net Clips & Accessories', ['cloth clips', 'clips for', 'net clip']],
        ['Insect & Mosquito Nets', ['mosquito', 'insect barrier', 'insect protection']],
        [
          'Shade Sails & Awnings',
          ['shade sail', 'sun shade sail', 'rain sail', 'awning', 'canopy'],
        ],
        [
          'Shade Nets',
          [
            'shade net',
            'shade cloth',
            'shade mesh',
            'shade tarp',
            'sun shade',
            'shade & agro',
            'sun mesh',
            '% shade',
            'shade protection',
            'sun protection',
            'uv blocking',
            'uv protection shade',
          ],
        ],
        ['Garden Fencing', ['fenc', 'tree guard']],
        ['Plant Cages & Stakes', ['cage', 'stake', 'hoop', 'stick', 'pole', 'spiral']],
        ['Plant Ties & Twine', ['twine', ' tie', 'tying']],
        [
          'Trellis & Creeper Nets',
          ['trellis', 'creeper', 'climb', 'vine', 'cucumber', 'bean', 'tomato', 'scrog'],
        ],
        ['Plant Support Nets', ['plant support', 'support net']],
        ['Balcony & Pigeon Nets', ['pigeon', 'balcon', 'window']],
      ],
      'Garden & Fruit Tree Nets',
    ),
    size_band:
      area === null
        ? null
        : area <= 50
          ? 'Up to 50 sq ft'
          : area <= 100
            ? '51 - 100 sq ft'
            : area <= 200
              ? '101 - 200 sq ft'
              : area <= 500
                ? '201 - 500 sq ft'
                : 'Above 500 sq ft',
    material: firstMatch(text, [
      ['HDPE', ['hdpe', 'polyethylene']],
      ['Nylon', ['nylon']],
      ['PVC', ['pvc']],
      ['Iron / Metal', [' iron ', 'weld wire', 'welded', 'galvanized', 'galvanised']],
      ['Aluminium', ['aluminum', 'aluminium']],
      ['Polyester', ['polyester', 'polycotton']],
    ]),
  };
  if (/uv[- ]?(stabili|resist|protect|treated)/.test(text)) out.uv_stabilized = true;
  return out;
}

/** Filters for home mosquito nets: what kind, and (bed nets) which bed it fits. */
const MOSQUITO_NET_FILTERS = [
  { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
  { key: 'product_type', label: 'Net Type', type: 'multi_select', order: 2 },
  { key: 'bed_size', label: 'Bed Size', type: 'multi_select', order: 3 },
  { key: 'material', label: 'Material', type: 'multi_select', order: 4 },
  { key: 'color', label: 'Colour', type: 'multi_select', order: 5 },
  { key: 'discount_band', label: 'Discount', type: 'multi_select', order: 6 },
];

/** product_type / bed_size / material for bed, window and door mosquito nets. */
function deriveMosquitoNet(product, text) {
  const title = String(product.Title ?? '').toLowerCase();
  const out = {
    weight_band: null,
    product_type: firstMatch(
      title,
      [
        ['Magnetic Door Curtains', ['magnetic', 'door curtain', 'door net', 'door screen']],
        ['Window Mosquito Nets', ['window', 'exhaust', 'ventilation', 'balcony screen']],
        ['Mesh Rolls & Fabric', ['roll', 'fabric', 'gsm grey', 'mesh net 4ft', 'seal strip']],
        ['Baby & Crib Nets', ['baby', 'crib', 'infant', 'toddler', 'stroller', 'newborn']],
        ['Foldable & Pop-up Nets', ['foldable', 'pop-up', 'pop up', 'tent']],
        ['Hanging Nets (Machardani)', ['machardani', 'machhardani', 'canopy', 'frame', 'bed']],
      ],
      // A plain "mosquito net 3x6.5 ft" is a bed net; a mesh / screen without more is a screen.
      /screen|mesh/.test(title) ? 'Mosquito Screens' : 'Hanging Nets (Machardani)',
    ),
    bed_size: firstMatch(title, [
      ['King / Queen', ['king', 'queen', 'family size']],
      ['Double Bed', ['double']],
      ['Single Bed', ['single']],
    ]),
    material: firstMatch(text, [
      ['Fiberglass', ['fiberglass', 'fibreglass']],
      ['Polycotton', ['polycotton', 'poly cotton']],
      ['HDPE', ['hdpe', 'polyethylene']],
      ['Polyester', ['polyester']],
      ['Nylon', ['nylon']],
      ['Cotton', ['cotton']],
      ['Stainless Steel', ['stainless steel']],
    ]),
  };
  return out;
}

const NETS = ['nets-and-fence', 'Nets and Fence'];
const netTarget = (leaf) => ({
  chain: [AGRI, NETS, leaf],
  filters: NET_FILTERS,
  derive: deriveNet,
});

/** Potting Mix: what the medium is, by its title first ("potting mix with vermicompost" is a mix). */
function derivePottingMix(product, text) {
  const out = deriveFertilizer(product, text);
  const title = String(product.Title ?? '').toLowerCase();
  const type = firstMatch(title, [
    ['Orchid & Bark Mix', ['orchid', 'bark']],
    ['Perlite', ['perlite']],
    ['Peat Moss', ['peat moss', 'sphagnum']],
    ['River Sand', ['sand']],
    [
      'Potting Mix',
      ['potting', 'soil mix', 'soilless', 'growing medi', 'substrate', 'soilrite', 'red soil'],
    ],
    ['Cocopeat', ['cocopeat', 'coco peat', 'coir', 'coco chips']],
  ]);
  return type ? { ...out, product_type: type } : out;
}

/** Vermiculite (the fertilizer rules would read "vermi" as vermicompost). */
function deriveVermiculite(product, text) {
  const title = String(product.Title ?? '').toLowerCase();
  return {
    ...deriveFertilizer(product, text),
    product_type: /perlite|mix/.test(title) ? 'Vermiculite Mixes' : 'Vermiculite',
  };
}

/** Soil Amendments: what it is, by its title. */
function deriveSoilAmendment(product, text) {
  const title = String(product.Title ?? '').toLowerCase();
  return {
    ...deriveFertilizer(product, text),
    product_type: firstMatch(
      title,
      [
        ['Biochar', ['biochar']],
        ['Charcoal', ['charcoal', 'coal']],
        ['Gypsum', ['gypsum']],
        ['Dolomite', ['dolomite']],
        ['Bentonite Clay', ['bentonite']],
        ['Humic Acid', ['humic']],
        ['Water Crystals', ['water storing', 'absorbent']],
      ],
      'Soil Conditioners',
    ),
  };
}

/** v1.18 Clothing: filters shared by its categories (Cargos...). */
const CLOTHING_FILTERS = [
  { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
  { key: 'department', label: 'For', type: 'multi_select', order: 2 },
  { key: 'size', label: 'Size', type: 'multi_select', order: 3 },
  { key: 'fit', label: 'Fit', type: 'multi_select', order: 4 },
  { key: 'product_type', label: 'Style', type: 'multi_select', order: 5 },
  { key: 'material', label: 'Fabric', type: 'multi_select', order: 6 },
  { key: 'color', label: 'Colour', type: 'multi_select', order: 7 },
  { key: 'discount_band', label: 'Discount', type: 'multi_select', order: 8 },
];

const DEPARTMENTS = [
  ['Men', /\bmen(?:'?s)?\b/],
  ['Women', /\bwomen(?:'?s)?\b/],
  ['Boys', /\bboys?\b|\bboy's\b/],
  ['Girls', /\bgirls?\b|\bgirl's\b/],
];

/** Cargos: who it's for, its style, fit, fabric and every size it's sold in. */
function deriveCargo(product, text) {
  const title = String(product.Title ?? '').toLowerCase();
  const variants = (product['Size & Color Variants'] ?? []).filter(
    (v) => v && Number(v['Selling Price (INR)']) > 0,
  );
  const variantField = (key) =>
    variants.map((v) => v[key]).find((value) => typeof value === 'string' && value.trim());
  const path = String(product['Category Path'] ?? '').toLowerCase();
  const fitText = `${title} ${String(variantField('Fit Type') ?? '').toLowerCase()}`;
  return {
    weight_band: null,
    // Whoever the title names ("Men's & Boys" cargos show under both; "Girls" jeans the delivery
    // filed under Women are Girls'), else the delivery's category path.
    department: [title, path]
      .map((where) => DEPARTMENTS.filter(([, word]) => word.test(where)).map(([name]) => name))
      .find((names) => names.length > 0),
    product_type: firstMatch(
      title,
      [
        ['Cargo Jeans', ['jeans', 'denim']],
        ['Cargo Joggers', ['jogger', 'trackpant', 'track pant', 'sweatpant']],
        ['Parachute Cargos', ['parachute']],
        ['Cargo Leggings', ['legging']],
      ],
      'Cargo Pants',
    ),
    fit: firstMatch(fitText, [
      ['Baggy / Oversized', ['baggy', 'oversized']],
      ['Wide Leg', ['wide leg', 'wide-leg', 'flared']],
      ['Loose / Relaxed', ['loose', 'relaxed']],
      ['Slim', ['slim', 'skinny', 'tapered']],
      ['Straight', ['straight']],
      ['Regular', ['regular', 'comfort']],
    ]),
    material: firstMatch(
      `${title} ${String(variantField('Material Type') ?? '').toLowerCase()} ${text}`,
      [
        ['Denim', ['denim', 'jeans']],
        [
          'Cotton Blend',
          ['cotton blend', 'cotton lycra', 'cotton stretch', 'polycotton', 'cotton mix'],
        ],
        ['Cotton', ['cotton']],
        ['Nylon', ['nylon', 'parachute']],
        ['Polyester', ['polyester', 'poly lycra']],
        ['Crepe', ['crepe']],
      ],
    ),
    size: [
      ...new Set(
        variants.map((v) => String(v.Size ?? '').trim()).filter((s) => s && !/^select\b/i.test(s)),
      ),
    ].sort((a, b) => sizeRank(a) - sizeRank(b)),
    // Every colour it's sold in (the product's own "Color" is just its first photo's).
    // The filter lists the base colour ("Black 1" is a Black).
    color: [
      ...new Set(
        variants
          .map((v) => cleanColor(v.Color)?.replace(/\s+\d+$/, ''))
          .filter((c) => c && !/^select\b/i.test(c)),
      ),
    ],
  };
}

/**
 * A delivery's colour name, readable: "DARK BLUE." -> "Dark Blue", "Chocolate Brown_620443" ->
 * "Chocolate Brown" (a seller code), "BLACK-1" / "Multi2" -> "Black 1" / "Multi 2" (a second
 * shade of that colour; the picker shows its photo).
 */
export function cleanColor(raw) {
  const s = String(raw ?? '')
    .replace(/_\d+$/, '')
    .replace(/[.\s,;:-]+$/, '')
    .replace(/^(.*[a-z])\s*-?\s*(\d+)$/i, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!s) return null;
  return s.replace(/(^|[\s&/-])([a-z])/g, (_m, a, l) => a + l.toUpperCase()).slice(0, 100);
}

const LETTER_SIZES = ['XXS', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL'];
/** Clothing size order: kids' ages, then letters (S < M < XL < 2XL), then waist inches. */
export function sizeRank(size) {
  const s = String(size ?? '')
    .trim()
    .toUpperCase()
    .replace(/^XXL$/, '2XL')
    .replace(/^XXXL$/, '3XL');
  const age = /^(\d+)(?:\s*-\s*\d+)?\s*Y/.exec(s);
  if (age) return Number(age[1]);
  const letter = LETTER_SIZES.indexOf(s);
  if (letter >= 0) return 100 + letter;
  const inches = /^(\d+(?:\.\d+)?)/.exec(s);
  if (inches) return 200 + Number(inches[1]);
  return 1000;
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
  Vermiculite: {
    chain: [AGRI, ['fertilizer', 'Fertilizer'], ['vermiculite', 'Vermiculite']],
    filters: FERTILIZER_FILTERS,
    derive: deriveVermiculite,
  },
  'Soil Amendments': {
    chain: [AGRI, ['fertilizer', 'Fertilizer'], ['soil-amendments', 'Soil Amendments']],
    filters: FERTILIZER_FILTERS,
    derive: deriveSoilAmendment,
  },
  'Air Fresheners': basicTarget(
    ['cleaning-products', 'Cleaning Products'],
    ['air-fresheners', 'Air Fresheners'],
  ),
  'Fish Food': basicTarget(
    ['pet-products', 'Pet Supplies'],
    ['fish', 'Fish'],
    ['fish-food', 'Fish Food'],
  ),
  'Cat Health Supplies': basicTarget(
    ['pet-products', 'Pet Supplies'],
    ['cat', 'Cat'],
    ['cat-health-supplies', 'Cat Health Supplies'],
  ),
  'Cement & Mortar': basicTarget(['hardwares', 'Hardwares'], ['cement-mortar', 'Cement & Mortar']),
  'Potting Mix': {
    derive: derivePottingMix,
    chain: [
      ['lawn-and-gardening', 'Agri and Gardening'],
      ['fertilizer', 'Fertilizer'],
      ['potting-mix', 'Potting Mix'],
    ],
    filters: FERTILIZER_FILTERS,
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
  'Bird Netting': netTarget(['bird-netting', 'Bird Netting']),
  'Insect Netting': netTarget(['insect-netting', 'Insect Netting']),
  'Shade Netting': netTarget(['shade-netting', 'Shade Netting']),
  'Plant Support Netting': netTarget(['plant-support-netting', 'Plant Support Netting']),
  'Garden Fencing': netTarget(['garden-fencing', 'Garden Fencing']),
  'Bird Cages & Covers': basicTarget(
    ['pet-products', 'Pet Supplies'],
    ['birds', 'Birds'],
    ['bird-cages', 'Bird Cages & Covers'],
  ),
  Cricket: basicTarget(['sports-fitness', 'Sports & Fitness'], ['cricket', 'Cricket']),
  Cargo: {
    chain: [
      ['clothing', 'Clothing'],
      ['bottomwear', 'Bottomwear'],
      ['cargos', 'Cargos'],
    ],
    filters: CLOTHING_FILTERS,
    derive: deriveCargo,
    variantOptions: ['size', 'color'],
  },
  'Bed Mosquito Nets': {
    chain: [
      ['home-furnishing', 'Home Furnishing'],
      ['mosquito-nets', 'Mosquito Nets'],
      ['bed-mosquito-nets', 'Bed Mosquito Nets'],
    ],
    filters: MOSQUITO_NET_FILTERS,
    derive: deriveMosquitoNet,
    // Mosquitoes are insects: also on the Insect Netting shelf.
    also: ['Insect Netting'],
  },
  'Window & Door Mosquito Nets': {
    chain: [
      ['home-furnishing', 'Home Furnishing'],
      ['mosquito-nets', 'Mosquito Nets'],
      ['window-door-mosquito-nets', 'Window & Door Mosquito Nets'],
    ],
    filters: MOSQUITO_NET_FILTERS,
    derive: deriveMosquitoNet,
    also: ['Insect Netting'],
  },
  'Mosquito Killer Racket': basicTarget(
    ['electrical-and-lights', 'Electrical and Lights'],
    ['mosquito-killer-racket', 'Mosquito Killer Racket'],
  ),
  'Insect Killers & Pest Control': basicTarget(
    ['electrical-and-lights', 'Electrical and Lights'],
    ['insect-killers', 'Insect Killers & Pest Control'],
  ),
  'Storage Containers': basicTarget(
    ['stainless-steel-vessels', 'Kitchenware'],
    ['storage-containers', 'Storage Containers'],
  ),
  'Outdoor Toys': basicTarget(['toys', 'Toys & Games'], ['sportsoutdoor', 'Outdoor Toys']),
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
