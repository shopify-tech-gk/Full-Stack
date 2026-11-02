import { useEffect, useMemo, useState } from 'react';
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
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ApiError,
  formatMoney,
  type BuyReminder,
  type Money,
  type ReminderRepeat,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { REPEAT_LABEL, quickPicks, timeLabel, whenLabel } from '@/lib/reminder-time';
import { colors, font, radii, space } from '@/theme';

export interface RemindProduct {
  skuId: string;
  title: string;
  imageUrl?: string;
  /** Today's price (left out where it isn't known, e.g. the reminders list). */
  price?: Money;
}

const DAYS_AHEAD = 60;
const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6 AM - 11 PM
const MINUTES = [0, 15, 30, 45];
const REPEATS: ReminderRepeat[] = ['NONE', 'WEEKLY', 'MONTHLY'];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * v1.18 "Remind me to buy": choose when (quick picks or any date and time), how often (once / every
 * week / every month for refills) and an optional note. At that time the customer gets a WhatsApp
 * with the product and its price then - and how much it dropped since.
 */
export function RemindSheet({
  visible,
  product,
  existing,
  initialPick,
  onClose,
  onSaved,
}: {
  visible: boolean;
  product: RemindProduct;
  /** Editing (or re-scheduling) this reminder; null = a new one. */
  existing: BuyReminder | null;
  /** Start on this time ("tonight", "weekend", "payday", "custom"); default tomorrow morning. */
  initialPick?: string;
  onClose: () => void;
  /** null = the reminder was removed. */
  onSaved: (reminder: BuyReminder | null) => void;
}) {
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(() => new Date());
  const picks = useMemo(() => quickPicks(now), [now]);
  const [pick, setPick] = useState<string>('tomorrow');
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [hour, setHour] = useState(10);
  const [minute, setMinute] = useState(0);
  const [repeat, setRepeat] = useState<ReminderRepeat>('NONE');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const fresh = new Date();
    setNow(fresh);
    setError(null);
    setBusy(null);
    const upcoming =
      existing?.status === 'SCHEDULED' && new Date(existing.remindAt).getTime() > fresh.getTime();
    if (existing && upcoming) {
      const d = new Date(existing.remindAt);
      setPick('custom');
      setDay(startOfDay(d));
      setHour(d.getHours());
      setMinute(d.getMinutes() - (d.getMinutes() % 15));
    } else {
      const offered =
        initialPick === 'custom' || quickPicks(fresh).some((p) => p.key === initialPick);
      setPick(initialPick && offered ? initialPick : 'tomorrow');
      const t = new Date(fresh);
      t.setDate(t.getDate() + 1);
      setDay(startOfDay(t));
      setHour(10);
      setMinute(0);
    }
    setRepeat(existing?.repeat ?? 'NONE');
    setNote(existing?.note ?? '');
  }, [visible, existing, initialPick]);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_AHEAD }, (_, i) => {
        const d = startOfDay(now);
        d.setDate(d.getDate() + i);
        return d;
      }),
    [now],
  );
  const customAt = useMemo(() => {
    const d = new Date(day);
    d.setHours(hour, minute, 0, 0);
    return d;
  }, [day, hour, minute]);
  const chosen = pick === 'custom' ? customAt : picks.find((p) => p.key === pick)?.at;
  const tooSoon = !chosen || chosen.getTime() - Date.now() < 60_000;
  const isToday = day.getTime() === startOfDay(now).getTime();
  const slotPast = (h: number, m: number) =>
    isToday && (h < now.getHours() || (h === now.getHours() && m <= now.getMinutes()));

  const save = async () => {
    if (!chosen || tooSoon) return;
    setBusy('save');
    setError(null);
    try {
      const body = {
        remindAt: chosen.toISOString(),
        repeat,
        note: note.trim() || undefined,
      };
      const saved = existing
        ? await api.reminders.update(existing.reminderId, { ...body, note: note.trim() || null })
        : await api.reminders.create({ ...body, skuId: product.skuId, imageUrl: product.imageUrl });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(
        () => undefined,
      );
      onSaved(saved);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save the reminder. Try again.');
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!existing) return;
    setBusy('remove');
    try {
      await api.reminders.remove(existing.reminderId);
      onSaved(null);
    } catch {
      setError('Could not remove the reminder. Try again.');
      setBusy(null);
    }
  };

  const editingUpcoming = existing?.status === 'SCHEDULED';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <View style={styles.headIcon}>
              <Ionicons name="alarm" size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                {editingUpcoming ? 'Change your reminder' : 'Remind me to buy'}
              </Text>
              <Text style={styles.subtitle}>We'll WhatsApp you at the time you pick.</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8} disabled={!!busy}>
              <Ionicons name="close" size={22} color={colors.text.strong} />
            </Pressable>
          </View>

          <ScrollView
            style={{ flexGrow: 0 }}
            contentContainerStyle={{ gap: space.md, paddingBottom: space.xs }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.product}>
              <View style={styles.thumb}>
                {product.imageUrl ? (
                  <Image
                    source={{ uri: product.imageUrl }}
                    style={styles.thumbImg}
                    contentFit="contain"
                  />
                ) : (
                  <Ionicons name="cube-outline" size={20} color={colors.text.muted} />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.productTitle} numberOfLines={2}>
                  {product.title}
                </Text>
                {product.price ? (
                  <Text style={styles.productPrice}>{formatMoney(product.price)} today</Text>
                ) : null}
              </View>
            </View>

            <View style={{ gap: space.sm }}>
              <Text style={styles.section}>When should we remind you?</Text>
              <View style={styles.picks}>
                {picks.map((p) => {
                  const on = pick === p.key;
                  return (
                    <Pressable
                      key={p.key}
                      style={[styles.pick, on && styles.pickOn]}
                      onPress={() => {
                        void Haptics.selectionAsync().catch(() => undefined);
                        setPick(p.key);
                      }}
                    >
                      <Ionicons
                        name={p.icon}
                        size={18}
                        color={on ? colors.white : colors.brand.DEFAULT}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pickLabel, on && styles.onText]} numberOfLines={1}>
                          {p.label}
                        </Text>
                        <Text style={[styles.pickWhen, on && styles.onSub]} numberOfLines={1}>
                          {whenLabel(p.at, now)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
                <Pressable
                  style={[styles.pick, pick === 'custom' && styles.pickOn]}
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => undefined);
                    setPick('custom');
                  }}
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={pick === 'custom' ? colors.white : colors.brand.DEFAULT}
                  />
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.pickLabel, pick === 'custom' && styles.onText]}
                      numberOfLines={1}
                    >
                      Pick date & time
                    </Text>
                    <Text
                      style={[styles.pickWhen, pick === 'custom' && styles.onSub]}
                      numberOfLines={1}
                    >
                      {pick === 'custom' ? whenLabel(customAt, now) : 'Any day, any time'}
                    </Text>
                  </View>
                </Pressable>
              </View>
            </View>

            {pick === 'custom' ? (
              <View style={styles.custom}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.strip}
                >
                  {days.map((d, i) => {
                    const on = d.getTime() === day.getTime();
                    return (
                      <Pressable
                        key={d.getTime()}
                        style={[styles.day, on && styles.dayOn]}
                        onPress={() => setDay(d)}
                      >
                        <Text style={[styles.dayName, on && styles.onSub]}>
                          {i === 0
                            ? 'Today'
                            : i === 1
                              ? 'Tmrw'
                              : d.toLocaleDateString('en-IN', { weekday: 'short' })}
                        </Text>
                        <Text style={[styles.dayNum, on && styles.onText]}>{d.getDate()}</Text>
                        <Text style={[styles.dayName, on && styles.onSub]}>
                          {d.toLocaleDateString('en-IN', { month: 'short' })}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.strip}
                >
                  {HOURS.map((h) => {
                    const on = h === hour;
                    const past = slotPast(h, 59);
                    const t = new Date(day);
                    t.setHours(h, 0, 0, 0);
                    return (
                      <Pressable
                        key={h}
                        disabled={past}
                        style={[styles.slot, on && styles.dayOn, past && styles.slotPast]}
                        onPress={() => setHour(h)}
                      >
                        <Text style={[styles.slotText, on && styles.onText]}>{timeLabel(t)}</Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
                <View style={styles.minutes}>
                  {MINUTES.map((m) => {
                    const on = m === minute;
                    return (
                      <Pressable
                        key={m}
                        disabled={slotPast(hour, m)}
                        style={[
                          styles.minute,
                          on && styles.dayOn,
                          slotPast(hour, m) && styles.slotPast,
                        ]}
                        onPress={() => setMinute(m)}
                      >
                        <Text style={[styles.slotText, on && styles.onText]}>
                          :{String(m).padStart(2, '0')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={{ gap: space.sm }}>
              <Text style={styles.section}>Repeat</Text>
              <View style={styles.segment}>
                {REPEATS.map((r) => {
                  const on = r === repeat;
                  return (
                    <Pressable
                      key={r}
                      style={[styles.segBtn, on && styles.segOn]}
                      onPress={() => setRepeat(r)}
                    >
                      <Text style={[styles.segText, on && styles.onText]}>{REPEAT_LABEL[r]}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {repeat !== 'NONE' ? (
                <Text style={styles.hint}>
                  Handy for refills - we'll remind you {repeat === 'WEEKLY' ? 'weekly' : 'monthly'}{' '}
                  until you turn it off.
                </Text>
              ) : null}
            </View>

            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Add a note (optional), e.g. for Amma's birthday"
              placeholderTextColor={colors.text.placeholder}
              maxLength={80}
              style={styles.input}
            />

            <View style={styles.promise}>
              <Ionicons name="logo-whatsapp" size={18} color="#1f9d55" />
              <Text style={styles.promiseText}>
                {chosen && !tooSoon
                  ? `${whenLabel(chosen, now)}: a WhatsApp and an Alert with today's price - and how much it dropped.`
                  : 'Pick a time at least a minute from now.'}
              </Text>
            </View>
          </ScrollView>

          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.confirm, (tooSoon || !!busy) && styles.disabled]}
            disabled={tooSoon || !!busy}
            onPress={() => void save()}
          >
            {busy === 'save' ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <>
                <Ionicons name="alarm-outline" size={18} color={colors.white} />
                <Text style={styles.confirmText}>
                  {editingUpcoming ? 'Update reminder' : 'Set reminder'}
                </Text>
              </>
            )}
          </Pressable>
          {editingUpcoming ? (
            <Pressable style={styles.remove} disabled={!!busy} onPress={() => void remove()}>
              {busy === 'remove' ? (
                <ActivityIndicator color={colors.price.discount} />
              ) : (
                <Text style={styles.removeText}>Remove reminder</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.card.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: space.xs },
  headIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  subtitle: { fontFamily: font.body, fontSize: 12.5, color: colors.text.body },
  product: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    padding: 10,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    backgroundColor: colors.white,
  },
  thumbImg: { width: '90%', height: '90%' },
  productTitle: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  productPrice: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.brand.DEFAULT },
  section: { fontFamily: font.uiBold, fontSize: 14, color: colors.heading },
  picks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pick: {
    width: '48.6%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  pickOn: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  pickLabel: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
  pickWhen: { fontFamily: font.ui, fontSize: 11.5, color: colors.text.body },
  onText: { color: colors.white },
  onSub: { color: 'rgba(255,255,255,0.85)' },
  custom: {
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    paddingVertical: 10,
  },
  strip: { gap: 6, paddingHorizontal: 10 },
  day: {
    width: 54,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  dayOn: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  dayName: { fontFamily: font.uiMedium, fontSize: 11, color: colors.text.body },
  dayNum: { fontFamily: font.uiBold, fontSize: 17, color: colors.text.strong },
  slot: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  slotPast: { opacity: 0.35 },
  slotText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
  minutes: { flexDirection: 'row', gap: 6, paddingHorizontal: 10 },
  minute: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    padding: 3,
    gap: 3,
  },
  segBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 9 },
  segOn: { backgroundColor: colors.brand.DEFAULT },
  segText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
  hint: { fontFamily: font.body, fontSize: 12, color: colors.text.body },
  input: {
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    backgroundColor: colors.white,
    paddingHorizontal: space.md,
    paddingVertical: 10,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text.input,
  },
  promise: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#e8f7ee',
    borderRadius: radii.tile,
    paddingHorizontal: space.md,
    paddingVertical: 9,
  },
  promiseText: { flex: 1, fontFamily: font.uiMedium, fontSize: 12.5, color: '#14663a' },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  confirm: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  confirmText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
  remove: { alignItems: 'center', paddingVertical: 8 },
  removeText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.price.discount },
});
