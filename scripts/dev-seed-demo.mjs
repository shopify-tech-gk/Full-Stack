// DEV/DEMO ONLY - seeds 100 demo Electronics products for testing the storefront (homepage rails,
// the Electronics category + its sub-categories, filters, and rich product pages): real product
// photos (DummyJSON's free demo CDN), 12-16 specifications each, Indian prices/discounts, ratings,
// stock, and a search reindex. Every row is tagged `demo-` (slug) / `DEMO-` (SKU) so
// `pnpm dev:remove-demo` removes it cleanly. Idempotent: re-running adds nothing already present.
// Usage: pnpm dev:seed-demo   (needs Docker infra + the backend running)
import { createSign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(path.join(root, '.env'));
const env = process.env;
if (env.NODE_ENV === 'production') {
  console.error('dev-seed-demo is for local development only.');
  process.exit(1);
}

const lit = (value) => `'${String(value).replace(/'/g, "''")}'`;
const json = (value) => `${lit(JSON.stringify(value))}::jsonb`;
const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Deterministic pseudo-random (same data on every run).
let seed = 20261009;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const between = (lo, hi) => lo + rand() * (hi - lo);
const pick = (list) => list[Math.floor(rand() * list.length)];
const round99 = (n) => Math.max(99, Math.round(n / 100) * 100 - 1);

// --- Product photos: DummyJSON demo CDN, keyed by its product title -------------------------------
const photos = new Map();
for (const category of ['smartphones', 'laptops', 'tablets', 'mobile-accessories']) {
  const res = await fetch(
    `https://dummyjson.com/products/category/${category}?limit=0&select=title,images`,
  );
  if (!res.ok) throw new Error(`Could not load demo photos (${category}): HTTP ${res.status}`);
  for (const p of (await res.json()).products) photos.set(p.title, p.images);
}
const imagesFor = (title) => {
  const list = photos.get(title);
  if (!list?.length) throw new Error(`No demo photos for "${title}"`);
  return list;
};

// --- Categories (storefront slugs, so every web/mobile link resolves) + filter definitions -------
const categories = [
  { slug: 'electronics', name: 'Electronics', parent: null },
  {
    slug: 'mobiles',
    name: 'Mobiles',
    parent: 'electronics',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'ram', label: 'RAM', type: 'multi_select', unit: 'GB', order: 2 },
      { key: 'storage', label: 'Storage', type: 'multi_select', unit: 'GB', order: 3 },
      { key: 'screen_size', label: 'Screen Size', type: 'range', unit: 'in', order: 4 },
      { key: 'network', label: 'Network', type: 'single_select', order: 5 },
      { key: 'battery_capacity', label: 'Battery', type: 'range', unit: 'mAh', order: 6 },
      { key: 'rear_camera', label: 'Rear Camera', type: 'range', unit: 'MP', order: 7 },
    ],
  },
  {
    slug: 'computers',
    name: 'Computers',
    parent: 'electronics',
    filters: [
      { key: 'device_type', label: 'Type', type: 'multi_select', order: 1 },
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 2 },
      { key: 'ram', label: 'RAM', type: 'multi_select', unit: 'GB', order: 3 },
      { key: 'storage', label: 'Storage', type: 'multi_select', unit: 'GB', order: 4 },
      { key: 'screen_size', label: 'Screen Size', type: 'range', unit: 'in', order: 5 },
    ],
  },
  {
    slug: 'speaker',
    name: 'Speaker',
    parent: 'electronics',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'connectivity', label: 'Connectivity', type: 'multi_select', order: 2 },
      { key: 'voice_assistant', label: 'Voice Assistant', type: 'single_select', order: 3 },
    ],
  },
  ...[
    ['air-pods', 'Air Pods'],
    ['head-phone', 'Head Phone'],
    ['ear-phones', 'Ear Phones'],
  ].map(([slug, name]) => ({
    slug,
    name,
    parent: 'mobiles',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'color', label: 'Colour', type: 'multi_select', order: 2 },
      { key: 'playback_time', label: 'Playback', type: 'range', unit: 'hrs', order: 3 },
      { key: 'noise_cancellation', label: 'Noise Cancellation', type: 'boolean', order: 4 },
    ],
  })),
  {
    slug: 'charger',
    name: 'Charger',
    parent: 'mobiles',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'charger_type', label: 'Type', type: 'multi_select', order: 2 },
      { key: 'output_power', label: 'Output', type: 'range', unit: 'W', order: 3 },
    ],
  },
  {
    slug: 'power-bank',
    name: 'Power Bank',
    parent: 'mobiles',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'capacity', label: 'Capacity', type: 'range', unit: 'mAh', order: 2 },
      { key: 'wireless_charging', label: 'Wireless', type: 'boolean', order: 3 },
    ],
  },
  {
    slug: 'back-case',
    name: 'Back Case',
    parent: 'mobiles',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'color', label: 'Colour', type: 'multi_select', order: 2 },
      { key: 'compatible_model', label: 'Compatible With', type: 'multi_select', order: 3 },
    ],
  },
  {
    slug: 'selfie-stick',
    name: 'Selfie Stick',
    parent: 'mobiles',
    filters: [
      { key: 'brand', label: 'Brand', type: 'multi_select', order: 1 },
      { key: 'max_length', label: 'Max Length', type: 'range', unit: 'cm', order: 2 },
      { key: 'bluetooth_remote', label: 'Bluetooth Remote', type: 'boolean', order: 3 },
    ],
  },
];

