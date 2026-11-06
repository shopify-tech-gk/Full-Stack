import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from '@/lib/router';
import {
  ApiError,
  detectIdentifier,
  identifierKind,
  otpErrorMessage,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { loginWithPassword } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

// Native login. Two ways (v1.18 toggle): ONE smart field (phone or email, auto-detected) -> OTP,
// or username + password. New shoppers can still sign up with OTP, or register a username.
type Mode = 'otp' | 'password';

export default function LoginScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('otp');
  const [value, setValue] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // v1.17 Refer & Earn: an optional friend's code, applied right after the OTP is verified.
  const [showRef, setShowRef] = useState(false);
  const [refCode, setRefCode] = useState('');

  const kind = identifierKind(value);
  const identifier = detectIdentifier(value);
  const canPassword = username.trim().length >= 3 && password.length >= 1;

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    void Haptics.selectionAsync().catch(() => undefined);
    setMode(next);
    setError(null);
  };

  const sendOtp = async () => {
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

  const logIn = async () => {
    if (!canPassword || busy) return;
    setError(null);
    setBusy(true);
    try {
      await loginWithPassword(username.trim().toLowerCase(), password);
      router.dismissAll?.();
      router.replace('/(tabs)/account');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not log in. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons
              name={mode === 'otp' ? 'lock-closed' : 'person'}
              size={26}
              color={colors.white}
            />
          </View>
          <Text style={styles.title}>Welcome to YouMart</Text>
          <Text style={styles.subtitle}>
            {mode === 'otp'
              ? 'Log in or sign up with your mobile number or email.'
              : 'Log in with your username and password.'}
          </Text>
        </View>

        {/* v1.18 OTP | Username toggle */}
        <View style={styles.toggle} accessibilityRole="tablist">
          {(
            [
              ['otp', 'OTP', 'chatbox-ellipses-outline'],
              ['password', 'Username', 'key-outline'],
            ] as const
          ).map(([m, label, icon]) => (
            <Pressable
              key={m}
              onPress={() => switchMode(m)}
              style={[styles.toggleItem, mode === m && styles.toggleOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
            >
              <Ionicons
                name={icon}
                size={16}
                color={mode === m ? colors.white : colors.text.body}
              />
              <Text style={[styles.toggleText, mode === m && styles.toggleTextOn]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {mode === 'otp' ? (
          <>
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
                onSubmitEditing={sendOtp}
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
              onPress={sendOtp}
              disabled={!identifier || busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>Username</Text>
            <View style={[styles.field, error && styles.fieldError]}>
              <Ionicons name="at" size={18} color={colors.text.placeholder} />
              <TextInput
                value={username}
                onChangeText={(t) => {
                  setUsername(t.replace(/\s+/g, ''));
                  setError(null);
                }}
                placeholder="Your username"
                placeholderTextColor={colors.text.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username"
                textContentType="username"
                maxLength={20}
                style={styles.input}
                returnKeyType="next"
              />
            </View>
            <Text style={styles.label}>Password</Text>
            <View style={[styles.field, error && styles.fieldError]}>
              <Ionicons name="lock-closed-outline" size={18} color={colors.text.placeholder} />
              <TextInput
                value={password}
                onChangeText={(t) => {
                  setPassword(t);
                  setError(null);
                }}
                placeholder="Your password"
                placeholderTextColor={colors.text.placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="current-password"
                textContentType="password"
                style={styles.input}
                onSubmitEditing={logIn}
                returnKeyType="go"
              />
              <Pressable
                onPress={() => setShowPassword((s) => !s)}
                hitSlop={8}
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={colors.text.muted}
                />
              </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable onPress={() => switchMode('otp')} hitSlop={8} style={styles.refLink}>
              <Ionicons name="help-circle-outline" size={15} color={colors.brand.DEFAULT} />
              <Text style={styles.refLinkText}>Forgot password? Log in with OTP</Text>
            </Pressable>

            <Pressable
              style={[styles.button, (!canPassword || busy) && styles.buttonDisabled]}
              onPress={logIn}
              disabled={!canPassword || busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Log in</Text>
              )}
            </Pressable>
          </>
        )}

        {/* v1.18 register with a username (needs the mobile number's OTP) */}
        <View style={styles.divider}>
          <View style={styles.rule} />
          <Text style={styles.or}>or</Text>
          <View style={styles.rule} />
        </View>
        <Pressable
          onPress={() => router.push('/auth/register')}
          style={({ pressed }) => [styles.register, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="person-add-outline" size={18} color={colors.brand.DEFAULT} />
          <Text style={styles.registerText}>Create an account with a username</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.xl, gap: space.md, paddingBottom: 40 },
  hero: { alignItems: 'center', gap: 8, paddingTop: space.lg, paddingBottom: space.md },
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
  toggle: {
    flexDirection: 'row',
    backgroundColor: '#e9eef7',
    borderRadius: 14,
    padding: 4,
    gap: 4,
  },
  toggleItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: 11,
  },
  toggleOn: { backgroundColor: colors.brand.DEFAULT },
  toggleText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.body },
  toggleTextOn: { color: colors.white },
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
    marginTop: space.sm,
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
  divider: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: space.sm },
  rule: { flex: 1, height: 1, backgroundColor: '#dfe5ef' },
  or: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.text.muted },
  register: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    backgroundColor: colors.white,
  },
  registerText: { fontFamily: font.uiBold, fontSize: 15, color: colors.brand.DEFAULT },
});
