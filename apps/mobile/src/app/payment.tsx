import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { formatMoney, type PayOrderResult } from '@youmart/shared-client';
import { api } from '@/lib/api';
import {
  parseRazorpayMessage,
  razorpayCheckoutHtml,
  razorpayPrefill,
  type RazorpaySuccess,
} from '@/lib/razorpay';
import { useSession } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

// Payment (W9): YouMart Wallet first when the customer chose it, Razorpay (in a WebView) for any
// rest. When the wallet covers the whole order the backend confirms it at once - no Razorpay step.
// Otherwise CONFIRMATION is authoritative via the server WEBHOOK: after the widget closes we POLL
// GET /api/orders/:id until CONFIRMED (we never trust the client callback alone).
type Phase = 'creating' | 'paying' | 'verifying' | 'failed';

export default function PaymentScreen() {
  const router = useRouter();
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;
  const { orderId, useWallet } = useLocalSearchParams<{ orderId: string; useWallet?: string }>();
  const id = String(orderId ?? '');
  const withWallet = useWallet === '1';

  const [phase, setPhase] = useState<Phase>('creating');
  const [html, setHtml] = useState<string | null>(null);
  const [pay, setPay] = useState<PayOrderResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);

  const done = useCallback(
    () => router.replace({ pathname: '/order-success', params: { orderId: id } }),
    [router, id],
  );

  // 1. Pay: wallet first (optional), then a Razorpay order for whatever is left.
  useEffect(() => {
    let active = true;
    api.payments
      .pay(id, withWallet)
      .then((result) => {
        if (!active) return;
        setPay(result);
        if (result.status === 'PAID' || !result.razorpay) {
          done();
          return;
        }
        setHtml(
          razorpayCheckoutHtml({
            keyId: result.razorpay.razorpayKeyId,
            razorpayOrderId: result.razorpay.razorpayOrderId,
            amount: result.razorpay.amount,
            currency: result.razorpay.currency,
            description: 'Order payment',
            prefill: user ? razorpayPrefill(user) : undefined,
          }),
        );
        setPhase('paying');
      })
      .catch(() => {
        if (!active) return;
        setError('Could not start payment. Please try again from My Orders.');
        setPhase('failed');
      });
    return () => {
      active = false;
    };
  }, [id, withWallet, done, user]);

  // 3. Poll the order until the WEBHOOK confirms it (server-authoritative).
  const pollConfirmation = useCallback(
    async (proof: RazorpaySuccess | null) => {
      if (polling.current) return;
      polling.current = true;
      setPhase('verifying');
      // Confirm with the server straight away (signature + Razorpay check); the webhook is the
      // backup, so polling below still covers a failed or PENDING verify.
      if (proof) {
        const verified = await api.payments.verify(proof).catch(() => null);
        if (verified?.status === 'PAID') {
          polling.current = false;
          done();
          return;
        }
      }
      for (let i = 0; i < 20; i += 1) {
        try {
          const o = await api.orders.get(id);
          if (o.status === 'CONFIRMED') {
            polling.current = false;
            done();
            return;
          }
          if (o.status === 'CANCELLED') break;
        } catch {
          /* keep polling */
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
      polling.current = false;
      setError('Payment is taking longer than expected. Check "My Orders" in a moment.');
      setPhase('failed');
    },
    [id, done],
  );

  // 2. Razorpay widget result (we still confirm via the webhook poll, not this callback).
  const onMessage = (e: WebViewMessageEvent) => {
    const msg = parseRazorpayMessage(e.nativeEvent.data);
    if (msg?.type === 'success') void pollConfirmation(msg.payment);
    else if (msg?.type === 'failed') {
      setError('The payment failed. Your order is saved - you can retry from My Orders.');
      setPhase('failed');
    } else if (msg?.type === 'dismiss') {
      setError('Payment cancelled. Your order is saved - you can retry from My Orders.');
      setPhase('failed');
    }
  };

  if (phase === 'paying' && html) {
    return (
      <View style={styles.web}>
        {pay && pay.walletAmount !== '0.00' ? (
          <View style={styles.splitBar}>
            <Ionicons name="wallet-outline" size={16} color={colors.brand.DEFAULT} />
            <Text style={styles.splitText}>
              {formatMoney(pay.walletAmount)} from your wallet · pay {formatMoney(pay.onlineAmount)}{' '}
              now
            </Text>
          </View>
        ) : null}
        <WebView
          originWhitelist={['*']}
          source={{ html, baseUrl: 'https://checkout.razorpay.com' }}
          onMessage={onMessage}
          javaScriptEnabled
          startInLoadingState
          style={styles.web}
        />
      </View>
    );
  }

  return (
    <View style={styles.center}>
      {phase === 'failed' ? (
        <>
          <Ionicons name="alert-circle-outline" size={56} color={colors.cart.danger} />
          <Text style={styles.msg}>{error}</Text>
          {pay && pay.walletAmount !== '0.00' ? (
            <Text style={styles.note}>
              {formatMoney(pay.walletAmount)} of your wallet balance stays reserved for this order
              and is returned automatically if the order isn&apos;t paid within 30 minutes.
            </Text>
          ) : null}
          <Pressable style={styles.btn} onPress={() => router.replace(`/orders/${id}`)}>
            <Text style={styles.btnText}>View order</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
          <Text style={styles.msg}>
            {phase === 'creating' ? 'Preparing secure payment…' : 'Confirming your payment…'}
          </Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: colors.page },
  splitBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brandPopup.bg,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  splitText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  center: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xl,
  },
  msg: { fontFamily: font.uiMedium, fontSize: 15, color: colors.text.strong, textAlign: 'center' },
  note: { fontFamily: font.body, fontSize: 13, color: colors.text.body, textAlign: 'center' },
  btn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  btnText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