// --- Products -------------------------------------------------------------------------------
const products = [];
const add = ({ title, category, photo, mrp, discount, attributes, description }) =>
  products.push({
    title,
    category,
    images: imagesFor(photo),
    mrp: round99(mrp),
    price: round99(mrp * (1 - discount)),
    attributes,
    description,
  });

const WARRANTY = '1 Year Manufacturer Warranty';

// Smartphones: 16 models x storage/colour variants = 40.
const phones = [
  ['iPhone 13 Pro', 'Apple', 'Apple iPhone 13 Pro', 6.1, 'Super Retina XDR OLED, 120Hz ProMotion', 'A15 Bionic', 3095, 20, 12, 12, 'iOS 17', ['Graphite', 'Sierra Blue', 'Gold'], [[6, 128, 119900], [6, 256, 129900], [6, 512, 149900]], 204],
  ['iPhone X', 'Apple', 'Apple iPhone X', 5.8, 'Super Retina OLED', 'A11 Bionic', 2716, 15, 12, 7, 'iOS 16', ['Space Grey', 'Silver'], [[3, 64, 49900], [3, 256, 59900]], 174],
  ['iPhone 6', 'Apple', 'Apple iPhone 6', 4.7, 'Retina HD IPS LCD', 'A8', 1810, 5, 8, 1.2, 'iOS 12', ['Space Grey', 'Gold'], [[1, 32, 19900], [1, 64, 22900]], 129],
  ['iPhone 5s', 'Apple', 'Apple iPhone 5s', 4.0, 'Retina IPS LCD', 'A7', 1560, 5, 8, 1.2, 'iOS 12', ['Silver', 'Gold'], [[1, 16, 12900], [1, 32, 14900]], 112],
  ['Samsung Galaxy S10', 'Samsung', 'Samsung Galaxy S10', 6.1, 'Dynamic AMOLED, HDR10+', 'Exynos 9820', 3400, 15, 12, 10, 'Android 12 (One UI 4)', ['Prism Black', 'Prism White', 'Prism Blue'], [[8, 128, 66900], [8, 256, 74900], [8, 512, 84900]], 157],
  ['Samsung Galaxy S8', 'Samsung', 'Samsung Galaxy S8', 5.8, 'Super AMOLED Infinity Display', 'Exynos 8895', 3000, 15, 12, 8, 'Android 9 (One UI)', ['Midnight Black', 'Orchid Grey', 'Coral Blue'], [[4, 64, 39900], [4, 128, 44900], [6, 128, 49900]], 155],
  ['Samsung Galaxy S7', 'Samsung', 'Samsung Galaxy S7', 5.1, 'Super AMOLED', 'Exynos 8890', 3000, 15, 12, 5, 'Android 8 (Samsung Experience)', ['Black Onyx', 'Gold Platinum'], [[4, 32, 29900], [4, 64, 32900]], 152],
  ['Oppo F19 Pro Plus', 'Oppo', 'OPPO F19 Pro+ 5G', 6.43, 'AMOLED Punch-hole', 'MediaTek Dimensity 800U', 4310, 50, 48, 16, 'Android 11 (ColorOS 11.1)', ['Fluid Black', 'Space Silver'], [[8, 128, 29990], [8, 256, 32990]], 173],
  ['Oppo K1', 'Oppo', 'OPPO K1', 6.4, 'AMOLED Waterdrop', 'Snapdragon 660', 3600, 10, 25, 25, 'Android 8.1 (ColorOS 5.2)', ['Piano Black', 'Astral Blue'], [[4, 64, 18990], [6, 64, 20990]], 156],
  ['Oppo A57', 'Oppo', 'OPPO A57', 6.56, 'IPS LCD HD+', 'MediaTek Helio G35', 5000, 33, 13, 8, 'Android 12 (ColorOS 12.1)', ['Glowing Green', 'Glowing Black', 'Sky Blue'], [[4, 64, 14990], [4, 128, 16990], [6, 128, 17990]], 187],
  ['Realme X', 'Realme', 'realme X', 6.53, 'AMOLED Full Screen', 'Snapdragon 710', 3765, 20, 48, 16, 'Android 10 (realme UI)', ['Space Blue', 'Polar White'], [[4, 128, 19999], [8, 128, 21999]], 191],
  ['Realme XT', 'Realme', 'realme XT', 6.4, 'Super AMOLED', 'Snapdragon 712', 4000, 20, 64, 16, 'Android 10 (realme UI)', ['Pearl Blue', 'Pearl White', 'Pearl Black'], [[4, 64, 15999], [6, 64, 16999], [8, 128, 18999]], 183],
  ['Realme C35', 'Realme', 'realme C35', 6.6, 'IPS LCD FHD+', 'Unisoc T616', 5000, 18, 50, 8, 'Android 11 (realme UI R)', ['Glowing Green', 'Glowing Black'], [[4, 64, 13999], [4, 128, 14999], [6, 128, 15999]], 189],
  ['Vivo X21', 'Vivo', 'vivo X21', 6.28, 'Super AMOLED, In-display Fingerprint', 'Snapdragon 660', 3200, 18, 12, 12, 'Android 8.1 (Funtouch OS 4.0)', ['Black', 'Ruby Red'], [[6, 128, 35990], [6, 64, 32990]], 156],
  ['Vivo V9', 'Vivo', 'vivo V9', 6.3, 'IPS LCD FullView', 'Snapdragon 626', 3260, 10, 16, 24, 'Android 8.1 (Funtouch OS 4.0)', ['Pearl Black', 'Gold', 'Super Blue'], [[4, 64, 22990], [6, 64, 24990], [6, 128, 26990]], 150],
  ['Vivo S1', 'Vivo', 'vivo S1', 6.38, 'Super AMOLED Halo FullView', 'MediaTek Helio P65', 4500, 18, 16, 32, 'Android 9 (Funtouch OS 9)', ['Diamond Black', 'Skyline Blue'], [[4, 128, 17990], [6, 64, 18990], [6, 128, 19990]], 179],
];
for (const [photo, brand, model, screen, display, chip, battery, watts, rear, front, os, colors, variants, grams] of phones) {
  const network = /iPhone (5s|6)|Galaxy S7|Galaxy S8/.test(model) ? '4G' : /5G/.test(model) || /13 Pro/.test(model) ? '5G' : '4G';
  variants.forEach(([ram, storage, mrp], i) => {
    const color = colors[i % colors.length];
    const title = `${model} (${color}, ${storage} GB)${brand === 'Apple' ? '' : ` (${ram} GB RAM)`}`;
    add({
      title,
      category: 'mobiles',
      photo,
      mrp,
      discount: between(0.08, 0.42),
      attributes: {
        brand,
        model_name: model,
        color,
        ram: String(ram),
        storage: String(storage),
        screen_size: screen,
        display,
        processor: chip,
        battery_capacity: battery,
        fast_charging: `${watts}W wired`,
        rear_camera: rear,
        front_camera: `${front} MP`,
        network,
        operating_system: os,
        sim_type: brand === 'Apple' ? 'Nano SIM + eSIM' : 'Dual SIM (Nano + Nano)',
        weight: `${grams} g`,
        in_the_box: 'Handset, USB Cable, SIM Eject Tool, User Manual',
        warranty: WARRANTY,
      },
      description: `${model} in ${color} with ${ram} GB RAM and ${storage} GB storage. The ${screen}-inch ${display} display is sharp and vivid for videos and gaming, powered by the ${chip}. A ${rear} MP rear camera and ${front} MP front camera capture detailed photos, and the ${battery} mAh battery with ${watts}W charging keeps you going all day. Comes with ${WARRANTY.toLowerCase()} from ${brand}.`,
    });
  });
}

