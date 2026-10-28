import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputInstance,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  OTP_LENGTH,
  OTP_RESEND_SECONDS,
  detectIdentifier,
  identifierLabel,
  otpErrorMessage,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { loginWithOtp } from '@/stores/session';
import { referralAfterSignIn } from '@/lib/referral-signup';
import { colors, font, radii, space } from '@/theme';

// OTP entry -> verify -> logged in. The session store captures the refresh token into secure-store.
export default function OtpScreen() {
  const router = useRouter();
  const { identifier, ref } = useLocalSearchParams<{ identifier: string; ref?: string }>();
  const id = String(identifier ?? '');
  const detected = detectIdentifier(id);
  const label = detected ? identifierLabel(detected) : id;

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(OTP_RESEND_SECONDS);
  const inputRef = useRef<TextInputInstance>(null);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  const verify = async (value: string) => {
    setBusy(true);
    setError(null);
    try {
      const user = await loginWithOtp(id, value);
      // v1.17 Refer & Earn: apply a code typed on the sign-in screen, or ask a new account once.
      const referral = await referralAfterSignIn(
        user.id,
        typeof ref === 'string' ? ref : undefined,
      );
      // Back to wherever the user came from (tabs); the session change merges guest data.
      router.dismissAll?.();
      router.replace('/(tabs)/account');
      if (referral.kind === 'ask') router.push('/auth/referral');
      else if (referral.kind === 'applied') {
        Alert.alert(
          'Referral code added',
          `You joined with ${referral.friend ?? 'your friend'}'s code. Happy shopping!`,
        );
      } else if (referral.kind === 'failed') {
        Alert.alert('Referral code not added', referral.message);
      }
    } catch (err) {
      setError(otpErrorMessage(err, 'verify'));
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const onChange = (t: string) => {
    const digits = t.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === OTP_LENGTH) void verify(digits);
  };

  const resend = async () => {
    if (seconds > 0 || !detected) return;
    try {
      await api.auth.requestOtp(detected.value);
      setSeconds(OTP_RESEND_SECONDS);
    } catch (err) {
      setError(otpErrorMessage(err, 'request'));
    }
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Enter the code</Text>
      <Text style={styles.subtitle}>
        We sent a {OTP_LENGTH}-digit code to{'\n'}
        <Text style={styles.strong}>{label}</Text>
      </Text>

      <View style={styles.boxes}>
        {Array.from({ length: OTP_LENGTH }).map((_, i) => (
          <View key={i} style={[styles.box, i === code.length && styles.boxActive]}>
            <Text style={styles.boxText}>{code[i] ?? ''}</Text>
          </View>
        ))}
        {/* The real input lies invisibly over the boxes (full size - Android's autofill skips a
            1px field). Marked as a one-time code, so the code from the SMS is offered above the
            keyboard: iOS "From Messages", Android's SMS code suggestion (Gboard / Google). */}
        <TextInput
          ref={inputRef}
          value={code}
          onChangeText={onChange}
          keyboardType="number-pad"
          maxLength={OTP_LENGTH}
          style={styles.overlayInput}
          caretHidden
          autoFocus
          textContentType="oneTimeCode"
          autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
          importantForAutofill="yes"
          accessibilityLabel={`${OTP_LENGTH}-digit code`}
        />
      </View>

      {busy ? (
        <ActivityIndicator color={colors.brand.DEFAULT} style={{ marginTop: space.lg }} />
      ) : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Pressable onPress={resend} disabled={seconds > 0} style={styles.resend}>
        <Text style={[styles.resendText, seconds > 0 && styles.resendDisabled]}>
          {seconds > 0 ? `Resend code in ${seconds}s` : 'Resend code'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page, padding: space.xl, alignItems: 'center' },
  title: { fontFamily: font.uiBold, fontSize: 22, color: colors.heading, marginTop: space.lg },
  subtitle: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text.body,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 21,
  },
  strong: { fontFamily: font.uiSemibold, color: colors.text.strong },
  boxes: { flexDirection: 'row', gap: space.sm, marginTop: space.xxl },
  box: {
    width: 46,
    height: 56,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.card.border,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.brand.DEFAULT },
  boxText: { fontFamily: font.uiBold, fontSize: 22, color: colors.text.strong },
  // Over the boxes, practically invisible (opacity 0 can hide a field from Android autofill).
  overlayInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.02,
    color: 'transparent',
    fontSize: 1,
  },
  error: {
    fontFamily: font.uiMedium,
    fontSize: 13,
    color: colors.price.discount,
    marginTop: space.lg,
  },
  resend: { marginTop: space.xl },
  resendText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
  resendDisabled: { color: colors.text.muted },
});
