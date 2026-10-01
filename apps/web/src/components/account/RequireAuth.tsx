'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { loginHref } from '@youmart/shared-client';
import { useSession } from '@/lib/session';

/** Client-side gate: the access token only exists in browser memory, so the server can't check it. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (session.status === 'anonymous') {
      router.replace(loginHref(pathname));
    }
  }, [session.status, pathname, router]);

  if (session.status !== 'authenticated') {
    return <div aria-busy="true" className="min-h-[480px]" />;
  }
  return <>{children}</>;
}
