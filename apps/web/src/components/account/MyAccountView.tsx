'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { ROUTES, authUserLabel } from '@youmart/shared-client';
import { reloadUser, useSession } from '@/lib/session';
import { AccountShell } from './AccountShell';
import { LogoutButton } from './LogoutButton';
import { OrdersList } from './OrdersList';
import { OtpLoginForm } from './OtpLoginForm';
import { BODY_TEXT, TEXT_LINK } from './formStyles';

const HEADING =
  'font-ui text-[20px] font-semibold leading-[1.3] text-heading md:text-[25px] min-[922px]:text-[34px]';

/** /account is the login page when signed out (as on live) and the dashboard when signed in. */
export function MyAccountView({ returnTo }: { returnTo?: string }) {
  const session = useSession();
  if (session.status === 'loading') {
    return <div aria-busy="true" className="min-h-[480px]" />;
  }
  if (session.status === 'anonymous') {
    return <LoginView returnTo={returnTo} />;
  }
  return <Dashboard label={authUserLabel(session.user)} />;
}

function Dashboard({ label }: { label: string }) {
  useEffect(() => {
    // Real authenticated read (GET /api/auth/me): refreshes the profile and exercises the
    // expired-token path (401 -> silent refresh -> retry).
    void reloadUser().catch(() => undefined);
  }, []);

  return (
    <AccountShell active="dashboard">
      <h1 className="sr-only">My account</h1>
      <div className={`${BODY_TEXT} mb-[25.6px]`}>
        Hello <strong>{label}</strong> (not <strong>{label}</strong>?{' '}
        <LogoutButton className={TEXT_LINK}>Log out</LogoutButton>)
      </div>
      <p className={`${BODY_TEXT} mb-[25.6px]`}>
        From your account dashboard you can view your{' '}
        <Link href={ROUTES.orders} className={TEXT_LINK}>
          recent orders
        </Link>
        , manage your{' '}
        <Link href={ROUTES.addresses} className={TEXT_LINK}>
          shipping and billing addresses
        </Link>
        , and{' '}
        <Link href={ROUTES.accountDetails} className={TEXT_LINK}>
          edit your account details
        </Link>
        .
      </p>
      <h2 className="mb-[12px] font-ui text-[20px] font-semibold leading-[26px] text-heading">
        Recent orders
      </h2>
      <OrdersList limit={3} paged={false} emptyText="You haven't placed an order yet." />
    </AccountShell>
  );
}

// Live logged-out /my-account: WooCommerce Login | Register columns (stacked below 922px).
function LoginView({ returnTo }: { returnTo?: string }) {
  return (
    <div className="mx-auto max-w-[1240px] px-[20px] pt-[10px] lg:mb-[64px] lg:mt-[88px] lg:pt-0">
      <h1 className="sr-only">My account</h1>
      <div className="min-[922px]:flex min-[922px]:justify-between">
        <section aria-labelledby="login-heading" className="min-[922px]:w-[48%]">
          {/* Live renders these at 13px on mobile; 20px is the flagged fix. */}
          <h2 id="login-heading" className={HEADING}>
            Login
          </h2>
          <OtpLoginForm mode="login" returnTo={returnTo} />
        </section>
        <section aria-labelledby="register-heading" className="min-[922px]:w-[48%]">
          <h2 id="register-heading" className={HEADING}>
            Register
          </h2>
          <OtpLoginForm mode="register" returnTo={returnTo} />
        </section>
      </div>
    </div>
  );
}
