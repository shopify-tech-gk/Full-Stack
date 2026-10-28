import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { detectIdentifier, identifierKind, otpErrorMessage } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

// Native login: ONE smart field (phone or email, auto-detected) -> request OTP. Mirrors web W2.
export default function LoginScreen() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // v1.17 Refer & Earn: an optional friend's code, applied right after the OTP is verified.
  const [showRef, setShowRef] = useState(false);
  const [refCode, setRefCode] = useState('');

  const kind = identifierKind(value);
  const identifier = detectIdentifier(value);

  const submit = async () => {
    setError(null);
    if (!identifier) {
      setError('Please enter a valid mobile number or email address.');
      return;
    }
    setBusy(true);
    try {
      await api.auth.requestOtp(identifier.value);
      router.push({
        pathname: '/auth/otp',
        params: {
          identifier: identifier.value,
          ...(refCode.trim() ? { ref: refCode.trim() } : {}),
        },
      });
    } catch (err) {
      setError(otpErrorMessage(err, 'request'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={styles.body}>
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons name="lock-closed" size={26} color={colors.white} />
          </View>
          <Text style={styles.title}>Welcome to YouMart</Text>
          <Text style={styles.subtitle}>Log in or sign up with your mobile number or email.</Text>
        </View>

        <Text style={styles.label}>Mobile number or email</Text>
        <View style={[styles.field, error && styles.fieldError]}>
          <Ionicons
            name={kind === 'EMAIL' ? 'mail-outline' : 'call-outline'}
            size={18}
            color={colors.text.placeholder}
          />
          <TextInput
            value={value}
            onChangeText={(t) => {
              setValue(t);
              setError(null);
            }}
            placeholder="Enter mobile number or email"
            placeholderTextColor={colors.text.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType={kind === 'EMAIL' ? 'email-address' : 'default'}
            style={styles.input}
            onSubmitEditing={submit}
            returnKeyType="send"
          />
        </View>
        <Text style={styles.hint}>Use your mobile number or email — no password needed.</Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* v1.17 Refer & Earn: optional friend's code (new accounts). */}
        {showRef ? (
          <View style={styles.refBox}>
            <Text style={styles.label}>Friend&apos;s referral code (optional)</Text>
            <View style={styles.field}>
              <Ionicons name="gift-outline" size={18} color={colors.text.placeholder} />
              <TextInput
                value={refCode}
                onChangeText={(t) => setRefCode(t.toUpperCase().replace(/\s+/g, ''))}
                placeholder="e.g. YMAB12CD"
                placeholderTextColor={colors.text.placeholder}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={20}
                style={styles.input}
              />
            </View>
            <Text style={styles.hint}>
              New to YouMart? Your friend earns a reward when you shop.
            </Text>
          </View>
        ) : (
          <Pressable onPress={() => setShowRef(true)} hitSlop={8} style={styles.refLink}>
            <Ionicons name="gift-outline" size={15} color={colors.brand.DEFAULT} />
            <Text style={styles.refLinkText}>Have a friend&apos;s referral code?</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, (!identifier || busy) && styles.buttonDisabled]}
          onPress={submit}
          disabled={!identifier || busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Send OTP</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.xl, gap: space.md },
  hero: { alignItems: 'center', gap: 8, paddingVertical: space.xl },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: font.uiBold, fontSize: 22, color: colors.heading, marginTop: 6 },
  subtitle: {
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text.body,
    textAlign: 'center',
    maxWidth: 300,
  },
  label: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.5,
    borderColor: colors.brand.accent,
    borderRadius: radii.button,
    paddingHorizontal: space.lg,
    height: 52,
    backgroundColor: colors.white,
  },
  fieldError: { borderColor: colors.price.discount },
  input: { flex: 1, fontFamily: font.body, fontSize: 16, color: colors.text.input },
  hint: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  button: {
    marginTop: space.md,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: { opacity: 0.5 },
  refLink: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  refLinkText: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.brand.DEFAULT },
  refBox: { gap: space.sm },
  buttonText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
});
