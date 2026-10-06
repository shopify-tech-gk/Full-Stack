'use client';

import { useEffect, useState } from 'react';

export const DESKTOP_QUERY = '(min-width: 1025px)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

/** Live `matchMedia` result; false during SSR and the first render. */
export function useMedia(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, [query]);
  return matches;
}

/** True while the page's tab is hidden (auto-advancing UI should pause). */
export function usePageHidden(): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const update = () => setHidden(document.visibilityState === 'hidden');
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);
  return hidden;
}
