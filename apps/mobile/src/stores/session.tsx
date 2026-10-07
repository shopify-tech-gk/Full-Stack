import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { AuthUser } from '@youmart/shared-client';
import { api, setAccessToken, setUnauthorizedHandler } from '@/lib/api';

// RN session, mirroring the web's lib/session.ts. The difference is storage: the web restores from
// an httpOnly cookie; RN restores from a refresh token in expo-secure-store (managed in lib/api.ts).
// Access token stays in memory. Silent refresh runs on launch and on any 401.
export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: AuthUser };

const LOADING: SessionState = { status: 'loading', user: null };
const ANONYMOUS: SessionState = { status: 'anonymous', user: null };

let state: SessionState = LOADING;
const listeners = new Set<() => void>();
let epoch = 0;
let refreshing: Promise<boolean> | null = null;

function setState(next: SessionState): void {
  state = next;
  listeners.forEach((l) => l());
}

function signIn(accessToken: string, user: AuthUser): void {
  setAccessToken(accessToken);
  setState({ status: 'authenticated', user });
}

/** Trades the stored refresh token for a fresh access token. Concurrent callers share one call. */
export function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    const started = epoch;
    refreshing = api.auth
      .refresh()
      .then(({ accessToken, user }) => {
        if (started === epoch) signIn(accessToken, user);
        return true;
      })
      .catch(() => {
        if (started === epoch) {
          setAccessToken(null);
          setState(ANONYMOUS);
        }
        return false;
      })
      .finally(() => {
        refreshing = null;
      });
  }
  return refreshing;
}

setUnauthorizedHandler(refreshSession);

/** On launch: attempt a silent refresh (the native cookie jar replays `ym_rt` if present). */
export async function bootstrapSession(): Promise<void> {
  await refreshSession();
}

export async function loginWithOtp(identifier: string, code: string): Promise<AuthUser> {
  const { accessToken, user } = await api.auth.verifyOtp(identifier, code);
  epoch += 1;
  signIn(accessToken, user); // the refresh token was captured into secure-store by lib/api.ts
  return user;
}

export async function logout(): Promise<void> {
  epoch += 1;
  try {
    await api.auth.logout(); // clears the `ym_rt` cookie server-side (Set-Cookie clears the jar)
  } finally {
    setAccessToken(null);
    setState(ANONYMOUS);
  }
}

export async function updateProfileName(name: string): Promise<AuthUser> {
  const user = await api.auth.updateProfile({ name });
  if (state.status === 'authenticated') setState({ status: 'authenticated', user });
  return user;
}

export function getSession(): SessionState {
  return state;
}

export function onSessionChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// --- React context ---
const SessionContext = createContext<SessionState>(LOADING);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<SessionState>(state);

  useEffect(() => {
    const unsub = onSessionChange(() => setSnapshot(state));
    void bootstrapSession();
    return unsub;
  }, []);

  const value = useMemo(() => snapshot, [snapshot]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionState {
  return useContext(SessionContext);
}
