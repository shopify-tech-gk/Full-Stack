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
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { ApiError, type AuthUser } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { applyUserUpdate } from '@/stores/session';
import { cleanUsername, passwordOk, passwordRules, useUsernameCheck } from '@/lib/username';
import { colors, font, radii, space } from '@/theme';

// v1.18 "Pick your username": a bottom sheet for accounts that signed up with OTP. The username is
// set once (shown to others, e.g. in YouFind Bot); a password is optional here and lets
// them log in with the username too. `reason` says why it's asked (after login / for the room).

const RM = ReduceMotion.Never;
const HERO = 'linear-gradient(135deg, #0142aa 0%, #3b6fe0 55%, #7c3aed 100%)';

export function UsernameSheet({
  visible,
  reason = 'login',
  hasPassword = false,
  onClose,
}: {
  visible: boolean;
  /** 'login': after signing in ("Maybe later"); 'finder': needed to enter the live room. */
  reason?: 'login' | 'finder' | 'account';
  hasPassword?: boolean;
  onClose: (user?: AuthUser) => void;
}) {
  const insets = useSafeAreaInsets();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = useUsernameCheck(username);
  const rules = passwordRules(password);
  const wantsPassword = !hasPassword && password.length > 0;
  const canSave = check.state === 'ok' && (!wantsPassword || passwordOk(password)) && !busy;

  useEffect(() => {
    if (!visible) {
      setUsername('');
      setPassword('');
      setError(null);
    }
  }, [visible]);

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    setError(null);
    try {
      const user = await api.auth.setLogin({
        username: cleanUsername(username),
        ...(wantsPassword ? { password } : {}),
      });
      applyUserUpdate(user);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      onClose(user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const subtitle =
    reason === 'finder'
      ? 'YouFind Bot shows your username with every question you ask.'
      : 'Your username is how other shoppers see you - and you can log in with it too.';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => onClose()}>
      <Pressable style={styles.backdrop} onPress={() => onClose()} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grabber} />

          <View style={styles.hero}>
            <Animated.View
              entering={ZoomIn.springify().damping(12).reduceMotion(RM)}
              style={styles.badge}
            >
              <Ionicons name="at" size={30} color={colors.white} />
            </Animated.View>
            <Text style={styles.title}>Pick your username</Text>
            <Text style={styles.subtitle}>{subtitle}</Text>
          </View>

          <Animated.View entering={FadeInDown.delay(80).duration(260).reduceMotion(RM)}>
            <View
              style={[
                styles.field,
                check.state === 'ok' && styles.fieldOk,
                check.state === 'bad' && styles.fieldBad,
              ]}
            >
              <Text style={styles.at}>@</Text>
              <TextInput
                value={username}
                onChangeText={(t) => {
                  setUsername(cleanUsername(t));
                  setError(null);
                }}
                placeholder="your_username"
                placeholderTextColor={colors.text.placeholder}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="username-new"
                maxLength={20}
                autoFocus
                style={styles.input}
              />
              {check.state === 'checking' ? (
                <ActivityIndicator size="small" color={colors.brand.DEFAULT} />
              ) : check.state === 'ok' ? (
                <Ionicons name="checkmark-circle" size={22} color="#059669" />
              ) : check.state === 'bad' ? (
                <Ionicons name="close-circle" size={22} color={colors.price.discount} />
              ) : null}
            </View>
            <Text
              style={[
                styles.hint,
                check.state === 'ok' && styles.ok,
                check.state === 'bad' && styles.bad,
              ]}
            >
              {check.message ?? 'Letters, numbers, _ or . - it can’t be changed later.'}
            </Text>
          </Animated.View>

          {!hasPassword ? (
            <Animated.View entering={FadeInDown.delay(140).duration(260).reduceMotion(RM)}>
              <Text style={styles.label}>
                Password <Text style={styles.optional}>(optional)</Text>
              </Text>
              <View style={styles.field}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.text.placeholder} />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder="To log in with your username"
                  placeholderTextColor={colors.text.placeholder}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="password-new"
                  maxLength={72}
                  style={styles.input}
                />
                <Pressable onPress={() => setShowPassword((s) => !s)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.text.muted}
                  />
                </Pressable>
              </View>
              {password.length > 0 ? (
                <View style={styles.rules}>
                  <Rule ok={rules.length} text="8+ characters" />
                  <Rule ok={rules.letter} text="A letter" />
                  <Rule ok={rules.number} text="A number" />
                </View>
              ) : (
                <Text style={styles.hint}>Skip it to keep logging in with OTP only.</Text>
              )}
            </Animated.View>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={save}
            disabled={!canSave}
            style={({ pressed }) => [
              styles.save,
              !canSave && styles.saveOff,
              pressed && { opacity: 0.9 },
            ]}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={19} color={colors.white} />
                <Text style={styles.saveText}>Save username</Text>
              </>
            )}
          </Pressable>
          <Pressable onPress={() => onClose()} hitSlop={8} style={styles.later}>
            <Text style={styles.laterText}>{reason === 'finder' ? 'Not now' : 'Maybe later'}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
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

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(7,21,48,0.5)' },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: space.xl,
    paddingTop: space.md,
    gap: space.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#dfe4ec',
  },
  hero: { alignItems: 'center', gap: 6, paddingTop: 4 },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: HERO,
    shadowColor: '#3b6fe0',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  title: { fontFamily: font.uiBold, fontSize: 21, color: colors.heading, marginTop: 6 },
  subtitle: {
    fontFamily: font.body,
    fontSize: 13.5,
    lineHeight: 19,
    color: colors.text.body,
    textAlign: 'center',
    maxWidth: 320,
  },
  label: {
    fontFamily: font.uiSemibold,
    fontSize: 13.5,
    color: colors.text.strong,
    marginBottom: 6,
  },
  optional: { fontFamily: font.body, color: colors.text.muted },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.brand.accent,
    borderRadius: radii.button,
    paddingHorizontal: space.lg,
    height: 54,
    backgroundColor: '#fbfcff',
  },
  fieldOk: { borderColor: '#10b981', backgroundColor: '#f3fdf8' },
  fieldBad: { borderColor: colors.price.discount },
  at: { fontFamily: font.uiBold, fontSize: 19, color: colors.brand.DEFAULT },
  input: { flex: 1, fontFamily: font.uiMedium, fontSize: 16.5, color: colors.text.input },
  hint: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted, marginTop: 6 },
  ok: { color: '#047857', fontFamily: font.uiMedium },
  bad: { color: colors.price.discount, fontFamily: font.uiMedium },
  rules: { flexDirection: 'row', gap: 14, marginTop: 8 },
  rule: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ruleText: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.muted },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  save: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 52,
    borderRadius: radii.button,
    experimental_backgroundImage: HERO,
  },
  saveOff: { opacity: 0.45 },
  saveText: { fontFamily: font.uiBold, fontSize: 16, color: colors.white },
  later: { alignSelf: 'center', paddingVertical: 2 },
  laterText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.muted },
});
