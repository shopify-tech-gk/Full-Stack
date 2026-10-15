import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ADD_TO_CART_SOUND = require('../../assets/sounds/add-to-cart.mp3');

let player: AudioPlayer | null = null;

function cartPlayer(): AudioPlayer | null {
  if (player) return player;
  try {
    // A UI sound: respects the silent switch and never stops the user's music.
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' }).catch(
      () => undefined,
    );
    player = createAudioPlayer(ADD_TO_CART_SOUND);
    player.volume = 1;
  } catch {
    player = null;
  }
  return player;
}

/** Load the sound up front so the first "Add" plays instantly. */
export function preloadFeedback(): void {
  cartPlayer();
}

/** "Added to cart": the YouMart add-to-cart sound plus a light tap. Never throws. */
export function addedToCartFeedback(): void {
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
  const p = cartPlayer();
  if (!p) return;
  try {
    // Rewind only after a previous play; a failed rewind must never swallow the sound.
    if (p.currentTime > 0) {
      void p
        .seekTo(0)
        .catch(() => undefined)
        .finally(() => p.play());
    } else {
      p.play();
    }
  } catch {
    /* sound is a nicety - never block adding to cart */
  }
}
