import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ApiError, formatMoney, type AccountDeletionCheck } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { logout } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

/**
 * W9: Privacy & account - policy links and in-app account deletion (Play Store / App Store
 * requirement). Deletion waits for orders in progress; a wallet balance must be explicitly given
 * up (Terms: forfeited on deletion).
 */
export default function PrivacyAccountScreen() {
  const router = useRouter();
  const [check, setCheck] = useState<AccountDeletionCheck | null>(null);
  const [checkError, setCheckError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [forfeit, setForfeit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      api.auth
        .deletionCheck()
        .then((c) => {
          setCheck(c);
          setCheckError(false);
        })
        .catch(() => setCheckError(true));
    }, []),
  );

  const hasBalance = !!check && check.walletBalance !== '0.00';
  const ready = confirmText.trim().toUpperCase() === 'DELETE' && (!hasBalance || forfeit);

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.auth.deleteAccount(hasBalance && forfeit);
      await logout().catch(() => {});
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not delete your account. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.body}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.rows}>
        <Pressable style={styles.row} onPress={() => router.push('/info/privacy-policy')}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.brand.DEFAULT} />
          <Text style={styles.rowText}>Privacy policy</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </Pressable>
        <Pressable style={styles.row} onPress={() => router.push('/info/terms')}>
          <Ionicons name="document-text-outline" size={20} color={colors.brand.DEFAULT} />
          <Text style={styles.rowText}>Terms & conditions</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </Pressable>
        <Pressable
          style={[styles.row, styles.rowLast]}
          onPress={() => router.push('/account/notifications')}
        >
          <Ionicons name="notifications-outline" size={20} color={colors.brand.DEFAULT} />
          <Text style={styles.rowText}>Notification settings</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.text.muted} />
        </Pressable>
      </View>

      <Text style={styles.section}>Delete account</Text>
      <View style={styles.card}>
        <Text style={styles.text}>
          Deleting your account permanently removes your name, mobile number, email, photo, saved
          addresses and browsing history, and signs you out everywhere. Past orders and tax invoices
          are kept without your contact details, as the law requires. This can&apos;t be undone.
        </Text>

        {!check ? (
          checkError ? (
            <Text style={styles.error}>
              Couldn&apos;t check your account. Please try again later.
            </Text>
          ) : (
            <ActivityIndicator color={colors.brand.DEFAULT} />
          )
        ) : check.openOrders > 0 ? (
          <View style={styles.block}>
            <Ionicons name="time-outline" size={18} color={colors.price.discount} />
            <Text style={styles.blockText}>
              You have {check.openOrders} order{check.openOrders === 1 ? '' : 's'} in progress. You
              can delete your account once {check.openOrders === 1 ? 'it is' : 'they are'} delivered
              or cancelled.
            </Text>
          </View>
        ) : check.walletHeld !== '0.00' ? (
          <View style={styles.block}>
            <Ionicons name="time-outline" size={18} color={colors.price.discount} />
            <Text style={styles.blockText}>
              Some wallet money is reserved for an order awaiting payment. Please try again later.
            </Text>
          </View>
        ) : !deleting ? (
          <Pressable style={styles.dangerBtn} onPress={() => setDeleting(true)}>
            <Ionicons name="trash-outline" size={18} color={colors.price.discount} />
            <Text style={styles.dangerText}>Delete my account</Text>
          </Pressable>
        ) : (
          <View style={styles.confirmBox}>
            {hasBalance ? (
              <Pressable style={styles.forfeit} onPress={() => setForfeit((v) => !v)}>
                <Ionicons
                  name={forfeit ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={forfeit ? colors.price.discount : colors.text.muted}
                />
                <Text style={styles.forfeitText}>
                  I understand my YouMart Wallet balance of{' '}
                  <Text style={styles.bold}>{formatMoney(check.walletBalance)}</Text> will be lost
                  and can&apos;t be refunded.
                </Text>
              </Pressable>
            ) : null}
            {hasBalance ? (
              <Pressable onPress={() => router.push('/wallet')}>
                <Text style={styles.link}>Use your wallet balance first</Text>
              </Pressable>
            ) : null}
            <Text style={styles.label}>Type DELETE to confirm</Text>
            <TextInput
              value={confirmText}
              onChangeText={setConfirmText}
              autoCapitalize="characters"
              placeholder="DELETE"
              placeholderTextColor={colors.text.placeholder}
              style={styles.input}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              style={[styles.deleteBtn, (!ready || busy) && styles.disabled]}
              disabled={!ready || busy}
              onPress={remove}
            >
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.deleteText}>Permanently delete account</Text>
              )}
            </Pressable>
            <Pressable onPress={() => setDeleting(false)} disabled={busy}>
              <Text style={styles.cancel}>Keep my account</Text>
            </Pressable>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  rows: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.cart.line,
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, fontFamily: font.uiMedium, fontSize: 14.5, color: colors.text.strong },
  section: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading, marginTop: space.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: space.md,
  },
  text: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: colors.text.body },
  block: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fdecec',
    borderRadius: radii.button,
    padding: space.md,
  },
  blockText: { flex: 1, fontFamily: font.uiMedium, fontSize: 13, color: colors.text.strong },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.price.discount,
    borderRadius: radii.button,
    paddingVertical: 12,
  },
  dangerText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.price.discount },
  confirmBox: { gap: space.sm },
  forfeit: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  forfeitText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.text.strong,
  },
  bold: { fontFamily: font.uiBold },
  link: {
    fontFamily: font.uiSemibold,
    fontSize: 13.5,
    color: colors.brand.DEFAULT,
    marginLeft: 32,
  },
  label: {
    fontFamily: font.uiSemibold,
    fontSize: 13,
    color: colors.text.strong,
    marginTop: space.xs,
  },
  input: {
    borderWidth: 1.5,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    paddingHorizontal: space.md,
    height: 46,
    fontFamily: font.uiSemibold,
    fontSize: 15,
    color: colors.text.input,
    backgroundColor: colors.white,
  },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  deleteBtn: {
    backgroundColor: colors.price.discount,
    borderRadius: radii.button,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  deleteText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  cancel: {
    fontFamily: font.uiSemibold,
    fontSize: 14,
    color: colors.brand.DEFAULT,
    textAlign: 'center',
    paddingVertical: 6,
  },
});
