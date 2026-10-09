import { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CatNode } from '@/lib/home-categories';

// The user's custom home category order (like rearranging a home screen), persisted on-device.
const KEY = 'ym.categoryOrder.v1';

/**
 * Returns the categories in the user's saved order (unknown/new categories appended in natural
 * order) and a `move(from, to)` that reorders by insert-and-shift and persists.
 */
export function useCategoryOrder(all: CatNode[]): {
  ordered: CatNode[];
  move: (from: number, to: number) => void;
} {
  const [order, setOrder] = useState<string[] | null>(null);

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!active) return;
        let saved: string[] = [];
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) saved = parsed.filter((s) => typeof s === 'string');
          } catch {
            /* ignore corrupt value */
          }
        }
        setOrder(saved);
      })
      .catch(() => active && setOrder([]));
    return () => {
      active = false;
    };
  }, []);

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
      AsyncStorage.setItem(KEY, JSON.stringify(slugs)).catch(() => {});
    },
    [ordered],
  );

  return { ordered, move };
}
