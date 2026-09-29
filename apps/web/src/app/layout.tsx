import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { WelcomeBar } from '@/components/layout/WelcomeBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { SiteFooter } from '@/components/layout/SiteFooter';
import './globals.css';

// Self-hosted (SIL OFL, see src/fonts/*OFL.txt): Next 14's Google Fonts loader fails to parse Outfit's CSS.
const outfit = localFont({
  src: '../fonts/Outfit-Variable.ttf',
  weight: '100 900',
  variable: '--font-outfit',
  display: 'swap',
});

// Body font, Latin subset (20 KB). Latin-ext (incl. ₹) is the on-demand "Arimo Ext" face in globals.css.
// No generated fallback: it would render ₹ in Arial before reaching "Arimo Ext", and Arimo already
// shares Arial's metrics.
const arimo = localFont({
  src: '../fonts/Arimo-latin.woff2',
  weight: '400 700',
  variable: '--font-arimo',
  display: 'swap',
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: 'YouMart - Online Shopping India | Fast Delivery in Coimbatore, Chennai, Bangalore',
  description: 'Shop easy, live better with YouMart.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0142aa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${arimo.variable} ${outfit.variable}`}>
      <body className="pb-[calc(79px+env(safe-area-inset-bottom))] lg:pb-0">
        <a
          href="#content"
          className="sr-only font-ui focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[1000] focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-brand"
        >
          Skip to content
        </a>
        <SiteHeader />
        <WelcomeBar />
        <main id="content">{children}</main>
        <SiteFooter />
        <MobileBottomNav />
      </body>
    </html>
  );
}
