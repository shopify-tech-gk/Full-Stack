import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, type AuthUser } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { applyUserUpdate } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

/**
 * Change (or add) the account's mobile number or email: type the new one, get a code on it
 * (WhatsApp for a number, email for an address), enter the code. Nothing changes until the code
 * checks out; a number/email already on another account is refused.
 */
export function ContactChangeSheet({
  kind,
  visible,
  onClose,
}: {
  kind: 'PHONE' | 'EMAIL';
  visible: boolean;
  onClose: (updated?: AuthUser) => void;
}) {
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'enter' | 'code'>('enter');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phone = kind === 'PHONE';

  useEffect(() => {
    if (visible) {
      setStep('enter');
      setValue('');
      setCode('');
      setError(null);
    }
  }, [visible]);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.auth.requestContactChange(value.trim());
      setStep('code');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const user = await api.auth.verifyContactChange(value.trim(), code.trim());
      applyUserUpdate(user);
      onClose(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not verify the code. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose()}>
      <Pressable style={styles.backdrop} onPress={() => onClose()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>
            {step === 'enter'
              ? phone
                ? 'New mobile number'
                : 'New email address'
              : 'Enter the code'}
          </Text>
          <Text style={styles.sub}>
            {step === 'enter'
              ? phone
                ? "We'll send a code on WhatsApp to confirm it's yours."
                : "We'll email you a code to confirm it's yours."
              : `Sent to ${value.trim()}.`}
          </Text>

          {step === 'enter' ? (
            <TextInput
              value={value}
              onChangeText={(t) => {
                setValue(t);
                setError(null);
              }}
              placeholder={phone ? '10-digit mobile number' : 'you@example.com'}
              placeholderTextColor={colors.text.placeholder}
              keyboardType={phone ? 'phone-pad' : 'email-address'}
              autoCapitalize="none"
              autoFocus
              style={styles.input}
            />
          ) : (
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t.replace(/\D/g, ''));
                setError(null);
              }}
              placeholder="••••••"
              placeholderTextColor={colors.text.placeholder}
              keyboardType="number-pad"
              maxLength={8}
              autoFocus
              textContentType="oneTimeCode"
              autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
              importantForAutofill="yes"
              style={[styles.input, styles.codeInput]}
            />
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.primary, busy && { opacity: 0.7 }]}
            disabled={busy || (step === 'enter' ? value.trim().length < 5 : code.length < 4)}
            onPress={() => void (step === 'enter' ? send() : verify())}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.primaryText}>
                {step === 'enter' ? 'Send code' : 'Verify & save'}
              </Text>
            )}
          </Pressable>
          {step === 'code' ? (
            <Pressable style={styles.back} onPress={() => setStep('enter')}>
              <Ionicons name="arrow-back" size={14} color={colors.brand.DEFAULT} />
              <Text style={styles.backText}>Change {phone ? 'number' : 'email'}</Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: space.xl,
    paddingTop: space.md,
    gap: space.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.card.border,
  },
  title: { fontFamily: font.uiBold, fontSize: 19, color: colors.heading },
  sub: { fontFamily: font.body, fontSize: 13.5, color: colors.text.body, marginTop: -6 },
  input: {
    borderWidth: 1.5,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    paddingHorizontal: space.md,
    height: 50,
    fontFamily: font.body,
    fontSize: 16,
    color: colors.text.input,
  },
  codeInput: { letterSpacing: 8, textAlign: 'center', fontFamily: font.uiBold, fontSize: 20 },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  primary: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { fontFamily: font.uiBold, fontSize: 15.5, color: colors.white },
  back: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'center' },
  backText: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.brand.DEFAULT },
});
