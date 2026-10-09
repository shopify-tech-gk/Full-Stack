import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Address } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';

// The customer's delivery address, tied to the ACCOUNT: the selected address is the account's
// default (isDefault), so choosing one here persists server-side with no new backend. Guests have
// no addresses until they sign in.
interface AddressContextValue {
  addresses: Address[] | null;
  selected: Address | null;
  loading: boolean;
  reload: () => void;
  select: (id: string) => Promise<void>;
}

const AddressContext = createContext<AddressContextValue | null>(null);

export function AddressProvider({ children }: { children: ReactNode }) {
  const authed = useSession().status === 'authenticated';
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(() => {
    if (!authed) {
      setAddresses(null);
      return;
    }
    setLoading(true);
    api.addresses
      .list()
      .then((r) => setAddresses(r.items))
      .catch(() => setAddresses([]))
      .finally(() => setLoading(false));
  }, [authed]);

  useEffect(() => {
    reload();
  }, [reload]);

  const select = useCallback(
    async (id: string) => {
      // Optimistic: mark the chosen one default locally, then persist and refetch.
      setAddresses((prev) => (prev ? prev.map((a) => ({ ...a, isDefault: a.id === id })) : prev));
      try {
        await api.addresses.setDefault(id);
      } catch {
        /* keep optimistic state; a reload will reconcile */
      }
      reload();
    },
    [reload],
  );

  const selected = addresses ? (addresses.find((a) => a.isDefault) ?? addresses[0] ?? null) : null;

  return (
    <AddressContext.Provider value={{ addresses, selected, loading, reload, select }}>
      {children}
    </AddressContext.Provider>
  );
}

export function useAddresses(): AddressContextValue {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error('useAddresses must be used within an AddressProvider');
  return ctx;
}
