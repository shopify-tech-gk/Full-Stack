import { useEffect, useState } from 'react';
import { getJSON, setJSON } from '@/lib/storage';

// First-launch onboarding: the customer must accept the Terms & Conditions and Privacy Policy before
// using the app (then may grant permissions - optional, store rules forbid forcing them). Kept on
// the device; bumping TERMS_VERSION when the Terms change asks everyone to accept again.

/** The version of the Terms + Privacy Policy the customer accepts (W9: YouMart Wallet terms). */
export const TERMS_VERSION = '2026-10-13';

const KEY = 'ym:onboarding';

interface OnboardingRecord {
  termsVersion: string;
  acceptedAt: string;
}

type Status = 'loading' | 'needed' | 'done';

let status: Status = 'loading';
const listeners = new Set<() => void>();

function set(next: Status) {
  status = next;
  listeners.forEach((l) => l());
}

let loading: Promise<void> | null = null;
function load(): Promise<void> {
  loading ??= getJSON<OnboardingRecord>(KEY).then((rec) => {
    set(rec?.termsVersion === TERMS_VERSION ? 'done' : 'needed');
  });
  return loading;
}

/** Records that the customer accepted the current Terms + Privacy Policy. */
export async function completeOnboarding(): Promise<void> {
  await setJSON(KEY, { termsVersion: TERMS_VERSION, acceptedAt: new Date().toISOString() });
  set('done');
}

/** 'loading' until read from storage, then 'needed' (show the welcome flow) or 'done'. */
export function useOnboarding(): Status {
  const [value, setValue] = useState<Status>(status);
  useEffect(() => {
    const listener = () => setValue(status);
    listeners.add(listener);
    void load();
    listener();
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return value;
}
