import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { OTP_LENGTH } from '@youmart/shared-client';

// v1.18 OTP autofill for WhatsApp codes. iPhone offers the code above the keyboard by itself
// (textContentType="oneTimeCode"); Android keyboards only do that for SMS. So on Android, when the
// shopper taps "Copy code" in WhatsApp and comes back, the copied code is filled in for them. Only a
// code copied AFTER this screen opened counts (an old one on the clipboard is ignored).

const CODE_RX = new RegExp(`(?:^|\\D)(\\d{${OTP_LENGTH}})(?!\\d)`);

/** The OTP inside some text ("Your code is 482913" -> "482913"; "482 913" counts too), or null. */
export function otpIn(text: string | null | undefined): string | null {
  return CODE_RX.exec((text ?? '').replace(/(\d)[\s-](?=\d)/g, '$1'))?.[1] ?? null;
}

/** The code on the clipboard now ("Paste code" button), or null. */
export async function otpFromClipboard(): Promise<string | null> {
  try {
    return otpIn(await Clipboard.getStringAsync());
  } catch {
    return null;
  }
}

/** Android: fill the code the shopper copies from WhatsApp as soon as they're back in the app. */
export function useOtpClipboardAutofill(onCode: (code: string) => void, enabled = true): void {
  const baseline = useRef<string | null | undefined>(undefined);
  const used = useRef<string | null>(null);
  const handler = useRef(onCode);
  handler.current = onCode;

  useEffect(() => {
    if (Platform.OS !== 'android' || !enabled) return;
    let alive = true;

    const check = async () => {
      const code = await otpFromClipboard();
      if (!alive) return;
      if (baseline.current === undefined) {
        baseline.current = code; // whatever was there before the code was sent
        return;
      }
      if (code && code !== baseline.current && code !== used.current) {
        used.current = code;
        handler.current(code);
      }
    };

    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    // Copied without leaving the app (e.g. a notification's "Copy code"): check now and then.
    const timer = setInterval(() => {
      if (AppState.currentState === 'active') void check();
    }, 2500);
    return () => {
      alive = false;
      sub.remove();
      clearInterval(timer);
    };
  }, [enabled]);
}
