import { requireOptionalNativeModule } from 'expo';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionOptions,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';

// Voice search: on-device speech-to-text via the phone's own recognizer (expo-speech-recognition).
// The native module ships in the YouMart app build (dev build / store build) but NOT in Expo Go, so
// it's loaded optionally - importing `expo-speech-recognition` directly would crash Expo Go at
// startup. When it's missing, `voiceAvailable` is false and the UI explains why.

interface Subscription {
  remove(): void;
}

interface SpeechModule {
  start(options: ExpoSpeechRecognitionOptions): void;
  stop(): void;
  abort(): void;
  isRecognitionAvailable(): boolean;
  getPermissionsAsync(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  requestPermissionsAsync(): Promise<{ granted: boolean; canAskAgain: boolean }>;
  addListener(event: 'result', cb: (e: ExpoSpeechRecognitionResultEvent) => void): Subscription;
  addListener(event: 'error', cb: (e: ExpoSpeechRecognitionErrorEvent) => void): Subscription;
  addListener(event: 'start' | 'end' | 'speechstart', cb: () => void): Subscription;
  addListener(event: 'volumechange', cb: (e: { value: number }) => void): Subscription;
}

const speech = requireOptionalNativeModule<SpeechModule>('ExpoSpeechRecognition');

/** True in the YouMart app build; false in Expo Go (no native speech module). */
export const voiceAvailable = speech !== null;

export type VoicePermission = 'granted' | 'denied' | 'blocked' | 'unavailable';

function toPermission(r: { granted: boolean; canAskAgain: boolean }): VoicePermission {
  if (r.granted) return 'granted';
  return r.canAskAgain ? 'denied' : 'blocked';
}

/** Microphone + speech recognition permission, without prompting. */
export async function getVoicePermission(): Promise<VoicePermission> {
  if (!speech) return 'unavailable';
  try {
    return toPermission(await speech.getPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

/** Asks for microphone + speech recognition (the OS shows its own dialogs). */
export async function requestVoicePermission(): Promise<VoicePermission> {
  if (!speech) return 'unavailable';
  try {
    return toPermission(await speech.requestPermissionsAsync());
  } catch {
    return 'unavailable';
  }
}

export interface VoiceHandlers {
  /** Live transcript while speaking; `final` once the phrase is complete. */
  onTranscript: (text: string, final: boolean) => void;
  onVolume?: (level: number) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

const FRIENDLY_ERROR: Partial<Record<ExpoSpeechRecognitionErrorEvent['error'], string>> = {
  'no-speech': "We didn't hear anything. Tap the mic and try again.",
  'speech-timeout': "We didn't hear anything. Tap the mic and try again.",
  'not-allowed': 'Microphone access is off. Turn it on in Settings to search by voice.',
  network: 'Voice search needs an internet connection on this phone.',
  'language-not-supported': "Voice search isn't available in this language on your phone.",
  'service-not-allowed': "Voice search isn't available on this phone.",
};

/**
 * Starts listening (Indian English, live results, stops after one phrase). Returns a stop
 * function that also removes the listeners. Errors come back through `onError`.
 */
export function startListening(handlers: VoiceHandlers): () => void {
  if (!speech) {
    handlers.onError('Voice search works in the YouMart app.');
    handlers.onEnd();
    return () => {};
  }
  const subs: Subscription[] = [
    speech.addListener('result', (e) => {
      const text = e.results[0]?.transcript ?? '';
      handlers.onTranscript(text, e.isFinal);
    }),
    speech.addListener('error', (e) => {
      if (e.error === 'aborted') return;
      handlers.onError(FRIENDLY_ERROR[e.error] ?? 'Voice search stopped. Please try again.');
    }),
    speech.addListener('end', () => handlers.onEnd()),
    speech.addListener('volumechange', (e) => handlers.onVolume?.(e.value)),
  ];
  try {
    speech.start({
      lang: 'en-IN',
      interimResults: true,
      continuous: false,
      maxAlternatives: 1,
      volumeChangeEventOptions: { enabled: true, intervalMillis: 120 },
    });
  } catch {
    handlers.onError('Voice search could not start. Please try again.');
    handlers.onEnd();
  }
  return () => {
    try {
      speech.abort();
    } catch {
      /* already stopped */
    }
    subs.forEach((s) => s.remove());
  };
}
