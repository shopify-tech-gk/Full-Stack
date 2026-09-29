import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountShell } from '@/components/account/AccountShell';
import { OrdersTable } from '@/components/account/OrdersTable';
import { OtpLoginForm } from '@/components/account/OtpLoginForm';
import { BODY_TEXT, TEXT_LINK } from '@/components/account/formStyles';
import { logout } from './actions';
import { getOrders } from '@/lib/account';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'My account - You Mart' };

const HEADING =
  'font-ui text-[20px] font-semibold leading-[1.3] text-heading md:text-[25px] min-[922px]:text-[34px]';

export default async function MyAccountPage() {
  const session = getSession();
  if (!session) {
    return <LoginView />;
  }
  const orders = await getOrders();
  const { name } = session.user;

  return (
    <AccountShell active="dashboard">
      <h1 className="sr-only">My account</h1>
      <div className={`${BODY_TEXT} mb-[25.6px]`}>
        Hello <strong>{name}</strong> (not <strong>{name}</strong>?{' '}
        <form action={logout} className="inline">
          <button type="submit" className={TEXT_LINK}>
            Log out
          </button>
        </form>
        )
      </div>
      <p className={`${BODY_TEXT} mb-[25.6px]`}>
        From your account dashboard you can view your{' '}
        <Link href="/my-account/orders" className={TEXT_LINK}>
          recent orders
        </Link>
        , manage your{' '}
        <Link href="/my-account/edit-address" className={TEXT_LINK}>
          shipping and billing addresses
        </Link>
        , and{' '}
        <Link href="/my-account/edit-account" className={TEXT_LINK}>
          edit your account details
        </Link>
        .
      </p>
      {orders.length > 0 && (
        <>
          <h2 className="mb-[12px] font-ui text-[20px] font-semibold leading-[26px] text-heading">
            Recent orders
          </h2>
          <OrdersTable orders={orders.slice(0, 3)} />
        </>
      )}
    </AccountShell>
  );
}

// Live logged-out /my-account: WooCommerce Login | Register columns (stacked below 922px).
function LoginView() {
  return (
    <div className="mx-auto max-w-[1240px] px-[20px] pt-[10px] lg:mb-[64px] lg:mt-[88px] lg:pt-0">
      <h1 className="sr-only">My account</h1>
      <div className="min-[922px]:flex min-[922px]:justify-between">
        <section aria-labelledby="login-heading" className="min-[922px]:w-[48%]">
          {/* Live renders these at 13px on mobile; 20px is the flagged fix. */}
          <h2 id="login-heading" className={HEADING}>
            Login
          </h2>
          <OtpLoginForm mode="login" />
        </section>
        <section aria-labelledby="register-heading" className="min-[922px]:w-[48%]">
          <h2 id="register-heading" className={HEADING}>
            Register
          </h2>
          <OtpLoginForm mode="register" />
        </section>
      </div>
    </div>
  );
}
