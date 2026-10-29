import { useEffect, useState } from 'react';
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
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  ApiError,
  formatMoney,
  orderStatusLabel,
  type HelpTicket,
  type HelpTopic,
  type OrderListItem,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

const TOPICS: { topic: HelpTopic; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { topic: 'ORDER_STATUS', label: 'Where is my order?', icon: 'cube-outline' },
  { topic: 'CANCELLATION', label: 'Cancel my order', icon: 'close-circle-outline' },
  { topic: 'RETURN_REFUND', label: 'Return / refund', icon: 'return-down-back-outline' },
  { topic: 'DAMAGED_WRONG_ITEM', label: 'Damaged or wrong item', icon: 'alert-circle-outline' },
  { topic: 'PAYMENT_WALLET', label: 'Payment / wallet', icon: 'wallet-outline' },
  { topic: 'ACCOUNT', label: 'My account', icon: 'person-outline' },
  { topic: 'OTHER', label: 'Something else', icon: 'ellipsis-horizontal-circle-outline' },
];

/** W9: "Need help with this order?" - choose the order (optional), the topic, describe it. */
export default function NewHelpRequestScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string }>();
  const [orders, setOrders] = useState<OrderListItem[] | null>(null);
  const [orderId, setOrderId] = useState<string | null>(
    params.orderId ? String(params.orderId) : null,
  );
  const [topic, setTopic] = useState<HelpTopic | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<HelpTicket | null>(null);

  useEffect(() => {
    api.orders
      .list({ limit: 10 })
      .then((p) => setOrders(p.items))
      .catch(() => setOrders([]));
  }, []);

  const submit = async () => {
    if (!topic) {
      setError('Please choose what you need help with.');
      return;
    }
    if (message.trim().length < 10) {
      setError('Please describe the issue in a few words (at least 10 characters).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const ticket = await api.support.createTicket({
        topic,
        message: message.trim(),
        ...(orderId ? { orderId } : {}),
      });
      setSent(ticket);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not send your request. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (sent) {
    return (
      <View style={styles.center}>
        <Ionicons name="checkmark-circle" size={64} color={colors.feature.guarantee} />
        <Text style={styles.doneTitle}>Request sent</Text>
        <Text style={styles.doneText}>
          Your reference is <Text style={styles.ref}>{sent.reference}</Text>. Our team will get back
          to you on your registered phone or email.
        </Text>
        <Pressable style={styles.btn} onPress={() => router.replace('/help')}>
          <Text style={styles.btnText}>View my requests</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.section}>Which order is this about?</Text>
        {!orders ? (
          <ActivityIndicator color={colors.brand.DEFAULT} />
        ) : (
          <View style={styles.orderList}>
            {orders.map((o) => {
              const on = o.orderId === orderId;
              return (
                <Pressable
                  key={o.orderId}
                  style={[styles.order, on && styles.selected]}
                  onPress={() => setOrderId(o.orderId)}
                >
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={colors.brand.DEFAULT}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.orderNo}>#{o.orderNumber}</Text>
                    <Text style={styles.orderMeta}>
                      {orderStatusLabel({ status: o.status, items: [] })} ·{' '}
                      {formatMoney(o.grandTotal)} ·{' '}
                      {new Date(o.createdAt).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              style={[styles.order, orderId === null && styles.selected]}
              onPress={() => setOrderId(null)}
            >
              <Ionicons
                name={orderId === null ? 'radio-button-on' : 'radio-button-off'}
                size={18}
                color={colors.brand.DEFAULT}
              />
              <Text style={styles.orderNo}>Not about a specific order</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.section}>What do you need help with?</Text>
        <View style={styles.topics}>
          {TOPICS.map((t) => {
            const on = t.topic === topic;
            return (
              <Pressable
                key={t.topic}
                style={[styles.topic, on && styles.selected]}
                onPress={() => setTopic(t.topic)}
              >
                <Ionicons
                  name={t.icon}
                  size={18}
                  color={on ? colors.brand.DEFAULT : colors.text.body}
                />
                <Text style={[styles.topicText, on && styles.topicTextOn]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Tell us more</Text>
        <TextInput
          value={message}
          onChangeText={(v) => {
            setMessage(v);
            setError(null);
          }}
          placeholder="Describe the issue - what happened and what you'd like us to do"
          placeholderTextColor={colors.text.placeholder}
          multiline
          maxLength={2000}
          style={styles.input}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.btnWide, busy && styles.disabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.btnText}>Send request</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  center: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    padding: space.xl,
  },
  doneTitle: { fontFamily: font.uiBold, fontSize: 20, color: colors.text.strong },
  doneText: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.body,
    textAlign: 'center',
  },
  ref: { fontFamily: font.uiBold, color: colors.brand.DEFAULT },
  section: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading, marginTop: space.md },
  orderList: { gap: 6 },
  order: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.md,
  },
  selected: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.brandPopup.bg },
  orderNo: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  orderMeta: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  topic: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topicText: { fontFamily: font.uiMedium, fontSize: 13, color: colors.text.body },
  topicTextOn: { color: colors.brand.DEFAULT, fontFamily: font.uiSemibold },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    backgroundColor: colors.white,
    padding: space.md,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text.input,
    textAlignVertical: 'top',
  },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  btn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  btnWide: {
    marginTop: space.md,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  btnText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
