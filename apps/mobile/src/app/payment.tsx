import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { formatMoney, type OrderView } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

// Razorpay payment, Expo-Go compatible via a WebView running Razorpay Checkout (checkout.js).
// The app never sees the secret — only the public key id + razorpay order id from the backend.
// CONFIRMATION is authoritative via the server WEBHOOK: after the widget closes we POLL
// GET /api/orders/:id until CONFIRMED (we never trust the client callback alone).
type Phase = 'creating' | 'paying' | 'verifying' | 'confirmed' | 'failed';

function checkoutHtml(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
}): string {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1" />
<script src="https://checkout.razorpay.com/v1/checkout.js"></script></head>
<body style="margin:0;background:#dcf0fa;font-family:sans-serif">
<script>
  function post(m){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(m)); }
  var opened=false;
  function open(){
    if(opened) return; opened=true;
    var rzp = new Razorpay({
      key: ${JSON.stringify(opts.keyId)},
      order_id: ${JSON.stringify(opts.orderId)},
      amount: ${opts.amount},
      currency: ${JSON.stringify(opts.currency)},
      name: 'YouMart',
      description: 'Order payment',
      theme: { color: '#0142aa' },
      handler: function(r){ post({ type: 'success', payment: r }); },
      modal: { ondismiss: function(){ post({ type: 'dismiss' }); }, escape: true }
    });
    rzp.on('payment.failed', function(r){ post({ type: 'failed', error: r.error }); });
    rzp.open();
  }
  if (window.Razorpay) open(); else window.onload = open;
</script></body></html>`;
}

export default function PaymentScreen() {
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const id = String(orderId ?? '');

  const [phase, setPhase] = useState<Phase>('creating');
  const [html, setHtml] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const polling = useRef(false);

  // 1. Create the Razorpay order on the backend (gets key id + rzp order id + amount in paise).
  useEffect(() => {
    let active = true;
    api.payments
      .createRazorpayOrder(id)
      .then((rz) => {
        if (!active) return;
        setHtml(
          checkoutHtml({
            keyId: rz.razorpayKeyId,
            orderId: rz.razorpayOrderId,
            amount: rz.amount,
            currency: rz.currency,
          }),
        );
        setPhase('paying');
      })
      .catch(
        () =>
          active && (setError('Could not start payment. Please try again.'), setPhase('failed')),
      );
    return () => {
      active = false;
    };
  }, [id]);

  // 3. Poll the order until the WEBHOOK confirms it (server-authoritative).
  const pollConfirmation = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    setPhase('verifying');
    for (let i = 0; i < 20; i += 1) {
      try {
        const o = await api.orders.get(id);
        if (o.status === 'CONFIRMED') {
          setOrder(o);
          setPhase('confirmed');
          polling.current = false;
          router.replace({ pathname: '/order-success', params: { orderId: id } });
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
  }, [id, router]);

  // 2. Razorpay widget result (we still confirm via the webhook poll, not this callback).
  const onMessage = (e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data) as { type: string };
      if (msg.type === 'success') void pollConfirmation();
      else if (msg.type === 'failed') {
        setError('The payment failed. Your order is saved — you can retry from My Orders.');
        setPhase('failed');
      } else if (msg.type === 'dismiss') {
        setError('Payment cancelled. Your order is saved — you can retry from My Orders.');
        setPhase('failed');
      }
    } catch {
      /* ignore malformed */
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
        style={styles.web}
      />
    );
  }

  return (
    <View style={styles.center}>
      {phase === 'failed' ? (
        <>
          <Ionicons name="alert-circle-outline" size={56} color={colors.cart.danger} />
          <Text style={styles.msg}>{error}</Text>
          <Pressable style={styles.btn} onPress={() => router.replace('/orders')}>
            <Text style={styles.btnText}>Go to My Orders</Text>
          </Pressable>
        </>
      ) : (
        <>
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
          <Text style={styles.msg}>
            {phase === 'creating' ? 'Preparing secure payment…' : 'Confirming your payment…'}
          </Text>
          {order ? <Text style={styles.amount}>{formatMoney(order.grandTotal)}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  web: { flex: 1, backgroundColor: colors.page },
  center: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.lg,
    padding: space.xl,
  },
  msg: { fontFamily: font.uiMedium, fontSize: 15, color: colors.text.strong, textAlign: 'center' },
  amount: { fontFamily: font.uiBold, fontSize: 20, color: colors.brand.DEFAULT },
  btn: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  btnText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
