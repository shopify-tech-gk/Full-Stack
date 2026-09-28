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
   * Live body stack. "DejaVu Sans" is declared but never loaded, so every platform renders its
   * default sans-serif (Arial on Windows) - using the identical stack reproduces that exactly.
   */
  body: '"DejaVu Sans", sans-serif',
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
} as const;

export const breakpoints = {
  /** Live Elementor tablet layout starts here. */
  tablet: 768,
  /** Live desktop layout (welcome marquee, icon tiles, mega-menu) starts here. */
  desktop: 1025,
} as const;
