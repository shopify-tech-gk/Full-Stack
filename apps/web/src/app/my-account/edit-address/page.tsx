import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AccountShell } from '@/components/account/AccountShell';
import { AddressBook } from '@/components/account/AddressBook';
import { getAddresses } from '@/lib/account';
import { getSession } from '@/lib/session';

export const metadata: Metadata = { title: 'Addresses - You Mart' };

export default async function EditAddressPage() {
  if (!getSession()) {
    redirect('/my-account');
  }
  const addresses = await getAddresses();
  return (
    <AccountShell active="addresses">
      <h1 className="sr-only">Addresses</h1>
      <AddressBook initial={addresses} />
    </AccountShell>
  );
}
