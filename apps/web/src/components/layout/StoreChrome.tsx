'use client';

import { usePathname } from 'next/navigation';

/** The storefront's header / footer / bottom nav - left off the admin dashboard (its own shell). */
export function StoreChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return pathname?.startsWith('/admin') ? null : <>{children}</>;
}
