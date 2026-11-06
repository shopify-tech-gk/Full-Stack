import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';
import { useSession } from '@/stores/session';
import { UsernameSheet } from './UsernameSheet';

// v1.18 After every sign-in (and each app start while signed in), an account without a username
// is asked to pick one - once per sign-in; "Maybe later" waits for the next one. Not over the
// sign-in screens, and not in YouFind Bot (it asks there itself).

const QUIET = ['/auth', '/welcome', '/ask/finder', '/lens', '/scan', '/checkout', '/payment'];

export function UsernamePrompt() {
  const session = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const askedFor = useRef<string | null>(null);

  const user = session.status === 'authenticated' ? session.user : null;
  const needs = !!user && !user.username;
  const quiet = QUIET.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (session.status === 'anonymous') askedFor.current = null; // the next sign-in asks again
  }, [session.status]);

  useEffect(() => {
    if (!user || !needs || quiet || askedFor.current === user.id) return;
    const t = setTimeout(() => {
      askedFor.current = user.id;
      setOpen(true);
    }, 1200);
    return () => clearTimeout(t);
  }, [user, needs, quiet]);

  if (!user) return null;
  return (
    <UsernameSheet
      visible={open && needs}
      reason="login"
      hasPassword={user.hasPassword ?? false}
      onClose={() => setOpen(false)}
    />
  );
}
