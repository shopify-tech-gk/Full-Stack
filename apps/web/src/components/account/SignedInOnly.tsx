'use client';

import { useSession } from '@/lib/session';

/** Renders `children` for a signed-in customer and `fallback` otherwise (nothing while loading). */
export function SignedInOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const { status } = useSession();
  if (status === 'loading') return null;
  return <>{status === 'authenticated' ? children : fallback}</>;
}
