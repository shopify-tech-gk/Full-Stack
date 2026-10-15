import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { colors, font, space } from '@/theme';

/** Waits at least `ms` - paired with real work so a step never flashes by. */
export const atLeast = <T,>(work: Promise<T>, ms: number): Promise<T> =>
  Promise.all([work, new Promise((r) => setTimeout(r, ms))]).then(([value]) => value);

/**
 * "Placing your order" - shown while checkout runs (like the big stores do). Each step ticks off in
 * turn; the real requests run underneath, so it never slows the order down beyond its minimum
 * time (see `atLeast`). Errors close it straight away.
 */
export function PlacingOrderOverlay({
  visible,
  steps,
  stepMs = 800,
}: {
  visible: boolean;
  steps: string[];
  stepMs?: number;
}) {
  const [done, setDone] = useState(0);
  const count = steps.length;

  useEffect(() => {
    if (!visible) {
      setDone(0);
      return;
    }
    // Keyed on the step COUNT: the parent rebuilds its steps array on every render.
    const timers = Array.from({ length: count }, (_, i) =>
      setTimeout(() => setDone(i + 1), stepMs * (i + 1)),
    );
    return () => timers.forEach(clearTimeout);
  }, [visible, count, stepMs]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <Animated.View entering={ZoomIn.springify().damping(16)} style={styles.card}>
          <View style={styles.badge}>
            <Ionicons name="bag-check" size={30} color={colors.white} />
          </View>
          <Text style={styles.title}>Placing your order</Text>
          <Text style={styles.sub}>Please don&apos;t close the app</Text>
          <View style={styles.steps}>
            {steps.map((label, i) => {
              const state = i < done ? 'done' : i === done ? 'active' : 'todo';
              return (
                <Animated.View key={label} entering={FadeIn.delay(i * 80)} style={styles.step}>
                  <View style={[styles.dot, state === 'done' && styles.dotDone]}>
                    {state === 'done' ? (
                      <Ionicons name="checkmark" size={14} color={colors.white} />
                    ) : state === 'active' ? (
                      <ActivityIndicator size="small" color={colors.brand.DEFAULT} />
                    ) : null}
                  </View>
                  <Text style={[styles.stepText, state === 'todo' && styles.stepTodo]}>
                    {label}
                  </Text>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(8,24,56,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.white,
    borderRadius: 24,
    padding: space.xl,
    alignItems: 'center',
    gap: 6,
  },
  badge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  title: { fontFamily: font.uiBold, fontSize: 19, color: colors.heading },
  sub: { fontFamily: font.body, fontSize: 13, color: colors.text.muted },
  steps: { alignSelf: 'stretch', gap: 14, marginTop: space.lg },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.card.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.feature.guarantee, borderColor: colors.feature.guarantee },
  stepText: { flex: 1, fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  stepTodo: { color: colors.text.muted },
});
