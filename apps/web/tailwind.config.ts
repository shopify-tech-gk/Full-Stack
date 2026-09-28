import type { Config } from 'tailwindcss';
// Relative import (not the package name): Tailwind loads this config outside the Next bundler.
import { colors, breakpoints, fonts, radii } from '../../packages/shared-client/src/theme';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    screens: {
      md: `${breakpoints.tablet}px`,
      lg: `${breakpoints.desktop}px`,
    },
    extend: {
      colors: {
        brand: colors.brand,
        page: colors.page,
        'strip-frame': colors.stripFrame,
        hover: colors.hover,
        ink: colors.text,
        nav: colors.nav,
        line: colors.border,
      },
      fontFamily: {
        sans: [fonts.body],
        ui: ['var(--font-outfit)', fonts.ui, 'sans-serif'],
      },
      borderRadius: {
        tile: `${radii.tile}px`,
        banner: `${radii.banner}px`,
        menu: `${radii.menu}px`,
        lang: `${radii.language}px`,
      },
      boxShadow: {
        menu: '0 10px 30px 0 rgba(45, 45, 45, 0.2)',
        'search-focus': `0 0 5px ${colors.focusGlow}`,
      },
      keyframes: {
        'marquee-track': {
          from: { transform: 'translateX(100%)' },
          to: { transform: 'translateX(0)' },
        },
        'marquee-text': {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-100%)' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
