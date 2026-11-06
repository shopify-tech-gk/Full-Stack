import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { ApiError, OTP_LENGTH, OTP_RESEND_SECONDS } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useRouter } from '@/lib/router';
import { registerWithUsername } from '@/stores/session';
import { referralAfterSignIn } from '@/lib/referral-signup';
import { colors, font, radii, space } from '@/theme';

// v1.18 Register with a username. Name, a unique username, a password and the MOBILE NUMBER (not
// optional): an OTP to the number completes it, so one number = one account. A number that already
// has an OTP account gets the username + password added to that account (same account, two ways
// to log in); a number that already has a username can't register again (log in instead).

const USERNAME_RX = /^[a-z][a-z0-9_.]{2,19}$/;

type Check = { state: 'idle' | 'checking' | 'ok' | 'bad'; message: string | null };

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [mobile, setMobile] = useState('');
  const [check, setCheck] = useState<Check>({ state: 'idle', message: null });
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [code, setCode] = useState('');
  const [seconds, setSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkSeq = useRef(0);

  const uname = username.trim().toLowerCase();
  const phone = `+91${mobile}`;
  const passwordOk = password.length >= 8 && /[a-z]/i.test(password) && /\d/.test(password);
  const ready =
    name.trim().length >= 2 && check.state === 'ok' && passwordOk && /^[6-9]\d{9}$/.test(mobile);

  // Live "is this username free?" (debounced).
  useEffect(() => {
    if (!uname) {
      setCheck({ state: 'idle', message: null });
      return;
    }
    if (!USERNAME_RX.test(uname)) {
      setCheck({
        state: 'bad',
        message: '3-20 letters, numbers, _ or . - start with a letter',
      });
      return;
    }
    setCheck({ state: 'checking', message: null });
    const seq = ++checkSeq.current;
    const t = setTimeout(() => {
      api.auth
        .checkUsername(uname)
        .then((r) => {
          if (seq !== checkSeq.current) return;
          setCheck(
            r.available
              ? { state: 'ok', message: `@${r.username} is available` }
              : { state: 'bad', message: r.reason ?? 'Not available' },
          );
        })
        .catch(() => seq === checkSeq.current && setCheck({ state: 'idle', message: null }));
    }, 450);
    return () => clearTimeout(t);
  }, [uname]);

  useEffect(() => {
    if (seconds <= 0) return;
    const t = setTimeout(() => setSeconds((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [seconds]);

  const body = () => ({ name: name.trim(), username: uname, password, phone });

  const sendOtp = async () => {
    if (!ready || busy) return;
    setError(null);
    setBusy(true);
    try {
      await api.auth.registerStart(body());
      setStep('otp');
      setCode('');
      setSeconds(OTP_RESEND_SECONDS);
      void Haptics.selectionAsync().catch(() => undefined);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send the OTP. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const create = async (otp: string) => {
    setError(null);
    setBusy(true);
    try {
      const user = await registerWithUsername({ ...body(), code: otp });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      const referral = await referralAfterSignIn(user.id, undefined).catch(() => null);
      router.dismissAll?.();
      router.replace('/(tabs)/account');
      if (referral?.kind === 'ask') router.push('/auth/referral');
      Alert.alert(
        'Account ready',
        `Welcome, @${user.username ?? uname}! You can now log in with your username or with OTP.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the account.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const onCode = (t: string) => {
    const digits = t.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setCode(digits);
    setError(null);
    if (digits.length === OTP_LENGTH) void create(digits);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.hero}>
          <View style={styles.badge}>
            <Ionicons name="person-add" size={26} color={colors.white} />
          </View>
          <Text style={styles.title}>Create your account</Text>
          <Text style={styles.subtitle}>
            Pick a username and password. Your mobile number keeps the account yours - one number,
            one account.
          </Text>
        </View>

        <View style={styles.steps}>
          <Step n={1} label="Your details" on={step === 'details'} done={step === 'otp'} />
          <View style={styles.stepLine} />
          <Step n={2} label="Verify mobile" on={step === 'otp'} done={false} />
        </View>

        {step === 'details' ? (
          <Animated.View
            entering={FadeInDown.duration(250).reduceMotion(ReduceMotion.Never)}
            style={styles.form}
          >
            <Field label="Full name" icon="person-outline">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Vijay Kumar"
                placeholderTextColor={colors.text.placeholder}
                autoComplete="name"
                textContentType="name"
                maxLength={60}
                style={styles.input}
              />
            </Field>

            <Field
              label="Username"
              icon="at"
              tone={check.state === 'ok' ? 'ok' : check.state === 'bad' ? 'bad' : undefined}
              trailing={
                check.state === 'checking' ? (
                  <ActivityIndicator size="small" color={colors.brand.DEFAULT} />
                ) : check.state === 'ok' ? (
                  <Ionicons name="checkmark-circle" size={20} color="#059669" />
                ) : check.state === 'bad' ? (
                  <Ionicons name="close-circle" size={20} color={colors.price.discount} />
                ) : null
              }
            >
              <TextInput
                value={username}
                onChangeText={(t) => setUsername(t.replace(/\s+/g, '').toLowerCase())}
                placeholder="e.g. vijay_07"
                placeholderTextColor={colors.text.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username-new"
                textContentType="username"
                maxLength={20}
                style={styles.input}
              />
            </Field>
            <Text
              style={[
                styles.hint,
                check.state === 'ok' && styles.okText,
                check.state === 'bad' && styles.badText,
              ]}
            >
              {check.message ??
                'Shown to others (e.g. in Product Finder Live). Different from your name.'}
            </Text>

            <Field
              label="Password"
              icon="lock-closed-outline"
              trailing={
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.muted}
                  />
                </Pressable>
              }
            >
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="At least 8 characters"
                placeholderTextColor={colors.text.placeholder}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="password-new"
                textContentType="newPassword"
                maxLength={72}
                style={styles.input}
              />
            </Field>
            <View style={styles.rules}>
              <Rule ok={password.length >= 8} text="8+ characters" />
              <Rule ok={/[a-z]/i.test(password)} text="A letter" />
              <Rule ok={/\d/.test(password)} text="A number" />
            </View>

            <Field label="Mobile number (required)" icon="call-outline" prefix="+91">
              <TextInput
                value={mobile}
                onChangeText={(t) => setMobile(t.replace(/\D/g, '').slice(-10))}
                placeholder="10-digit mobile number"
                placeholderTextColor={colors.text.placeholder}
                keyboardType="number-pad"
                autoComplete="tel"
                textContentType="telephoneNumber"
                maxLength={10}
                style={styles.input}
              />
            </Field>
            <Text style={styles.hint}>We&apos;ll send an OTP to verify it&apos;s yours.</Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.button, (!ready || busy) && styles.buttonDisabled]}
              onPress={sendOtp}
              disabled={!ready || busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Send OTP</Text>
              )}
            </Pressable>
          </Animated.View>
        ) : (
          <Animated.View
            entering={FadeInDown.duration(250).reduceMotion(ReduceMotion.Never)}
            style={styles.form}
          >
            <View style={styles.summary}>
              <Ionicons name="person-circle" size={34} color={colors.brand.DEFAULT} />
              <View style={{ flex: 1 }}>
                <Text style={styles.summaryName}>@{uname}</Text>
                <Text style={styles.summaryText}>OTP sent to +91 {mobile}</Text>
              </View>
              <Pressable onPress={() => setStep('details')} hitSlop={8}>
                <Text style={styles.link}>Edit</Text>
              </Pressable>
            </View>
            <Text style={styles.label}>Enter the {OTP_LENGTH}-digit OTP</Text>
            <TextInput
              value={code}
              onChangeText={onCode}
              keyboardType="number-pad"
              autoComplete="sms-otp"
              textContentType="oneTimeCode"
              maxLength={OTP_LENGTH}
              autoFocus
              placeholder={'•'.repeat(OTP_LENGTH)}
              placeholderTextColor={colors.text.placeholder}
              style={styles.otp}
              editable={!busy}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {busy ? <ActivityIndicator color={colors.brand.DEFAULT} /> : null}
            <Pressable
              onPress={() => void sendOtp()}
              disabled={seconds > 0 || busy}
              hitSlop={8}
              style={{ alignSelf: 'center' }}
            >
              <Text style={[styles.link, seconds > 0 && { color: colors.text.muted }]}>
                {seconds > 0 ? `Resend OTP in ${seconds}s` : 'Resend OTP'}
              </Text>
            </Pressable>
          </Animated.View>
        )}

        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{ alignSelf: 'center', marginTop: 8 }}
        >
          <Text style={styles.footer}>
            Already have an account? <Text style={styles.link}>Log in</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Step({ n, label, on, done }: { n: number; label: string; on: boolean; done: boolean }) {
  return (
    <View style={styles.step}>
      <View style={[styles.stepDot, (on || done) && styles.stepDotOn]}>
        {done ? (
          <Ionicons name="checkmark" size={13} color={colors.white} />
        ) : (
          <Text style={[styles.stepNum, on && { color: colors.white }]}>{n}</Text>
        )}
      </View>
      <Text style={[styles.stepLabel, on && styles.stepLabelOn]}>{label}</Text>
    </View>
  );
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return (
    <View style={styles.rule}>
      <Ionicons
        name={ok ? 'checkmark-circle' : 'ellipse-outline'}
        size={14}
        color={ok ? '#059669' : colors.text.muted}
      />
      <Text style={[styles.ruleText, ok && { color: '#047857' }]}>{text}</Text>
    </View>
  );
}

function Field({
  label,
  icon,
  prefix,
  tone,
  trailing,
  children,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  prefix?: string;
  tone?: 'ok' | 'bad';
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.field,
          tone === 'ok' && { borderColor: '#10b981' },
          tone === 'bad' && { borderColor: colors.price.discount },
        ]}
      >
        <Ionicons name={icon} size={18} color={colors.text.placeholder} />
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        {children}
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.xl, gap: space.md, paddingBottom: 48 },
  hero: { alignItems: 'center', gap: 8, paddingTop: space.md },
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
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.text.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  steps: { flexDirection: 'row', alignItems: 'center', gap: 8, marginVertical: 4 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#e3e9f3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotOn: { backgroundColor: colors.brand.DEFAULT },
  stepNum: { fontFamily: font.uiBold, fontSize: 11.5, color: colors.text.muted },
  stepLabel: { fontFamily: font.uiMedium, fontSize: 13, color: colors.text.muted },
  stepLabelOn: { fontFamily: font.uiBold, color: colors.heading },
  stepLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: '#e3e9f3' },
  form: { gap: space.md },
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
  prefix: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.heading },
  input: { flex: 1, fontFamily: font.body, fontSize: 16, color: colors.text.input },
  hint: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted, marginTop: -6 },
  okText: { color: '#047857', fontFamily: font.uiMedium },
  badText: { color: colors.price.discount, fontFamily: font.uiMedium },
  rules: { flexDirection: 'row', gap: 14, marginTop: -6 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ruleText: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.muted },
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
  buttonText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#eef4ff',
    borderRadius: 14,
    padding: 12,
  },
  summaryName: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading },
  summaryText: { fontFamily: font.body, fontSize: 12.5, color: colors.text.body },
  otp: {
    height: 58,
    borderWidth: 1.5,
    borderColor: colors.brand.accent,
    borderRadius: radii.button,
    backgroundColor: colors.white,
    textAlign: 'center',
    fontFamily: font.uiBold,
    fontSize: 24,
    letterSpacing: 10,
    color: colors.heading,
  },
  link: { fontFamily: font.uiBold, fontSize: 13.5, color: colors.brand.DEFAULT },
  footer: { fontFamily: font.body, fontSize: 13.5, color: colors.text.body },
});