// Laptops (5 x 2 = 10) and tablets (3 x 2 = 6) -> Computers.
const laptops = [
  ['Apple MacBook Pro 14 Inch Space Grey', 'Apple', 'Apple MacBook Pro 14"', 14.2, 'Liquid Retina XDR, 3024 x 1964', 'Apple M3 Pro', 'Integrated 18-core GPU', 'macOS Sonoma', 18, 1.6, [[18, 512, 199900], [36, 1024, 249900]]],
  ['Asus Zenbook Pro Dual Screen Laptop', 'Asus', 'ASUS Zenbook Pro Duo 14', 14.5, '2.8K OLED + ScreenPad Plus', 'Intel Core i9-13900H', 'NVIDIA GeForce RTX 4050 6GB', 'Windows 11 Home', 9, 1.75, [[16, 1024, 189990], [32, 1024, 219990]]],
  ['Huawei Matebook X Pro', 'Huawei', 'HUAWEI MateBook X Pro', 14.2, '3.1K LTPO Touch, 120Hz', 'Intel Core Ultra 7 155H', 'Intel Arc Graphics', 'Windows 11 Home', 14, 1.26, [[16, 512, 149990], [32, 1024, 179990]]],
  ['Lenovo Yoga 920', 'Lenovo', 'Lenovo Yoga Slim 7 (920 Series)', 13.9, '4K UHD Touch, Dolby Vision', 'Intel Core i7-1360P', 'Intel Iris Xe', 'Windows 11 Home', 12, 1.37, [[16, 512, 109990], [16, 1024, 124990]]],
  ['New DELL XPS 13 9300 Laptop', 'Dell', 'Dell XPS 13 9300', 13.4, 'FHD+ InfinityEdge, 500 nits', 'Intel Core i7-1065G7', 'Intel Iris Plus', 'Windows 11 Home', 12, 1.2, [[16, 512, 129990], [32, 1024, 159990]]],
];
for (const [photo, brand, model, screen, display, chip, gpu, os, hours, kg, variants] of laptops) {
  variants.forEach(([ram, storage, mrp]) => {
    const storageLabel = storage >= 1024 ? `${storage / 1024} TB SSD` : `${storage} GB SSD`;
    add({
      title: `${model} Laptop (${chip}, ${ram} GB RAM, ${storageLabel})`,
      category: 'computers',
      photo,
      mrp,
      discount: between(0.06, 0.3),
      attributes: {
        device_type: 'Laptop',
        brand,
        model_name: model,
        processor: chip,
        ram: String(ram),
        storage: String(storage),
        storage_type: 'NVMe SSD',
        screen_size: screen,
        display,
        graphics: gpu,
        operating_system: os,
        battery_life: `Up to ${hours} hours`,
        weight: `${kg} kg`,
        ports: 'USB-C / Thunderbolt, USB-A, HDMI, 3.5mm Audio',
        wireless: 'Wi-Fi 6E, Bluetooth 5.3',
        warranty: WARRANTY,
      },
      description: `${model} with the ${chip}, ${ram} GB RAM and a fast ${storageLabel}. Its ${screen}-inch ${display} display is great for work and entertainment, while ${gpu} handles creative apps smoothly. Weighing just ${kg} kg with up to ${hours} hours of battery life, it is built for work on the move.`,
    });
  });
}
const tablets = [
  ['iPad Mini 2021 Starlight', 'Apple', 'Apple iPad mini (6th Gen)', 8.3, 'Liquid Retina, True Tone', 'A15 Bionic', 5124, 'iPadOS 17', [[4, 64, 49900, 'Wi-Fi'], [4, 256, 64900, 'Wi-Fi + Cellular']]],
  ['Samsung Galaxy Tab S8 Plus Grey', 'Samsung', 'Samsung Galaxy Tab S8+', 12.4, 'Super AMOLED, 120Hz', 'Snapdragon 8 Gen 1', 10090, 'Android 13 (One UI 5)', [[8, 128, 84999, 'Wi-Fi'], [8, 256, 94999, 'Wi-Fi + 5G']]],
  ['Samsung Galaxy Tab White', 'Samsung', 'Samsung Galaxy Tab A8', 10.5, 'TFT LCD WUXGA', 'Unisoc T618', 7040, 'Android 13 (One UI 5)', [[3, 32, 19999, 'Wi-Fi'], [4, 64, 23999, 'Wi-Fi + LTE']]],
];
for (const [photo, brand, model, screen, display, chip, battery, os, variants] of tablets) {
  variants.forEach(([ram, storage, mrp, connectivity]) => {
    add({
      title: `${model} ${screen}" Tablet (${storage} GB, ${connectivity})`,
      category: 'computers',
      photo,
      mrp,
      discount: between(0.05, 0.3),
      attributes: {
        device_type: 'Tablet',
        brand,
        model_name: model,
        processor: chip,
        ram: String(ram),
        storage: String(storage),
        screen_size: screen,
        display,
        battery_capacity: `${battery} mAh`,
        connectivity,
        operating_system: os,
        stylus_support: 'Yes',
        warranty: WARRANTY,
      },
      description: `${model} with a ${screen}-inch ${display} display, ${storage} GB storage and ${connectivity} connectivity. The ${chip} keeps apps, games and multitasking smooth, and the ${battery} mAh battery lasts through a full day of study, work or streaming.`,
    });
  });
}

