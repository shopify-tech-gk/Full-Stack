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

/**
 * Non-floral items mixed into the artificial flowers delivery, matched on "title | path"
 * (lehengas, paper plates, incense, pebbles...): each goes to its own app category.
 */
const ARTIFICIAL_STRAYS = [
  [/lehenga/, "Women's Lehenga Cholis"],
  [/dhoti kurta/, 'Ethnic Sets'],
  [/sleep & lounge wear > babydolls/, 'Babydolls'],
  [/ethnic wear > dress material/, 'Dress Materials'],
  [/hair styling accessories|hair accessories/, 'Hair Accessories'],
  [/mangalsutra/, 'Mangalsutra'],
  [/jewellery > women > jewelry sets/, 'Jewellery Sets'],
  [/disposable tableware|paper plate/, 'Paper Plates'],
  // Incense / dhoop sticks (the "Flower Sticks" in this delivery are temple-flower incense): home
  // fragrance, as Religion has no storefront section yet.
  [/incense|agarbatti|dhoop/, 'Air Fresheners'],
  [/broom|floor wiper/, 'Wipers'],
  [/grass carpet|grass mat|lawnmat|synthetic turf/, 'Artificial Grass'],
  [/furniture pads|furniture protector/, 'Furniture Fittings'],
  [/^[^|]*machine[^|]*stand/, 'Washing Machines'],
  // Pebbles by their own category path (many flowers are sold "with decorative pebbles").
  [/\|.*(decorative stones|decorative marbles|hardscaping)/, 'Garden Decor'],
  // Empty pots / planters (not sold with an artificial plant): the gardening shelves; pots are
  // listed on this main's Artificial Plant Pots page too.
  [
    /^(?![^|]*(artificial|fake|faux))[^|]*\|.*plant containers > hanging planters/,
    'Hanging Planters',
  ],
  [
    /^(?![^|]*(artificial|fake|faux))[^|]*\|.*plant containers > flower pots/,
    'Pots & Planters',
    ['Artificial Plant Pots'],
  ],
  [/photo backgrounds/, 'Wedding Backdrops'],
  [/model kit/, 'DIY Kits'],
];

/**
 * Non-bath items mixed into the bath fittings delivery, matched on "title | path" (curtains in
 * Shower Panels, potty seats in Toilet Seats, pools in Whirlpool Tubs...).
 */
