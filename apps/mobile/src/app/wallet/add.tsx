import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { formatMoney, type WalletSummary } from '@youmart/shared-client';
import { ApiError } from '@youmart/shared-client';
import { api } from '@/lib/api';
import {
  parseRazorpayMessage,
  razorpayCheckoutHtml,
  razorpayPrefill,
  type RazorpaySuccess,
} from '@/lib/razorpay';
import { useSession } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

const QUICK = ['100', '500', '1000', '2000'];

type Phase = 'form' | 'paying' | 'verifying' | 'done' | 'failed';

/** "500" / "499.5" -> "499.50"; null when not a positive amount with at most 2 decimals. */
function toAmount(input: string): string | null {
  const clean = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const value = Number(clean);
  return value > 0 ? value.toFixed(2) : null;
}

/** W9: add money to the YouMart Wallet through Razorpay; the webhook credits it (we poll). */
export default function AddMoneyScreen() {
  const router = useRouter();
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('form');
  const [html, setHtml] = useState<string | null>(null);
  const [topupId, setTopupId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const polling = useRef(false);

  useEffect(() => {
    api.wallet
      .get()
      .then(setWallet)
      .catch(() => setWallet(null));
  }, []);

  const amount = toAmount(input);
  const limits = wallet?.topupLimits;

  const start = async () => {
    if (!amount) {
      setError('Enter an amount.');
      return;
    }
    if (limits && (Number(amount) < Number(limits.min) || Number(amount) > Number(limits.max))) {
      setError(
        `You can add between ${formatMoney(limits.min)} and ${formatMoney(limits.max)} at a time.`,
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const topup = await api.wallet.createTopup(amount);
      setTopupId(topup.topupId);
      setHtml(
        razorpayCheckoutHtml({
          keyId: topup.razorpayKeyId,
          razorpayOrderId: topup.razorpayOrderId,
          amount: topup.amountPaise,
          currency: topup.currency,
          description: 'Add money to YouMart Wallet',
          prefill: user ? razorpayPrefill(user) : undefined,
        }),
      );
      setPhase('paying');
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Could not start the payment. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  };

  const poll = useCallback(
    async (proof: RazorpaySuccess | null) => {
      if (!topupId || polling.current) return;
      polling.current = true;
      setPhase('verifying');
      // Confirm with the server straight away; the webhook is the backup (polled below).
      if (proof) {
        const verified = await api.payments.verify(proof).catch(() => null);
        if (verified?.status === 'PAID') {
          polling.current = false;
          setPhase('done');
          return;
        }
      }
      for (let i = 0; i < 20; i += 1) {
        try {
          const t = await api.wallet.getTopup(topupId);
          if (t.status === 'PAID') {
            polling.current = false;
            setPhase('done');
            return;
          }
        } catch {
          /* keep polling */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      polling.current = false;
      setError(
        'Your payment is taking longer than expected. The money will show in your wallet once it is confirmed.',
      );
      setPhase('failed');
    },
    [topupId],
  );

  const onMessage = (e: WebViewMessageEvent) => {
    const msg = parseRazorpayMessage(e.nativeEvent.data);
    if (msg?.type === 'success') void poll(msg.payment);
    else if (msg?.type === 'failed') {
      setError('The payment failed. No money was added.');
      setPhase('failed');
    } else if (msg?.type === 'dismiss') {
      setError('Payment cancelled. No money was added.');
      setPhase('failed');
    }
  };

  if (phase === 'paying' && html) {
    return (
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
        onMessage={onMessage}
        javaScriptEnabled
        startInLoadingState
        style={styles.screen}
      />
    );
  }

  if (phase !== 'form') {
    return (
      <View style={styles.center}>
        {phase === 'verifying' ? (
          <>
            <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
            <Text style={styles.msg}>Confirming your payment…</Text>
          </>
        ) : phase === 'done' ? (
          <>
            <Ionicons name="checkmark-circle" size={64} color={colors.feature.guarantee} />
            <Text style={styles.msg}>
              {amount ? formatMoney(amount) : 'Money'} added to your wallet
            </Text>
            <Pressable style={styles.btn} onPress={() => router.back()}>
              <Text style={styles.btnText}>Back to wallet</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Ionicons name="alert-circle-outline" size={56} color={colors.cart.danger} />
            <Text style={styles.msg}>{error}</Text>
            <Pressable
              style={styles.btn}
              onPress={() => {
                setPhase('form');
                setError(null);
              }}
            >
              <Text style={styles.btnText}>Try again</Text>
            </Pressable>
          </>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Current balance</Text>
        <Text style={styles.balance}>{wallet ? formatMoney(wallet.balance) : '—'}</Text>

        <Text style={[styles.label, { marginTop: space.lg }]}>Amount to add</Text>
        <View style={styles.inputRow}>
          <Text style={styles.rupee}>₹</Text>
          <TextInput
            value={input}
            onChangeText={(t) => {
              setInput(t);
              setError(null);
            }}
            placeholder="0"
            placeholderTextColor={colors.text.placeholder}
            keyboardType="decimal-pad"
            style={styles.input}
            autoFocus
          />
        </View>
        <View style={styles.chips}>
          {QUICK.map((q) => (
            <Pressable
              key={q}
              style={[styles.chip, input === q && styles.chipOn]}
              onPress={() => {
                setInput(q);
                setError(null);
              }}
            >
              <Text style={[styles.chipText, input === q && styles.chipTextOn]}>+ ₹{q}</Text>
            </Pressable>
          ))}
        </View>
        {limits ? (
          <Text style={styles.hint}>
            {formatMoney(limits.min)} – {formatMoney(limits.max)} per top-up · wallet limit{' '}
            {formatMoney(limits.maxBalance)}
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.note}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.text.muted} />
          <Text style={styles.noteText}>
            Paid securely through Razorpay. Wallet money is store credit for YouMart purchases and
            can&apos;t be withdrawn or transferred.
          </Text>
        </View>

        <Pressable
          style={[styles.payBtn, (!amount || busy) && styles.disabled]}
          onPress={start}
          disabled={!amount || busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.payText}>Add {amount ? formatMoney(amount) : 'money'}</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xl,
  },
  msg: {
    fontFamily: font.uiSemibold,
    fontSize: 16,
    color: colors.text.strong,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  btnText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  body: { padding: space.lg, gap: space.sm },
  label: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.muted },
  balance: { fontFamily: font.uiBold, fontSize: 24, color: colors.text.strong },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.brand.DEFAULT,
    paddingBottom: 4,
  },
  rupee: { fontFamily: font.uiBold, fontSize: 30, color: colors.text.strong },
  input: { flex: 1, fontFamily: font.uiBold, fontSize: 30, color: colors.text.strong, padding: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  chipOn: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.brandPopup.bg },
  chipText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.body },
  chipTextOn: { color: colors.brand.DEFAULT },
  hint: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  note: {
    flexDirection: 'row',
    gap: 8,
    marginTop: space.lg,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.md,
  },
  noteText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.body,
  },
  payBtn: {
    marginTop: space.lg,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  payText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
});
