'use client';

// v1.15: the inbox (bell) unread count for the header and the Notifications page. Signed in:
// read now, every 30 seconds while the tab is visible, and when the tab comes back. Signed out: 0.
import { useEffect, useSyncExternalStore } from 'react';
import { api } from './api';
import { getSession, useSession } from './session';

let unread = 0;
const listeners = new Set<() => void>();

function set(next: number): void {
  const value = Math.max(0, next);
  if (value === unread) return;
  unread = value;
  listeners.forEach((l) => l());
}

export async function refreshUnread(): Promise<void> {
  if (getSession().status !== 'authenticated') {
    set(0);
    return;
  }
  try {
    set((await api.notifications.unreadCount()).unread);
  } catch {
    // Keep the last value; the next tick tries again.
  }
}

/** The Notifications page sets this directly after "mark read" so the bell reacts instantly. */
export function setUnread(next: number): void {
  set(next);
}

export function useUnreadCount(): number {
  const session = useSession();
  useEffect(() => {
    void refreshUnread();
    if (session.status !== 'authenticated') return;
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void refreshUnread();
    }, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refreshUnread();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [session.status]);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => unread,
    () => 0,
  );
}
