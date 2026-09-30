'use client';

// The signed-in customer's saved addresses (address-service, GET /api/addresses: default first,
// then newest). Scoped to the session's user: switching accounts never shows the previous list.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Address } from '@youmart/shared-client';
import { api } from './api';
import { useSession } from './session';

interface AddressState {
  userId: string | null;
  items: Address[] | null;
  failed: boolean;
}

export interface AddressList {
  /** null while loading, when signed out, or after a failed load. */
  addresses: Address[] | null;
  failed: boolean;
  /** Re-reads the list from the server (after a change, or to retry a failed load). */
  reload: () => Promise<void>;
}

export function useAddresses(): AddressList {
  const session = useSession();
  const userId = session.status === 'authenticated' ? session.user.id : null;
  const [state, setState] = useState<AddressState>({ userId: null, items: null, failed: false });
  // Only the newest request may land (a slow list for a previous account is ignored).
  const latest = useRef(0);

  const reload = useCallback(async () => {
    if (!userId) return;
    const request = ++latest.current;
    try {
      const { items } = await api.addresses.list();
      if (request === latest.current) setState({ userId, items, failed: false });
    } catch {
      if (request === latest.current) setState({ userId, items: null, failed: true });
    }
  }, [userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const current = state.userId === userId ? state : { items: null, failed: false };
  return { addresses: current.items, failed: current.failed, reload };
}
