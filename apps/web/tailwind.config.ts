import type { Config } from 'tailwindcss';
// Relative import (not the package name): Tailwind loads this config outside the Next bundler.
import { colors, breakpoints } from '../../packages/shared-client/src/theme';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        sky: colors.sky,
        success: colors.green,
        gold: colors.gold,
        hover: colors.hover,
        ink: colors.text,
        divider: colors.divider,
      },
      fontFamily: {
        sans: ['var(--font-roboto)', 'Roboto', 'Arial', 'sans-serif'],
        heading: ['var(--font-roboto-slab)', '"Roboto Slab"', 'Georgia', 'serif'],
      },
      screens: {
        lg: `${breakpoints.desktop}px`,
      },
      boxShadow: {
        menu: '0 6px 24px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
};

export default config;
