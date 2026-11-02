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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useRouter } from '@/lib/router';
import { formatMoney, type BuyReminder } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { RemindSheet } from '@/components/RemindSheet';
import { REPEAT_LABEL, fromNow, whenLabel } from '@/lib/reminder-time';
import { colors, font, radii, space } from '@/theme';

type Tab = 'upcoming' | 'past';

/** v1.18 "Remind me to buy": the customer's reminders - change, remove, or set one again. */
export default function RemindersScreen() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('upcoming');
  const [items, setItems] = useState<BuyReminder[] | null>(null);
  const [editing, setEditing] = useState<BuyReminder | null>(null);

  const load = useCallback((which: Tab) => {
    setItems(null);
    api.reminders
      .list(which)
      .then((r) => setItems(r.items))
      .catch(() => setItems([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load(tab);
    }, [load, tab]),
  );

  const remove = (r: BuyReminder) =>
    Alert.alert('Remove reminder?', r.title, [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          setItems((cur) => cur?.filter((x) => x.reminderId !== r.reminderId) ?? cur);
          api.reminders.remove(r.reminderId).catch(() => load(tab));
        },
      },
    ]);

  return (
    <View style={styles.screen}>
      <View style={styles.segment}>
        {(['upcoming', 'past'] as const).map((t) => (
          <Pressable
            key={t}
            style={[styles.segBtn, tab === t && styles.segOn]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.segText, tab === t && styles.segTextOn]}>
              {t === 'upcoming' ? 'Upcoming' : 'Sent'}
            </Text>
          </Pressable>
        ))}
      </View>

      {!items ? (
        <ActivityIndicator color={colors.brand.DEFAULT} style={{ marginTop: space.xl }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="alarm-outline" size={34} color={colors.brand.DEFAULT} />
          </View>
          <Text style={styles.emptyTitle}>
            {tab === 'upcoming' ? 'No reminders yet' : 'Nothing sent yet'}
          </Text>
          <Text style={styles.emptyText}>
            On any product, tap "Remind me later" and pick a time - payday, the weekend, or every
            month for refills. We'll WhatsApp you with the price then.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          {items.map((r) => {
            const at = new Date(r.lastSentAt && tab === 'past' ? r.lastSentAt : r.remindAt);
            return (
              <View key={r.reminderId} style={styles.card}>
                <Pressable style={styles.row} onPress={() => router.push(`/product/${r.slug}`)}>
                  <View style={styles.thumb}>
                    {r.imageUrl ? (
                      <Image
                        source={{ uri: r.imageUrl }}
                        style={styles.thumbImg}
                        contentFit="contain"
                      />
                    ) : (
                      <Ionicons name="cube-outline" size={20} color={colors.text.muted} />
                    )}
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.title} numberOfLines={2}>
                      {r.title}
                    </Text>
                    <View style={styles.whenRow}>
                      <Ionicons
                        name={tab === 'upcoming' ? 'alarm' : 'checkmark-done'}
                        size={14}
                        color={colors.brand.DEFAULT}
                      />
                      <Text style={styles.when}>
                        {tab === 'upcoming' ? whenLabel(at) : `Sent ${whenLabel(at)}`}
                      </Text>
                      {tab === 'upcoming' ? <Text style={styles.soon}>{fromNow(at)}</Text> : null}
                    </View>
                    <View style={styles.tags}>
                      {r.repeat !== 'NONE' ? (
                        <View style={styles.tag}>
                          <Ionicons name="repeat" size={12} color={colors.brand.DEFAULT} />
                          <Text style={styles.tagText}>{REPEAT_LABEL[r.repeat]}</Text>
                        </View>
                      ) : null}
                      {r.priceAtSet ? (
                        <Text style={styles.meta}>Set at {formatMoney(r.priceAtSet)}</Text>
                      ) : null}
                    </View>
                    {r.note ? (
                      <Text style={styles.note} numberOfLines={1}>
                        "{r.note}"
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                <View style={styles.actions}>
                  <Pressable style={styles.action} onPress={() => setEditing(r)}>
                    <Ionicons
                      name={tab === 'upcoming' ? 'create-outline' : 'alarm-outline'}
                      size={16}
                      color={colors.brand.DEFAULT}
                    />
                    <Text style={styles.actionText}>
                      {tab === 'upcoming' ? 'Change' : 'Remind me again'}
                    </Text>
                  </Pressable>
                  <Pressable style={styles.action} onPress={() => remove(r)}>
                    <Ionicons name="trash-outline" size={16} color={colors.price.discount} />
                    <Text style={[styles.actionText, { color: colors.price.discount }]}>
                      Remove
                    </Text>
                  </Pressable>
                  <Pressable
                    style={[styles.action, styles.buy]}
                    onPress={() => router.push(`/product/${r.slug}`)}
                  >
                    <Text style={styles.buyText}>Buy now</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {editing ? (
        <RemindSheet
          visible
          product={{
            skuId: editing.skuId ?? '',
            title: editing.title,
            imageUrl: editing.imageUrl ?? undefined,
          }}
          existing={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load(tab);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    padding: 3,
    gap: 3,
    margin: space.md,
    marginBottom: space.sm,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segOn: { backgroundColor: colors.brand.DEFAULT },
  segText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  segTextOn: { color: colors.white },
  list: { paddingHorizontal: space.md, paddingBottom: space.xxl, gap: space.sm },
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.md,
    gap: 10,
  },
  row: { flexDirection: 'row', gap: 10 },
  thumb: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  thumbImg: { width: '90%', height: '90%' },
  title: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  whenRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  when: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  soon: { fontFamily: font.ui, fontSize: 12, color: colors.text.body },
  tags: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  tagText: { fontFamily: font.uiMedium, fontSize: 11.5, color: colors.brand.DEFAULT },
  meta: { fontFamily: font.ui, fontSize: 12, color: colors.text.body },
  note: { fontFamily: font.body, fontSize: 12, fontStyle: 'italic', color: colors.text.body },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.card.border,
    paddingTop: 10,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  buy: {
    marginLeft: 'auto',
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  buyText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.white },
  empty: { alignItems: 'center', paddingHorizontal: space.xl, paddingTop: space.xxxl, gap: 10 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  emptyText: {
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.body,
    textAlign: 'center',
  },
});