const NOT_A_HOLDER = '(?![^|]*(holder|\\bring\\b(?! ?-? ?spun)|rack|\\brod\\b|\\bbar\\b|hanger|stand|hook|shelf|clip))';
const NOT_CURTAIN_PART = '(?![^|]*(shower|hook|\\brings?\\b|\\brod\\b|bracket|clip|track))';
const BATH_STRAYS = [
  [/^[^|]*(backdrop|foil curtain|fringe curtain|tinsel curtain)/, 'Wedding Backdrops'],
  // Window / door curtains (shower curtains stay with the shower panels; curtain hooks with hooks).
  [new RegExp(`^${NOT_CURTAIN_PART}[^|]*blackout[^|]*\\|.*curtains`), 'Blackout Curtains'],
  [new RegExp(`^${NOT_CURTAIN_PART}[^|]*(sheer|\\bnet\\b|tulle)[^|]*\\|.*curtains`), 'Sheer Curtains'],
  [new RegExp(`^${NOT_CURTAIN_PART}[^|]*window[^|]*\\|.*curtains`), 'Window Curtains'],
  [new RegExp(`^${NOT_CURTAIN_PART}[^|]*curtain[^|]*\\|.*curtains`), 'Door Curtains'],
  [/^(?![^|]*(litter|\bcats?\b))[^|]*\|.*potty seats/, 'Potty Training'],
  [
    /^(?![^|]*(squat|step stool|adult|litter|\bcats?\b))[^|]*(potty|toilet training|training seat|toilet trainer)/,
    'Potty Training',
  ],
  [
    new RegExp(
      `^${NOT_A_HOLDER}(?![^|]*(dispenser|towel))[^|]*(\\bply\\b|\\d+ pulls|toilet tissue|tissue roll|toilet paper roll)`,
    ),
    'Tissue Paper',
  ],
  [/^(?![^|]*(brush|holder|stand))[^|]*(toilet (bowl )?cleaner|harpic|domex|sani fresh)/, 'Toilet Cleaners'],
  [/^(?![^|]*(brush|holder))[^|]*kitchen cleaner/, 'Kitchen Cleaners'],
  // Whirlpool is also a washing machine brand: spin caps, gear boxes, descalers, inlet hoses.
  [/scalegon|^[^|]*(descal[^|]*washing machine|washing machine[^|]*descal)/, 'Washing Machines'],
  [/^[^|]*(inlet (hose|pipe)|water fill)[^|]*washing machine/, 'Washing Machines'],
  [
    /^(?![^|]*(\btap\b|faucet|bib|cock|valve|inlet|outlet|pipe|hose))[^|]*(washing machine|spin cap)/,
    'Washing Machines',
  ],
  [
    /^(?![^|]*(brush|filter|overhead shower|shower arm))[^|]*(limescale|descal|tap cleaner|tap & shower cleaner|faucet cleaner|bathroom cleaner|stain remover|chrome cleaner|tap and shower cleaner)/,
    'Bathroom Cleaners',
  ],
  [/^[^|]*(gaming rug|area rug)/, 'Area Rugs'],
  [/^[^|]*\b(bath mat|bathroom mat|shower mat|anti skid mat|anti - slip mat|floor mat)s?\b/, 'Bath Mats'],
  [
    /^(?![^|]*(brush|\bmat\b|scrub|sponge))[^|]*(swimming pool|kiddie pool|kids pool|paddling pool|baby pool|water pool|family pool)/,
    'Swimming',
  ],
  // Towels themselves (not towel rings / racks).
  [new RegExp(`^${NOT_A_HOLDER}[^|]*\\|.*towels > hand towels`), 'Hand Towels'],
  [new RegExp(`^${NOT_A_HOLDER}[^|]*\\|.*towels > face towels`), 'Face Towels'],
  [new RegExp(`^${NOT_A_HOLDER}[^|]*\\|.*towels > bath towels`), 'Bath Towels'],
  [new RegExp(`^${NOT_A_HOLDER}[^|]*\\|.*kitchen linens`), 'Kitchen Towels'],
  [new RegExp(`^${NOT_A_HOLDER}[^|]*(napkin|hand towel)[^|]*\\|.*bathroom linen`), 'Hand Towels'],
  [new RegExp(`^${NOT_A_HOLDER}[^|]*towel[^|]*\\|.*bathroom linen`), 'Bath Towels'],
  [/^[^|]*crochet/, 'Hand Sewing Needles'],
  [/^[^|]*(eye pins|jewell?e?ry making)/, 'Jewellery Making Kits'],
  [/^[^|]*(car seat|car back seat|car headrest|headrest hook)/, 'Car Organizers'],
  [/^[^|]*(sewing fastener|hooks? (and|&) eyes?)/, 'Hooks & Eyes'],
  [/^[^|]*toiletry bag/, 'Toiletry Bags'],
  [
    /^[^|]*(paddle mixer|paint mix|concrete mix|mortar mix|drill mixer|mixer drill|mixing paddle|paint mate|putty mix|cement mixer|mud mixer|mixing machine)/,
    'Concrete Tools',
  ],
  [
    /^[^|]*(caulk|sealing strip|sealant tape|sealing tape|sink platform sticker|corner tape|trim tape|waterproof tape|sealant strip)/,
    'Sealants',
  ],
  [
    /^(?![^|]*(ceramic|vessel|coupling|jali|\btap\b|faucet|commode|shower|spray|ice bath))[^|]*(bucket|foldable (wash|basin)|collapsible (wash|basin)|wash - tub|laundry tub|dish tub)/,
    'Water Buckets',
  ],
  // Mixer grinders / blenders (the "Mixers" in tap targets), their stands go with kitchen organisers.
  [
    /^(?![^|]*bathroom)[^|]*(mixer grinder[^|]*stand|spice rack|cord (organi[sz]er|wrap|holder))/,
    'Kitchenware › Kitchen Organizers › Kitchen Organizers',
  ],
  [/^(?![^|]*(\btap\b|faucet))[^|]*(mixer grinder|blender|juicer)/, 'Mixer Grinders'],
  [/^(?![^|]*(toilet|\btub\b|bathtub))[^|]*(splash guard|splash baffle)/, 'Kitchenware › Kitchen Organizers › Kitchen Organizers'],
  [
    /^(?![^|]*(toilet|\btub\b|bathtub|bathroom|soap (dish|holder)))[^|]*(sponge holder|sink caddy|sink organi[sz]er)/,
    'Kitchenware › Kitchen Organizers › Kitchen Organizers',
  ],
  [
    /^(?![^|]*(toilet|bathroom|\btub\b|bathtub|coupling|\bpipe\b|extender|aerator))[^|]*\|.*(paper towel holders|kitchen sponge holders|spice racks|dish racks|kitchen sink accessories)/,
    'Kitchenware › Kitchen Organizers › Kitchen Organizers',
  ],
  // Smaller strays, each to its own app category.
  [/^(?![^|]*(faucet|valve|\btap\b))[^|]*(litter|cat toilet)/, 'Pet Training'],
  [
    /^(?![^|]*(health faucet|faucet|valve|\btap\b|diverter))[^|]*(hamster|gerbil|chinchilla|\bpets?\b[^|]*(shower|sprayer|bath)|dog bath|puppies)/,
    'Pet Supplies › Pet Grooming › Grooming Kits',
  ],
  [/^(?![^|]*(dispenser|holder|brush|pump))[^|]*(dish ?wash(ing)? bar|dish wash bar|utensil cleaning|black soap)/, 'Dishwashing Bars'],
  [
    /^(?![^|]*(dispenser|holder|brush|pump|caddy|tray))[^|]*(dishwash(er|ing)? liquid|dish soap|dish spray|liquid soap concentrate)/,
    'Dishwashing Liquids',
  ],
  [/^(?![^|]*(holder|dispenser))[^|]*sanitizer spray/, 'Disinfectants'],
  [/^(?![^|]*(squeegee|wiper|brush))[^|]*glass cleaner/, 'Glass Cleaners'],
  [/^[^|]*(drain cleaner|drain opener|drain cleaning|dranex|hair catching claw)/, 'Drain Cleaners'],
  [/^(?![^|]*(brush|plunger))[^|]*(all purpose cleaner|multi surface cleaner|cleaning combo)/, 'All Purpose Cleaners'],
  [/^(?![^|]*(holder|hook|hanger|organi[sz]er))[^|]*\bmop\b/, 'Mops'],
  [
    /^(?![^|]*(pipe|hose|connection|\btap\b|faucet|shower|valve|\bcock\b|hook|hanger))[^|]*(water heater|geyser)/,
    'Instant Water Heaters',
  ],
  [/^(?![^|]*(\btap\b|faucet))[^|]*(solar panel|sprinkler)/, 'Sprinklers'],
  [/^[^|]*(floor drain|backflow|anti core|sewer seal|drain pipe seal|anti - rat|anti rat|cockroach)/, 'Floor Drains'],
  [
    /^(?![^|]*(shower|faucet|geyser|basin|sink|drain|sewer|hanger|holder))[^|]*(garden (pipe|hose)|hose connector|pipe connector|connector joint|quick connector|pipe coupler|sprinkler pipe)/,
    'Hose Connectors',
  ],
  [/^(?![^|]*(\btap\b|\bcock\b|faucet))[^|]*(garden water pipe sprayer|hose nozzle)/, 'Sprayers'],
  [/^[^|]*embroidery/, 'Arts and Crafts › Embroidery Kits'],
  [/^(?![^|]*splash)[^|]*(water (dam|stopper|barrier)|weather strip|liquid rubber|waterproofing)/, 'Sealants'],
  [/^(?![^|]*(artificial|fake|faux|stool|hooks?\b))[^|]*(flower pots?|planters?|plant pots?)\b/, 'Pots & Planters'],
  [/^[^|]*(incense|agarbatti|dhoop)/, 'Air Fresheners'],
  [/^[^|]*\bcandles?\b/, 'Candles'],
  [/^[^|]*(play ?dough|fundough)/, 'Modelling Clay'],
  [/^(?![^|]*(\btap\b|faucet))[^|]*(water fountain|tabletop fountain|indoor fountain)/, 'Garden Fountains'],
  [/^[^|]*bird ?bath/, 'Bird Baths'],
  [/^[^|]*shelf brackets?/, 'Hardwares › Building Hardware › Brackets'],
  [/^[^|]*(shower hinges|glass door hinges?)/, 'Hardwares › Door & Cabinet Handles › Hinges'],
  // Kitchen racks (knife / mug / pot lid racks) filed as towel racks.
  [
    /^(?![^|]*bathroom)[^|]*\|.*(utensil holders|cutlery (racks|trays)|mug holders|pot racks)/,
    'Kitchenware › Kitchen Organizers › Kitchen Organizers',
  ],
  // Kitchen brushes (after the organisers: a sink caddy "with brush holder" is an organiser).
  [/^(?![^|]*(toilet|commode|\bwc\b|bathroom|soap dish))[^|]*(dish|kitchen|utensil)[^|]*(\bbrush(es)?\b|\bscrubber\b)/, 'Scrubbers'],
  // Towels by title (the path rules above catch most).
  ...[
    [/(face towel|washcloth|wash cloth)/, 'Face Towels'],
    [/hand towel/, 'Hand Towels'],
    [/(dish towel|flour sack|kitchen towel)/, 'Kitchen Towels'],
    [/(bath towel|towels for bath|gym towel)/, 'Bath Towels'],
  ].map(([re, to]) => [
    new RegExp(`^${NOT_A_HOLDER}[^|]*${re.source}[^|]*\\|.*(towels|linen|cleaning cloths|exercise)`),
    to,
  ]),
];

/** Bath fixtures (taps, showers, basins, tubs, plumbing): accessories mixed in go to their shelf. */
const NOT_A_FIXTURE = '(?![^|]*(faucet|shower|\\btap\\b|mixer|spray|valve))';
const BATH_FIXTURE_STRAYS = [
  // No Kitchen Sinks menu item yet: the nearest sink shelf.
  [new RegExp(`^${NOT_A_FIXTURE}[^|]*kitchen sink[^|]*(bowl|handmade|\\d+ ?x ?\\d+)`), 'Wash Basins'],
  [new RegExp(`^${NOT_A_FIXTURE}[^|]*soap dispenser`), 'Soap Dishes'],
  [
    new RegExp(
      `^${NOT_A_FIXTURE}[^|]*(corner (shelf|shelves|rack)|shower caddy|\\bcaddy\\b|organi[sz]er|bathroom shelf|storage rack|shelves)`,
    ),
    'Bathroom Shelves',
  ],
  [/^(?![^|]*(toilet|commode|\bwc\b))[^|]*(dish|kitchen|utensil)[^|]*(\bbrush(es)?\b|\bscrub(ber)?s?\b|sponge)/, 'Scrubbers'],
  [
    /^[^|]*(spin scrubber|cleaning brush|scrubber brush|tile brush|floor brush|scrub brush|cloth brush|clothes brush|grout brush|gap brush)/,
    'Cleaning Brush Sets',
  ],
  [/^[^|]*(squeegee|\bwiper\b)/, 'Wipers'],
  [/^[^|]*grab bar/, 'Towel Racks'],
  [new RegExp(`^${NOT_A_FIXTURE}(?![^|]*basin)[^|]*(wall hooks?|adhesive hooks?|door hooks?)`), 'Bathroom Hooks'],
  [/^[^|]*(connection pipe|connector pipe|supply line|inlet hose)/, 'Angle Valves'],
];