// Audio: Air Pods (5), Head Phone (5), Ear Phones (5).
const audio = [
  ['air-pods', 'Apple Airpods', 'Apple', [
    ['AirPods (2nd Generation) with Charging Case', 'White', 24, 14900, false],
    ['AirPods (3rd Generation) with Lightning Case', 'White', 30, 20900, false],
    ['AirPods (3rd Generation) with MagSafe Case', 'White', 30, 21900, false],
    ['AirPods Pro (2nd Gen) with USB-C Case', 'White', 30, 26900, true],
    ['AirPods 4 with Active Noise Cancellation', 'White', 30, 22900, true],
  ]],
  ['head-phone', 'Apple AirPods Max Silver', 'Apple', [
    ['AirPods Max Wireless Over-Ear Headphones', 'Silver', 20, 59900, true],
    ['AirPods Max Wireless Over-Ear Headphones', 'Space Grey', 20, 59900, true],
    ['AirPods Max Wireless Over-Ear Headphones', 'Sky Blue', 20, 59900, true],
    ['AirPods Max Wireless Over-Ear Headphones', 'Pink', 20, 59900, true],
    ['AirPods Max Wireless Over-Ear Headphones', 'Green', 20, 59900, true],
  ]],
  ['ear-phones', 'Beats Flex Wireless Earphones', 'Beats', [
    ['Beats Flex Wireless Neckband Earphones', 'Beats Black', 12, 4999, false],
    ['Beats Flex Wireless Neckband Earphones', 'Yuzu Yellow', 12, 4999, false],
    ['Beats Flex Wireless Neckband Earphones', 'Flame Blue', 12, 4999, false],
    ['Beats Flex Wireless Neckband Earphones', 'Smoke Grey', 12, 4999, false],
    ['Beats Flex Wireless Earphones (All-Day)', 'Beats Black', 12, 5499, false],
  ]],
];
for (const [category, photo, brand, items] of audio) {
  for (const [name, color, hours, mrp, anc] of items) {
    const type = category === 'head-phone' ? 'Over-Ear' : category === 'air-pods' ? 'True Wireless (TWS)' : 'In-Ear Neckband';
    add({
      title: `${brand} ${name} - ${color}`,
      category,
      photo,
      mrp,
      discount: between(0.1, 0.45),
      attributes: {
        brand,
        model_name: name,
        color,
        headphone_type: type,
        connectivity: 'Bluetooth 5.3',
        playback_time: hours,
        noise_cancellation: anc,
        microphone: 'Yes, with voice assistant',
        water_resistance: category === 'head-phone' ? 'Not rated' : 'IPX4 sweat & water resistant',
        charging_port: category === 'ear-phones' ? 'USB-C' : 'Lightning / USB-C',
        driver: category === 'head-phone' ? '40 mm dynamic driver' : 'Custom high-excursion driver',
        warranty: WARRANTY,
      },
      description: `${brand} ${name} in ${color}. ${type} design with ${anc ? 'active noise cancellation, ' : ''}rich, balanced sound and up to ${hours} hours of playback. Built-in microphones make calls clear, and quick pairing gets you listening in seconds.`,
    });
  }
}

