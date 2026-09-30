import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { AddressBook } from '@/components/account/AddressBook';
import { RequireAuth } from '@/components/account/RequireAuth';
import { getAddresses } from '@/lib/account';

export const metadata: Metadata = { title: 'Addresses - You Mart' };

export default async function EditAddressPage() {
  const addresses = await getAddresses();
  return (
    <RequireAuth>
      <AccountShell active="addresses">
        <h1 className="sr-only">Addresses</h1>
        <AddressBook initial={addresses} />
      </AccountShell>
    </RequireAuth>
  );
}
