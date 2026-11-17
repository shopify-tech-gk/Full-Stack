// v1.20 deliveries that mix other kinds of product into one "Target Name": the cleaning delivery's
// "Wipers" are mostly car windscreen wipers, the auto delivery's "Floor Mats" are bath mats and
// doormats, its "LED Lights" are home string lights and bulbs. Each rule tests the lower-cased
// title + Amazon "Category Path"; the first match sends the product to the app category it really
// is, or skips it (null) when the app has no category for it - never onto the wrong shelf.
// Used by scripts/import-products-json.mjs.

/** Amazon paths that are vehicle (car / bike / cycle) products. */
const VEHICLE_PATH =
  /car & motorbike|car accessories|motorbike|automobile|automotive|vehicle|car electronics|car care|car travel|cycl|bike|tyre|helmet|exterior accessories|interior accessories/;

/**
 * Auto targets whose deliveries carry many home / office products: after the rules below, an item
 * whose Amazon path isn't a vehicle path is skipped (no home for it in Auto Accessories).
 */
const VEHICLE_ONLY = new Set([
  'Floor Mats',
  'LED Lights',
  'USB Chargers',
  'Seat Cushions',
  'Seat Covers',
  'Door Guards',
  'Reverse Cameras',
  'Mobile Holders',
  'Number Plate Frames',
  'Parking Sensors',
  'Saddle Bags',
  'Helmet Accessories',
  'Horn',
  'Battery Boosters',
  'Car Organizers',
  'Dash Cameras',
  'Sun Shades',
  'Car Chargers',
]);