// Chargers (7), Power Banks (5), Back Cases (6), Selfie Sticks (6).
const chargers = [
  ['Apple iPhone Charger', 'Apple 20W USB-C Power Adapter', 'Wall Adapter', 20, 1900],
  ['Apple iPhone Charger', 'Apple 30W USB-C Power Adapter', 'Wall Adapter', 30, 3900],
  ['Apple iPhone Charger', 'Apple 35W Dual USB-C Port Compact Adapter', 'Wall Adapter', 35, 5800],
  ['Apple iPhone Charger', 'Apple USB-C to Lightning Cable (1 m) + 20W Adapter Combo', 'Wall Adapter + Cable', 20, 3800],
  ['Apple Airpower Wireless Charger', 'Apple MagSafe Wireless Charger 15W', 'Wireless Pad', 15, 4500],
  ['Apple Airpower Wireless Charger', 'Apple 2-in-1 Wireless Charging Pad', 'Wireless Pad', 15, 6900],
  ['Apple Airpower Wireless Charger', 'Apple 3-in-1 Wireless Charging Station', 'Wireless Stand', 15, 11900],
];
for (const [photo, name, type, watts, mrp] of chargers) {
  add({
    title: name,
    category: 'charger',
    photo,
    mrp,
    discount: between(0.1, 0.5),
    attributes: {
      brand: 'Apple',
      model_name: name,
      charger_type: type,
      output_power: watts,
      input: '100-240V AC, 50/60Hz',
      compatible_devices: 'iPhone, AirPods, Apple Watch (with cable)',
      fast_charging: watts >= 20 ? 'Yes (Power Delivery)' : 'Qi / MagSafe',
      safety: 'Over-current, over-voltage & temperature protection',
      warranty: WARRANTY,
    },
    description: `${name} delivers up to ${watts}W of ${type.toLowerCase()} power for fast, safe charging. Compact and travel-friendly, with built-in protection against over-current, over-voltage and overheating.`,
  });
}
[5000, 7500, 10000, 15000, 20000].forEach((mah, i) => {
  add({
    title: `Apple MagSafe Battery Pack ${mah} mAh${i >= 2 ? ' (Fast Charge Edition)' : ''}`,
    category: 'power-bank',
    photo: 'Apple MagSafe Battery Pack',
    mrp: 6900 + i * 2400,
    discount: between(0.15, 0.5),
    attributes: {
      brand: 'Apple',
      capacity: mah,
      wireless_charging: true,
      output_power: `${i >= 2 ? 20 : 15}W`,
      ports: 'Lightning / USB-C input',
      battery_type: 'Lithium-ion Polymer',
      weight: `${115 + i * 35} g`,
      compatible_devices: 'iPhone 12 and later (MagSafe)',
      warranty: WARRANTY,
    },
    description: `Snap-on MagSafe battery pack with ${mah} mAh capacity. It aligns perfectly on the back of your iPhone and charges wirelessly, so you can keep going all day without a cable.`,
  });
});
['Plum', 'Midnight', 'Deep Navy', 'Kumquat', 'Pink Citrus', 'Cypress Green'].forEach((color) => {
  add({
    title: `Apple iPhone 12 Silicone Case with MagSafe - ${color}`,
    category: 'back-case',
    photo: 'iPhone 12 Silicone Case with MagSafe Plum',
    mrp: 4900,
    discount: between(0.2, 0.6),
    attributes: {
      brand: 'Apple',
      color,
      compatible_model: 'iPhone 12 / 12 Pro',
      material: 'Silicone with microfibre lining',
      magsafe_compatible: true,
      drop_protection: 'Raised edges for camera & screen',
      warranty: '6 Months Manufacturer Warranty',
    },
    description: `Soft-touch silicone case in ${color} with a microfibre lining that protects your iPhone 12. Built-in magnets align with MagSafe chargers and accessories.`,
  });
});
[
  ['Monopod', 'TechGear', 'TechGear Pro Aluminium Monopod', 120, false, 1499],
  ['Monopod', 'TechGear', 'TechGear Travel Monopod with Tripod Base', 150, false, 1999],
  ['Monopod', 'TechGear', 'TechGear Vlog Monopod Kit', 170, true, 2499],
  ['Selfie Stick Monopod', 'SnapTech', 'SnapTech Bluetooth Selfie Stick', 80, true, 999],
  ['Selfie Stick Monopod', 'SnapTech', 'SnapTech Extendable Selfie Stick Tripod', 100, true, 1299],
  ['Selfie Stick Monopod', 'SnapTech', 'SnapTech Compact Selfie Stick', 70, false, 699],
].forEach(([photo, brand, name, cm, remote, mrp]) => {
  add({
    title: name,
    category: 'selfie-stick',
    photo,
    mrp,
    discount: between(0.2, 0.6),
    attributes: {
      brand,
      max_length: cm,
      bluetooth_remote: remote,
      material: 'Aluminium alloy',
      rotation: '360° phone holder',
      compatible_devices: 'Phones 4.7" - 6.9"',
      weight: `${130 + cm} g`,
      warranty: '6 Months Manufacturer Warranty',
    },
    description: `${name} extends up to ${cm} cm for group selfies, vlogs and travel shots${remote ? ', with a detachable Bluetooth remote shutter' : ''}. Lightweight aluminium build with a 360° rotating phone holder.`,
  });
});

