import type { Metadata } from 'next';
import { AccountShell } from '@/components/account/AccountShell';
import { AddressBook } from '@/components/account/AddressBook';
import { RequireAuth } from '@/components/account/RequireAuth';

export const metadata: Metadata = { title: 'Addresses - You Mart' };

// Addresses load client-side with the in-memory access token (the server never holds it).
export default function EditAddressPage() {
  return (
    <RequireAuth>
      <AccountShell active="addresses">
        <h1 className="sr-only">Addresses</h1>
        <AddressBook />
      </AccountShell>
    </RequireAuth>
  );
}
