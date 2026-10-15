import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ApiError,
  formatMoney,
  type AvailableCoupon,
  type CouponQuote,
  type Money,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { atLeast } from '@/components/PlacingOrderOverlay';
import { colors, font, radii, space } from '@/theme';

/**
 * Checkout's "Apply coupon": type a code, or tap one of the running offers (the ones that fit this
 * cart first, with what each saves; the rest say what's missing, e.g. "Add ₹300 more"). The server
 * validates the code against this cart and the customer's own past uses.
 */
export function CouponSheet({
  visible,
  subtotal,
  cartItemIds,
  onClose,
  onApplied,
}: {
  visible: boolean;
  subtotal: Money;
  cartItemIds?: readonly string[];
  onClose: () => void;
  onApplied: (quote: CouponQuote) => void;
}) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [offers, setOffers] = useState<AvailableCoupon[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCode('');
    setError(null);
    setOffers(null);
    api.orders
      .coupons(subtotal)
      .then((r) => setOffers(r.items))
      .catch(() => setOffers([]));
  }, [visible, subtotal]);

  const apply = async (value: string) => {
    const c = value.trim();
    if (!c) return;
    setBusy(c);
    setError(null);
    try {
      // A short "checking" beat so applying reads as a real check, not an instant swap.
      onApplied(await atLeast(api.orders.quoteCoupon(c, cartItemIds), 900));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not apply the coupon. Try again.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Apply coupon</Text>
          <View style={styles.inputRow}>
            <TextInput
              value={code}
              onChangeText={(t) => {
                setCode(t.toUpperCase());
                setError(null);
              }}
              placeholder="Enter coupon code"
              placeholderTextColor={colors.text.placeholder}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.input}
              onSubmitEditing={() => void apply(code)}
              returnKeyType="done"
            />
            <Pressable
              style={[styles.applyBtn, !code.trim() && { opacity: 0.5 }]}
              disabled={!code.trim() || busy !== null}
              onPress={() => void apply(code)}
            >
              {busy === code.trim() && code.trim() ? (
                <ActivityIndicator color={colors.white} size="small" />
              ) : (
                <Text style={styles.applyText}>Apply</Text>
              )}
            </Pressable>
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.section}>Available offers</Text>
          {!offers ? (
            <ActivityIndicator color={colors.brand.DEFAULT} style={{ margin: space.lg }} />
          ) : offers.length === 0 ? (
            <Text style={styles.empty}>No offers right now - have a code? Enter it above.</Text>
          ) : (
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: space.sm }}>
              {offers.map((o) => (
                <View key={o.code} style={[styles.offer, !o.applicable && styles.offerOff]}>
                  <View style={styles.offerTop}>
                    <View style={styles.codeChip}>
                      <Ionicons name="pricetag" size={12} color={colors.brand.DEFAULT} />
                      <Text style={styles.codeText}>{o.code}</Text>
                    </View>
                    {o.applicable ? (
                      <Pressable onPress={() => void apply(o.code)} disabled={busy !== null}>
                        {busy === o.code ? (
                          <ActivityIndicator color={colors.brand.DEFAULT} size="small" />
                        ) : (
                          <Text style={styles.offerApply}>APPLY</Text>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.offerTitle}>{o.title}</Text>
                  {o.applicable ? (
                    <Text style={styles.save}>You save {formatMoney(o.discount)}</Text>
                  ) : o.reason ? (
                    <Text style={styles.reason}>{o.reason}</Text>
                  ) : null}
                  {o.description ? <Text style={styles.desc}>{o.description}</Text> : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: colors.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: space.lg,
    paddingTop: space.md,
    gap: space.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.card.border,
  },
  title: { fontFamily: font.uiBold, fontSize: 19, color: colors.heading },
  inputRow: { flexDirection: 'row', gap: space.sm },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    paddingHorizontal: space.md,
    backgroundColor: colors.white,
    fontFamily: font.uiSemibold,
    fontSize: 15,
    letterSpacing: 1,
    color: colors.text.strong,
  },
  applyBtn: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: radii.button,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyText: { fontFamily: font.uiBold, fontSize: 14.5, color: colors.white },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  section: { fontFamily: font.uiBold, fontSize: 14, color: colors.text.strong, marginTop: 4 },
  empty: { fontFamily: font.body, fontSize: 13.5, color: colors.text.body },
  offer: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.brand.DEFAULT,
    padding: space.md,
    gap: 4,
  },
  offerOff: { borderColor: colors.card.border, opacity: 0.75 },
  offerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  codeText: {
    fontFamily: font.uiBold,
    fontSize: 13,
    letterSpacing: 0.8,
    color: colors.brand.DEFAULT,
  },
  offerApply: { fontFamily: font.uiBold, fontSize: 14, color: colors.brand.DEFAULT },
  offerTitle: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  save: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.feature.guarantee },
  reason: { fontFamily: font.uiMedium, fontSize: 12.5, color: '#c47f00' },
  desc: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted },
});