/** Kitchen faucets filed as bathroom taps: Kitchen Taps, still listed on their own tap page. */
const kitchenTap = (name) => [
  /^(?![^|]*(bathroom|wash ?basin))[^|]*(kitchen sink|kitchen (faucet|tap|mixer)|sink (faucet|mixer|tap))/,
  'Kitchen Taps',
  [name],
];

const BATH_ACCESSORIES = ['Bathroom Stools', 'Towel Racks', 'Towel Rings', 'Bathroom Hooks', 'Hooks', 'Soap Dishes', 'Toothbrush Holders', 'Bathroom Mirrors', 'Bathroom Shelves', 'Toilet Brushes', 'Toilet Paper Holders', 'Toilet Seats'];
const BATH_FIXTURES = ['Kitchen Taps', 'Pillar Taps', 'Basin Mixers', 'Wall Mixers', 'Shower Mixers', 'Health Faucets', 'Overhead Showers', 'Hand Showers', 'Shower Heads', 'Shower Panels', 'Wash Basins', 'Countertop Basins', 'Corner Basins', 'Pedestal Basins', 'Freestanding Tubs', 'Corner Tubs', 'Whirlpool Tubs', 'Waste Couplings', 'Angle Valves'];

// --- arts and crafts delivery -------------------------------------------------------------------
// Its source paths are reliable while its Target Names are not (hair oil under "Oil Colors", water
// bottles under "Water Colors", BBQ charcoal under "Charcoal"), so these rules match the PATH.
/** A rule on the Amazon path (the text after the last " | "), optionally not when the title has `notTitle`. */
const P = (seg, notTitle) =>
  new RegExp(`^${notTitle ? `(?![^|]*(?:${notTitle}))` : ''}.*\\| [^|]*(?:${seg})[^|]*$`);

