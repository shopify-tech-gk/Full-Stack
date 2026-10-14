import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import type { LoggedInDevice } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, space } from '@/theme';

function lastActive(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 2) return 'Active now';
  if (mins < 60) return `Active ${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Active ${hours} h ago`;
  return `Active ${new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
}

/** Logged-in devices (WhatsApp-style): every signed-in phone / browser, with sign-out. */
export default function DevicesScreen() {
  const router = useRouter();
  const [items, setItems] = useState<LoggedInDevice[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.auth
      .devices()
      .then((r) => {
        setItems(r.items);
        setError(null);
      })
      .catch(() => setError('Could not load your devices.'));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const signOut = (d: LoggedInDevice) =>
    Alert.alert('Sign out this device?', `${d.label} will need to sign in again.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setBusy(d.deviceId);
          await api.auth.signOutDevice(d.deviceId).catch(() => undefined);
          setBusy(null);
          load();
        },
      },
    ]);

  const signOutOthers = () =>
    Alert.alert(
      'Sign out all other devices?',
      'Every other phone and browser will need to sign in again.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out others',
          style: 'destructive',
          onPress: async () => {
            setBusy('others');
            try {
              await api.auth.signOutOtherDevices();
            } catch {
              setError('Could not sign out other devices. Please try again.');
            }
            setBusy(null);
            load();
          },
        },
      ],
    );

  if (!items) {
    return (
      <View style={styles.center}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
        )}
      </View>
    );
  }

  const others = items.filter((d) => !d.current);

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      <Pressable style={styles.linkCard} onPress={() => router.push('/scan')}>
        <View style={styles.linkIcon}>
          <Ionicons name="qr-code" size={22} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.linkTitle}>Sign in on a computer</Text>
          <Text style={styles.linkSub}>
            Open youmart.in → Login → Scan QR code, then scan it here.
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.brand.DEFAULT} />
      </Pressable>

      <Text style={styles.section}>Signed-in devices</Text>
      <View style={styles.card}>
        {items.map((d, i) => (
          <View key={d.deviceId} style={[styles.row, i < items.length - 1 && styles.rowBorder]}>
            <View style={[styles.icon, d.current && styles.iconCurrent]}>
              <Ionicons
                name={d.kind === 'APP' ? 'phone-portrait-outline' : 'desktop-outline'}
                size={20}
                color={d.current ? colors.white : colors.brand.DEFAULT}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{d.label}</Text>
              <Text style={[styles.meta, d.current && styles.metaCurrent]}>
                {d.current ? 'This device' : lastActive(d.lastActiveAt)}
              </Text>
            </View>
            {!d.current ? (
              busy === d.deviceId ? (
                <ActivityIndicator color={colors.price.discount} />
              ) : (
                <Pressable onPress={() => signOut(d)} hitSlop={8}>
                  <Text style={styles.signOut}>Sign out</Text>
                </Pressable>
              )
            ) : null}
          </View>
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {others.length > 0 ? (
        <Pressable style={styles.othersBtn} onPress={signOutOthers} disabled={busy === 'others'}>
          {busy === 'others' ? (
            <ActivityIndicator color={colors.price.discount} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={colors.price.discount} />
              <Text style={styles.othersText}>Sign out all other devices</Text>
            </>
          )}
        </Pressable>
      ) : null}

      <Text style={styles.note}>
        Don&apos;t recognise a device? Sign it out, then check your account details.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    padding: space.md,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkTitle: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  linkSub: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.body,
    marginTop: 2,
  },
  section: {
    fontFamily: font.uiBold,
    fontSize: 13,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: space.sm,
    marginLeft: 4,
  },
  card: { backgroundColor: colors.white, borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border.menu },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCurrent: { backgroundColor: colors.feature.guarantee },
  label: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  meta: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted, marginTop: 1 },
  metaCurrent: { color: colors.feature.guarantee, fontFamily: font.uiSemibold },
  signOut: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.price.discount },
  othersBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#f3c4cf',
    backgroundColor: colors.white,
    borderRadius: 18,
    paddingVertical: 14,
  },
  othersText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.price.discount },
  error: {
    fontFamily: font.uiMedium,
    fontSize: 13,
    color: colors.price.discount,
    textAlign: 'center',
  },
  note: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted, textAlign: 'center' },
});
