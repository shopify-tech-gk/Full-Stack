'use client';

import { useEffect, useSyncExternalStore } from 'react';
import type { AuthUser } from '@youmart/shared-client';
import { api, setAccessToken, setUnauthorizedHandler } from './api';

export type SessionState =
  | { status: 'loading'; user: null }
  | { status: 'anonymous'; user: null }
  | { status: 'authenticated'; user: AuthUser };

const LOADING: SessionState = { status: 'loading', user: null };
const ANONYMOUS: SessionState = { status: 'anonymous', user: null };

let state: SessionState = LOADING;
const listeners = new Set<() => void>();
// Bumped by every login/logout so a slower, older refresh can never overwrite the newer state.
let epoch = 0;
let refreshing: Promise<boolean> | null = null;
let bootstrapped = false;

function setState(next: SessionState): void {
  state = next;
  listeners.forEach((listener) => listener());
}

function signIn(accessToken: string, user: AuthUser): void {
  setAccessToken(accessToken);
  setState({ status: 'authenticated', user });
}

/**
 * Trades the httpOnly `ym_rt` cookie for a fresh in-memory access token. Concurrent callers share
 * one request: the cookie rotates on every refresh, so two parallel refreshes would race.
 */
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

// Any authed API call that gets 401 (expired token) refreshes once and retries (api-client).
setUnauthorizedHandler(refreshSession);

export async function loginWithOtp(identifier: string, code: string): Promise<AuthUser> {
  const { accessToken, user } = await api.auth.verifyOtp(identifier, code);
  epoch += 1;
  signIn(accessToken, user);
  return user;
}

export async function logout(): Promise<void> {
  epoch += 1;
  try {
    await api.auth.logout();
  } finally {
    setAccessToken(null);
    setState(ANONYMOUS);
  }
}

/** Re-reads the profile through an authenticated call (401 -> silent refresh -> retry). */
export async function reloadUser(): Promise<void> {
  const user = await api.auth.me();
  if (state.status === 'authenticated') setState({ status: 'authenticated', user });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Non-React access for stores that follow the session (the cart switches guest <-> account). */
export function getSession(): SessionState {
  return state;
}

export function onSessionChange(listener: () => void): () => void {
  return subscribe(listener);
}

/** Current session; the first mounted caller restores it from the refresh cookie (no re-OTP). */
export function useSession(): SessionState {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
  useEffect(() => {
    if (!bootstrapped) {
      bootstrapped = true;
      void refreshSession();
    }
  }, []);
  return snapshot;
}