const REROUTES = {
  // --- cleaning delivery ---
  Wipers: [[/windscreen|windshield|wiper blade|wiper arm|wiper refill for car/, 'Wiper Blades']],
  Brushes: [
    [/make-?up brush|kabuki|foundation brush|eyeshadow brush|blush brush/, 'Makeup Brushes'],
    [/paint ?brush|painting brush|artist|acrylic|water ?colou?r|gouache/, 'Paint Brushes'],
    [/\bpet\b|\bdogs?\b|\bcats?\b|slicker|deshed/, 'Pet Brushes'],
    [
      /pastry|basting|oil brush|oil bottle|spatula|bbq|tooth ?brush|oral care|hair ?brush|hair styling|\bcomb\b|detangl|face|facial|skin care|massager|eyebrow|eyelash|beard|nail|bathing accessories|bath brush|loofah/,
      null,
    ],
  ],
  'Biodegradable Bags': [[/disposal bag/, 'Biodegradable Bags']],
  // A car-washing sponge filed as a badge.
  'Washing Powders': [[/badges & emblems/, 'Car Cleaning']],
  Scrubbers: [[/loofah|bath brush|bathing accessories|foot|heel|nail|body scrub|back scrub/, null]],

  // --- clothing deliveries: names the app spells differently / lists in two mains, and the few
  // non-clothing items filed with them ---
  'women lehenga cholis': [[/./, "Women's Lehenga Cholis"]],
  // The source paths on these deliveries are often wrong (bib overalls under "blankets", collar
  // stays under "neck braces", dupattas under "sindoors"), so clothing rules match the TITLE only.
  'mens dungarees': [[/./, "Men's Dungarees"]],
  'womens jumpsuits': [[/./, "Women's Jumpsuits and Dungarees"]],
  'mens tracksuits': [[/./, "Men's Tracksuits"]],
  'womens tracksuits': [[/./, "Women's Tracksuits"]],
  'applique patches': [[/./, 'Applique Patch']],
  'womens clothing': [[/./, "Women's Clothing"]],
  gloves: [[/./, 'Clothing › Gloves']],
  // Satin trim ribbons: Clothing Accessories, and the party Backdrop Decorations page too.
  ribbons: [[/./, 'Clothing › Ribbons', ['Party Decorations › Ribbons']]],
  // The app menu has Embroidery Kits under Clothing Accessories and under Arts and Crafts' Craft
  // Kits: filed with the other embroidery items, shown on both pages.
  'embroidery kits': [[/./, 'Clothing › Embroidery Kits', ['Arts and Crafts › Embroidery Kits']]],
  // Foam / rope hot knives and cardboard scissors are workshop tools, not fabric cutters.
  'fabric cutters': [[/^[^|]*(styrofoam|foam|hot knife|rope|cardboard|zipsnip|lanyard)/, 'Hand Tools']],

  // --- baby care delivery: names the app spells differently / lists in two mains ---
  'baby bottle accessories': [[/./, 'Baby Care › Bottle Accessories']],
  'baby travel systems': [[/./, 'Travel Systems']],
  'bath toys': [[/./, 'Baby Care › Bath Toys']],
  'musical toys': [
    [/baby/, 'Baby Care › Musical Toys'],
    [/./, 'Toys & Games › Musical Toys'],
  ],
  'grooming kits': [[/./, 'Baby Care › Grooming Kits']],

  // --- auto delivery ---
  'Air Fresheners': [[/\bcar\b|vehicle|dashboard|\bvent\b/, 'Car Fresheners']],
  'Floor Mats': [
    [/bath mats|bath & shower safety mats|bathroom linen/, 'Bath Mats'],
    [/doormats/, 'Door Mats'],
    [/kitchen rugs & mats/, 'Mats'],
    [/carpets & rugs > carpets/, 'Carpets'],
    [/carpets & rugs > runners/, 'Runner Rugs'],
    [/carpets & rugs > rugs|outdoor rugs/, 'Area Rugs'],
  ],
  'LED Lights': [
    [/string lights|diwali decorations/, 'String Lights'],
    [/light bulbs > led bulbs/, 'LED Bulbs'],
    [/night lights|usb gadgets > lamps/, 'Night Lamps'],
    [/led strips/, 'Decorative Lights'],
    [/wall lamps & sconces/, 'Wall Lights'],
    [/tube lights & battens/, 'LED Tubelights'],
    [/office ceiling lights|recessed lighting|close-to-ceiling/, 'LED Ceiling Lights'],
    [/pendant lights/, 'Pendant Lights'],
    [/street and area lighting/, 'Street Lights'],
    [/flashlights/, 'Torch Lights'],
    [/outdoor lighting|patio lighting|security lighting/, 'Outdoor Lights'],
  ],
  'USB Chargers': [
    [/automobile chargers/, 'Car Chargers'],
    [
      /wall chargers|international chargers|tablet accessories > chargers|laptop chargers/,
      'Chargers',
    ],
    [/usb cables|cables & adapters/, 'Cables'],
    [/international power adapters|multi-outlets/, 'Adapters'],
    [/power strips/, 'Power Strips'],
    [/power banks/, 'Power Banks'],
    [/string lights/, 'String Lights'],
    [/night lights|usb gadgets > lamps/, 'Night Lamps'],
    [/usb gadgets > fans|table fans/, 'Table Fans'],
    [/electric lanterns/, 'Torch Lights'],
  ],
  'Car Chargers': [[/pressure washers/, 'Car Cleaning']],
  'Seat Cushions': [
    [/sofa slipcovers/, 'Sofa Covers'],
    [
      /back & seat cushions|accessories & parts > cushions|lumbar pillows|cushions & cushion covers/,
      'Cushions',
    ],
  ],
  'Seat Covers': [
    [/dining chair slipcovers|armchair slipcovers/, 'Chair Covers'],
    [/sofa slipcovers/, 'Sofa Covers'],
    [/toilets & toilet parts > toilet seats/, 'Toilet Seats'],
  ],
  'Door Guards': [[/door hardware & locks > stops/, 'Door Stoppers']],
  'Reverse Cameras': [
    [/baby monitors/, 'Baby Monitors'],
    [/security cameras|surveillance video|security monitors/, 'CCTV'],
  ],
  'Mobile Holders': [
    [/automobile accessories > cradles|mobile accessories > mounts/, 'Car Mounts'],
    [/handlebar mounts/, 'Mobile Holders'],
    [
      /mobile accessories > stands|bedstand & desk mounts|shower & wall mounts/,
      'Mobile Accessories',
    ],
    [/camera mounts|tripod/, 'Camera Accessories'],
    [/toilet paper holders/, 'Toilet Paper Holders'],
  ],
  'Parking Sensors': [
    [/light bulbs > led bulbs/, 'LED Bulbs'],
    [/security lighting|solar lights|pathway lighting|outdoor lighting/, 'Outdoor Lights'],
    [/flashlights/, 'Torch Lights'],
    [/security cameras/, 'CCTV'],
  ],
  'Saddle Bags': [[/sling & cross-body|messenger & sling/, 'Sling Bags']],
  'Helmet Accessories': [
    [/action camera accessories|action camera cases/, 'Camera Accessories'],
    [/scarves/, 'Scarves'],
  ],
  Horn: [[/lights & reflectors > headlights/, 'LED Lights']],
  'Battery Boosters': [
    [/power banks/, 'Power Banks'],
    [/international power adapters/, 'Adapters'],
  ],
  'Dash Cameras': [[/memory cards/, 'Memory Cards']],
  'Sun Shades': [[/shade sails|sunscreen fabric|plant netting/, 'Shade Netting']],
  'Wiper Blades': [
    [/squeegees/, 'Wipers'],
    [
      /masonry & tiling tools|kitchen brushes|zesters|cleaning tools > scrubbers|cleaning supplies > brushes/,
      null,
    ],
  ],
  'Bike Tool Kits': [
    [/tire repair kits/, 'Tyre Repair Kits'],
    [/> screwdriver sets|> screwdrivers & nut drivers/, 'Screwdriver Sets'],
    [/wrenches > hex keys/, 'Allen Keys'],
    [/spanners & wrenches|socket sets|socket wrench sets|drive sockets/, 'Wrenches'],
    [/drills|impact drivers|power tools/, 'Drills'],
    [/diamond painting|leathercraft|nail tools|polishing pads/, null],
  ],
  'Car Tool Kits': [
    [/> screwdriver sets|hand tools > screwdrivers/, 'Screwdriver Sets'],
    [/wrenches > hex keys/, 'Allen Keys'],
    [/spanners & wrenches|socket sets|socket wrench sets|drive sockets/, 'Wrenches'],
    [/hammers/, 'Hammers'],
    [/drills|impact drivers|drill drivers/, 'Drills'],
    [/model building|sewing sets|soldering|painting craft|squeegees|buffing wheels/, null],
  ],
  'Bike Riding Gear': [[/skirts|keyrings|shoulder bags|messenger & sling|face masks/, null]],
  'Bike Mirrors': [[/keyrings|accessories > glasses|safety mirrors|camera mounts/, null]],
  'Microfiber Cloths': [[/eye care|hair drying towels|face towels|table cloths/, null]],
  'Car Organizers': [
    [/waste & recycling > dustbins|accessories > car organisers/, 'Car Organizers'],
  ],
  'Emergency Tool Kits': [
    [/sewing sets|keyrings|water storage|storage boxes|lighters|whistles/, null],
  ],
  'Car Polish': [[/hand sanitizers|tapes, adhesives/, null]],
  'Car Shampoo': [[/shampoo & conditioner/, null]],
  'Car Wax': [[/laundry detergents|suction cups/, null]],
};

