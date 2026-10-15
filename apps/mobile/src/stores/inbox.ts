// v1.15: the inbox (bell) unread count, shared by the header bell, the Account screen and the
// inbox itself. Signed in: refreshed now, every 30 seconds while the app is open, and whenever
// the app comes back to the foreground. Signed out: 0.
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { api } from '@/lib/api';
import { getSession, onSessionChange } from './session';

let unread = 0;
const listeners = new Set<() => void>();

function set(next: number): void {
  if (next === unread) return;
  unread = next;
  listeners.forEach((l) => l());
}

/** Re-reads the unread count from the server (quietly keeps the last value on failure). */
export async function refreshUnread(): Promise<void> {
  if (getSession().status !== 'authenticated') {
    set(0);
    return;
  }
  try {
    set((await api.notifications.unreadCount()).unread);
  } catch {
    // Offline / server busy - try again on the next tick.
  }
}

/** The inbox screen sets this directly after "mark read" so the badge reacts instantly. */
export function setUnread(next: number): void {
  set(Math.max(0, next));
}

let started = false;
function start(): void {
  if (started) return;
  started = true;
  void refreshUnread();
  onSessionChange(() => void refreshUnread());
  setInterval(() => {
    if (AppState.currentState === 'active') void refreshUnread();
  }, 30_000);
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void refreshUnread();
  });
}

export function useUnreadCount(): number {
  useEffect(start, []);
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => unread,
  );
}
