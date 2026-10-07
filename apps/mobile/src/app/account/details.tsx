import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { authUserLabel, formatPhone } from '@youmart/shared-client';
import { updateProfileName, useSession } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

export default function AccountDetailsScreen() {
  const router = useRouter();
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const [name, setName] = useState(user?.name ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Please sign in.</Text>
      </View>
    );
  }

  const save = async () => {
    if (name.trim().length < 1) {
      setError('Please enter your name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateProfileName(name.trim());
      setSaved(true);
      setTimeout(() => router.back(), 600);
    } catch {
      setError('Could not save. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.body}>
        <View style={styles.readonly}>
          <Text style={styles.roLabel}>Signed in as</Text>
          <Text style={styles.roValue}>{authUserLabel(user)}</Text>
          {user.phone ? <Text style={styles.roSub}>{formatPhone(user.phone)}</Text> : null}
          {user.email ? <Text style={styles.roSub}>{user.email}</Text> : null}
        </View>

        <Text style={styles.label}>Display name</Text>
        <TextInput
          value={name}
          onChangeText={(t) => {
            setName(t);
            setError(null);
            setSaved(false);
          }}
          placeholder="Your name"
          placeholderTextColor={colors.text.placeholder}
          style={styles.input}
          autoCapitalize="words"
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {saved ? <Text style={styles.okMsg}>Saved ✓</Text> : null}

        <Pressable style={[styles.button, busy && styles.disabled]} onPress={save} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Save</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  muted: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  body: { padding: space.lg, gap: space.md },
  readonly: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: 2,
  },
  roLabel: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  roValue: { fontFamily: font.uiBold, fontSize: 17, color: colors.text.strong },
  roSub: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
  label: {
    fontFamily: font.uiSemibold,
    fontSize: 13,
    color: colors.text.strong,
    marginTop: space.sm,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    paddingHorizontal: space.md,
    height: 48,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text.input,
    backgroundColor: colors.white,
  },
  error: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.price.discount },
  okMsg: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.feature.guarantee },
  button: {
    marginTop: space.sm,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
});
