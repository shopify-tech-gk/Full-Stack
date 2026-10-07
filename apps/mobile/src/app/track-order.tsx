import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  ApiError,
  TRACKING_STEPS,
  toE164Phone,
  trackingProgress,
  type GuestTrackingView,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

// Public guest order tracking: orderNumber + phone (both must match; non-enumerable).
export default function TrackOrderScreen() {
  const [orderNumber, setOrderNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GuestTrackingView | null>(null);

  const track = async () => {
    setError(null);
    const e164 = toE164Phone(phone);
    if (!orderNumber.trim() || !e164) {
      setError('Enter your order number and the phone number used for the order.');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      setResult(await api.orders.track(orderNumber.trim(), e164));
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 404
          ? 'No order found for that number and phone.'
          : 'Could not track the order. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Order number</Text>
        <TextInput
          value={orderNumber}
          onChangeText={setOrderNumber}
          placeholder="e.g. YM-2026-000123"
          placeholderTextColor={colors.text.placeholder}
          autoCapitalize="characters"
          style={styles.input}
        />
        <Text style={styles.label}>Phone number</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="Mobile number on the order"
          placeholderTextColor={colors.text.placeholder}
          keyboardType="phone-pad"
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable style={[styles.button, busy && styles.disabled]} onPress={track} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Track order</Text>
          )}
        </Pressable>

        {result ? (
          <View style={styles.result}>
            <View style={styles.resultHead}>
              <Text style={styles.resultNo}>#{result.orderNumber}</Text>
              <Text style={styles.resultStatus}>{result.status.replace('_', ' ')}</Text>
            </View>
            {(() => {
              const { step, cancelled } = trackingProgress({
                status: result.status,
                items: result.items,
              });
              if (cancelled) return <Text style={styles.cancelled}>This order was cancelled.</Text>;
              return (
                <View style={styles.tracker}>
                  {TRACKING_STEPS.map((lbl, i) => (
                    <View key={lbl} style={styles.step}>
                      <View style={[styles.dot, i <= step && styles.dotDone]}>
                        {i <= step ? (
                          <Ionicons name="checkmark" size={12} color={colors.white} />
                        ) : null}
                      </View>
                      <Text style={[styles.stepLabel, i <= step && styles.stepLabelDone]}>
                        {lbl}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })()}
            {result.items.map((item, i) => (
              <Text key={i} numberOfLines={1} style={styles.item}>
                {item.quantity} × {item.title}
              </Text>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.md },
  label: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
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
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
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
  result: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: space.md,
    marginTop: space.md,
  },
  resultHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  resultNo: { fontFamily: font.uiBold, fontSize: 16, color: colors.heading },
  resultStatus: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  cancelled: { fontFamily: font.uiMedium, fontSize: 14, color: colors.cart.danger },
  tracker: { flexDirection: 'row', justifyContent: 'space-between' },
  step: { alignItems: 'center', gap: 6, flex: 1 },
  dot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.steps.idle,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.feature.guarantee },
  stepLabel: { fontFamily: font.ui, fontSize: 11, color: colors.text.muted, textAlign: 'center' },
  stepLabelDone: { color: colors.text.strong, fontFamily: font.uiSemibold },
  item: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
});
