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

const MINOR_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
  'with',
]);

/**
 * Title Case for category labels: capitalises each word and hyphen part, lower-cases minor words
 * after the first, and never lower-cases letters (keeps LED, PVC, USB, 3D).
 */
export function toTitleCase(label: string): string {
  return label
    .trim()
    .split(/\s+/)
    .map((word, index) =>
      index > 0 && MINOR_WORDS.has(word.toLowerCase())
        ? word.toLowerCase()
        : word.replace(
            /(^|-)([^A-Za-z]*)([a-z])/g,
            (_, sep: string, lead: string, ch: string) => sep + lead + ch.toUpperCase(),
          ),
    )
    .join(' ');
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// Captured from the live youmartshop.com menu (2026-09-28): order and slugs verbatim, so every link
// keeps the exact WooCommerce URL. Names are cleaned to toTitleCase() (live casing is inconsistent),
// duplicate "Party Popper" removed and "Skate | Board" -> "Skate Board".
const TREE: ReadonlyArray<[slug: string, name: string, subcategories: string]> = [
  [
    'lawn-and-gardening',
    'Agri and Gardening',
    'fertilizer=Fertilizer;garden-decor=Garden Decor;agri-gardening-tools=Gardening Tools;grow-bags=Grow Bags;irrigation-equipment=Irrigation Equipment;nets-and-fence=Nets and Fence;pesticides=Pesticides;plant-saplings=Plant Saplings;pots-and-planters=Pots & Planters;seeds=Seeds;lawn-care=Lawn Care;greenhouse-accessories=Greenhouse Accessories;garden-soil=Garden Soil;plant-stands=Plant Stands',
  ],
  [
    'arts-and-crafts',
    'Arts and Crafts',
    'art-sets=Art Sets;beeds=Beads;boards=Boards;card-stocks=Card Stocks;clay-arts-and-crafts=Clay;coloured-paper=Coloured Paper;craft-kit=Craft Kits;drawing-materials=Drawing Materials;magnets=Magnets;painting-craft-kits=Painting Craft Kits;painting-materials=Painting Materials;paper=Paper;paper-craft=Paper Craft;pim-pom=Pom Pom;stones=Stones;thread=Thread;writing-supplies=Writing Supplies;sewing-tools=Sewing Tools;art-supplies=Art Supplies;kids-art-and-craft=Kids Art & Craft;clay-and-moulding=Clay & Moulding;calligraphy-supplies=Calligraphy Supplies;craft-tools=Craft Tools;craft-paper=Craft Paper;art-easels=Art Easels',
  ],
  [
    'artifical-flowers-and-plants',
    'Artificial Flowers and Plants',
    'bocckey-flower=Bouquet Flower;customized-product=Customized Product;cone-rose=Cone Rose;dry-flower=Dry Flower;flower-bunch=Flower Bunch;flower-kodi=Flower Kodi;flower-wase=Flower Vase;fruits=Fruits;hanging-pot=Hanging Pot;leaf-kodi=Leaf Kodi;lotus-flower=Lotus Flower;plants=Plants;plastic-accessories=Plastic Accessories;pocket-rose=Pocket Rose;single-foam-flower=Single Foam Flower;single-glitter-flower=Single Glitter Flower;stick-flower=Stick Flower;tree=Tree;wall-grass-mat=Wall Grass Mat;wall-hanging-grass=Wall Hanging Grass;wall-stand=Wall Stand;wooden-stand=Wooden Stand;pots=Pots;artificial-plant-pots=Artificial Plant Pots;artificial-plants=Artificial Plants;artificial-flowers=Artificial Flowers;artificial-grass=Artificial Grass',
  ],
  [
    'auto-accessories',
    'Auto Accessories',
    'automative-air-fresheners=Automotive Air Fresheners;car-interior=Car Interior;cloth-and-towels=Cloth and Towels;consoles-organizers=Consoles & Organizers;mobile-phone-chargers=Mobile Phone Chargers;riding-gloves=Riding Gloves;car-exterior-accessories=Car Exterior Accessories;jump-starters=Jump Starters;car-care=Car Care;bike-accessories=Bike Accessories;car-interior-accessories=Car Interior Accessories;car-accessories=Car Accessories;tool-kits=Tool Kits;tyre-accessories=Tyre Accessories',
  ],
  [
    'baby-care',
    'Baby Care',
    'baby-bathing-products=Baby Bathing Products;baby-diaper=Baby Diaper;baby-grooming-kit=Baby Grooming Kit;baby-hair-care=Baby Hair Care;baby-skin-care=Baby Skin Care;baby-toiletries-hygiene-products=Baby Toiletries & Hygiene Products;baby-towels-wrappers=Baby Towels & Wrappers;baby-monitors=Baby Monitors;baby-grooming=Baby Grooming;baby-bath-and-skin-care=Baby Bath & Skin Care;baby-diapering-and-wipes=Baby Diapering & Wipes;baby-strollers-and-prams=Baby Strollers & Prams;baby-feeding-bottles=Baby Feeding Bottles;baby-toys-baby-care=Baby Toys;baby-bedding=Baby Bedding;baby-safety=Baby Safety',
  ],
  [
    'bath-fittings',
    'Bath Fittings',
    'closet=Closet;glass-shelf=Glass Shelf;kitchen-sinks=Kitchen Sinks;plumbing-hardware=Plumbing Hardware;rain-shower=Rain Shower;abs-unbreakable=Soap Holder;stop-cock=Stop Cock;table-top-basin=Table Top Basin;taps-bath-fittings=Taps;towel-ring=Towel Ring;toilet-accessories=Toilet Accessories;bathroom-accessories=Bathroom Accessories;taps-and-faucets=Taps & Faucets;showers=Showers;bathroom-sinks=Bathroom Sinks;bath-tubs=Bath Tubs',
  ],
  [
    'cleaning-products',
    'Cleaning Products',
    'brooms=Brooms;brush=Brush;detergents-cleaners=Detergents & Cleaners;dishwash=Dishwash;duster=Duster;dust-pan=Dust Pan;mops=Mops;scrubbers-sponges=Scrubbers & Sponges;rope=Rope;air-fresheners=Air Fresheners;cleaning-gloves=Cleaning Gloves;floor-cleaners=Floor Cleaners;dishwashing-liquids=Dishwashing Liquids;laundry-detergents=Laundry Detergents;home-cleaning-sets=Home Cleaning Sets;garbage-bags-cleaning-products=Garbage Bags',
  ],
  [
    'cosmetics',
    'Cosmetics',
    'both-and-body=Bath and Body;blush=Blush;body-spray=Body Spray;brushes=Brushes;compact=Compact;combs=Combs;eyeliner=Eyeliner;eye-shadow=Eye Shadow;face-pack=Face Pack;face-peel-of-mask=Face Peel of Mask;face-scrub=Face Scrub;face-wash=Face Wash;foundation=Foundation;hair=Hair;kajal=Kajal;lip-care=Lip Care;lip-gloss=Lip Gloss;lipstick=Lipstick;liquid-lipstick=Liquid Lipstick;mascara=Mascara;moisturizer=Moisturizer;nail-polish=Nail Polish;perfumes=Perfumes;powder=Powder;primer=Primer;sunscreen=Sunscreen;makeup=Makeup;body-care=Body Care;skin-care=Skin Care;hair-care=Hair Care;grooming=Grooming;fragrances=Fragrances;face-makeup=Face Makeup',
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
  [
    'electronics',
    'Electronics',
    'mobiles=Mobiles;computers=Computers;speaker=Speaker;smart-devices=Smart Devices;mobile-accessories=Mobile Accessories;cameras=Cameras;storage-devices=Storage Devices;computer-accessories=Computer Accessories;printers=Printers',
  ],
  [
    'electrical-and-lights',
    'Electrical and Lights',
    'cables-wiring=Cables & Wiring;door-chimes-bells=Door Bells;lights=Lights;electrical-accessories=Electrical Accessories;mosquito-killer-racket=Mosquito Killer Racket;insect-killers=Insect Killers & Pest Control;switches=Switches;decorative-lights=Decorative Lights;led-bulbs=LED Bulbs;emergency-lights=Emergency Lights;ceiling-lights=Ceiling Lights;extension-boards=Extension Boards;fans=Fans',
  ],
  [
    'furniture',
    'Furniture',
    'chairs=Chairs;dining-table=Dining Table;kids-chair=Kids;plastic-chair=Plastic Chair;table=Table;wardrobe=Wardrobe;outdoor-furniture=Outdoor Furniture;beds=Beds',
  ],
  [
    'fashion-jewellery',
    'Fashion Jewellery',
    'anklet=Anklet;bracelet=Bracelet;bangle=Bangle;brooch=Brooch;earrings=Earrings;head-jewellery=Head Jewellery;jewellery-set=Jewellery Set;mangalsutra=Mangalsutra;necklace-and-chains=Necklace and Chains;nosepin=Nosepin;pendant=Pendant;ring=Ring;saree-accessories=Saree Accessories;hair-accessories=Hair Accessories;necklaces=Necklaces;artificial-jewellery=Artificial Jewellery',
  ],
  [
    'clothing',
    'Clothing',
    "bottomwear=Bottomwear;accessories=Accessories;clothing-accessories=Clothing Accessories;winter-wear=Winter Wear;topwear=Topwear;ethnic-wear=Ethnic Wear;sports-and-gym-wear=Sports & Gym Wear;sarees-and-saree-essentials=Sarees and Saree Essentials;lingerie-sleep-and-swimwear=Lingerie, Sleep & Swimwear;kids-clothing=Kids' Clothing;formal-wear=Formal Wear;dresses-and-western-wear=Dresses & Western Wear;fabrics=Fabrics",
  ],
  ['grocery', 'Grocery & Gourmet Foods', 'sweeteners=Sweeteners'],
  ['footwear', 'Footwear', 'kids-footwear=Kids Footwear;men=Men;women=Women;shoe-care=Shoe Care;men-s-footwear=Men\'s Footwear;women-s-footwear=Women\'s Footwear'],
  [
    'gifts',
    'Gifts & Frames',
    'ceramics-gifts=Ceramics-Gifts;dream-catches=Dream Catches;gift-sets=Ceramic Gift Sets;gift-lamps=Gift Lamps;gift-tray=Gift Tray;message-bottle=Message Bottle;metal-gift-box=Metal Gift Box;metal-wall-decor=Metal Wall Decor;statue-gift=Statue Gift;wind-chain=Wind Chain;wall-photo-frame=Wall Photo Frame;water-fountain=Water Fountain;wooden-gift-box=Wooden Gift Box;personalized-gifts=Personalized Gifts;trophies-and-awards=Trophies & Awards;photo-frames=Photo Frames;decorative-showpieces=Decorative Showpieces;gift-sets-and-greeting-cards=Gift Sets & Greeting Cards;photo-albums=Photo Albums',
  ],
  [
    'hardwares',
    'Hardware',
    'bearings=Bearings;cabinet-hardware=Cabinet Hardware;fasteners-fittings=Fasteners & Screws;latches-bolts=Latches & Bolts;locks-security-hardware=Locks & Security Hardware;angles-brackets-fasteners=Angles and Brackets;paints=Paints;cement-mortar=Cement & Mortar;door-and-cabinet-handles=Door & Cabinet Handles;door-locks=Door Locks;safety-hardware=Safety Hardware;furniture-fittings=Furniture Fittings;adhesives-and-tapes=Adhesives & Tapes;building-hardware=Building Hardware',
  ],
  [
    'home-appliances',
    'Home Appliances',
    'air-purifiers=Air Purifiers;airfryers=Airfryers;citrus-press=Citrus Press;garment-steamers=Garment Steamers;hand-blenders=Hand Blenders;hand-mixers=Hand Mixers;induction-cooktops=Induction Cooktops;steam-irons=Iron Box;jmg=Juicer Mixer Grinder;juicer=Juicer;kettles=Kettles;mixer-grinders=Mixer Grinders;otg=Oven Toaster Grill;sandwich-maker=Sandwich Maker;toasters=Toasters;vacuum-cleaners=Vacuum Cleaners;cooking-appliances=Cooking Appliances;washing-machines=Washing Machines;water-heaters=Water Heaters;chimneys=Chimneys;water-purifiers=Water Purifiers',
  ],
  [
    'home-furnishing',
    'Home Furnishing',
    'bath-linen=Bath Linen;bedsheets=Bedsheets;curtain-accessories=Curtain & Accessories;cushion-covers=Cushion Covers;carpets=Carpets;door-mats=Door Mats;fabric=Fabric;heavy-bed=Mattress;pillow-covers=Pillow Covers;quilts=Quilts;ready-made-curtains=Ready Made Curtains;rugs=Rugs;sheer-curtains=Sheer Curtains;sofa-covers=Sofa Covers;sofa-headrests=Sofa Headrests;string-curtains=String Curtains;table-linen=Table Linen;table-mat=Table Mat;towel=Towel;mosquito-nets=Mosquito Nets;cushions-and-pillows=Cushions & Pillows;rugs-and-mats=Rugs & Mats;sofa-and-chair-covers=Sofa & Chair Covers;blankets=Blankets;curtains=Curtains;aprons=Aprons;laundry-bags-and-mosquito-nets=Laundry Bags & Mosquito Nets',
  ],
  [
    'stainless-steel-vessels',
    'Kitchenware',
    'water-bottle=Bottle and Flask;casserole=Casserole;cookware=Cookware;electric-tiffin=Electric Tiffin;stainless-vessels=Stainless Vessels;hot-cold-flask=Hot & Cold Flask;hot-box=Hot Box;ice-packs-and-pails=Ice Packs and Pails;lunch-box=Lunch Box;jugs=Jugs and Purifier;kettle=Kettle;kitchen-utensils=Kitchen Utensils;pots-and-pans=Pots & Pans;smart-range=Smart Range;storage-jar=Storage Jar;storage-containers=Storage Containers;tableware=Tableware;tiffin-box=Tiffin Box;kitchen-tools=Kitchen Tools;knives=Knives;disposable-items-stainless-steel-vessels=Disposable Items;kitchen-organizers=Kitchen Organizers;plastic-household-stainless-steel-vessels=Plastic Household;crockery-stainless-steel-vessels=Crockery',
  ],
  [
    'musical-instruments',
    'Musical Instruments',
    'flutes=Flutes;harmonicas=Harmonicas;portable-keyboard=Portable Keyboard;steel-drums=Steel Drums;tambourines=Tambourines;violins=Violins',
  ],
  [
    'party-decorations',
    'Party Decorations',
    'anniversary=Anniversary Decoration;baby-shower=Baby Shower Decoration;birthday-banners=Banners;birthday-caps=Caps;snow-spary=Snow Spray;balloon-decoration-accessories=Balloon Decoration Accessories;baloon-pump=Balloon Pump;birthday-sash=Sash;birthday-photo-banner=Photo Banner;party-popper=Party Popper;birthday-decoration-set=Decoration Set;balloons=Balloons;birthday=Birthday;butterfly-wings=Butterfly Wings;bride-to-be=Bride to Be Decoration;cake-toper=Cake Toper;candles=Candles;chinees-doom=Chinese Dome;chinese-visiri=Chinese Visiri;crown=Crown;eye-mask=Eye Mask;face-beard=Face Beard;face-mask=Face Mask;fancy-umbrella=Fancy Umbrella;foil-fringe-curtain=Foil Fringe Curtain;foil-balloons=Foil Balloons;hand-gloves=Hand Gloves;maalai=Maalai;naming-ceremony=Naming Ceremony Decoration;net-cloth=Net Cloth;paper-cutting=Paper Cutting;party-caps=Party Caps;photo-prop=Photo Prop;reception-maalai=Reception Maalai;ribbon=Ribbon;screen=Screen;sky-lantern=Sky Lantern;strings=Strings;thermocol-design=Thermocol Design;thoranam=Thoranam;wigs=Wigs;zoomer=Zoomer;festival-decorations=Festival Decorations;wedding-decorations=Wedding Decorations;party-decoration-kits=Party Decoration Kits',
  ],
  [
    'pet-products',
    'Pet Supplies',
    'birds=Birds;dogs=Dogs;fish=Fish;cat=Cat;pet-grooming=Pet Grooming;pet-training=Pet Training;pet-toys=Pet Toys;pet-bowls-and-feeders=Pet Bowls & Feeders',
  ],
  [
    'plastic-household',
    'Plastic Household',
    'bathroom-accessory-sets=Bathroom Accessory Sets;bathroom-cabinet=Bathroom Cabinet;dustbin=Dustbin;laundry-basket=Laundry Basket;multi-purpose=Multi-Purpose;organizer=Organizer',
  ],
  [
    'sports-fitness',
    'Sports & Fitness',
    'badminton=Badminton;basketball=Basketball;carrom=Carrom;cricket=Cricket;fitness-product=Fitness Product;sports-shoes-sports-goods=Sports Shoes;football=Football;indoor-sports=Indoor Sports;tennis=Tennis;skate-board=Skate Board;sports-ball=Sports Ball;sports-kit-bag=Sports Kit Bag;squash=Squash;yoga=Yoga;swimming=Swimming;trophy=Trophy;volleyball=Volleyball;skating=Skating',
  ],
  [
    'stationary',
    'Stationary',
    'a3-a4-drawing-note=A3 & A4 Drawing Note;a4-white-paper=A4 White Paper;acrylic-paint=Acrylic Paint;calculator=Calculator;pen=Pen;pencil=Pencil;eraser=Eraser;pen-stand=Pen Stand;paper-weight=Paper Weight;resin-arts=Resin Arts;spray-paint=Spray Paint;sticky-notes=Sticky Notes;taps=Tapes;chart-paper=Chart Paper;colour-pencil=Colour Pencil;correction-pen=Correction Pen;correction-tape=Correction Tape;cotton=Cotton;crayons=Crayons;drawing-board=Drawing Board;files=Files;geometry-box=Geometry Box;glue-gun-and-stick=Glue Gun and Stick;highlighter=Highlighter;marker-ink=Marker;mechanical-pencil=Mechanical Pencil;magnifier-lens=Magnifier Lens;note-book=Note Book;oil-pastels=Oil Pastels;pastel-paint=Pastel Paint;permanent-marker=Permanent Marker;pin=Pin;poster-colour=Poster Colour;premium-poster-colour=Premium Poster Colour;scissors=Scissors;sketch-paper=Sketch Paper;soft-pastel=Soft Pastel;study-table=Study Table;watercolour-tube=Watercolour Tube;whiteboard-marker=Whiteboard Marker;pen-holder=Pen Holder;reading-magnifiers=Reading Magnifiers;rotary-desk-organiser=Rotary Desk Organiser;whiteboard-eraser=Whiteboard Eraser;bouquet-sheet=Bouquet Sheet;bubble-wrap=Bubble Wrap;colour-paper=Colour Paper;crepe-paper=Crepe Paper;felt-sheet=Felt Sheet;foam-sheet=Foam Sheet;gift-sheet=Gift Sheet;thermocol-sheet=Thermocol Sheet;file-folders=Files & Folders;office-supplies=Office Supplies;school-supplies=School Supplies;glue-and-adhesives-stationary=Glue & Adhesives;notebooks=Notebooks;pencils-and-erasers=Pencils & Erasers',
  ],
  [
    'surgical-instruments',
    'Surgical Instruments',
    'needle-holder=Needle Holder;medical-forceps=Medical Forceps',
  ],
  [
    'tools',
    'Tools',
    'carpenters-tools=Carpenters Tools;construction-tools=Construction Tools;cutters=Cutters;gardening-tools=Gardening Tools;hand-tools=Hand Tools;power-tools=Power Tools;safety-gloves=Safety Gloves;measuring-tools=Measuring Tools;tool-boxes-and-organizers=Tool Boxes & Organizers;safety-equipment=Safety Equipment',
  ],
  [
    'toys',
    'Toys & Games',
    'baby-toddler-toys=Plush Toys;animal-toys=Animal Toys;baby-toys=Baby Toys;specialty-lighting=Specialty Lighting;sportsoutdoor=Outdoor Toys;remote-cars=Remote Toys;science-toys-kits=Learning Toys;dolls=Dolls;games=Games;kids-cycle=Kids Cycle;modeling-clay=Modeling Clay;rubber-toys=Rubber Toys;saving-bank=Saving Bank;talking-bird=Talking Bird;musical-toys-toys=Musical Toys;outdoor-and-ride-on-toys=Outdoor & Ride-On Toys;role-play-toys=Role Play Toys;board-games-and-puzzles=Board Games & Puzzles;educational-and-building-toys=Educational & Building Toys;toy-cars-and-vehicles=Toy Cars & Vehicles',
  ],
  [
    'travel-accessories',
    'Travel & Accessories',
    'backpack=Backpack;belt=Belt;breifcase=Briefcase;duffle-bag=Duffle Bag;hand-bag=Hand Bag;laptop-backpacks=Laptop Backpacks;laptop-sleeves=Laptop Sleeves;lock=Lock;luggage-cover=Luggage Cover;lunch-bag=Lunch Bag;neck-pouches=Neck Pouches;rucksacks=Rucksacks;shoulder-bags=Shoulder Bags;sling-bag=Sling Bag;sleep-masks=Sleep Masks;straps=Straps;suitcase=Suitcase;toiletry-bags=Toiletry Bags;travel-pillow=Travel Pillow;travel-tote-bags=Travel Tote Bags;trolly=Trolley;umbrella=Umbrella;wallet=Wallet;travel-bags=Travel Bags;travel-accessories-travel-accessories=Travel Accessories;luggage-accessories=Luggage Accessories',
  ],
  [
    'wall-clock',
    'Wall Clock & Watches',
    'alaram-clock=Alaram Clock;analog-clock=Analog Clock;digital-clock=Digital Clock;double-side-clock=Double Side Clock;modern-clock=Modern Clock;fancy-clock=Fancy Clock;watch=Watch;wall-clocks=Wall Clocks',
  ],
];

/** Third menu level, keyed `categorySlug/subcategorySlug` (live desktop flyouts). */
const THIRD_LEVEL: Readonly<Record<string, string>> = {
  // v1.17 catalog import: Compost (products imported from the data delivery).
  'lawn-and-gardening/fertilizer':
    'compost=Compost;organic-manure=Organic Manure;organic-fertilizers=Organic Fertilizers;vermicompost=Vermicompost;npk-fertilizers=NPK Fertilizers;liquid-fertilizers=Liquid Fertilizers;chemical-fertilizers=Chemical Fertilizers;soil-amendments=Soil Amendments;plant-protection=Plant Protection',
  'lawn-and-gardening/garden-decor':
    'garden-statues=Garden Statues;bird-baths=Bird Baths;garden-fountains=Garden Fountains;garden-ornaments=Garden Ornaments;garden-lights=Garden Lights',
  'bath-fittings/taps-bath-fittings':
    'flexo-ebony-series=Flexo-Ebony Series;flexo-series=Flexo Series;plastic-taps=Plastic Taps',
  'cleaning-products/brooms': 'floor-brooms=Floor Brooms',
  'cleaning-products/brush':
    'bottle-brush=Bottle Brush;antibacterial-series=Hockey Brush;sink-brush=Sink Brush;steel-electrical-brush=Steel Brush;tiotel-brush=Toilet Brush',
  'cleaning-products/mops':
    'bucket-mops=Bucket Mops;cotton-mops=Cotton Mops;pva-mop=PVA Mop;wiper-mops=Wiper Mops',
  'cosmetics/both-and-body':
    'face-cream=Face Cream;face-serum=Face Serum;facial-wipes=Facial Wipes;hand-wash=Hand Wash;soaps=Soaps;toner=Toner',
  'cosmetics/hair': 'conditioner=Conditioner;cream=Cream;henna=Henna;oil=Oil;shampoo=Shampoo',
  'crockery/serving-dining':
    'dinner-set=Dinner Set;jar-gift-sets=Jar & Gift Sets;jugs-jug-sets=Jugs & Jug Sets;serving-set=Serving Set;glass-crockery=Glass;juice-set=Juice Set',
  'crockery/bowls': 'mixing-bowl=Mixing Bowl;soup-bowl=Soup Bowl;ice-cream-bowl=Ice Cream Bowl',
  'crockery/drinkware':
    'coffee-sets=Coffee Sets;cup-sauser=Cup & Saucer;mugs-teacups=Mugs & Teacups',
  'electronics/mobiles':
    'air-pods=Air Pods;back-case=Back Case;charger=Charger;ear-phones=Ear Phones;head-phone=Head Phone;selfie-stick=Selfie Stick;power-bank=Power Bank;neckband=Neckband;temper-glass=Temper Glass;mobile-stand=Mobile Stand;usb-cable=USB Cable',
  'electronics/computers':
    'cpu=CPU;keyboard=Keyboard;laptop-bag=Laptop Bag;monitor=Monitor;mouse=Mouse;quick-scanner=Quick Scanner;webcam=Webcam',
  'electrical-and-lights/cables-wiring': 'wire=Wire',
  'electrical-and-lights/lights':
    'inverter-bulb=Inverter Bulb;emergency-light=Emergency Light;floor-lamp=Floor Lamp;serial-lights=Serial Lights;touch-light=Torch Light;solar-led-street-light=Solar LED Street Light;wall-lights=Wall Lights',
  'electrical-and-lights/electrical-accessories':
    'adaptor-plug=Adaptor Plug;extension-cords=Extension Cords;lamp-holder=Lamp Holder;light-socket=Light Socket;breakers-fuses=Breakers & Fuses;electrical-hardware=Electrical Hardware;regulators=Regulators;enclosure-metal=Enclosure Metal;socket=Socket;switch=Switch',
  'footwear/men':
    'mens-bounceez=Bounceez;mens-flip-flops=Flip-Flops;slippers-footwear=Men\u2019s Slippers;mens-sandals-clogs=Sandals & Clogs;mens-sneakers=Sneakers',
  'clothing/bottomwear':
    'cargos=Cargos;leggings-and-jeggings=Leggings and Jeggings;palazzos=Palazzos;track-pants=Track Pants;harem-pants=Harem Pants;three-fourths=Three-Fourths;shorts=Shorts;jeans=Jeans;trousers=Trousers;skirts=Skirts',
  'footwear/women':
    'bounceez=Bounceez;flip-flops=Flip-Flops;sandals-and-clogs=Sandals and Clogs;sneakers=Sneakers;slippers=Women\u2019s Slippers',
  'gifts/metal-wall-decor':
    '3d-frame=3D Frame;aluminium-frame=Aluminium Frame;aluminium-slim-frame=Aluminium Slim Frame;charkol-d-frame=Charkol D Frame;charkol-frames=Charkol Frames;lamination-pictures=Lamination Pictures;led-light-aluminium-frame=LED Light Aluminium Frame;pvc-slim-frame=PVC Slim Frame;wooden-frames=Wooden Frames',
  'party-decorations/ribbon':
    'gross-grain-ribbon=Gross Grain Ribbon;organza-ribbon=Organza Ribbon;plastic-ribbon=Plastic Ribbon;satin-ribbon-ribbon=Satin Ribbon;ribbon-bow-ribbon=Ribbon Bow;velvet-ribbon=Velvet Ribbon',
  'pet-products/birds':
    'bird-feeders=Bird Feeders;birds-health-supplies=Birds Health Supplies;bird-foods=Bird Foods;nests=Nests;bird-cages=Bird Cages & Covers',
  'pet-products/dogs':
    'dry-bath=Dry Bath;hair-oil=Hair Oil;shampoo-pet-products=Shampoo;pet-perfumes=Pet Perfumes;tick-flea=Tick & Flea Care',
  'pet-products/fish':
    'fish-food=Fish Food;aquarium-accessories=Aquarium Accessories;aquarium-pumps-filters=Aquarium Pumps & Filters;aquarium-water-testing-treatment=Aquarium Water Testing & Treatment;aquarium-decor=Aquarium Decor',
  'pet-products/cat':
    'cat-food=Cat Food;cat-health-supplies=Cat Health Supplies;cat-shampoo=Cat Shampoo',
  'stationary/pen': 'hero-pen=Hero Pen;fountain-pens=Fountain Pens;gel-pens=Gel Pens;ball-pens=Ball Pens;roller-pens=Roller Pens',
  'lawn-and-gardening/pots-and-planters':
    'hanging-planters=Hanging Planters;ceramic-pots=Ceramic Pots;plastic-pots=Plastic Pots;self-watering-planters=Self-Watering Planters',
  'home-furnishing/mosquito-nets':
    'bed-mosquito-nets=Bed Mosquito Nets;window-door-mosquito-nets=Window & Door Mosquito Nets',
  'lawn-and-gardening/nets-and-fence':
    'bird-netting=Bird Netting;insect-netting=Insect Netting;shade-netting=Shade Netting;plant-support-netting=Plant Support Netting;garden-fencing=Garden Fencing',
  'lawn-and-gardening/irrigation-equipment':
    'sprinklers=Sprinklers;drip-irrigation=Drip Irrigation;drip-irrigation-kits=Drip Irrigation Kits;irrigation-pipes=Irrigation Pipes;hose-connectors=Hose Connectors;micro-irrigation=Micro Irrigation',
  'lawn-and-gardening/pesticides':
    'insecticides=Insecticides;organic-pesticides=Organic Pesticides;herbicides=Herbicides;fungicides=Fungicides',
  'lawn-and-gardening/agri-gardening-tools':
    'sprayers=Sprayers;pruning-tools=Pruning Tools;garden-hand-tools=Garden Hand Tools;gardening-gloves=Gardening Gloves;garden-hoses=Garden Hoses;lawn-edgers=Lawn Edgers & Trimmers;trowels=Trowels;cultivators=Cultivators;rakes=Rakes;garden-forks=Garden Forks;shovels=Shovels;pruners-secateurs=Pruners/Secateurs',
  'lawn-and-gardening/plant-saplings':
    'indoor-plants=Indoor Plants;flower-plants=Flower Plants;fruit-plants=Fruit Plants;vegetable-plants=Vegetable Plants',
  'stationary/eraser':
    'fancy-eraser=Fancy Eraser;ink-eraser=Ink Eraser;electric-and-pen-eraser=Electric and Pen Eraser',
  'stationary/taps':
    'cellophane-tape-celo-tape=Cellophane Tape (Celo Tape);double-sided-tape=Double-Sided Tape;nano-tape=Nano Tape',
  'cleaning-products/floor-cleaners':
    'all-purpose-cleaners=All Purpose Cleaners;marble-cleaners=Marble Cleaners;kitchen-cleaners=Kitchen Cleaners;tile-cleaners=Tile Cleaners;glass-cleaners=Glass Cleaners;floor-disinfectants=Floor Disinfectants;toilet-cleaners=Toilet Cleaners;disinfectants=Disinfectants;surface-cleaners=Surface Cleaners;drain-cleaners=Drain Cleaners;bathroom-cleaners=Bathroom Cleaners',
  'lawn-and-gardening/seeds':
    'flower-seeds=Flower Seeds;herb-seeds=Herb Seeds;vegetable-seeds=Vegetable Seeds;fruit-seeds=Fruit Seeds',
  'lawn-and-gardening/lawn-care':
    'grass-seeds=Grass Seeds;lawn-fertilizers=Lawn Fertilizers;weed-control=Weed Control;lawn-mowers=Lawn Mowers',
  'lawn-and-gardening/greenhouse-accessories':
    'greenhouse-covers=Greenhouse Covers;greenhouse-frames=Greenhouse Frames',
  'lawn-and-gardening/garden-soil':
    'potting-mix=Potting Mix;cocopeat=Cocopeat;vermiculite=Vermiculite;perlite=Perlite;soil-fertilizers=Soil Fertilizers',
  'cleaning-products/dishwashing-liquids':
    'dishwashing-bars=Dishwashing Bars;scrubbers=Scrubbers;dishwasher-tablets=Dishwasher Tablets',
  'cleaning-products/laundry-detergents':
    'fabric-softeners=Fabric Softeners;stain-removers=Stain Removers;washing-powders=Washing Powders;liquid-detergents=Liquid Detergents',
  'cleaning-products/home-cleaning-sets':
    'scrub-pads=Scrub Pads;cleaning-cloths=Cleaning Cloths;mop-refills=Mop Refills;wipers=Wipers;brushes-home-cleaning-sets=Brushes;cleaning-brush-sets=Cleaning Brush Sets;dustpans=Dustpans',
  'cleaning-products/garbage-bags-cleaning-products':
    'large-garbage-bags=Large Garbage Bags;drawstring-bags=Drawstring Bags;biodegradable-bags=Biodegradable Bags;small-garbage-bags=Small Garbage Bags',
  'auto-accessories/car-exterior-accessories':
    'wiper-blades=Wiper Blades;horn=Horn;mud-flaps=Mud Flaps;number-plate-frames=Number Plate Frames;dash-cameras=Dash Cameras;door-guards=Door Guards;parking-sensors=Parking Sensors;reverse-cameras=Reverse Cameras;car-covers=Car Covers;led-lights=LED Lights',
  'cleaning-products/air-fresheners':
    'electric-diffusers=Electric Diffusers;room-sprays=Room Sprays;gel-fresheners=Gel Fresheners;car-fresheners=Car Fresheners',
  'arts-and-crafts/art-supplies': 'paint-brushes=Paint Brushes;canvas=Canvas;paint-sets=Paint Sets;palettes=Palettes;drawing-boards=Drawing Boards',
  'cosmetics/makeup': 'makeup-brushes=Makeup Brushes;nail-care=Nail Care;eyeshadow=Eyeshadow',
  'pet-products/pet-grooming': 'pet-brushes=Pet Brushes;grooming-kits-pet-grooming=Grooming Kits;nail-clippers=Nail Clippers',
  'auto-accessories/jump-starters':
    'battery-boosters=Battery Boosters;jump-starter-cables=Jump Starter Cables;portable-jump-starters=Portable Jump Starters',
  'auto-accessories/car-care':
    'car-polish=Car Polish;car-shampoo=Car Shampoo;tyre-polish=Tyre Polish;microfiber-cloths=Microfiber Cloths;car-wax=Car Wax;car-cleaning=Car Cleaning',
  'auto-accessories/bike-accessories':
    'bike-covers=Bike Covers;bike-mirrors=Bike Mirrors;usb-chargers=USB Chargers;mobile-holders=Mobile Holders;bike-riding-gear=Bike Riding Gear;saddle-bags=Saddle Bags;helmet-accessories=Helmet Accessories',
  'home-furnishing/cushions-and-pillows': 'cushions=Cushions;sleeping-pillows=Sleeping Pillows',
  'electrical-and-lights/switches':
    'modular-switches=Modular Switches;smart-switches=Smart Switches',
  'auto-accessories/car-interior-accessories':
    'seat-cushions=Seat Cushions;steering-covers=Steering Covers;car-sun-shades=Car Sun Shades;car-chargers=Car Chargers;floor-mats=Floor Mats;gear-knobs=Gear Knobs;car-organizers=Car Organizers;seat-covers=Seat Covers',
  'electronics/smart-devices': 'smart-sensors=Smart Sensors',
  'clothing/accessories':
    'caps=Caps;stockings=Stockings;garters=Garters;suspenders=Suspenders;stoles=Stoles;bandanas=Bandanas;handkerchiefs=Handkerchiefs;hats=Hats;collar-stays=Collar Stays;wristbands=Wristbands;applique-patch=Applique Patch;mittens=Mittens;ties-and-cufflinks=Ties and Cufflinks;turbans=Turbans;socks=Socks',
  'footwear/shoe-care': 'shoe-accessories=Shoe Accessories;shoe-polish=Shoe Polish',
  'electrical-and-lights/decorative-lights': 'string-lights=String Lights;night-lamps=Night Lamps;table-lamps=Table Lamps',
  'electrical-and-lights/led-bulbs': 'led-tubelights=LED Tubelights',
  'electrical-and-lights/emergency-lights':
    'outdoor-lights=Outdoor Lights;street-lights=Street Lights',
  'electrical-and-lights/ceiling-lights':
    'pendant-lights=Pendant Lights;led-ceiling-lights=LED Ceiling Lights',
  'auto-accessories/car-accessories': 'sun-shades=Sun Shades',
  'gifts/personalized-gifts': 'keychains=Keychains',
  'home-furnishing/towel': 'face-towels=Face Towels;bath-towels=Bath Towels;hand-towels=Hand Towels;kitchen-towels=Kitchen Towels',
  'electrical-and-lights/extension-boards':
    'adapters=Adapters;power-strips=Power Strips;surge-protectors=Surge Protectors',
  'electronics/mobile-accessories': 'cables=Cables;car-mounts=Car Mounts',
  'tools/hand-tools':
    'wrenches=Wrenches;screwdriver-sets=Screwdriver Sets;hammers=Hammers;allen-keys=Allen Keys;spanners=Spanners;pliers=Pliers',
  'auto-accessories/tool-kits':
    'car-tool-kits=Car Tool Kits;bike-tool-kits=Bike Tool Kits;emergency-tool-kits=Emergency Tool Kits',
  'home-furnishing/table-linen': 'table-cloths=Table Cloths;table-runners=Table Runners',
  'electronics/cameras': 'camera-accessories=Camera Accessories;cctv=CCTV',
  'electrical-and-lights/fans': 'table-fans=Table Fans',
  'bath-fittings/toilet-accessories':
    'toilet-paper-holders=Toilet Paper Holders;toilet-seats=Toilet Seats;angle-valves=Angle Valves;toilet-brushes=Toilet Brushes;floor-drains=Floor Drains;waste-couplings=Waste Couplings',
  'hardwares/door-and-cabinet-handles': 'hooks=Hooks;hinges=Hinges',
  'tools/power-tools': 'drills=Drills;soldering-tools=Soldering Tools;glue-guns-power-tools=Glue Guns;heat-guns=Heat Guns;angle-grinders=Angle Grinders;saws=Saws;cutting-machines=Cutting Machines',
  'clothing/clothing-accessories':
    'sewing-kits=Sewing Kits;patches=Patches;velcro=Velcro;waistband-elastic=Waistband Elastic;polyester-threads=Polyester Threads;cotton-threads=Cotton Threads;embroidery-threads=Embroidery Threads;laces=Laces;ribbons=Ribbons;presser-feet=Presser Feet;bias-tapes=Bias Tapes;embroidery-scissors=Embroidery Scissors;tailoring-scissors=Tailoring Scissors;machine-needles=Machine Needles;bobbins=Bobbins;bobbin-cases=Bobbin Cases;marking-tools=Marking Tools;tailor-chalk=Tailor Chalk;fabric-cutters=Fabric Cutters;hooks-and-eyes=Hooks & Eyes;fabric-glue=Fabric Glue;fusible-interlining=Fusible Interlining;non-woven-interfacing=Non-Woven Interfacing;hand-sewing-needles=Hand Sewing Needles;zippers=Zippers;elastic-bands=Elastic Bands;embroidery-kits=Embroidery Kits;embroidery-needles=Embroidery Needles;embroidery-hoops=Embroidery Hoops',
  'auto-accessories/tyre-accessories': 'tyre-repair-kits=Tyre Repair Kits',
  'gifts/trophies-and-awards': 'plaques=Plaques',
  'electronics/storage-devices': 'memory-cards=Memory Cards',
  'hardwares/door-locks': 'door-stoppers=Door Stoppers',
  'home-furnishing/rugs-and-mats':
    'bath-mats=Bath Mats;mats=Mats;area-rugs=Area Rugs;runner-rugs=Runner Rugs',
  'furniture/chairs': 'stools=Stools;office-chairs=Office Chairs',
  'furniture/outdoor-furniture': 'garden-chairs=Garden Chairs;garden-tables=Garden Tables',
  'hardwares/safety-hardware': 'safety-helmets=Safety Helmets',
  'home-furnishing/sofa-and-chair-covers': 'chair-covers=Chair Covers',
  'clothing/winter-wear':
    'scarves=Scarves;sweatshirts=Sweatshirts;raincoats=Raincoats;jackets=Jackets;mufflers=Mufflers;windcheaters=Windcheaters;shawls=Shawls;ponchos=Ponchos;sweaters-and-cardigans=Sweaters and Cardigans;thermals=Thermals;gloves-winter-wear=Gloves',
  'cosmetics/body-care': 'foot-care=Foot Care;body-wash=Body Wash;body-scrubs=Body Scrubs',
  'baby-care/baby-grooming':
    'baby-oral-care=Baby Oral Care;baby-hair-brushes=Baby Hair Brushes;grooming-kits=Grooming Kits;baby-nail-clippers=Baby Nail Clippers;baby-combs=Baby Combs',
  'bath-fittings/bathroom-accessories':
    'toothbrush-holders=Toothbrush Holders;bathroom-mirrors=Bathroom Mirrors;bathroom-stools=Bathroom Stools;towel-racks=Towel Racks;bathroom-hooks=Bathroom Hooks;soap-dishes=Soap Dishes;bathroom-shelves=Bathroom Shelves;hooks-bathroom-accessories=Hooks',
  'cosmetics/grooming': 'shaving=Shaving;beard-care=Beard Care;trimmers=Trimmers',
  'cosmetics/fragrances': 'deodorants=Deodorants',
  'baby-care/baby-bath-and-skin-care':
    'baby-lotion-and-creams=Baby Lotion & Creams;baby-lotion=Baby Lotion;baby-oil=Baby Oil;baby-massage-oils=Baby Massage Oils;baby-shampoo=Baby Shampoo;baby-soaps=Baby Soaps;baby-powder=Baby Powder',
  'baby-care/baby-diapering-and-wipes':
    'disposable-diapers=Disposable Diapers;diaper-rash-cream=Diaper Rash Cream;diaper-changing-mats=Diaper Changing Mats;nappy-pads=Nappy Pads;potty-training=Potty Training;baby-wipes=Baby Wipes;cloth-diapers=Cloth Diapers;diaper-pants=Diaper Pants',
  'baby-care/baby-strollers-and-prams':
    'prams=Prams;strollers=Strollers;baby-walkers=Baby Walkers;travel-systems=Travel Systems;baby-car-seats=Baby Car Seats;baby-carriers=Baby Carriers',
  'baby-care/baby-feeding-bottles':
    'feeding-bottles=Feeding Bottles;bottle-accessories=Bottle Accessories;bottle-cleaners=Bottle Cleaners;bottle-sterilizers=Bottle Sterilizers;bottle-warmers=Bottle Warmers;sterilizers-and-warmers=Sterilizers & Warmers;breast-pumps=Breast Pumps',
  'baby-care/baby-toys-baby-care':
    'rattles=Rattles;teethers=Teethers;activity-toys=Activity Toys;musical-toys=Musical Toys;bath-toys=Bath Toys',
  'cosmetics/hair-care': 'hair-oil-hair-care=Hair Oil',
  'baby-care/baby-bedding':
    'baby-mats=Baby Mats;baby-blankets=Baby Blankets;baby-mosquito-nets=Baby Mosquito Nets;baby-pillows=Baby Pillows;baby-bedding-sets=Baby Bedding Sets',
  'baby-care/baby-safety':
    'bed-rails=Bed Rails;baby-safety-gates=Baby Safety Gates;safety-gates=Safety Gates;corner-guards=Corner Guards;socket-covers=Socket Covers',
  'home-appliances/cooking-appliances': 'electric-kettles=Electric Kettles',
  'clothing/topwear': 't-shirts=T-Shirts;tops=Tops;shirts=Shirts',
  'stainless-steel-vessels/knives': 'choppers=Choppers;vegetable-knives=Vegetable Knives;kitchen-knife-sets=Kitchen Knife Sets;slicers=Slicers',
  'party-decorations/festival-decorations': 'christmas-decorations=Christmas Decorations;diwali-decorations=Diwali Decorations;holi-decorations=Holi Decorations',
  'tools/tool-boxes-and-organizers': 'tool-organizers=Tool Organizers;tool-boxes=Tool Boxes',
  'toys/outdoor-and-ride-on-toys': 'ride-ons=Ride Ons',
  'sports-fitness/cricket': 'cricket-accessories=Cricket Accessories',
  'stationary/school-supplies': 'pencil-cases=Pencil Cases;school-bags=School Bags',
  'clothing/ethnic-wear':
    "abayas-and-burqas=Abayas and Burqas;kurtas-ethnic-sets-and-bottoms=Kurtas, Ethnic Sets and Bottoms;kurtas=Kurtas;women-s-lehenga-cholis=Women's Lehenga Cholis;ethnic-sets=Ethnic Sets;ethnic-pyjamas=Ethnic Pyjamas;dhotis=Dhotis;salwars-and-patialas=Salwars and Patialas;shararas=Shararas;dhoti-pants=Dhoti Pants;lehenga-cholis=Lehenga Cholis;sherwanis=Sherwanis;dupattas=Dupattas",
  'clothing/sports-and-gym-wear':
    "kids-tracksuits=Kids' Tracksuits;women-s-tracksuits=Women's Tracksuits;men-s-tracksuits=Men's Tracksuits",
  'clothing/sarees-and-saree-essentials':
    'petticoats=Petticoats;saree-falls=Saree Falls;sarees=Sarees;blouses=Blouses',
  'clothing/lingerie-sleep-and-swimwear':
    'shapewears=Shapewears;pyjamas-and-lounge-pants=Pyjamas and Lounge Pants;babydolls=Babydolls;lingerie-sets-and-accessories=Lingerie Sets and Accessories;swimsuits=Swimsuits;night-suits=Night Suits;bras=Bras;night-dresses-and-nighties=Night Dresses and Nighties;briefs-and-trunks=Briefs and Trunks;camisoles-and-slips=Camisoles and Slips;panties=Panties',
  'clothing/kids-clothing':
    "kids-windcheaters=Kids' Windcheaters;kids-apparel-combos=Kids' Apparel Combos;kids-costume-wear=Kids' Costume Wear;kids-lehenga-cholis=Kids' Lehenga Cholis;kids-raincoats=Kids' Raincoats;kids-rompers-and-dungarees=Kids' Rompers and Dungarees",
  'clothing/formal-wear': 'waistcoats=Waistcoats;suits=Suits;blazers=Blazers',
  'clothing/dresses-and-western-wear':
    "women-s-clothing=Women's Clothing;gowns=Gowns;jumpsuits-and-dungarees=Jumpsuits and Dungarees;women-s-jumpsuits-and-dungarees=Women's Jumpsuits and Dungarees;men-s-dungarees=Men's Dungarees;twinning-sets=Twinning Sets;co-ords=Co-ords;dresses=Dresses;dresses-and-gowns=Dresses and Gowns",
  'clothing/fabrics':
    'blouse-material=Blouse Material;shirt-and-trouser-fabrics=Shirt and Trouser Fabrics;formal-suit-fabrics=Formal Suit Fabrics;dress-materials=Dress Materials',
  'arts-and-crafts/craft-kit': 'embroidery-kits-craft-kit=Embroidery Kits;diy-kits=DIY Kits;jewellery-making-kits=Jewellery Making Kits;diy-craft-kits=DIY Craft Kits;kids-craft-kits=Kids Craft Kits',
  'artifical-flowers-and-plants/artificial-plants':
    'artificial-cactus=Artificial Cactus;wall-hanging-plants=Wall Hanging Plants;artificial-succulents=Artificial Succulents;hanging-plants=Hanging Plants;artificial-leaves=Artificial Leaves;artificial-bonsai=Artificial Bonsai;artificial-vines=Artificial Vines',
  'artifical-flowers-and-plants/flower-wase':
    'ceramic-vases=Ceramic Vases;floor-vases=Floor Vases;glass-vases=Glass Vases;decorative-vases=Decorative Vases',
  'artifical-flowers-and-plants/artificial-flowers':
    'decorative-flowers=Decorative Flowers;flower-arrangements=Flower Arrangements;artificial-bouquets=Artificial Bouquets;festival-flowers=Festival Flowers;artificial-garlands=Artificial Garlands;flower-sticks=Flower Sticks;wedding-flowers=Wedding Flowers',
  'party-decorations/wedding-decorations': 'wedding-backdrops=Wedding Backdrops',
  'stainless-steel-vessels/disposable-items-stainless-steel-vessels': 'paper-plates=Paper Plates;tissue-paper-disposable-items-stainless-steel-vessels=Tissue Paper;wooden-cutlery=Wooden Cutlery;paper-napkins=Paper Napkins;disposable-glasses=Disposable Glasses;aluminium-foil=Aluminium Foil',
  'bath-fittings/taps-and-faucets': 'kitchen-taps=Kitchen Taps;shower-mixers=Shower Mixers;basin-mixers=Basin Mixers;health-faucets=Health Faucets;wall-mixers=Wall Mixers;pillar-taps=Pillar Taps',
  'stainless-steel-vessels/plastic-household-stainless-steel-vessels': 'water-buckets=Water Buckets;storage-baskets=Storage Baskets;water-bottles=Water Bottles;clothes-hangers=Clothes Hangers;plastic-storage-boxes=Plastic Storage Boxes;dustbins=Dustbins;plastic-jars=Plastic Jars',
  'tools/construction-tools': 'concrete-tools=Concrete Tools;tiling-tools=Tiling Tools',
  'bath-fittings/showers': 'overhead-showers=Overhead Showers;hand-showers=Hand Showers;shower-panels=Shower Panels;shower-heads=Shower Heads',
  'bath-fittings/bathroom-sinks': 'countertop-basins=Countertop Basins;wash-basins=Wash Basins;corner-basins=Corner Basins;pedestal-basins=Pedestal Basins',
  'hardwares/adhesives-and-tapes': 'sealants=Sealants;adhesives=Adhesives;double-sided-tapes=Double-Sided Tapes',
  'bath-fittings/bath-tubs': 'freestanding-tubs=Freestanding Tubs;whirlpool-tubs=Whirlpool Tubs;corner-tubs=Corner Tubs',
  'home-furnishing/curtains': 'blackout-curtains=Blackout Curtains;window-curtains=Window Curtains;door-curtains=Door Curtains',
  'arts-and-crafts/clay-and-moulding': 'modelling-clay=Modelling Clay;moulds=Moulds;polymer-clay=Polymer Clay;clay-tools=Clay Tools',
  'hardwares/building-hardware': 'brackets=Brackets',
  'home-appliances/water-heaters': 'instant-water-heaters=Instant Water Heaters',
  'gifts/photo-frames': 'poster-frames=Poster Frames;painting-frames=Painting Frames;table-frames=Table Frames',
  'arts-and-crafts/beeds': 'glass-beads=Glass Beads;wooden-beads=Wooden Beads;pearl-beads=Pearl Beads;acrylic-beads=Acrylic Beads;seed-beads=Seed Beads',
  'arts-and-crafts/calligraphy-supplies': 'calligraphy-sets=Calligraphy Sets;nibs=Nibs;ink=Ink;calligraphy-pens=Calligraphy Pens',
  'arts-and-crafts/drawing-materials': 'drawing-pencils=Drawing Pencils;oil-colors=Oil Colors;charcoal=Charcoal;color-pencils=Color Pencils;drawing-sheets=Drawing Sheets;sketch-pens=Sketch Pens;poster-colors=Poster Colors;acrylic-colors=Acrylic Colors;crayons-drawing-materials=Crayons;markers=Markers;water-colors=Water Colors',
  'arts-and-crafts/craft-tools': 'glue-and-adhesives=Glue & Adhesives;glue-guns=Glue Guns;cutting-tools=Cutting Tools;stencils=Stencils;punches=Punches;scissors-craft-tools=Scissors',
  'pet-products/pet-toys': 'bird-toys=Bird Toys',
  'footwear/men-s-footwear': 'canvas-shoes=Canvas Shoes',
  'toys/role-play-toys': 'kitchen-sets=Kitchen Sets;slime-and-putty=Slime & Putty',
  'toys/board-games-and-puzzles': 'puzzles=Puzzles',
  'fashion-jewellery/hair-accessories': 'hair-pins=Hair Pins;hair-clips=Hair Clips;hair-bands=Hair Bands',
  'travel-accessories/travel-bags': 'laptop-bags=Laptop Bags',
  'stainless-steel-vessels/crockery-stainless-steel-vessels': 'spoon-sets=Spoon Sets;tumblers=Tumblers;serving-platters=Serving Platters;glassware=Glassware',
  'party-decorations/party-decoration-kits': 'costume-props=Costume Props;photo-booth-props=Photo Booth Props',
  'footwear/kids-footwear': 'school-shoes=School Shoes',
  'gifts/gift-sets-and-greeting-cards': 'gift-boxes=Gift Boxes;greeting-cards=Greeting Cards',
  'toys/educational-and-building-toys': 'stem-toys=STEM Toys',
  'footwear/women-s-footwear': 'women-s-sneakers=Women\'s Sneakers',
  'gifts/photo-albums': 'scrapbooks=Scrapbooks',
  'home-furnishing/laundry-bags-and-mosquito-nets': 'laundry-bags=Laundry Bags',
  'cosmetics/face-makeup': 'concealer=Concealer;compact-powder=Compact Powder;highlighter-face-makeup=Highlighter',
  'electronics/computer-accessories': 'laptop-stands=Laptop Stands',
  'arts-and-crafts/craft-paper': 'cardstock=Cardstock;handmade-paper=Handmade Paper;origami-paper=Origami Paper;scrapbook-paper=Scrapbook Paper',
  'stationary/notebooks': 'diaries=Diaries;ruled-notebooks=Ruled Notebooks',
  'stationary/office-supplies': 'printer-paper=Printer Paper',
  'stainless-steel-vessels/kitchen-tools': 'cutting-boards=Cutting Boards',
  'fashion-jewellery/artificial-jewellery': 'pearl-jewellery=Pearl Jewellery;kundan-jewellery=Kundan Jewellery',
  'cosmetics/skin-care': 'face-masks=Face Masks',
  'stationary/pencils-and-erasers': 'color-pencils-pencils-and-erasers=Color Pencils',
  'stainless-steel-vessels/storage-containers': 'lunch-boxes=Lunch Boxes',
  'furniture/beds': 'single-beds=Single Beds',
  'stationary/marker-ink': 'sketch-pens-marker-ink=Sketch Pens',
  'arts-and-crafts/art-easels': 'display-easels=Display Easels;portable-easels=Portable Easels;table-easels=Table Easels;floor-easels=Floor Easels',
  'home-furnishing/blankets': 'fleece-blankets=Fleece Blankets',
  'furniture/table': 'side-tables=Side Tables;coffee-tables=Coffee Tables',
  'toys/toy-cars-and-vehicles': 'die-cast-cars=Die-Cast Cars',
  'travel-accessories/luggage-accessories': 'travel-wallets=Travel Wallets',
  'pet-products/pet-bowls-and-feeders': 'pet-feeding-accessories=Pet Feeding Accessories',
  'home-appliances/water-purifiers': 'ro-purifiers=RO Purifiers',
  'wall-clock/wall-clocks': 'designer-wall-clocks=Designer Wall Clocks',
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

/** Clean URL scheme (W6): `/category/<category>[/<sub>[/<child>]]`. */
export function categoryHref(...slugs: string[]): string {
  return `/category/${slugs.join('/')}`;
}

/** Asset path convention; the platform decides how to load it (web: /public, mobile: bundled). */
export function categoryImagePath(categorySlug: string): string {
  return `/categories/${categorySlug}.png`;
}

export const SUBCATEGORY_PLACEHOLDER_IMAGE = '/categories/subcategory-placeholder.png';

/**
 * Builds the category tree from `GET /api/catalog/categories` (flat list with `parentId`, any
 * depth; the storefront uses three levels). Roots keep API order. Names go through toTitleCase()
 * so catalog data renders exactly like the static list; catalog names should be stored clean too.
 */
export function buildCategoryTree(items: readonly ApiCategory[]): StoreCategory[] {
  const childrenOf = (parentId: string): StoreSubcategory[] =>
    items
      .filter((c) => c.parentId === parentId)
      .map((c) => ({ slug: c.slug, name: toTitleCase(c.name), children: childrenOf(c.id) }));
  return items
    .filter((c) => c.parentId === null)
    .map((root) => ({
      slug: root.slug,
      name: toTitleCase(root.name),
      subcategories: childrenOf(root.id),
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
