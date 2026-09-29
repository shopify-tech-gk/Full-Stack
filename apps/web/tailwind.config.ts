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
        heading: colors.heading,
        card: colors.card,
        rail: colors.rail,
        price: colors.price,
        star: colors.star,
        'tab-active': colors.tabActive,
        offer: colors.offerBadge,
        'category-card': colors.categoryCard,
        feature: colors.feature,
        footer: colors.footer,
        social: {
          youtube: colors.social.youtube,
          facebook: colors.social.facebook,
          share: colors.social.share,
        },
        catalog: colors.catalog,
        filter: colors.filter,
        steps: colors.steps,
        'brand-popup': colors.brandPopup,
        'share-btn': colors.shareButton,
        woo: colors.woo,
      },
      fontFamily: {
        sans: ['var(--font-arimo)', '"Arimo Ext"', ...fonts.bodyFallback],
        ui: ['var(--font-outfit)', fonts.ui, 'sans-serif'],
      },
      borderRadius: {
        tile: `${radii.tile}px`,
        banner: `${radii.banner}px`,
        menu: `${radii.menu}px`,
        lang: `${radii.language}px`,
        'product-card': `${radii.productCard}px`,
        'rail-card': `${radii.railCard}px`,
        'rail-thumb': `${radii.railThumb}px`,
        'brand-tile': `${radii.brandTile}px`,
        'category-card': `${radii.categoryCard}px`,
        'feature-card': `${radii.featureCard}px`,
        button: `${radii.button}px`,
      },
      boxShadow: {
        menu: '0 10px 30px 0 rgba(45, 45, 45, 0.2)',
        'search-focus': `0 0 5px ${colors.focusGlow}`,
        'product-card': `0 2px 10px 0 ${colors.card.shadow}`,
        'rail-card': '0 2px 5px 0 rgba(0, 0, 0, 0.05)',
        'category-card': '0 2px 8px 0 rgba(0, 0, 0, 0.12)',
        'carousel-arrow': '0 2px 6px 0 rgba(0, 0, 0, 0.15)',
        'listing-card': '0 14px 28px 0 rgba(0, 0, 0, 0.04), 0 10px 10px 0 rgba(0, 0, 0, 0.03)',
        'account-nav': '0 4px 8px 0 rgba(0, 0, 0, 0.1)',
        'brand-popup': '0 10px 40px 0 rgba(0, 51, 102, 0.45)',
        'step-glow': `0 0 10px 0 ${colors.steps.glow}, 0 0 20px 0 ${colors.steps.glow}`,
      },
      backgroundImage: {
        instagram: `linear-gradient(to right bottom, ${colors.social.instagram.join(', ')})`,
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