const ART_STRAYS = [
  // beauty
  [P('hair care > hair oils'), 'Hair Oil'],
  [P('hair colou?r|hennas'), 'Cosmetics › Hair Care › Hair Care'],
  [P('\\blips > lip glosses'), 'Lip Gloss'],
  [P('\\blips > '), 'Lipstick'],
  // Steel make-up mixing palettes are tools; eyeshadow palettes are eyeshadow.
  [P('make-up palettes', 'mixing'), 'Eyeshadow'],
  [P('make-up palettes'), 'Makeup Brushes'],
  [P('eyes > eyeshadow'), 'Eyeshadow'],
  [P('eyes > kajal'), 'Kajal'],
  [P('eyes > (eyebrow|eyeliner)'), 'Eyeliner'],
  [P('\\bface > blushes'), 'Blush'],
  [P('\\bface > compact powder'), 'Compact Powder'],
  [P('\\bface > concealer'), 'Concealer'],
  [P('\\bface > (face masks|face pack)'), 'Face Masks'],
  [P('face wash|cleansing creams'), 'Face Wash'],
  [P('solid soap bars'), 'Body Wash'],
  [P('oral care|hair cutting tools'), 'Cosmetics › Grooming › Grooming'],
  [P('nose & ear trimmers|moustache & beard'), 'Trimmers'],
  [P('nails > nail polish'), 'Nail Polish'],
  [P('false nails|nail art'), 'Nail Care'],
  [P('false eyelashes'), 'Mascara'],
  [P('make-up brushes|facial cleansing brushes|skin care tools', 'art brush|artist|paint'), 'Makeup Brushes'],
  [P('temporary tattoos|tattoo accessories|hot & cold therapies', 'stencil'), 'Cosmetics › Body Care › Body Care'],
  // home, kitchen, garden, pets
  [P('feeding & watering'), 'Pet Feeding Accessories'],
  [P('water bottles'), 'Kitchenware › Plastic Household › Water Bottles'],
  [P('aquarium'), 'Aquarium Accessories'],
  [P('faucet mounts|replacement faucet'), 'Kitchen Taps'],
  [P('water purifier|water filtration|water quality'), 'RO Purifiers'],
  [P('sink aerators'), 'Kitchen Taps'],
  [P('facial tissue|toilet tissue|paper towels'), 'Tissue Paper'],
  [P('wraps & bags > napkins'), 'Paper Napkins'],
  [P('mold removers'), 'Bathroom Cleaners'],
  [P('baby care > (nail care|grooming)'), 'Baby Nail Clippers'],
  [P('gardening scissors'), 'Pruners/Secateurs'],
  [P('manual weeders|gardening > gardening tools'), 'Garden Hand Tools'],
  [P('chopping boards'), 'Cutting Boards'],
  [P('hot plates'), 'Induction Cooktops'],
  [P('picnic'), 'Kitchenware › Storage Containers › Lunch Boxes'],
  // Charcoal tablets for dhoop / bakhoor burners are incense supplies, not barbecue fuel.
  [/^[^|]*(dhoop|bakhoor|incense|loban|hookah|sambrani).*\| [^|]*barbecue/, 'Air Fresheners'],
  [P('barbecue'), 'Furniture › Outdoor Furniture › Outdoor Furniture'],
  [P('incense|home fragrance|air fresheners'), 'Air Fresheners'],
  [P('plant stands'), 'Agri and Gardening › Plant Stands › Plant Stands'],
  [P('seat cushions'), 'Seat Cushions'],
  [P('car & motorbike > .*seat'), 'Auto Accessories › Car Interior Accessories › Seat Covers'],
  [P('car & motorbike > paintwork|paint & exterior care'), 'Car Polish'],
  [P('tarps'), 'Greenhouse Covers'],
  [P('shopping bags|> handbags'), 'Sling Bags'],
  // Canvas shoes and shoe whitener (Amazon's "Shoes & Handbags").
  [P('shoe care', 'glue|fevi'), 'Shoe Polish'],
  [P("boys' shoes|girls' shoes"), 'School Shoes'],
  [P("women's shoes"), "Women's Sneakers"],
  [P("\\bmen's shoes"), 'Canvas Shoes'],
  [P('school supplies > pencil cases'), 'Pencil Cases'],
  [P('tool bags|tool organisers'), 'Tool Organizers'],
  [P("women's > wallets"), 'Travel Wallets'],
  [P('boxes, baskets & bins'), 'Plastic Storage Boxes'],
  [P('curtains & drapes'), 'Window Curtains'],
  [P('night lights'), 'Night Lamps'],
  [P('wall lamps'), 'Wall Lights'],
  [P('fish bowls'), 'Fish Tanks'],
  [P('birds > toys|birdcage'), 'Bird Toys'],
  [P('bead mazes|baby & toddler toys'), 'Toys & Games › Baby & Bath Toys › Baby Toys'],
  [P('slime & putty'), 'Slime & Putty'],
  [P('learning & education > science|model building kits > robots'), 'STEM Toys'],
  [P('early childhood education'), 'Learning Toys'],
  [P('lapdesks'), 'Laptop Stands'],
  [P('end tables'), 'Side Tables'],
  [P('chair armrests'), 'Office Chairs'],
  // gifts, decor, frames
  [P('rangoli', 'stencil'), 'Diwali Decorations'],
  [P('gift wrap'), 'Gift Boxes'],
  [P('greeting cards'), 'Greeting Cards'],
  [P('photobooth props'), 'Photo Booth Props'],
  [P('photo frames > poster frames'), 'Poster Frames'],
  [P('artwork > posters', 'poster colou?rs|poster paints?'), 'Poster Frames'],
  [P('artwork > (art prints|paintings)', 'stretched canvas|blank canvas|canvas (board|panel)'), 'Painting Frames'],
  [P('plaques & wall art|signs & plaques|wall stickers'), 'Decorative Showpieces'],
  [P('wall & tabletop frames'), 'Table Frames'],
  [P('albums & refills'), 'Scrapbooks'],
  // stationery
  // Paper trimmers / guillotines are craft cutting tools.
  [P('paper trimmers|guillotine', 'scissor'), 'Arts and Crafts › Craft Tools › Cutting Tools'],
  [P('desktop calendars|clipboards|bulletin boards|magnetic boards|message boards', 'easel|scissor|drawing|doodle|writing (board|pad)|kids|\\bled\\b'), 'Stationary › Office Supplies › Office Supplies'],
  [P('appointment books|writing pads & diaries > diaries|personal organisers'), 'Stationary › Notebooks › Diaries'],
  [P('composition notebooks'), 'Ruled Notebooks'],
  [P('copy & multipurpose paper'), 'Printer Paper'],
  [P('gel ink rollerball', 'scraper|palette'), 'Gel Pens'],
  [P('liquid ink rollerball'), 'Roller Pens'],
  [P('ballpoint pens|pen refills', '\\bnibs?\\b|fountain|cartridge|converter'), 'Ball Pens'],
  [P('& highlighters > highlighters'), 'Stationary › Markers › Highlighters'],
  [P('permanent markers'), 'Permanent Markers'],
  [P('dry erase & wet erase'), 'Whiteboard Markers'],
  [P('mechanical pencil', 'colou?r(ed)? pencil'), 'Mechanical Pencils'],
  [P('fountain pens', 'calligraph|\\bnibs\\b|(spare|replacement|extra)\b[^,|]{0,24}\bnib|nib (set|pack|kit|only)|fountain pen ink|ink cartridges?\b'), 'Fountain Pens'],
  [P('stylus', 'fountain'), 'Electronics › Mobile Accessories › Mobile Accessories'],
  [P('inks, toners & cartridges'), 'Electronics › Printers › Printers'],
  // tools and hardware
  [P('paint rollers|prep materials|wire brushes'), 'Tools › Construction Tools › Construction Tools'],
  [P('brushes & dusters'), 'Dusters'],
  [P('caulking guns|> silicone|waterproofers', 'glue (stick|gun)'), 'Hardwares › Adhesives & Tapes › Sealants'],
  [P('epoxies'), 'Hardwares › Adhesives & Tapes › Adhesives'],
  [P('hot air guns|heat guns'), 'Heat Guns'],
  [P('soldering'), 'Soldering Tools'],
  [P('wire cutters|wire strippers'), 'Tools › Hand Tools › Cutters'],
  [P('hand tools > pliers'), 'Tools › Hand Tools › Pliers'],
  // sewing
  [P('> snaps'), 'Hooks & Eyes'],
  [P('sewing sets & kits'), 'Sewing Kits'],
  [P('hand sewing needles'), 'Hand Sewing Needles'],
  [P('fabric adhesives'), 'Fabric Glue'],
  [P('embroidery > hoops'), 'Embroidery Hoops'],
  // --- second pass: household, car and tool items ---
  [P('car styling|mud flaps'), 'Mud Flaps'],
  [P('registration plates'), 'Number Plate Frames'],
  [P('door protection'), 'Door Guards'],
  [P('engine oil|oil additives|dashboard figurines'), 'Auto Accessories › Car Accessories › Car Accessories'],
  [P('car covers'), 'Car Covers'],
  [P('emergency tool kits|vehicle tools|windscreen wipers'), 'Car Tool Kits'],
  [P('car accessories > interior accessories'), 'Air Fresheners'],
  [P('paint & primer|speciality paint|paint cleaners|paint sprayers|paint roller|putty knives|hand tools > scrapers', 'acrylic sheet'), 'Tools › Construction Tools › Construction Tools'],
  [P('respirators'), 'Tools › Safety Equipment › Safety Equipment'],
  [P('spanners'), 'Spanners'],
  [P('screwdriver sets'), 'Screwdriver Sets'],
  [P('clothes hangers'), 'Clothes Hangers'],
  [P('cloths & towels > microfibre|cleaning cloths'), 'Cleaning Cloths'],
  [P('pillowcases|pillow cases'), 'Pillow Covers'],
  [P('> pillows >'), 'Sleeping Pillows'],
  [P('soup spoons'), 'Spoon Sets'],
  [P('beds, frames|camping furniture > cots'), 'Single Beds'],
  [P('loofahs|facial scrubs'), 'Body Scrubs'],
  [P('range hood'), 'Chimneys'],
  [P('towels > bath towels'), 'Bath Towels'],
  [P('scented oil diffusers'), 'Electric Diffusers'],
  [P('scented oils|deodorisers'), 'Air Fresheners'],
  [P('tandoors & grills|outdoor heating|fire pits'), 'Furniture › Outdoor Furniture › Outdoor Furniture'],
  [P('> soils|fertilizers & plant food|planting media'), 'Agri and Gardening › Garden Soil › Garden Soil'],
  [P('gas stoves|induction cooktop'), 'Induction Cooktops'],
  [P('> wax >|waxing|massage creams|body oils|skin care > oils|carrier & essential oils', 'seal'), 'Cosmetics › Body Care › Body Care'],
  [P('\\bface > foundation'), 'Foundation'],
  [P('\\bface > highlighters'), 'Cosmetics › Face Makeup › Highlighter'],
  [P('cuticle|nail tools|nail brushes|> nail art'), 'Nail Care'],
  [P('hair styling tools > (brushes|combs)|shampoo & conditioner'), 'Cosmetics › Hair Care › Hair Care'],
  [P('hair styling accessories > (claws|bun)|hair clips > |hair accessories > clips'), 'Hair Clips'],
  [P('body paint|face paints'), 'Costume Props'],
  [P('household cleaners > toilet cleaners', 'liquid|gel'), 'Toilet Brushes'],
  [P('brushes > kitchen brushes'), 'Cleaning Brush Sets'],
  [P('all-purpose cleaners|stain removers'), 'All Purpose Cleaners'],
  [P('pruning saws'), 'Pruning Tools'],
  [P('saws & accessories|handsaw|chain saws|circular saw blades'), 'Saws'],
  [P('angle grinders|grinder accessories|cutting tools > tool holders|power brushes'), 'Angle Grinders'],
  [P('rotary tool|cutting wheels|drill tool kits'), 'Cutting Machines'],
  [P('kitchen knife sets'), 'Kitchen Knife Sets'],
  [P('fruit and vegetable knives'), 'Vegetable Knives'],
  [P('fruit slicers|graters|pizza cutters|manual choppers'), 'Slicers'],
  [P('tile & masonry'), 'Tiling Tools'],
  [P('hand tools > cutters|pipe cutters'), 'Tools › Hand Tools › Cutters'],
  [P('disposable tableware > dishes'), 'Paper Plates'],
  [P('disposable tableware > drinkware|drinkware > cups'), 'Disposable Glasses'],
  [P('disposable tableware > spoons'), 'Wooden Cutlery'],
  [P('aluminium foil'), 'Aluminium Foil'],
  [P('moist wipes|tissue holders'), 'Tissue Paper'],
  [P('dustbin bags'), 'Cleaning Products › Garbage Bags › Garbage Bags'],
  [P('table lamps'), 'Table Lamps'],
  [P('close-to-ceiling'), 'LED Ceiling Lights'],
  [P('paper towel holders'), 'Kitchenware › Kitchen Organizers › Kitchen Organizers'],
  [P('paper bins'), 'Dustbins'],
  [P('toilet paper holders'), 'Toilet Paper Holders'],
  [P('> lunch boxes'), 'Kitchenware › Storage Containers › Lunch Boxes'],
  [P('idols & figurines|dream catchers|indoor fountains|tapestries|decorative bowls'), 'Decorative Showpieces'],
  [P('lanyards & wrist straps'), 'Electronics › Mobile Accessories › Mobile Accessories'],
  [P('door hardware & locks > hinges'), 'Hardwares › Door & Cabinet Handles › Hinges'],
  [P('musical toy'), 'Toys & Games › Musical Toys › Musical Toys'],
  [P('> puzzles', 'diy|kit'), 'Puzzles'],
  [P('hanging planters'), 'Hanging Planters'],
  [P('kitchen playsets|kitchen toys'), 'Kitchen Sets'],
  [P('glassware & drinkware'), 'Glassware'],
  [P('jars & containers'), 'Plastic Jars'],
  [P('clocks > wall clocks'), 'Designer Wall Clocks'],
  [P('water pistols'), 'Holi Decorations'],
  [P('electric kettles'), 'Electric Kettles'],
  [P('pool toys'), 'Swimming'],
  [P('toy vehicles > cars'), 'Die-Cast Cars'],
  [P('cake stands'), 'Serving Platters'],
  [P('blankets, throws'), 'Fleece Blankets'],
  [P('soap holders'), 'Soap Dishes'],
  [P('coffee tables'), 'Coffee Tables'],
  [P('patio furniture'), 'Garden Tables'],
  [P('notebook computer stands'), 'Laptop Stands'],
  [P('pins & tacks|clips, clamps & rings|binder'), 'Stationary › Office Supplies › Office Supplies'],
  [P('desk supplies organisers|pencil holders', 'brush|easel|plate'), 'Stationary › Office Supplies › Office Supplies'],
  [P('mounting tape|transparent tape|hook & loop strips|picture hangers'), 'Double-Sided Tapes'],
  [P('laptop messenger'), 'Laptop Bags'],
  [P('messenger & sling|canvas & beach tote|retail bags'), 'Sling Bags'],
  [P('cosmetic bags|make-up pouches|cosmetic cases'), 'Toiletry Bags'],
  [P('laundry bags|> hampers'), 'Laundry Bags'],
  [P('clothing & wardrobe storage|under-bed storage|produce storage bags'), 'Storage Baskets'],
  [P('drawstring bags|rucksacks|coin purses'), 'Backpacks'],
  [P('kitchen linens > aprons'), 'Aprons'],
  [P('kitchen linens > table runners'), 'Table Runners'],
  [P('outdoor curtains'), 'Window Curtains'],
  [P('insulated drinks containers'), 'Tumblers'],
  [P('pet supplies > .*grooming > scissors'), 'Pet Supplies › Pet Grooming › Grooming Kits'],
  [P('pet supplies > .*claw care'), 'Pet Supplies › Pet Grooming › Nail Clippers'],
];

