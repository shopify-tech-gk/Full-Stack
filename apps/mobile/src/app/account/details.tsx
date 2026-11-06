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
import { useRouter } from '@/lib/router';
import { Ionicons } from '@expo/vector-icons';
import { ContactChangeSheet } from '@/components/ContactChangeSheet';
import { UsernameSheet } from '@/components/UsernameSheet';
import { api } from '@/lib/api';
import { passwordOk, passwordRules } from '@/lib/username';
import { ApiError, authUserLabel, formatPhone } from '@youmart/shared-client';
import { applyUserUpdate, updateProfileName, useSession } from '@/stores/session';
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
  // v1.18 username (set once) and a first password for username login.
  const [usernameSheet, setUsernameSheet] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState<string | null>(null);

  if (!user) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Please sign in.</Text>
      </View>
    );
  }

  const savePassword = async () => {
    if (!passwordOk(pw) || pwBusy) return;
    setPwBusy(true);
    setPwMsg(null);
    try {
      applyUserUpdate(await api.auth.setLogin({ password: pw }));
      setPw('');
      setPwOpen(false);
      setPwMsg('Password saved ✓ - you can log in with your username now.');
    } catch (err) {
      setPwMsg(err instanceof ApiError ? err.message : 'Could not save the password.');
    } finally {
      setPwBusy(false);
    }
  };
  const rules = passwordRules(pw);

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
    <KeyboardAvoidingView style={styles.screen} behavior="padding">
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

        {/* v1.18 Username (set once - shown to others) + password for username login */}
        <View style={styles.contactCard}>
          <View style={styles.contactRow}>
            <Ionicons name="at" size={20} color={colors.brand.DEFAULT} />
            <View style={{ flex: 1 }}>
              <Text style={styles.roLabel}>Username</Text>
              <Text style={user.username ? styles.contactValue : styles.contactEmpty}>
                {user.username ? `@${user.username}` : 'Not set'}
              </Text>
            </View>
            {user.username ? (
              <View style={styles.lockPill}>
                <Ionicons name="lock-closed" size={11} color={colors.text.muted} />
                <Text style={styles.lockText}>Permanent</Text>
              </View>
            ) : (
              <Pressable onPress={() => setUsernameSheet(true)} hitSlop={8}>
                <Text style={styles.changeText}>Set</Text>
              </Pressable>
            )}
          </View>
          {user.username ? (
            <View style={[styles.contactRow, styles.contactDivider]}>
              <Ionicons name="key-outline" size={20} color={colors.brand.DEFAULT} />
              <View style={{ flex: 1 }}>
                <Text style={styles.roLabel}>Password</Text>
                <Text style={user.hasPassword ? styles.contactValue : styles.contactEmpty}>
                  {user.hasPassword ? 'Set  ✓' : 'Not set - OTP login only'}
                </Text>
              </View>
              {!user.hasPassword ? (
                <Pressable onPress={() => setPwOpen((o) => !o)} hitSlop={8}>
                  <Text style={styles.changeText}>{pwOpen ? 'Cancel' : 'Add'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
          {pwOpen ? (
            <View style={[styles.pwBox, styles.contactDivider]}>
              <TextInput
                value={pw}
                onChangeText={setPw}
                placeholder="New password (8+ letters & numbers)"
                placeholderTextColor={colors.text.placeholder}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={72}
                style={styles.input}
              />
              <Text style={styles.pwRules}>
                {rules.length ? '✓' : '•'} 8+ characters {rules.letter ? '✓' : '•'} a letter
                {'   '}
                {rules.number ? '✓' : '•'} a number
              </Text>
              <Pressable
                style={[styles.button, (!passwordOk(pw) || pwBusy) && styles.disabled]}
                onPress={savePassword}
                disabled={!passwordOk(pw) || pwBusy}
              >
                {pwBusy ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.buttonText}>Save password</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
        {pwMsg ? <Text style={styles.okMsg}>{pwMsg}</Text> : null}
        {!user.username ? (
          <Text style={styles.muted}>
            Your username is shown in Product Finder Live and lets you log in with a password.
          </Text>
        ) : null}

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
      <UsernameSheet
        visible={usernameSheet}
        reason="account"
        hasPassword={user.hasPassword ?? false}
        onClose={() => setUsernameSheet(false)}
      />
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
  lockPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#f1f4f9',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lockText: { fontFamily: font.uiSemibold, fontSize: 11, color: colors.text.muted },
  pwBox: { padding: space.md, gap: space.sm },
  pwRules: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.muted },
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
