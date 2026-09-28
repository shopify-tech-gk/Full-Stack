// YouMart design tokens, taken from youmartshop.com (Elementor kit 3049 + homepage overrides).
// Plain values (no CSS/Tailwind) so web (Tailwind) and mobile (React Native StyleSheet) share them.

export const colors = {
  brand: {
    DEFAULT: '#0142aa',
    500: '#0e6ab3',
    600: '#0d66ad',
    700: '#01589e',
    900: '#003366',
  },
  sky: {
    DEFAULT: '#6EC1E4',
    tint: '#e9f4fb',
  },
  green: '#61CE70',
  gold: '#f9b41a',
  hover: '#d32f2f',
  text: {
    body: '#7A7A7A',
    secondary: '#54595F',
    strong: '#333333',
    heading: '#1a1a2e',
  },
  white: '#ffffff',
  divider: '#f0f0f0',
} as const;

export const fonts = {
  body: 'Roboto',
  heading: 'Roboto Slab',
} as const;

export const breakpoints = {
  desktop: 1024,
} as const;