/** Hair and wrist jewellery (also checked on the Kundan Jewellery delivery). */
const JEWELLERY_STRAYS = [
  [P('hair accessories > bands'), 'Hair Bands'],
  [P('hair accessories > pins|hair pins'), 'Hair Pins'],
  [P('hair decoration'), 'Hair Clips'],
  [P('bangles & bracelets > bangles'), 'Bangles'],
  [P('women > anklets'), 'Anklets'],
];
/** Finished necklaces / sets / earrings filed as bead supplies. */
const WEAR_JEWELLERY = [
  [P('women > necklaces'), 'Necklaces'],
  [P('women > jewelry sets'), 'Jewellery Sets'],
  [P('women > earrings'), 'Earrings'],
  [P('bangles & bracelets > bracelets'), 'Charm Bracelets'],
];

// --- jewellery delivery ---------------------------------------------------------------------------
// Its Target Names are reliable for real jewellery, but some names catch other things: "Pendant Sets"
// (ceiling pendant lights), "Fashion Rings" (keyrings, ring lights), "Adjustable Rings" (gym rings,
// wrenches), "Chains" (door / lock / bike chains), "Cocktail Rings" (bar ware, condoms). These rules
// move an item by its Amazon PATH; jewellery paths never match, so real jewellery stays put.
/** A rule's destination that means "no home in the app": the product is skipped. */
const SKIP = false;
const MAKING_WORDS =
  /making|diy|\bbeads?\b|findings|jump rings?|clasps?|lobster|crimp|\bwire\b|\bcord\b|thread|string|dori|\bkit\b|supplies|spacer|\bbails?\b|ear ?wires|cabochon|resin|enamel|glue|pliers|charms? for/;
/** Bead / jewellery-making supplies (only when the title says so: finished pieces stay jewellery). */
const JEWEL_MAKING = {
  test(text) {
    const cut = text.lastIndexOf(' | ');
    return (
      /beading|craft kits|craft supplies|craft materials|toys & games > arts & crafts/.test(text.slice(cut + 3)) &&
      MAKING_WORDS.test(text.slice(0, cut))
    );
  },
};
const JEWEL_STRAYS = [
  [P('sexual wellness'), SKIP],
  [P('needlework'), 'Arts and Crafts › Craft Kits › Embroidery Kits'],
  [JEWEL_MAKING, 'Jewellery Making Kits'],
  [P('indoor lighting'), 'Pendant Lights'],
  [P('keyrings & keychains|> key rings|keychain carabiners'), 'Keychains'],
  [P('gymnastics|exercise & fitness|strength training|gym sets|braces, splints'), 'Fitness Accessories'],
  [P('plant containers'), 'Agri and Gardening › Plant Stands › Plant Stands'],
  [P('cameras & photography', 'display|jewel|necklace|earring'), 'Camera Accessories'],
  [P('lingerie|sleep & lounge'), 'Babydolls'],
  [P('suitcases & trolley|luggage sets'), 'Trolley Bags'],
  [P('travel kits & organisers', 'jewel'), 'Packing Cubes'],
  [P('watch boxes|watch stands'), 'Watch Boxes'],
  [P('watch straps'), 'Watch Straps'],
  [P('wrist watches|smart watches'), 'Quartz Watches'],
  [P('mobile accessories'), 'Electronics › Mobile Accessories › Mobile Accessories'],
  [P('dogs > collars|dogs > toys'), 'Dog Leashes'],
  [P('cats > collars'), 'Cat Collars'],
  [P('office supplies|binders|presentation supplies|identification badges', 'organi[sz]|storage|drawer|jewel|scrunchie|display|rack|holder'), 'Stationary › Office Supplies › Office Supplies'],
  [P('bar accessories|kitchen tools|kitchen storage'), 'Kitchen Tools'],
  [P('tableware', 'display|jewel|stand'), 'Tumblers'],
  [P('boxing'), 'Sports & Fitness › Boxing › Boxing'],
  [/^[^|]*spanner[^|]*\|[^|]*hand tools/, 'Spanners'],
  [/^[^|]*plier[^|]*\|[^|]*hand tools/, 'Pliers'],
  [P('hand tools'), 'Wrenches'],
  [P('bathroom fixtures|water pumps|hydraulics'), 'Hardwares › Clamps › Clamps'],
  [/^[^|]*(diya|oil lamp)[^|]*\|/, 'Gifts & Frames › Decorative Showpieces › Decorative Showpieces'],
  [P('seasonal decorations'), 'Christmas Decorations'],
  [P('wind chimes|decorative accessories', 'display|jewel|organi|stand|riser|rack'), 'Gifts & Frames › Decorative Showpieces › Decorative Showpieces'],
  [/^[^|]*\bsaree[^|]*\|[^|]*ethnic wear/, 'Sarees'],
  [/^[^|]*chunri[^|]*\|/, 'Gifts & Frames › Decorative Showpieces › Decorative Showpieces'],
  [/^[^|]*\btops?\b[^|]*\|[^|]*western wear/, 'Clothing › Topwear › Tops'],
];
/** "Chains" is also a hardware shelf: non-jewellery chains go to their own place, the rest are necklaces. */
const CHAIN_STRAYS = [
  [/^[^|]*lock[^|]*\|[^|]*(luggage|travel)/, 'Travel Locks'],
  [/^[^|]*lock[^|]*\|[^|]*cycl/, 'Padlocks'],
  [P('door hardware|tarps & tie-downs|home improvement > hardware|safety signs|pulling & lifting|livestock|bathroom hardware'), 'Hardwares › Ropes & Chains › Chains'],
  [P('car & motorbike care'), 'Car Cleaning'],
  [P('cycling|oils & fluids|engine tools|motorbike accessories'), 'Bike Tool Kits'],
  [P('outdoor power tool'), 'Tools › Power Tools › Saws'],
];
const JEWEL_TARGETS = ['Pendant Necklaces', 'Nose Rings', 'Fashion Rings', 'Adjustable Rings', 'Chokers', 'Mangalsutra', 'Meenakari Jewellery', 'CZ Jewellery', 'Hair Pins', 'Drop Earrings', 'Scrunchies', 'Chain Bracelets', 'Hoop Earrings', 'Stud Earrings', 'Oxidised Jewellery', 'Gold-Plated Jewellery', 'Temple Jewellery', 'Pearl Jewellery', 'Jhumkas', 'Bangles', 'Hair Clips', 'Charm Bracelets', 'Hair Bands', 'Pendant Sets', 'Layered Necklaces', 'Jewellery Organizers', 'Cocktail Rings', 'Travel Jewellery Cases', 'Jewellery Stands'];

