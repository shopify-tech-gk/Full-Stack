import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import type { CatNode } from '@/lib/home-categories';

// The user's custom home category order (like rearranging a home screen). Signed-in: saved to the
// ACCOUNT (auth-service preferences). Guests: cached on-device so it still persists per device.
const KEY = 'ym.categoryOrder.v1';

/**
 * Returns the categories in the user's saved order (unknown/new categories appended in natural
 * order) and a `move(from, to)` that reorders by insert-and-shift and persists — to the account
 * when signed in, otherwise to on-device storage.
 */
export function useCategoryOrder(all: CatNode[]): {
  ordered: CatNode[];
  move: (from: number, to: number) => void;
} {
  const [order, setOrder] = useState<string[] | null>(null);
  const authed = useSession().status === 'authenticated';
  const authedRef = useRef(authed);
  authedRef.current = authed;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (authed) {
        try {
          const { categoryOrder } = await api.auth.getPreferences();
          if (active) {
            setOrder(categoryOrder);
            return;
          }
        } catch {
          /* fall through to the local cache */
        }
      }
      try {
        const raw = await AsyncStorage.getItem(KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        if (active) {
          setOrder(Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : []);
        }
      } catch {
        if (active) setOrder([]);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [authed]);

  const ordered = useMemo<CatNode[]>(() => {
    if (!order) return all;
    const bySlug = new Map(all.map((c) => [c.slug, c]));
    const seen = new Set<string>();
    const out: CatNode[] = [];
    for (const slug of order) {
      const c = bySlug.get(slug);
      if (c && !seen.has(slug)) {
        out.push(c);
        seen.add(slug);
      }
    }
    for (const c of all) if (!seen.has(c.slug)) out.push(c);
    return out;
  }, [all, order]);

  const move = useCallback(
    (from: number, to: number) => {
      if (from === to || from < 0 || to < 0 || from >= ordered.length) return;
      const slugs = ordered.map((c) => c.slug);
      const [moved] = slugs.splice(from, 1);
      if (moved === undefined) return;
      slugs.splice(Math.min(to, slugs.length), 0, moved);
      setOrder(slugs);
      // Persist: account when signed in, device cache otherwise. Best-effort (UI already updated).
      if (authedRef.current) {
        api.auth.setCategoryOrder(slugs).catch(() => {});
      } else {
        AsyncStorage.setItem(KEY, JSON.stringify(slugs)).catch(() => {});
      }
    },
    [ordered],
  );

  return { ordered, move };
}
