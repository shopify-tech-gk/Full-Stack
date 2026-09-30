'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { logout } from '@/lib/session';

/** POST /api/auth/logout (revokes the refresh cookie), drops the in-memory token, back to login. */
export function LogoutButton({
  className,
  children,
}: {
  className: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() =>
        startTransition(async () => {
          // The local session is cleared even if the network call fails.
          await logout().catch(() => undefined);
          router.replace('/my-account');
        })
      }
    >
      {children}
    </button>
  );
}
