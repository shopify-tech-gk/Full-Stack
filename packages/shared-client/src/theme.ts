// YouMart design tokens, MEASURED from the live youmartshop.com (computed styles + declared CSS,
// audited 2026-09-28). The live site is the source of truth; values below are what it renders.
// Plain values (no CSS/Tailwind) so web (Tailwind) and mobile (React Native StyleSheet) share them.

export const colors = {
  brand: {
    /** Welcome band, header icon tiles, active tab, drawer links, "English". */
    DEFAULT: '#0142aa',
    /** Search-bar border (declared `2px solid #0d66ad`) and price accents. */
    accent: '#0d66ad',
  },
  /** Page background AND the category strip fill. */
  page: '#dcf0fa',
  /** Frame around the desktop category strip. */
  stripFrame: '#f1f2f4',
  /** Category label/chevron colour while its dropdown is open (live uses pure red). */
  hover: '#ff0000',
  text: {
    /** Default body text. */
    body: '#364151',
    /** Header/category/submenu labels. */
    strong: '#000000',
    /** Typed search text. */
    input: '#666666',
    placeholder: '#757575',
    /** Language caret. */
    muted: '#666666',
    /** Category chevrons. */
    chevron: '#101010',
    /** Mobile hamburger icon. */
    icon: '#494c4f',
  },
  nav: {
    inactiveIcon: '#989898',
    inactiveLabel: '#818799',
  },
  border: {
    menu: '#dadada',
  },
  overlay: 'rgba(0, 0, 0, 0.6)',
  focusGlow: 'rgba(0, 115, 170, 0.3)',
  white: '#ffffff',
  /** Section headings, e.g. "Best Categories Today". */
  heading: '#0f172a',
  /** Product grid card. */
  card: {
    border: '#90caf9',
    shadow: 'rgba(144, 202, 249, 0.18)',
  },
  /** Homepage "Pick up where you left off" style rail cards (border is brand.DEFAULT). */
  rail: {
    title: '#0f1111',
    thumb: '#f7f7f7',
  },
  price: {
    label: '#333333',
    /** The two crossed lines through the MRP. */
    strike: 'rgba(255, 0, 0, 0.9)',
    discount: '#ff0000',
  },
  star: {
    empty: '#000000',
    filled: '#fdd039',
  },
  /** Active product-filter tab outline. */
  tabActive: '#0e6ab3',
  offerBadge: {
    outer: '#ff3300',
    inner: '#fcfe93',
    text: '#7a4b00',
  },
  categoryCard: {
    bg: '#eeeeee',
    label: '#111111',
    arrowBorder: '#dddddd',
  },
  feature: {
    expertise: '#fee533',
    quality: '#024caa',
    guarantee: '#28b463',
  },
  /** Footer background is brand.DEFAULT. */
  footer: {
    heading: '#dadada',
    subheading: '#cdcdcd',
    divider: '#afafaf',
    rule: '#454d5e',
    separator: '#364151',
    icon: '#fff86b',
  },
  social: {
    youtube: '#cd201f',
    facebook: '#3b5998',
    share: '#1664c8',
    /** Gradient stops, to right bottom. */
    instagram: ['#f9ce34', '#ee2a7b', '#6228d7'],
  },
  /** Category listing + product page (WooCommerce templates). */
  catalog: {
    /** Pure-blue 1px rules: sidebar divider, loop cards, tabs line, form fields. */
    rule: '#0000ff',
    starFill: '#ffcc33',
    tab: '#515151',
    reviewBorder: '#e1dde7',
    reviewMeta: '#777777',
    muted: '#333333',
    qtyBorder: '#01589e',
  },
  filter: {
    panel: '#6ec1e4',
    apply: '#003f82',
    applyHover: '#002d5e',
    thumb: '#1a3c6e',
    track: '#c8c8c8',
    text: '#111111',
  },
  steps: {
    line: '#cccccc',
    idle: '#e0e0e0',
    glow: '#00cfff',
    dark: '#000d1a',
  },
  brandPopup: {
    bg: '#e3f2fd',
    title: '#01589e',
    border: '#c9dff0',
  },
  shareButton: {
    facebook: '#0765fe',
    x: '#2a2a2a',
    whatsapp: '#55eb4c',
    more: '#ee8e2d',
  },
  /** WooCommerce notices + account pages (live CSS; info/message borders use brand). */
  woo: {
    noticeBg: '#f7f6f7',
    noticeText: '#515151',
    error: '#b81c23',
    success: '#8fae1b',
    required: '#ff0000',
    navText: '#333333',
    linkHover: '#015b9c',
  },
  /** Live custom cart table (#ymc-cart-table) + WooCommerce totals/checkout panels. */
  cart: {
    border: '#90caf9',
    headBg: '#e8f1fb',
    rowBg: '#ddecf9',
    rowHover: '#f0f7ff',
    line: '#d4e9f7',
    ink: '#1a1a2e',
    brandDark: '#0135cc',
    danger: '#e63946',
    panelHead: '#fbfbfb',
    payBox: '#efefef',
  },
  // Declared in the Elementor kit but NOT observed in the homepage top section; unverified.
  kit: {
    primary: '#6EC1E4',
    secondary: '#54595F',
    text: '#7A7A7A',
    accent: '#61CE70',
  },
} as const;

export const fonts = {
  /**
   * Arimo: metric-compatible with Arial (what live renders on Windows via its never-loading
   * "DejaVu Sans" stack), so it looks the same and every device gets the same font.
   */
  body: 'Arimo',
  /** Arial-metric fallbacks: identical line breaks while Arimo loads. */
  bodyFallback: ['Arial', 'Liberation Sans', 'Helvetica', 'sans-serif'],
  /** The only UI webfont the live site loads (400/600/700): labels, tabs, menus, language pill. */
  ui: 'Outfit',
} as const;

export const radii = {
  tile: 10,
  pill: 9999,
  banner: 8,
  menu: 10,
  language: 5,
  bottomNav: 8,
  productCard: 16,
  railCard: 8,
  railThumb: 4,
  brandTile: 30,
  categoryCard: 14,
  featureCard: 10,
  button: 8,
} as const;

export const breakpoints = {
  /** Live Elementor tablet layout starts here. */
  tablet: 768,
  /** Live desktop layout (welcome marquee, icon tiles, mega-menu) starts here. */
  desktop: 1025,
} as const;