/** Per-target rules, checked before ART_STRAYS. */
const ART_OWN = {
  'Pearl Beads': [
    ...JEWELLERY_STRAYS.slice(0, 3),
    [P('hair styling accessories > claws'), 'Hair Clips'],
    [P('women > |girls > |bangles & bracelets'), 'Pearl Jewellery'],
  ],
  // Eyebrow / beard scissors are grooming tools.
  Scissors: [[P("eyebrow|tweezers|eye care|beauty > tools|women's > sets"), 'Cosmetics › Grooming › Grooming']],
  'Paint Sets': [[P('paintbrush'), 'Paint Brushes']],
  'Paint Brushes': [[P('painting materials > paints'), 'Paint Sets']],
  'Modelling Clay': [[P('ceramic & pottery tools|modeling tools'), 'Clay Tools']],
  'Polymer Clay': [
    [P('ceramic & pottery tools|modeling tools'), 'Clay Tools'],
    [P('candle making > moulds|chocolate moulds'), 'Moulds'],
  ],
  'Clay Tools': [[P('ceramics & pottery > clay|clay & dough', 'tool'), 'Modelling Clay']],
  'Drawing Pencils': [
    [P('coloured pencils'), 'Arts and Crafts › Drawing Materials › Color Pencils', ['Stationary › Pencils & Erasers › Color Pencils']],
    [P('mechanical pencil'), 'Mechanical Pencils', ['Drawing Pencils']],
  ],
  'Color Pencils': [[P('wooden pencils', 'colou?r'), 'Drawing Pencils']],
  'Calligraphy Sets': [[P('wooden pencils'), 'Drawing Pencils']],
  Stencils: [[P('rangoli'), 'Stencils', ['Diwali Decorations']]],
};

/**
 * Names the app menu has in two places: filed under Arts and Crafts, listed on the other page too
 * (checked last, after the stray rules).
 */
const ART_TWO_PLACES = {
  Canvas: ['Arts and Crafts › Art Supplies › Canvas', ['Arts and Crafts › Drawing Materials › Canvas']],
  'Color Pencils': ['Arts and Crafts › Drawing Materials › Color Pencils', ['Stationary › Pencils & Erasers › Color Pencils']],
  Crayons: ['Arts and Crafts › Drawing Materials › Crayons', ['Stationary › Pencils & Erasers › Crayons']],
  Markers: ['Arts and Crafts › Drawing Materials › Markers', ['Stationary › Markers']],
  'Sketch Pens': ['Arts and Crafts › Drawing Materials › Sketch Pens', ['Stationary › Markers › Sketch Pens']],
  'Glue & Adhesives': ['Arts and Crafts › Craft Tools › Glue & Adhesives', ['Stationary › Glue & Adhesives']],
  'Glue Guns': ['Arts and Crafts › Craft Tools › Glue Guns', ['Tools › Power Tools › Glue Guns']],
  Scissors: ['Arts and Crafts › Craft Tools › Scissors', ['Stationary › Office Supplies › Scissors']],
  'Embroidery Kits': ['Arts and Crafts › Embroidery Kits', ['Clothing › Embroidery Kits']],
};

const ART_TARGETS = ['Calligraphy Sets', 'Glass Beads', 'Modelling Clay', 'Wooden Beads', 'Moulds', 'Canvas', 'Glue & Adhesives', 'DIY Craft Kits', 'Paint Sets', 'Nibs', 'DIY Kits', 'Glue Guns', 'Palettes', 'Drawing Boards', 'Cardstock', 'Oil Colors', 'Handmade Paper', 'Pearl Beads', 'Charcoal', 'Drawing Pencils', 'Origami Paper', 'Ink', 'Polymer Clay', 'Clay Tools', 'Drawing Sheets', 'Paint Brushes', 'Sketch Pens', 'Jewellery Making Kits', 'Cutting Tools', 'Display Easels', 'Portable Easels', 'Poster Colors', 'Acrylic Colors', 'Color Pencils', 'Embroidery Kits', 'Stencils', 'Kids Craft Kits', 'Punches', 'Crayons', 'Acrylic Beads', 'Table Easels', 'Scissors', 'Markers', 'Calligraphy Pens', 'Water Colors', 'Floor Easels', 'Scrapbook Paper', 'Seed Beads'];

