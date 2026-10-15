'use client';

// The add-to-cart sound - the same clip as the app (apps/mobile/assets/sounds/add-to-cart.mp3).
// Browsers only play audio after a user gesture; every add starts from a click, so it plays.
let audio: HTMLAudioElement | null = null;

function clip(): HTMLAudioElement | null {
  if (typeof window === 'undefined') return null;
  if (!audio) {
    audio = new Audio('/sounds/add-to-cart.mp3');
    audio.preload = 'auto';
  }
  return audio;
}

/** Fetch the clip ahead of time so the first "Add" plays instantly. */
export function preloadAddToCartSound(): void {
  clip();
}

/** Plays the add-to-cart sound. Never throws - a blocked or failed play is silently skipped. */
export function playAddToCartSound(): void {
  const a = clip();
  if (!a) return;
  try {
    a.currentTime = 0;
    void a.play().catch(() => undefined);
  } catch {
    /* a sound is a nicety */
  }
}
