import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { BuyReminder } from '@youmart/shared-client';
import { REPEAT_LABEL, fromNow, quickPicks, whenLabel } from '@/lib/reminder-time';
import { font, radii, space } from '@/theme';

const CHIPS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'tonight', label: 'Tonight', icon: 'moon' },
  { key: 'weekend', label: 'Weekend', icon: 'cafe' },
  { key: 'payday', label: 'Payday', icon: 'wallet' },
  { key: 'custom', label: 'Any date', icon: 'calendar' },
];

const YELLOW = '#ffd60a';
const INK = '#1f1300';

/** A bell that rings every few seconds (a short wiggle, then rest). */
function RingingBell({ ringing, size }: { ringing: boolean; size: number }) {
  const turn = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ringing) return;
    const step = (to: number) =>
      Animated.timing(turn, {
        toValue: to,
        duration: 70,
        easing: Easing.linear,
        useNativeDriver: true,
      });
    const loop = Animated.loop(
      Animated.sequence([
        step(1),
        step(-1),
        step(1),
        step(-1),
        step(0.5),
        step(0),
        Animated.delay(2600),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [ringing, turn]);
  const rotate = turn.interpolate({ inputRange: [-1, 1], outputRange: ['-18deg', '18deg'] });
  return (
    <Animated.View style={{ transform: [{ rotate }] }}>
      <Ionicons name="alarm" size={size} color={INK} />
    </Animated.View>
  );
}

/**
 * v1.18 the product page's "Remind me to buy" card: a bold brand card with one-tap times
 * (Tonight / Weekend / Payday / any date), or - once set - the reminder's time and a countdown.
 */
export function RemindCard({
  reminder,
  onOpen,
}: {
  reminder: BuyReminder | null;
  /** Opens the sheet, preselecting this time ("tonight", "weekend", "payday", "custom"). */
  onOpen: (pick?: string) => void;
}) {
  const tap = (pick?: string) => {
    void Haptics.selectionAsync().catch(() => undefined);
    onOpen(pick);
  };
  const tonightGone = !quickPicks().some((p) => p.key === 'tonight');

  if (reminder) {
    const at = new Date(reminder.remindAt);
    return (
      <Pressable
        style={({ pressed }) => [styles.card, styles.setCard, pressed && styles.pressed]}
        onPress={() => tap()}
        accessibilityLabel="Change your buy reminder"
      >
        <View style={styles.glow} pointerEvents="none" />
        <Ionicons name="alarm" size={84} color="rgba(255,255,255,0.07)" style={styles.watermark} />
        <View style={styles.row}>
          <View style={styles.bellSet}>
            <Ionicons name="checkmark" size={17} color="#0b7a3e" />
          </View>
          <View style={{ flex: 1 }}>
            <Text maxFontSizeMultiplier={1} style={styles.kicker}>
              REMINDER SET
            </Text>
            <Text maxFontSizeMultiplier={1} style={styles.setWhen} numberOfLines={1}>
              {whenLabel(at)}
            </Text>
          </View>
          <View style={styles.countdown}>
            <Ionicons name="hourglass-outline" size={12} color={INK} />
            <Text maxFontSizeMultiplier={1} style={styles.countdownText}>
              {fromNow(at)}
            </Text>
          </View>
        </View>
        <View style={styles.setFoot}>
          <View style={styles.whatsapp}>
            <Ionicons name="logo-whatsapp" size={13} color="#ffffff" />
            <Text maxFontSizeMultiplier={1} style={styles.whatsappText}>
              WhatsApp + Alert
            </Text>
          </View>
          {reminder.repeat !== 'NONE' ? (
            <View style={styles.tag}>
              <Ionicons name="repeat" size={12} color="#ffffff" />
              <Text maxFontSizeMultiplier={1} style={styles.tagText}>
                {REPEAT_LABEL[reminder.repeat]}
              </Text>
            </View>
          ) : null}
          {reminder.note ? (
            <Text maxFontSizeMultiplier={1} style={styles.note} numberOfLines={1}>
              “{reminder.note}”
            </Text>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <View style={styles.change}>
            <Text maxFontSizeMultiplier={1} style={styles.changeText}>
              Change
            </Text>
            <Ionicons name="chevron-forward" size={14} color="#0142aa" />
          </View>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.glow} pointerEvents="none" />
      <Ionicons name="alarm" size={90} color="rgba(255,255,255,0.07)" style={styles.watermark} />
      <Pressable style={styles.row} onPress={() => tap()}>
        <View style={styles.bell}>
          <RingingBell ringing size={18} />
        </View>
        <View style={{ flex: 1 }}>
          <Text maxFontSizeMultiplier={1} style={styles.title} numberOfLines={1}>
            Not buying today?
          </Text>
          <Text maxFontSizeMultiplier={1} style={styles.sub} numberOfLines={1}>
            Get a WhatsApp reminder with the price then.
          </Text>
        </View>
      </Pressable>

      <View style={styles.chips}>
        {CHIPS.filter((c) => !(c.key === 'tonight' && tonightGone)).map((c) => (
          <Pressable
            key={c.key}
            style={({ pressed }) => [styles.chip, pressed && styles.chipPressed]}
            onPress={() => tap(c.key)}
          >
            <Ionicons name={c.icon} size={11} color="#ffffff" />
            <Text maxFontSizeMultiplier={1} style={styles.chipText} numberOfLines={1}>
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <Pressable
        style={({ pressed }) => [styles.cta, pressed && styles.pressed]}
        onPress={() => tap()}
        accessibilityLabel="Remind me to buy this"
      >
        <Ionicons name="notifications" size={14} color={INK} />
        <Text maxFontSizeMultiplier={1} style={styles.ctaText}>
          Remind me to buy
        </Text>
        <View style={styles.ctaWa}>
          <Ionicons name="logo-whatsapp" size={11} color="#ffffff" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: space.lg,
    marginBottom: space.sm,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    overflow: 'hidden',
    backgroundColor: '#0142aa',
    experimental_backgroundImage: 'linear-gradient(135deg, #0142aa 0%, #1f5fd6 55%, #4f46e5 100%)',
    shadowColor: '#0142aa',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  setCard: {
    experimental_backgroundImage: 'linear-gradient(135deg, #0142aa 0%, #0d66ad 60%, #0f8a6a 100%)',
    gap: 7,
  },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  glow: {
    position: 'absolute',
    top: -60,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  watermark: { position: 'absolute', right: -18, top: -14, transform: [{ rotate: '-15deg' }] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bell: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: YELLOW,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  bellSet: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  title: { fontFamily: font.uiBold, fontSize: 14.5, color: '#ffffff' },
  sub: {
    fontFamily: font.ui,
    fontSize: 11.5,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.88)',
    marginTop: 1,
  },
  // One row on every screen width (Android phones are often narrower).
  chips: { flexDirection: 'row', gap: 6 },
  chip: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipPressed: { backgroundColor: 'rgba(255,255,255,0.3)' },
  chipText: { fontFamily: font.uiSemibold, fontSize: 11.5, color: '#ffffff' },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: radii.button,
    backgroundColor: YELLOW,
  },
  ctaText: { fontFamily: font.uiBold, fontSize: 13.5, color: INK },
  ctaWa: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1fa855',
    alignItems: 'center',
    justifyContent: 'center',
  },
  kicker: {
    fontFamily: font.uiBold,
    fontSize: 9.5,
    letterSpacing: 1,
    color: 'rgba(255,255,255,0.8)',
  },
  setWhen: { fontFamily: font.uiBold, fontSize: 14.5, color: '#ffffff' },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: YELLOW,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  countdownText: { fontFamily: font.uiBold, fontSize: 11, color: INK },
  setFoot: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  whatsapp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(31,168,85,0.9)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  whatsappText: { fontFamily: font.uiSemibold, fontSize: 11.5, color: '#ffffff' },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: { fontFamily: font.uiSemibold, fontSize: 11.5, color: '#ffffff' },
  note: {
    flex: 1,
    fontFamily: font.ui,
    fontSize: 12,
    fontStyle: 'italic',
    color: 'rgba(255,255,255,0.85)',
  },
  change: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  changeText: { fontFamily: font.uiBold, fontSize: 12.5, color: '#0142aa' },
});
