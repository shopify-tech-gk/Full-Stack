import { useMemo } from 'react';
import { useRouter as useExpoRouter } from 'expo-router';

// A quick double tap used to open the same page twice (and need two Backs). Every screen takes
// its router from here: a second push / navigate within GAP_MS of the last one is ignored.
// Replace / back / dismiss are untouched.
const GAP_MS = 700;
let lastAt = 0;

function once<A extends unknown[]>(go: (...args: A) => void) {
  return (...args: A) => {
    const now = Date.now();
    if (now - lastAt < GAP_MS) return;
    lastAt = now;
    go(...args);
  };
}

export function useRouter(): ReturnType<typeof useExpoRouter> {
  const router = useExpoRouter();
  return useMemo(
    () => ({ ...router, push: once(router.push), navigate: once(router.navigate) }),
    [router],
  );
}
