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
import { Ionicons } from '@expo/vector-icons';
import { ContactChangeSheet } from '@/components/ContactChangeSheet';
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
  const [change, setChange] = useState<'PHONE' | 'EMAIL' | null>(null);
  const [contactSaved, setContactSaved] = useState<string | null>(null);

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
        </View>

        {/* v1.12: change / add the login phone or email - verified with a code to the new value. */}
        <View style={styles.contactCard}>
          {(['PHONE', 'EMAIL'] as const).map((kind, i) => {
            const value =
              kind === 'PHONE' ? (user.phone ? formatPhone(user.phone) : null) : user.email;
            const verified = kind === 'PHONE' ? user.isPhoneVerified : user.isEmailVerified;
            return (
              <View key={kind} style={[styles.contactRow, i > 0 && styles.contactDivider]}>
                <Ionicons
                  name={kind === 'PHONE' ? 'call-outline' : 'mail-outline'}
                  size={20}
                  color={colors.brand.DEFAULT}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.roLabel}>{kind === 'PHONE' ? 'Mobile number' : 'Email'}</Text>
                  <Text style={value ? styles.contactValue : styles.contactEmpty}>
                    {value ?? 'Not added'}
                    {value && verified ? '  ✓' : ''}
                  </Text>
                </View>
                <Pressable onPress={() => setChange(kind)} hitSlop={8}>
                  <Text style={styles.changeText}>{value ? 'Change' : 'Add'}</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
        {contactSaved ? <Text style={styles.okMsg}>{contactSaved}</Text> : null}

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
      <ContactChangeSheet
        kind={change ?? 'PHONE'}
        visible={change !== null}
        onClose={(updated) => {
          if (updated) {
            setContactSaved(change === 'PHONE' ? 'Mobile number updated ✓' : 'Email updated ✓');
          }
          setChange(null);
        }}
      />
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
  contactCard: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  contactDivider: { borderTopWidth: 1, borderTopColor: colors.card.border },
  contactValue: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.text.strong },
  contactEmpty: { fontFamily: font.body, fontSize: 14, color: colors.text.muted },
  changeText: { fontFamily: font.uiBold, fontSize: 14, color: colors.brand.DEFAULT },
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