/** Storefront slug of the Baby Care main category. */
const BABY_ROOT = 'baby-care';

/** Off-topic items inside any cleaning delivery (toothpaste in Stain Removers...): skipped. */
const CLEANING_OFF_TOPIC =
  /oral care|toothpaste|hair colou?r|shampoo & conditioner|sanitary napkin|homeopathic|screwdriver|facial roller|skin care tools|moisturi[sz]er|deodorants & antiperspirants|pain relief|binding covers|badges & emblems/;

/**
 * The nearest app category for an off-topic item no rule above places (by its Amazon path).
 * Products are never dropped: what isn't matched here stays on the delivery's own category.
 */
const RELATED = [
  // Adult personal care / home items found in baby deliveries.
  [
    /solid soap bars|body washes > body lotions|body butters|talcum|massage creams|therapeutic skin/,
    'Body Care',
  ],
  [/body wash gels|cleansers > body wash/, 'Body Wash'],
  [/hair care > hair oils|hair oils/, 'Hair Oil'],
  [/pest control > mosquito nets/, 'Mosquito Nets'],
  [/blankets & throws/, 'Blankets'],
  [/bathroom linen > bath mats/, 'Bath Mats'],
  [/kettles & hot water/, 'Electric Kettles'],
  [/toilets & toilet parts > toilet seats/, 'Toilet Seats'],
  [/creams & moisturisers > face creams/, 'Face Creams'],
  // Personal care found in cleaning deliveries (toothbrushes among "Brushes", loofahs among
  // "Scrubbers", conditioner among "Fabric Softeners"...).
  [/baby toothbrushes|baby & child dental|baby care > grooming/, 'Baby Oral Care'],
  [/toothbrush holders/, 'Toothbrush Holders'],
  [/toothbrush|toothpaste|teeth whitening|oral care/, 'Grooming'],
  [/shampoo & conditioner > conditioners/, 'Conditioner'],
  [/shampoo & conditioner > shampoos/, 'Shampoo'],
  [/hair styling|hair colou?r|hair care|scalp massagers|straighteners/, 'Hair Care'],
  [/foot rasps|callus|foot care/, 'Foot Care'],
  [/nail tools|nail brushes/, 'Nail Care'],
  [/moisturi[sz]ers/, 'Moisturizers'],
  [/skin care tools|facial cleansing|facial rollers|facial steamers|exfoliation/, 'Skin Care'],
  [/eyebrow|eyes >/, 'Makeup'],
  [/beard & moustache/, 'Beard Care'],
  [/shaving/, 'Shaving'],
  [/deodorants/, 'Deodorants'],
  [
    /loofahs|bath brushes|bathing accessories|shower & bath|sanitary napkins|pain relief|homeopathic/,
    'Body Care',
  ],
  [/pastry brushes|basting brushes|oil preparation/, 'Kitchen Tools'],
  [/binding covers/, 'File Folders'],
  [/screwdriver sets/, 'Screwdriver Sets'],
  [
    /door & window guards|draft stoppers|weather stripping|door hardware|edge & corner guards/,
    'Door Stoppers',
  ],
  [/keyrings & keychains|key cases/, 'Keychains'],
  [
    /name plaques|house numbers|signs & plaques|address plaques|decorative plates|message boards/,
    'Plaques',
  ],
  [/face masks|balaclavas|multifunctional headwear/, 'Bike Riding Gear'],
  [/skullies|beanies|caps & hats|hats & headwear|berets|> hats/, 'Caps'],
  [/blowers|pressure washers|handheld vacuums/, 'Car Cleaning'],
  [/shoe horns|shoe care/, 'Shoe Accessories'],
  [/sling & cross-body|messenger & sling/, 'Sling Bags'],
  [
    /handbags|shoulder bags|top-handle|satchels|clutches|backpacks|waist packs|duffles|suitcases|hydration packs/,
    'Travel Bags',
  ],
  [/handbag hangers|wall hooks|key holders|multi-purpose hooks|hooks & hangers/, 'Hooks'],
  [/motion detectors|alarms|sensors|chimes/, 'Smart Sensors'],
  [/camping furniture > stools/, 'Stools'],
  [/camping furniture > chairs/, 'Garden Chairs'],
  [/hard hat|head protection/, 'Safety Helmets'],
  [/switches/, 'Modular Switches'],
  [/tea lights|candles/, 'Candles'],
  [/sewing sets|sewing kits/, 'Sewing Kits'],
  [/sprayers & accessories/, 'Sprayers'],
  [
    /battery chargers|power supplies|laptop chargers|automobile chargers|chargers & adapters/,
    'Chargers',
  ],
  [/brooms/, 'Brooms'],
  [/kitchen brushes|cleaning supplies > brushes|cleaning tools > scrubbers/, 'Brushes'],
  [/voltage testers|electrical testing|temperature indicators/, 'Measuring Tools'],
  [/eye care|cleaning tissues/, 'Cleaning Cloths'],
  [/hair drying towels|face towels/, 'Face Towels'],
  [/table cloths/, 'Table Cloths'],
  [/yoga > mats|exercise equipment mats|playmats/, 'Mats'],
  [
    /specialty lighting|under-cabinet|continuous output lighting|selfie lights|led diodes/,
    'Decorative Lights',
  ],
  [/usb cables|cable connection|cable organiser|cable straps/, 'Cables'],
  [/lanyards|holsters|card holders|screen expanders|mobile accessories/, 'Mobile Accessories'],
  [/id cases|card cases|wallets|travel accessories|bag covers|shoe bags/, 'Travel Accessories'],
  [/medical pillows/, 'Sleeping Pillows'],
];

