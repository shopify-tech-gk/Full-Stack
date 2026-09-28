import type { Metadata, Viewport } from 'next';
import { Roboto, Roboto_Slab } from 'next/font/google';
import { SiteHeader } from '@/components/layout/SiteHeader';
import { WelcomeBar } from '@/components/layout/WelcomeBar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import './globals.css';

// Next 14's Roboto metadata has no 600 weight; font-semibold (600) resolves to 700.
const roboto = Roboto({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-roboto',
  display: 'swap',
});

const robotoSlab = Roboto_Slab({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-roboto-slab',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'YouMart - Online Shopping India | Shop Easy Live Better',
  description: 'Shop easy, live better with YouMart.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0142aa',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" className={`${roboto.variable} ${robotoSlab.variable}`}>
      <body className="pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:text-brand"
        >
          Skip to content
        </a>
        <SiteHeader />
        <WelcomeBar />
        <main id="content">{children}</main>
        <MobileBottomNav />
      </body>
    </html>
  );
}