// Speakers (5) -> Speaker.
[
  ['Amazon Echo Plus', 'Amazon', 'Amazon Echo Plus (2nd Gen) Smart Speaker - Charcoal', 'Alexa', 14999],
  ['Amazon Echo Plus', 'Amazon', 'Amazon Echo Plus (2nd Gen) Smart Speaker - Sandstone', 'Alexa', 14999],
  ['Apple HomePod Mini Cosmic Grey', 'Apple', 'Apple HomePod mini - Space Grey', 'Siri', 10900],
  ['Apple HomePod Mini Cosmic Grey', 'Apple', 'Apple HomePod mini - Blue', 'Siri', 10900],
  ['Apple HomePod Mini Cosmic Grey', 'Apple', 'Apple HomePod mini - Orange', 'Siri', 10900],
].forEach(([photo, brand, name, assistant, mrp]) => {
  add({
    title: name,
    category: 'speaker',
    photo,
    mrp,
    discount: between(0.1, 0.4),
    attributes: {
      brand,
      speaker_type: 'Smart Speaker',
      voice_assistant: assistant,
      connectivity: ['Wi-Fi', 'Bluetooth'],
      output: '360° room-filling sound',
      smart_home_hub: 'Yes',
      power_source: 'AC adapter',
      warranty: WARRANTY,
    },
    description: `${name} with ${assistant} built in. Play music, set reminders and control your smart home with your voice, with rich 360° sound that fills the room.`,
  });
});

