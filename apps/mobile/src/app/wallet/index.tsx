import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { formatMoney, type WalletSummary, type WalletTransaction } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

const TYPE_ICON: Record<WalletTransaction['type'], keyof typeof Ionicons.glyphMap> = {
  TOPUP: 'add-circle',
  REFUND: 'return-down-back',
  ORDER_PAYMENT: 'bag-handle',
  FORFEIT: 'remove-circle',
  REFERRAL_REWARD: 'gift',
};

function when(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso));
}

/** W9: YouMart Wallet - balance, add money, and every credit/debit (refunds land here). */
export default function WalletScreen() {
  const router = useRouter();
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [items, setItems] = useState<WalletTransaction[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const [w, page] = await Promise.all([api.wallet.get(), api.wallet.transactions()]);
      setWallet(w);
      setItems(page.items);
      setCursor(page.nextCursor);
      setError(false);
    } catch {
      setError(true);
      setItems((cur) => cur ?? []);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const more = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await api.wallet.transactions({ cursor });
      setItems((cur) => [...(cur ?? []), ...page.items]);
      setCursor(page.nextCursor);
    } finally {
      setLoadingMore(false);
    }
  };

  if (!items) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.body}
      data={items}
      keyExtractor={(t) => t.id}
      onEndReached={more}
      onEndReachedThreshold={0.6}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={colors.brand.DEFAULT}
        />
      }
      ListHeaderComponent={
        <View style={styles.headerWrap}>
          <View style={styles.balanceCard}>
            <View style={styles.balanceTop}>
              <Ionicons name="wallet" size={22} color={colors.white} />
              <Text style={styles.balanceLabel}>YouMart Wallet</Text>
            </View>
            <Text style={styles.balance}>{wallet ? formatMoney(wallet.balance) : '—'}</Text>
            {wallet && wallet.held !== '0.00' ? (
              <Text style={styles.held}>
                {formatMoney(wallet.held)} reserved for an order awaiting payment ·{' '}
                {formatMoney(wallet.available)} available
              </Text>
            ) : (
              <Text style={styles.held}>
                Use it at checkout - on its own or with another method.
              </Text>
            )}
            <Pressable style={styles.addBtn} onPress={() => router.push('/wallet/add')}>
              <Ionicons name="add" size={18} color={colors.brand.DEFAULT} />
              <Text style={styles.addText}>Add money</Text>
            </Pressable>
          </View>

          <View style={styles.infoCard}>
            <Ionicons name="information-circle-outline" size={18} color={colors.brand.DEFAULT} />
            <Text style={styles.infoText}>
              Refunds for cancelled and returned orders are added here instantly. Wallet balance is
              store credit for shopping on YouMart and can&apos;t be withdrawn as cash.
            </Text>
          </View>

          {error ? (
            <Text style={styles.error}>Couldn&apos;t load your wallet. Pull to retry.</Text>
          ) : null}
          <Text style={styles.section}>History</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Ionicons name="receipt-outline" size={44} color={colors.card.border} />
          <Text style={styles.emptyText}>No wallet activity yet.</Text>
        </View>
      }
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator color={colors.brand.DEFAULT} style={{ margin: space.lg }} />
        ) : undefined
      }
      renderItem={({ item }) => {
        const credit = item.direction === 'CREDIT';
        return (
          <Pressable
            style={styles.txn}
            disabled={!item.orderId}
            onPress={() => item.orderId && router.push(`/orders/${item.orderId}`)}
          >
            <View style={[styles.txnIcon, credit ? styles.txnIconIn : styles.txnIconOut]}>
              <Ionicons
                name={TYPE_ICON[item.type]}
                size={18}
                color={credit ? colors.feature.guarantee : colors.price.discount}
              />
            </View>
            <View style={styles.txnBody}>
              <Text style={styles.txnTitle} numberOfLines={2}>
                {item.description}
              </Text>
              <Text style={styles.txnWhen}>{when(item.createdAt)}</Text>
            </View>
            <View style={styles.txnRight}>
              <Text style={[styles.txnAmount, credit ? styles.in : styles.out]}>
                {credit ? '+ ' : '− '}
                {formatMoney(item.amount)}
              </Text>
              <Text style={styles.txnAfter}>Bal {formatMoney(item.balanceAfter)}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.sm, paddingBottom: space.xxl },
  headerWrap: { gap: space.md, marginBottom: space.xs },
  balanceCard: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.tile + 6,
    padding: space.lg,
    gap: 6,
  },
  balanceTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  balanceLabel: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.white },
  balance: { fontFamily: font.uiBold, fontSize: 32, color: colors.white, marginTop: 4 },
  held: { fontFamily: font.body, fontSize: 12.5, color: '#dbe7ff' },
  addBtn: {
    marginTop: space.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  addText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
  infoCard: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.tile,
    padding: space.md,
  },
  infoText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.body,
  },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  section: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading, marginTop: space.xs },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxl },
  emptyText: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  txn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.md,
  },
  txnIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txnIconIn: { backgroundColor: '#e7f6ee' },
  txnIconOut: { backgroundColor: '#fdecec' },
  txnBody: { flex: 1, gap: 2 },
  txnTitle: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  txnWhen: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  txnRight: { alignItems: 'flex-end', gap: 2 },
  txnAmount: { fontFamily: font.uiBold, fontSize: 14 },
  in: { color: colors.feature.guarantee },
  out: { color: colors.price.discount },
  txnAfter: { fontFamily: font.body, fontSize: 11.5, color: colors.text.muted },
});