/**
 * Where a product really goes (a target name). `rootOf(name)` gives the slug of the main category a
 * target name files under. Nothing is skipped here (Amazon's own brands are, by the importer).
 */
export function routeProduct(targetName, title, categoryPath, rootOf) {
  const path = String(categoryPath ?? '').toLowerCase();
  const text = `${String(title ?? '').toLowerCase()} | ${path}`;
  const related = () => RELATED.find(([re]) => re.test(path))?.[1] ?? targetName;
  // A rule's optional third entry: other app categories the product is ALSO listed on.
  for (const [re, to, also] of REROUTES[targetName] ?? []) {
    if (re.test(text)) return { name: to ?? related(), also: also ?? [] };
  }
  if (VEHICLE_ONLY.has(targetName) && path && !VEHICLE_PATH.test(path)) {
    return { name: related() };
  }
  const root = rootOf(targetName);
  if (root === 'cleaning-products' && CLEANING_OFF_TOPIC.test(path)) {
    return { name: related() };
  }
  // Baby deliveries: an item whose Amazon path isn't a baby / kids path goes to the nearest adult
  // category when there is one (adult hair brushes, soap bars...); otherwise it stays.
  if (root === BABY_ROOT && path && !/baby|nursery|kid|child|infant|toddler|toys/.test(path)) {
    return { name: related() };
  }
  return { name: targetName };
}