if (products.length !== 100) throw new Error(`Expected 100 demo products, built ${products.length}`);

// --- SQL (idempotent: every insert is guarded by "not already there") -----------------------
const sql = ['BEGIN;'];
for (const c of categories) {
  const parent = c.parent
    ? `(SELECT id FROM catalog.category WHERE slug = ${lit(c.parent)} AND deleted_at IS NULL)`
    : 'NULL';
  sql.push(`INSERT INTO catalog.category (id, name, slug, parent_id, created_at, updated_at)
    SELECT gen_random_uuid(), ${lit(c.name)}, ${lit(c.slug)}, ${parent}, now(), now()
    WHERE NOT EXISTS (SELECT 1 FROM catalog.category WHERE slug = ${lit(c.slug)} AND deleted_at IS NULL);`);
  if (c.filters) {
    sql.push(`UPDATE catalog.category SET filter_definition = ${json(c.filters)}, updated_at = now()
      WHERE slug = ${lit(c.slug)} AND deleted_at IS NULL;`);
  }
}
products.forEach((p, index) => {
  const slug = `demo-${slugify(p.title)}`;
  const code = slug.toUpperCase();
  const rating = Math.round(between(3.7, 4.9) * 10) / 10;
  const count = Math.round(between(40, 9000));
  // Newest first, ahead of every older sample, so the homepage rails show the demo catalogue.
  const created = `now() - interval '${index} minutes'`;
  sql.push(`INSERT INTO catalog.product (id, title, slug, description, seller_id, category_id, attributes,
      status, rating, rating_count, created_at, updated_at)
    SELECT gen_random_uuid(), ${lit(p.title)}, ${lit(slug)}, ${lit(p.description)},
      ${lit(env.DEFAULT_SELLER_ID)}, c.id, ${json(p.attributes)}, 'ACTIVE', ${rating}, ${count},
      ${created}, now()
    FROM catalog.category c
    WHERE c.slug = ${lit(p.category)} AND c.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM catalog.product WHERE slug = ${lit(slug)} AND deleted_at IS NULL);`);
  const skuAttrs = p.attributes.color ? { color: p.attributes.color } : {};
  sql.push(`INSERT INTO catalog.sku (id, product_id, sku_code, mrp, selling_price, attributes, created_at, updated_at)
    SELECT gen_random_uuid(), p.id, ${lit(code)}, ${p.mrp}, ${p.price}, ${json(skuAttrs)}, now(), now()
    FROM catalog.product p
    WHERE p.slug = ${lit(slug)} AND p.deleted_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM catalog.sku WHERE sku_code = ${lit(code)} AND deleted_at IS NULL);`);
  p.images.forEach((url, position) => {
    sql.push(`INSERT INTO catalog.product_image (id, product_id, url, position, created_at, updated_at)
      SELECT gen_random_uuid(), p.id, ${lit(url)}, ${position}, now(), now()
      FROM catalog.product p
      WHERE p.slug = ${lit(slug)} AND p.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM catalog.product_image i
          WHERE i.product_id = p.id AND i.position = ${position} AND i.deleted_at IS NULL);`);
  });
});
sql.push('COMMIT;');
sql.push(`SELECT c.slug, count(p.id) FROM catalog.product p JOIN catalog.category c ON c.id = p.category_id
  WHERE p.slug LIKE 'demo-%' AND p.deleted_at IS NULL GROUP BY c.slug ORDER BY c.slug;`);
