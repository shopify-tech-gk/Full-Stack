import type { ApiCategory } from './types';

export interface StoreSubcategory {
  slug: string;
  name: string;
  children: StoreSubcategory[];
}

export interface StoreCategory {
  slug: string;
  name: string;
  subcategories: StoreSubcategory[];
}

/** Parses `slug=Name;slug=Name` (the compact form the live menu was captured in). */
function parse(list: string): StoreSubcategory[] {
  return list
    .split(';')
    .filter(Boolean)
    .map((entry) => {
      const [slug = '', name = ''] = entry.split('=');
      return { slug, name, children: [] };
    });
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Captured from the live youmartshop.com menu (2026-09-28): names, order and slugs verbatim, so
// every link keeps the exact WooCommerce URL. Only corrections: duplicate "Party Popper" removed
// and "Skate | Board" -> "Skate Board" (both flagged as live-data defects).
const TREE: ReadonlyArray<[slug: string, name: string, subcategories: string]> = [
  [
    'lawn-and-gardening',
    'Agri and Gardening',
    'fertilizer=Fertilizer;grow-bags=Grow Bags;nets-and-fence=Nets and Fence;seeds=Seeds',
  ],
  [
    'arts-and-crafts',
    'Arts and Crafts',
    'art-sets=Art Sets;beeds=Beads;boards=Boards;card-stocks=Card Stocks;clay-arts-and-crafts=Clay;coloured-paper=Coloured Paper;craft-kit=Craft Kits;drawing-materials=Drawing Materials;magnets=Magnets;painting-craft-kits=Painting Craft kits;painting-materials=Painting Materials;paper=Paper;paper-craft=Paper Craft;pim-pom=Pom Pom;stones=Stones;thread=Thread;writing-supplies=Writing Supplies',
  ],
  [
    'artifical-flowers-and-plants',
    'Artificial Flowers and Plants',
    'bocckey-flower=Bouquet Flower;customized-product=Customized Product;cone-rose=Cone Rose;dry-flower=Dry Flower;flower-bunch=Flower Bunch;flower-kodi=Flower Kodi;flower-wase=Flower Vase;fruits=Fruits;hanging-pot=Hanging Pot;leaf-kodi=Leaf Kodi;lotus-flower=Lotus Flower;plants=Plants;plastic-accessories=Plastic Accessories;pocket-rose=Pocket Rose;single-foam-flower=Single Foam Flower;single-glitter-flower=Single Glitter Flower;stick-flower=Stick Flower;tree=Tree;wall-grass-mat=Wall Grass Mat;wall-hanging-grass=Wall Hanging Grass;wall-stand=Wall Stand;wooden-stand=Wooden Stand;pots=Pots',
  ],
  [
    'auto-accessories',
    'Auto Accessories',
    'automative-air-fresheners=Automotive Air Fresheners;car-interior=Car Interior;cloth-and-towels=Cloth and Towels;consoles-organizers=Consoles & Organizers;mobile-phone-chargers=Mobile Phone Chargers',
  ],
  [
    'baby-care',
    'Baby Care',
    'baby-bathing-products=Baby Bathing Products;baby-diaper=Baby Diaper;baby-grooming-kit=Baby Grooming Kit;baby-hair-care=Baby Hair Care;baby-skin-care=Baby Skin Care;baby-toiletries-hygiene-products=Baby Toiletries & Hygiene Products;baby-towels-wrappers=Baby Towels & Wrappers',
  ],
  [
    'bath-fittings',
    'Bath Fittings',
    'closet=Closet;glass-shelf=Glass Shelf;kitchen-sinks=Kitchen sinks;plumbing-hardware=Plumbing Hardware;rain-shower=Rain Shower;abs-unbreakable=Soap holder;stop-cock=Stop cock;table-top-basin=Table top basin;taps-bath-fittings=Taps;towel-ring=Towel Ring',
  ],
  [
    'cleaning-products',
    'Cleaning Products',
    'brooms=Brooms;brush=Brush;detergents-cleaners=Detergents & Cleaners;dishwash=Dishwash;duster=Duster;dust-pan=Dust pan;mops=Mops;scrubbers-sponges=Scrubbers & sponges;rope=Rope',
  ],
  [
    'cosmetics',
    'Cosmetics',
    'both-and-body=Bath and Body;blush=Blush;body-spray=Body Spray;brushes=Brushes;compact=Compact;combs=Combs;eyeliner=Eyeliner;eye-shadow=Eye Shadow;face-pack=Face Pack;face-peel-of-mask=Face Peel of Mask;face-scrub=Face Scrub;face-wash=Face Wash;foundation=Foundation;hair=Hair;kajal=Kajal;lip-care=Lip Care;lip-gloss=Lip Gloss;lipstick=Lipstick;liquid-lipstick=Liquid Lipstick;mascara=Mascara;moisturizer=Moisturizer;nail-polish=Nail Polish;perfumes=Perfumes;powder=Powder;primer=Primer;sunscreen=Sunscreen',
  ],
  [
    'crockery',
    'Crockery',
    'bakewares=Bakewares;serving-dining=Serving & Dining;bowls=Bowls;drinkware=Drinkware',
  ],
  [
    'disposable-items',
    'Disposable Items',
    'aluminum-container=Aluminium Container;bamboo-stike=Bamboo Stick;garbage-bags=Garbage Bags;gloves=Gloves;ice-stick=Ice Stick;klinpaper=Cling Paper;paper-cup=Paper Cup;paper-plate=Paper Plate;plastic-tumbler=Plastic Tumbler;spoon=Spoon;straw=Straw;tissue-paper=Tissue Paper;tooth-picks=Tooth Picks',
  ],
  ['electronics', 'Electronics', 'mobiles=Mobiles;computers=Computers;speaker=Speaker'],
  [
    'electrical-and-lights',
    'Electrical and Lights',
    'cables-wiring=Cables & Wiring;door-chimes-bells=Door bells;lights=Lights;electrical-accessories=Electrical Accessories;mosquito-killer-racket=Mosquito killer racket',
  ],
  [
    'furniture',
    'Furniture',
    'chairs=Chairs;dining-table=Dining Table;kids-chair=Kids;plastic-chair=Plastic Chair;table=Table;wardrobe=Wardrobe',
  ],
  [
    'fashion-jewellery',
    'Fashion Jewellery',
    'anklet=Anklet;bracelet=Bracelet;bangle=Bangle;brooch=Brooch;earrings=Earrings;head-jewellery=Head Jewellery;jewellery-set=Jewellery Set;mangalsutra=Mangalsutra;necklace-and-chains=Necklace and Chains;nosepin=Nosepin;pendant=Pendant;ring=Ring;saree-accessories=Saree Accessories',
  ],
  ['footwear', 'Footwear', 'kids-footwear=Kids Footwear;men=Men;women=women'],
  [
    'gifts',
    'Gifts & Frames',
    'ceramics-gifts=Ceramics-gifts;dream-catches=Dream catches;gift-sets=Ceramic Gift Sets;gift-lamps=Gift Lamps;gift-tray=Gift Tray;message-bottle=Message Bottle;metal-gift-box=Metal Gift Box;metal-wall-decor=Metal Wall Decor;statue-gift=Statue Gift;wind-chain=Wind Chain;wall-photo-frame=Wall photo frame;water-fountain=Water Fountain;wooden-gift-box=Wooden Gift Box',
  ],
  [
    'hardwares',
    'Hardware',
    'bearings=Bearings;cabinet-hardware=Cabinet Hardware;fasteners-fittings=Fasteners & Screws;latches-bolts=Latches & Bolts;locks-security-hardware=Locks & Security Hardware;angles-brackets-fasteners=Angles and Brackets;paints=Paints',
  ],
  [
    'home-appliances',
    'Home Appliances',
    'air-purifiers=Air Purifiers;airfryers=Airfryers;citrus-press=Citrus Press;garment-steamers=Garment Steamers;hand-blenders=Hand Blenders;hand-mixers=Hand Mixers;induction-cooktops=Induction Cooktops;steam-irons=Iron Box;jmg=Juicer Mixer Grinder;juicer=Juicer;kettles=Kettles;mixer-grinders=Mixer Grinders;otg=Oven Toaster Grill;sandwich-maker=Sandwich Maker;toasters=Toasters;vacuum-cleaners=Vacuum Cleaners',
  ],
  [
    'home-furnishing',
    'Home Furnishing',
    'bath-linen=Bath Linen;bedsheets=Bedsheets;curtain-accessories=Curtain & Accessories;cushion-covers=Cushion Covers;carpets=Carpets;door-mats=Door mats;fabric=Fabric;heavy-bed=Mattress;pillow-covers=Pillow Covers;quilts=Quilts;ready-made-curtains=Ready Made Curtains;rugs=Rugs;sheer-curtains=Sheer Curtains;sofa-covers=Sofa Covers;sofa-headrests=Sofa Headrests;string-curtains=String Curtains;table-linen=Table Linen;table-mat=Table Mat;towel=Towel',
  ],
  [
    'stainless-steel-vessels',
    'Kitchenware',
    'water-bottle=Bottle and Flask;casserole=Casserole;cookware=Cookware;electric-tiffin=Electric Tiffin;stainless-vessels=stainless vessels;hot-cold-flask=Hot & Cold Flask;hot-box=Hot Box;ice-packs-and-pails=Ice Packs and Pails;lunch-box=Lunch Box;jugs=Jugs and Purifier;kettle=Kettle;kitchen-utensils=Kitchen Utensils;pots-and-pans=Pots & Pans;smart-range=Smart Range;storage-jar=Storage Jar;storage-containers=Storage Containers;tableware=Tableware;tiffin-box=Tiffin Box',
  ],
  [
    'musical-instruments',
    'Musical Instruments',
    'flutes=Flutes;harmonicas=Harmonicas;portable-keyboard=Portable Keyboard;steel-drums=Steel Drums;tambourines=Tambourines;violins=Violins',
  ],
  [
    'party-decorations',
    'Party Decorations',
    'anniversary=Anniversary Decoration;baby-shower=Baby Shower Decoration;birthday-banners=Banners;birthday-caps=Caps;snow-spary=Snow Spray;balloon-decoration-accessories=Balloon Decoration Accessories;baloon-pump=Balloon Pump;birthday-sash=Sash;birthday-photo-banner=Photo Banner;party-popper=Party Popper;birthday-decoration-set=Decoration Set;balloons=Balloons;birthday=Birthday;butterfly-wings=Butterfly Wings;bride-to-be=Bride To Be Decoration;cake-toper=Cake Toper;candles=Candles;chinees-doom=Chinese Dome;chinese-visiri=Chinese Visiri;crown=Crown;eye-mask=Eye Mask;face-beard=Face Beard;face-mask=Face Mask;fancy-umbrella=Fancy Umbrella;foil-fringe-curtain=Foil Fringe Curtain;foil-balloons=Foil Balloons;hand-gloves=Hand Gloves;maalai=Maalai;naming-ceremony=Naming Ceremony Decoration;net-cloth=Net Cloth;paper-cutting=Paper Cutting;party-caps=Party Caps;photo-prop=Photo Prop;reception-maalai=Reception Maalai;ribbon=Ribbon;screen=Screen;sky-lantern=Sky Lantern;strings=Strings;thermocol-design=Thermocol Design;thoranam=Thoranam;wigs=Wigs;zoomer=Zoomer',
  ],
  ['pet-products', 'Pet Supplies', 'birds=Birds;dogs=Dogs;fish=Fish;cat=Cat'],
  [
    'plastic-household',
    'Plastic Household',
    'bathroom-accessory-sets=Bathroom Accessory Sets;bathroom-cabinet=Bathroom Cabinet;dustbin=Dustbin;laundry-basket=Laundry Basket;multi-purpose=Multi-purpose;organizer=Organizer',
  ],
  [
    'sports-fitness',
    'Sports & Fitness',
    'badminton=Badminton;basketball=Basketball;carrom=Carrom;cricket=Cricket;fitness-product=Fitness Product;sports-shoes-sports-goods=Sports shoes;football=Football;indoor-sports=Indoor Sports;tennis=Tennis;skate-board=Skate Board;sports-ball=Sports Ball;sports-kit-bag=Sports Kit Bag;squash=Squash;yoga=Yoga;swimming=Swimming;trophy=Trophy;volleyball=Volleyball',
  ],
  [
    'stationary',
    'Stationary',
    'a3-a4-drawing-note=A3 & A4 Drawing Note;a4-white-paper=A4 White Paper;acrylic-paint=Acrylic Paint;calculator=Calculator;pen=Pen;pencil=pencil;eraser=Eraser;pen-stand=Pen Stand;paper-weight=Paper weight;resin-arts=Resin Arts;spray-paint=spray paint;sticky-notes=Sticky notes;taps=Tapes;chart-paper=Chart Paper;colour-pencil=Colour Pencil;correction-pen=Correction Pen;correction-tape=Correction Tape;cotton=Cotton;crayons=Crayons;drawing-board=Drawing Board;files=Files;geometry-box=Geometry Box;glue-gun-and-stick=Glue Gun and Stick;highlighter=Highlighter;marker-ink=Marker;mechanical-pencil=Mechanical Pencil;magnifier-lens=Magnifier Lens;note-book=Note Book;oil-pastels=Oil Pastels;pastel-paint=Pastel Paint;permanent-marker=Permanent Marker;pin=Pin;poster-colour=Poster Colour;premium-poster-colour=Premium Poster Colour;scissors=Scissors;sketch-paper=Sketch Paper;soft-pastel=Soft Pastel;study-table=Study Table;watercolour-tube=Watercolour Tube;whiteboard-marker=Whiteboard Marker;pen-holder=Pen holder;reading-magnifiers=Reading magnifiers;rotary-desk-organiser=Rotary desk organiser;whiteboard-eraser=Whiteboard eraser;bouquet-sheet=Bouquet Sheet;bubble-wrap=Bubble Wrap;colour-paper=Colour Paper;crepe-paper=Crepe Paper;felt-sheet=Felt Sheet;foam-sheet=Foam Sheet;gift-sheet=Gift Sheet;thermocol-sheet=Thermocol Sheet',
  ],
  [
    'surgical-instruments',
    'Surgical Instruments',
    'needle-holder=Needle Holder;medical-forceps=medical forceps',
  ],
  ['tailoring-materials', 'Tailoring Materials', 'sewing-measuring-kit=Sewing Measuring Kit'],
  [
    'tools',
    'Tools',
    'carpenters-tools=Carpenters Tools;construction-tools=Construction Tools;cutters=Cutters;gardening-tools=Gardening Tools;hand-tools=Hand tools;power-tools=Power tools',
  ],
  [
    'toys',
    'Toys & Games',
    'baby-toddler-toys=plush Toys;animal-toys=Animal Toys;baby-toys=Baby Toys;specialty-lighting=Specialty Lighting;sportsoutdoor=Outdoor Toys;remote-cars=Remote Toys;science-toys-kits=Learning Toys;dolls=Dolls;games=Games;kids-cycle=Kids Cycle;modeling-clay=Modeling Clay;rubber-toys=Rubber Toys;saving-bank=Saving Bank;talking-bird=Talking Bird',
  ],
  [
    'travel-accessories',
    'Travel & Accessories',
    'backpack=Backpack;belt=Belt;breifcase=Briefcase;duffle-bag=Duffle Bag;hand-bag=Hand bag;laptop-backpacks=Laptop Backpacks;laptop-sleeves=Laptop Sleeves;lock=Lock;luggage-cover=Luggage Cover;lunch-bag=Lunch Bag;neck-pouches=Neck Pouches;rucksacks=Rucksacks;shoulder-bags=Shoulder Bags;sling-bag=Sling Bag;sleep-masks=Sleep Masks;straps=Straps;suitcase=Suitcase;toiletry-bags=Toiletry Bags;travel-pillow=Travel Pillow;travel-tote-bags=Travel Tote Bags;trolly=Trolley;umbrella=Umbrella;wallet=Wallet',
  ],
  [
    'wall-clock',
    'Wall Clock & Watches',
    'alaram-clock=Alaram Clock;analog-clock=Analog Clock;digital-clock=Digital Clock;double-side-clock=Double Side Clock;modern-clock=Modern Clock;fancy-clock=Fancy Clock;watch=Watch',
  ],
];

/** Third menu level, keyed `categorySlug/subcategorySlug` (live desktop flyouts). */
const THIRD_LEVEL: Readonly<Record<string, string>> = {
  'bath-fittings/taps-bath-fittings':
    'flexo-ebony-series=Flexo-ebony series;flexo-series=Flexo series;plastic-taps=Plastic Taps',
  'cleaning-products/brooms': 'floor-brooms=Floor brooms',
  'cleaning-products/brush':
    'bottle-brush=Bottle brush;antibacterial-series=Hockey Brush;sink-brush=Sink brush;steel-electrical-brush=Steel brush;tiotel-brush=Toilet brush',
  'cleaning-products/mops':
    'bucket-mops=Bucket mops;cotton-mops=Cotton mops;pva-mop=PVA mop;wiper-mops=Wiper mops',
  'cosmetics/both-and-body':
    'face-cream=Face Cream;face-serum=Face Serum;facial-wipes=Facial Wipes;hand-wash=Hand Wash;soaps=Soaps;toner=Toner',
  'cosmetics/hair': 'conditioner=Conditioner;cream=Cream;henna=Henna;oil=Oil;shampoo=Shampoo',
  'crockery/serving-dining':
    'dinner-set=Dinner Set;jar-gift-sets=Jar & gift sets;jugs-jug-sets=Jugs & Jug Sets;serving-set=Serving set;glass-crockery=Glass;juice-set=Juice Set',
  'crockery/bowls': 'mixing-bowl=Mixing Bowl;soup-bowl=Soup Bowl;ice-cream-bowl=Ice Cream Bowl',
  'crockery/drinkware':
    'coffee-sets=Coffee sets;cup-sauser=Cup & Saucer;mugs-teacups=Mugs & Teacups',
  'electronics/mobiles':
    'air-pods=Air Pods;back-case=Back Case;charger=Charger;ear-phones=Ear phones;head-phone=Head Phone;selfie-stick=Selfie Stick;power-bank=Power Bank;neckband=Neckband;temper-glass=Temper Glass;mobile-stand=Mobile Stand;usb-cable=USB cable',
  'electronics/computers':
    'cpu=CPU;keyboard=Keyboard;laptop-bag=Laptop bag;monitor=Monitor;mouse=Mouse;quick-scanner=Quick scanner;webcam=Webcam',
  'electrical-and-lights/cables-wiring': 'wire=Wire',
  'electrical-and-lights/lights':
    'inverter-bulb=Inverter bulb;emergency-light=Emergency light;floor-lamp=Floor Lamp;serial-lights=Serial Lights;touch-light=Torch light;solar-led-street-light=Solar LED street light;wall-lights=Wall lights',
  'electrical-and-lights/electrical-accessories':
    'adaptor-plug=Adaptor Plug;extension-cords=Extension cords;lamp-holder=Lamp holder;light-socket=Light socket;breakers-fuses=Breakers & Fuses;electrical-hardware=Electrical Hardware;regulators=Regulators;enclosure-metal=Enclosure Metal;socket=Socket;switch=Switch',
  'footwear/men':
    'mens-bounceez=Bounceez;mens-flip-flops=Flip-Flops;slippers-footwear=Men\u2019s Slippers;mens-sandals-clogs=Sandals & Clogs;mens-sneakers=Sneakers',
  'footwear/women':
    'bounceez=Bounceez;flip-flops=Flip-Flops;sandals-and-clogs=Sandals and Clogs;sneakers=Sneakers;slippers=Women\u2019s Slippers',
  'gifts/metal-wall-decor':
    '3d-frame=3D Frame;aluminium-frame=Aluminium Frame;aluminium-slim-frame=Aluminium Slim Frame;charkol-d-frame=Charkol D Frame;charkol-frames=Charkol Frames;lamination-pictures=Lamination Pictures;led-light-aluminium-frame=LED Light Aluminium Frame;pvc-slim-frame=PVC Slim Frame;wooden-frames=Wooden Frames',
  'party-decorations/ribbon':
    'gross-grain-ribbon=Gross Grain Ribbon;organza-ribbon=Organza Ribbon;plastic-ribbon=Plastic Ribbon;satin-ribbon-ribbon=Satin Ribbon;ribbon-bow-ribbon=Ribbon Bow;velvet-ribbon=velvet Ribbon',
  'pet-products/birds':
    'bird-feeders=Bird Feeders;birds-health-supplies=Birds health supplies;bird-foods=Bird foods;nests=Nests',
  'pet-products/dogs':
    'dry-bath=Dry Bath;hair-oil=Hair Oil;shampoo-pet-products=Shampoo;pet-perfumes=Pet Perfumes',
  'pet-products/fish':
    'fish-food=Fish Food;aquarium-accessories=Aquarium Accessories;aquarium-pumps-filters=Aquarium Pumps & Filters;aquarium-water-testing-treatment=Aquarium Water Testing & Treatment',
  'pet-products/cat':
    'cat-food=Cat Food;cat-health-supplies=Cat Health Supplies;cat-shampoo=Cat Shampoo',
  'stationary/pen': 'hero-pen=Hero Pen',
  'stationary/eraser':
    'fancy-eraser=Fancy Eraser;ink-eraser=Ink Eraser;electric-and-pen-eraser=Electric and Pen Eraser',
  'stationary/taps':
    'cellophane-tape-celo-tape=Cellophane Tape (Celo Tape);double-sided-tape=Double-Sided Tape;nano-tape=Nano Tape',
};

/** The homepage category strip, in the exact order and naming of youmartshop.com. */
export const STORE_CATEGORIES: readonly StoreCategory[] = TREE.map(([slug, name, list]) => ({
  slug,
  name,
  subcategories: parse(list).map((sub) => ({
    ...sub,
    children: parse(THIRD_LEVEL[`${slug}/${sub.slug}`] ?? ''),
  })),
}));

/** Live URL scheme: `/product-category/<category>[/<sub>[/<child>]]`. */
export function categoryHref(...slugs: string[]): string {
  return `/product-category/${slugs.join('/')}`;
}

/** Asset path convention; the platform decides how to load it (web: /public, mobile: bundled). */
export function categoryImagePath(categorySlug: string): string {
  return `/categories/${categorySlug}.png`;
}

export const SUBCATEGORY_PLACEHOLDER_IMAGE = '/categories/subcategory-placeholder.png';

/**
 * Builds the category tree from `GET /api/catalog/categories` (flat list with `parentId`, any
 * depth; the storefront uses three levels). Roots keep API order.
 */
export function buildCategoryTree(items: readonly ApiCategory[]): StoreCategory[] {
  const childrenOf = (parentId: string): StoreSubcategory[] =>
    items
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ slug: c.slug, name: c.name, children: childrenOf(c.id) }));
  return items
    .filter((c) => c.parentId === null)
    .map((root) => ({ slug: root.slug, name: root.name, subcategories: childrenOf(root.id) }));
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
