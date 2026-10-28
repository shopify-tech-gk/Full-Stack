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
import * as Haptics from 'expo-haptics';
import { ApiError } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

// v1.17 Refer & Earn: shown once right after a brand-new account signs up without typing a code -
// "Got a friend's referral code?" with Apply / Skip. (Also possible later under Refer & Earn,
// within the first days.)
export default function ReferralCodeScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const apply = async () => {
    if (code.trim().length < 4) {
      setError("Please enter your friend's code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.auth.applyReferral(code.trim());
      setDone(res.referredBy.name ?? 'your friend');
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not add the code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
      <View style={styles.body}>
        <View style={styles.badge}>
          <Ionicons name={done ? 'checkmark' : 'gift'} size={30} color={colors.white} />
        </View>
        {done ? (
          <>
            <Text style={styles.title}>You&apos;re all set!</Text>
            <Text style={styles.text}>
              You joined with {done}&apos;s code. They&apos;ll earn a reward when you shop.
            </Text>
            <Pressable style={styles.button} onPress={() => router.back()}>
              <Text style={styles.buttonText}>Start shopping</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.title}>Got a friend&apos;s referral code?</Text>
            <Text style={styles.text}>
              Enter it now - your friend earns a reward on your orders. You can skip this.
            </Text>
            <View style={[styles.field, error && styles.fieldError]}>
              <Ionicons name="gift-outline" size={18} color={colors.text.placeholder} />
              <TextInput
                value={code}
                onChangeText={(t) => {
                  setCode(t.toUpperCase().replace(/\s+/g, ''));
                  setError(null);
                }}
                placeholder="e.g. YMAB12CD"
                placeholderTextColor={colors.text.placeholder}
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                maxLength={20}
                style={styles.input}
                onSubmitEditing={() => void apply()}
                returnKeyType="done"
              />
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.button, busy && { opacity: 0.6 }]}
              onPress={() => void apply()}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Apply code</Text>
              )}
            </Pressable>
            <Pressable onPress={() => router.back()} hitSlop={10} style={styles.skip}>
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.xl, gap: space.md, alignItems: 'stretch', paddingTop: space.xxl },
  badge: {
    alignSelf: 'center',
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
    experimental_backgroundImage: 'linear-gradient(140deg, #0142aa 0%, #7c3aed 100%)',
  },
  title: {
    fontFamily: font.uiBold,
    fontSize: 21,
    color: colors.heading,
    textAlign: 'center',
    marginTop: 6,
  },
  text: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text.body,
    textAlign: 'center',
  },
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
    marginTop: space.sm,
  },
  fieldError: { borderColor: colors.price.discount },
  input: {
    flex: 1,
    fontFamily: font.uiBold,
    fontSize: 16,
    letterSpacing: 1.5,
    color: colors.text.input,
  },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  button: {
    marginTop: space.sm,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
  skip: { alignSelf: 'center', paddingVertical: 6 },
  skipText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.muted },
});