sql.push(`SELECT 'STOCK', s.id, s.sku_code FROM catalog.sku s
  WHERE s.sku_code LIKE 'DEMO-%' AND s.deleted_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM inventory.stock_level l WHERE l.sku_id = s.id::text AND l.deleted_at IS NULL);`);

const out = execFileSync(
  'docker',
  [
    'compose', '-f', 'docker/docker-compose.yml', '--env-file', '.env', 'exec', '-T', 'postgres',
    'psql', '-v', 'ON_ERROR_STOP=1', '-U', env.POSTGRES_USER, '-d', env.POSTGRES_DB, '-At',
  ],
  { cwd: root, input: sql.join('\n'), maxBuffer: 16 * 1024 * 1024 },
).toString();
const rows = out.trim().split('\n');
console.log('demo products per category:');
console.log(rows.filter((l) => l.includes('|') && !l.startsWith('STOCK|')).map((l) => `  ${l.replace('|', ': ')}`).join('\n'));
const unstocked = rows
  .filter((l) => l.startsWith('STOCK|'))
  .map((l) => {
    const [, id, code] = l.split('|');
    return { id, code };
  });

// --- Admin token for the real admin endpoints ------------------------------------------------
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const unsigned = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
  typ: 'admin',
  role: 'SUPER_ADMIN',
  sub: '00000000-0000-4000-8000-000000000000',
  iss: env.JWT_ISSUER || 'youmart-auth',
  aud: env.JWT_AUDIENCE || 'youmart',
  iat: now,
  exp: now + 300,
})}`;
const signature = createSign('RSA-SHA256')
  .update(unsigned)
  .sign(Buffer.from(env.JWT_PRIVATE_KEY, 'base64').toString('utf8'), 'base64url');
const gateway = env.GATEWAY_URL || 'http://localhost:4000';
const authorization = `Bearer ${unsigned}.${signature}`;

// Stock through the real inventory endpoint (only SKUs without a stock row, so re-runs never reset it).
let stocked = 0;
for (const { id, code } of unstocked) {
  const res = await fetch(`${gateway}/api/inventory/${id}/set`, {
    method: 'POST',
    headers: { authorization, 'content-type': 'application/json' },
    body: JSON.stringify({ available: 25 + Math.floor(rand() * 100) }),
  });
  if (res.ok) stocked += 1;
  else console.log(`stock ${code}: HTTP ${res.status} ${await res.text()}`);
}
console.log(`stock set for ${stocked} demo SKU(s)`);

const reindex = await fetch(`${gateway}/api/search/admin/reindex`, {
  method: 'POST',
  headers: { authorization },
});
console.log(`search reindex: HTTP ${reindex.status} ${await reindex.text()}`);