// --- cosmetics delivery --------------------------------------------------------------------------
// Its Target Names are mostly right and its Amazon paths are noisy (a trimmer under "cake sculpting
// tools", a concealer under "cooling racks"), so a product moves only when BOTH agree: the path is
// another cosmetics category's AND its own title names that kind of product (and not its target).
// Titles carry the target name glued on ("Blush – ...", "... – Perfumes"); that part is ignored.
/** [menu name, path regex, title regex] */
const COS_PLACES = [
  ['Foundation', /face > (foundation|bb creams|cc creams)/, /foundation|\bbb cream|\bcc cream/],
  ['Compact Powder', /compact powder/, /compact|pressed powder/],
  ['Concealer', /concealer/, /concealer/],
  ['Cosmetics › Face Makeup › Highlighter', /highlighters & illuminators/, /highlight|illuminat|strobe/],
  ['Blush', /blushes/, /blush/],
  ['Bronzer', /bronzers/, /bronz/],
  ['Makeup Primer', /> primers|eyeshadow bases & primers/, /primer/],
  ['Eyeshadow', /eyes > eyeshadow$|make-up palettes/, /eye ?shadow/],
  ['Eyeliner', /eyeliners/, /eye ?liner/],
  ['Kajal', /kajal/, /kajal|kohl/],
  ['Mascara', /mascaras/, /mascara/],
  ['Lipstick', /lipsticks|lip stains/, /lipstick|lip (tint|stain|crayon)/],
  ['Lip Gloss', /lip glosses/, /gloss/],
  ['Lip Liner', /lip liners/, /lip ?liner/],
  ['Nail Polish', /nails > (nail polish|nail gel)$/, /nail (polish|paint|lacquer|enamel)|gel polish/],
  [
    'Nail Care',
    /nail polish remover|manicure & pedicure > nail care|cuticle|nail tools|manicure kits/,
    /remover|cuticle|nail file|buffer|clipper|cutter|manicure|nail (kit|drill|care)/,
  ],
  ['Makeup Brushes', /make-up brushes|face brushes|eyes > (eyeshadow|eyeliner) brushes/, /brush/],
  ['Makeup Sponges', /sponges & blenders/, /sponge|blender|puff/],
  ['Makeup Remover', /make-up remover/, /remov|micellar|cleansing (water|oil|balm|milk)/],
  ['Face Wash', /cleansing creams & milks > (face wash|gels)/, /face ?wash|cleanser/],
  ['Face Creams', /face creams|night creams/, /(face|day|night) cream/],
  ['Moisturizers', /creams & moisturisers > moisturizers/, /moisturi[sz]er/],
  ['Serums', /creams & moisturisers > serums|eye serums/, /serum/],
  ['Sunscreen', /sunscreen/, /sunscreen|\bspf|sun ?block/],
  ['Face Masks', /face masks|face pack/, /mask|face pack/],
  ['Body Scrubs', /body scrubs|facial scrubs/, /scrub/],
  ['Body Lotion', /body lotions|body creams|body butters/, /body (lotion|cream|butter|milk)|hand (and|&) body/],
  ['Body Wash', /body wash|bathing > body washes|bath & body > body washes/, /body wash|shower gel/],
  ['Hand Cream', /hand creams/, /hand (moisturi[sz]ing )?(cream|lotion)/],
  ['Foot Care', /foot care|foot creams|callus|foot rasps/, /foot|heel|callus/],
  ['Hair Serum', /hair serums|hair regrowth/, /hair.*serum|serum.*hair/],
  ['Hair Oil', /hair oils/, /hair oil/],
  ['Shampoo', /> shampoos$|2-in-1 shampoo/, /shampoo/],
  ['Conditioner', /shampoo & conditioner > conditioners$/, /conditioner/],
  ['Hair Masks', /hair masks/, /hair mask|hair pack/],
  ['Deodorants', /deodorant|antiperspirant/, /\bdeo/],
  ['Perfumes', /fragrance > (perfume|eau de)/, /perfume|eau de|\bedp\b|\bedt\b|parfum/],
  ['Body Mists', /body sprays & mists/, /mist|body spray/],
  ['Beard Care', /beard (conditioners|oils)|moustache waxes/, /beard|moustache/],
  ['Shaving', /razor|shaving sets|men's > (creams|gels|foams)$|aftershave/, /razor|shav|after ?shave/],
  ['Trimmers', /trimmers|body groomers|hair clippers/, /trimmer|groomer|clipper/],
];
/** Each target's own words: a title that names them keeps the product where it was filed. */
const COS_OWN_WORDS = {
  foundation: /foundation|\bbb\b|\bcc\b/,
  'face creams': /cream/,
  blush: /blush/,
  'compact powder': /compact|powder/,
  concealer: /concealer/,
  'hair serum': /serum/,
  sunscreen: /sunscreen|\bspf|sun ?block|sun protection|\buv\b/,
  serums: /serum/,
  trimmers: /trimmer|groomer|clipper|shaver/,
  eyeshadow: /eye ?shadow|palette/,
  'grooming kits': /kit|\bset\b|combo|pack/,
  'beard care': /beard|moustache/,
  shaving: /razor|shav/,
  'hand cream': /hand/,
  eyeliner: /eye ?liner/,
  // "moisturising" alone is not enough: hand creams and body lotions say it too.
  moisturizers: /moisturi[sz]er|\bface\b|facial/,
  kajal: /kajal|kohl/,
  'body lotion': /body (lotion|cream|butter|milk)|lotion/,
  'makeup primer': /primer/,
  bronzer: /bronz|contour/,
  'foot care': /foot|feet|heel|callus/,
  'nail care': /nail/,
  attars: /attar|ittar|\bitr\b/,
  conditioner: /conditioner/,
  shampoo: /shampoo/,
  'hair masks': /mask|hair pack/,
  highlighter: /highlight|illuminat|strobe/,
  'hair oil': /oil/,
  'face wash': /wash|cleanser/,
  'lip liner': /liner/,
  deodorants: /\bdeo/,
  perfumes: /perfume|parfum|fragrance|eau de|\bedt\b|\bedp\b/,
  lipstick: /lipstick|lip (tint|stain|crayon)|lip (&|and) cheek/,
  'lip gloss': /gloss/,
  'nail polish': /nail (polish|paint|lacquer|enamel)|polish/,
  'body mists': /mist|body spray/,
  'makeup brushes': /brush/,
  'body scrubs': /scrub/,
  'face masks': /mask|face pack/,
  'body wash': /wash|shower/,
  mascara: /mascara/,
  'makeup remover': /remov|micellar|cleansing/,
  'makeup sponges': /sponge|blender|puff/,
};
/** Rules for one cosmetics target: another category's path + title, never its own words. */
function cosmeticRules(target) {
  const own = COS_OWN_WORDS[target];
  const glued = new RegExp(`^${target} – | – ${target}$`, 'g');
  return COS_PLACES.map(([to, pathRe, titleRe]) => [
    {
      test(text) {
        const cut = text.lastIndexOf(' | ');
        const title = text.slice(0, cut).replace(glued, '');
        const path = text.slice(cut + 3);
        return pathRe.test(path) && titleRe.test(title) && !own.test(title);
      },
    },
    to,
  ]);
}
// ('grooming kits' is set with the baby delivery's rule, further down.)
const COS_TARGETS = Object.keys(COS_OWN_WORDS).filter((t) => t !== 'grooming kits');
/** Names the menu has in more than one place: these deliveries are the cosmetics ones. */
const COS_HOME = {
  highlighter: ['Cosmetics › Face Makeup › Highlighter'],
  // (Religion › Islamic Items › Attars has no catalog category: the app finds these there by name.)
  attars: ['Cosmetics › Fragrances › Attars'],
};
/** Title-only moves checked before the path + title rules (the path is wrong for these). */
const COS_FIRST = {
  moisturizers: [[/^[^|]*hand (and|&) body/, 'Body Lotion']],
};

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
  'fabric cutters': [
    [/^[^|]*(styrofoam|foam|hot knife|rope|cardboard|zipsnip|lanyard)/, 'Hand Tools'],
  ],

  // --- artificial flowers delivery: the few non-floral items mixed in (see ARTIFICIAL_STRAYS) ---
  ...Object.fromEntries(
    [
      'Glass Vases',
      'Ceramic Vases',
      'Decorative Vases',
      'Floor Vases',
      'Artificial Bouquets',
      'Flower Sticks',
      'Artificial Garlands',
      'Decorative Flowers',
      'Festival Flowers',
      'Flower Arrangements',
      'Wedding Flowers',
      'Wall Hanging Plants',
      'Hanging Plants',
      'Artificial Bonsai',
      'Artificial Cactus',
      'Artificial Leaves',
      'Artificial Vines',
      'Artificial Succulents',
    ].map((name) => [
      name,
      [
        ...ARTIFICIAL_STRAYS,
        // Flower bunches / sticks filed as vases.
        ...(name.endsWith('Vases')
          ? [
              [/^[^|]*(bunch|bouquet)[^|]*\|.*artificial flowers/, 'Artificial Bouquets'],
              [/^[^|]*flower sticks?[^|]*\|.*artificial flowers/, 'Flower Sticks'],
            ]
          : []),
      ],
    ]),
  ),

  // --- bath fittings delivery (see BATH_STRAYS) ---
  ...Object.fromEntries(
    BATH_FIXTURES.map((name) => [
      name,
      [
        ...BATH_STRAYS,
        ...(/Taps|Mixers/.test(name) && name !== 'Kitchen Taps' ? [kitchenTap(name)] : []),
        // Baby / inflatable bath tubs filed as corner or whirlpool tubs.
        ...(/^(Corner|Whirlpool) Tubs$/.test(name)
          ? [
              [
                /^(?![^|]*(hot tub|spa filter|switch|hamster))[^|]*(baby bath|bath ?tub for (baby|kids)|inflatable|pool tub|bath pool)/,
                'Freestanding Tubs',
              ],
            ]
          : []),
        ...BATH_FIXTURE_STRAYS,
      ],
    ]),
  ),
  ...Object.fromEntries(
    BATH_ACCESSORIES.map((name) => [
      name,
      [
        ...BATH_STRAYS,
        // Wall hooks filed as towel racks / rings.
        ...(/^Towel R/.test(name)
          ? [
              [
                /^(?![^|]*(towel (ring|rack|rod|bar|holder|rail)|napkin|knife|kitchen|drying|coat rack|clothes|stand))[^|]*\bhooks?\b/,
                'Bathroom Hooks',
              ],
            ]
          : []),
        // Hooks is in Bath Fittings and in Hardwares: filed under bath, listed on both.
        ...(name === 'Hooks'
          ? [[/./, 'Bath Fittings › Bathroom Accessories › Hooks', ['Hardwares › Door & Cabinet Handles › Hooks']]]
          : []),
      ],
    ]),
  ),

  // --- cosmetics and jewellery delivery: jewellery-making supplies filed as jewellery ---
  // --- jewellery delivery (see JEWEL_STRAYS) ---
  ...Object.fromEntries(JEWEL_TARGETS.map((name) => [name, JEWEL_STRAYS])),
  Chains: [...JEWEL_STRAYS, ...CHAIN_STRAYS, [/./, 'Fashion Jewellery › Necklaces › Chains']],

  // --- cosmetics delivery (see COS_PLACES) ---
  ...Object.fromEntries(COS_TARGETS.map((name) => [name, [
    ...(COS_FIRST[name] ?? []),
    ...cosmeticRules(name),
    ...(COS_HOME[name] ? [[/./, ...COS_HOME[name]]] : []),
  ]])),
  // --- arts and crafts delivery (see ART_STRAYS) ---
  ...Object.fromEntries(
    ART_TARGETS.map((name) => [
      name,
      [
        ...(ART_OWN[name] ?? []),
        ...ART_STRAYS,
        ...JEWELLERY_STRAYS,
        ...WEAR_JEWELLERY,
        ...(ART_TWO_PLACES[name] ? [[/./, ...ART_TWO_PLACES[name]]] : []),
      ],
    ]),
  ),
  // Kundan sets are the right kind of item: only hair and wrist pieces move.
  'Kundan Jewellery': JEWELLERY_STRAYS,

  // --- baby care delivery: names the app spells differently / lists in two mains ---
  'baby bottle accessories': [[/./, 'Baby Care › Bottle Accessories']],
  'baby travel systems': [[/./, 'Travel Systems']],
  'bath toys': [[/./, 'Baby Care › Bath Toys']],
  'musical toys': [
    [/baby/, 'Baby Care › Musical Toys'],
    [/./, 'Toys & Games › Musical Toys'],
  ],
  // Baby deliveries and cosmetics deliveries both send lowercase 'grooming kits'.
  'grooming kits': [
    [/baby|infant|newborn|toddler|\bkids?\b|child/, 'Baby Care › Grooming Kits'],
    ...cosmeticRules('grooming kits'),
    [/./, 'Cosmetics › Grooming › Grooming Kits'],
  ],

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

// --- stationery delivery --------------------------------------------------------------------------
// Names it shares with other shelves catch other things: "Scales" (kitchen / body weighing scales),
// "Scientific" (lab glassware), "Compasses" (hiking compasses, Jeep Compass key covers), "Romance"
// (a deodorant line), "Erasers" (magic eraser sponges). Moved by Amazon PATH (+ title where needed);
// these run before any rules the name already has. Two-place names: filed once, `also` on the others.
const STAT_RULES = {
  Highlighters: [
    [P('beauty'), 'Cosmetics › Face Makeup › Highlighter'],
    [/./, 'Stationary › Markers › Highlighters'],
  ],
  'Lunch Boxes': [
    [/^[^|]*plastic/, 'Stationary › School Supplies › Lunch Boxes', ['Kitchenware › Storage Containers › Lunch Boxes', 'Kitchenware › Plastic Household › Lunch Boxes']],
    [/./, 'Stationary › School Supplies › Lunch Boxes', ['Kitchenware › Storage Containers › Lunch Boxes']],
  ],
  Diaries: [
    [/^[^|]*(personali[sz]|customi[sz]|with name|gift|leather)/, 'Stationary › Notebooks › Diaries', ['Gifts & Frames › Personalized Gifts › Diaries']],
    [/./, 'Stationary › Notebooks › Diaries'],
  ],
  'Art Supplies': [
    [/./, 'Stationary › Art Supplies › Art Supplies', ['Arts and Crafts › Art Supplies › Art Supplies', 'Stationary › School Supplies › Art Supplies']],
  ],
  // Kitchen scales to Kitchen Tools, the rest (body, pocket, luggage) to Measuring Tools.
  Scales: [
    [/^[^|]*(kitchen|food|cooking|baking)[^|]*\|[^|]*(small kitchen|health monitors|scales & balances|kitchen & dining)/, 'Kitchenware › Kitchen Tools'],
    [P('small kitchen|health monitors|scales & balances|luggage|kitchen & dining'), 'Tools › Measuring Tools'],
  ],
  Scientific: [
    [P('learning & education|science kits'), 'STEM Toys'],
    [P('lab & scientific'), 'Stationary › School Supplies › School Supplies'],
  ],
  Compasses: [
    [P('car accessories|car & motorbike'), 'Auto Accessories › Car Accessories › Car Accessories'],
    [P('sports gadgets|decorative|outdoor recreation|camping|keyrings', 'antique|vintage|brass|nautical|vastu|engraved') , 'Tools › Measuring Tools'],
    [P('sports gadgets|decorative|outdoor recreation|camping|keyrings'), 'Gifts & Frames › Decorative Showpieces › Decorative Showpieces'],
  ],
  'Music Books': [
    [P('music stands|music-making accessories'), 'Musical Instruments › Music Accessories & Audio › Stands'],
    [P('learning & education'), 'Toys & Games › Educational & Building Toys › Learning Toys'],
  ],
  'Writing Pads': [
    [/^[^|]*(chair pad|seat cushion|cushion)[^|]*\|[^|]*furniture/, 'Chair Covers'],
    [/^[^|]*folding[^|]*\|[^|]*furniture/, 'Folding Chairs'],
    [P('furniture'), 'Office Chairs'],
  ],
  'Printer Paper': [[P('printer accessories', 'paper\\b(?! (tray|output|input))'), 'Electronics › Printers › Printers']],
  'Expanding Files': [[P('expanding foams|sealants'), 'Sealants']],
  'Communication Skills': [[P('flash cards|learning & education'), 'Educational Games']],
  Registers: [[P('dress up & pretend|shops & accessories'), 'Pretend Play']],
  Erasers: [[P('cleaning supplies|scrubs & sponges'), 'Scrub Pads']],
  Protractors: [[P('test, measure|measuring & layout'), 'Tools › Measuring Tools']],
  Rulers: [[P('measuring & layout|test, measure'), 'Tools › Measuring Tools']],
  Scissors: [[P('kitchen tools|kitchen & dining'), 'Kitchenware › Kitchen Tools']],
  'Photography Books': [[P('cameras & photography'), 'Camera Accessories']],
  'Glue Sticks': [[P('power tools|power & hand tools'), 'Tools › Power Tools › Glue Guns']],
  Romance: [
    [P('deodorants'), 'Deodorants'],
    [P('fragrance|body sprays'), 'Body Mists'],
  ],
};
for (const [name, rules] of Object.entries(STAT_RULES)) REROUTES[name] = [...rules, ...(REROUTES[name] ?? [])];

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
    if (re.test(text) && to === SKIP) return { skip: 'no category for it in the app' };
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
