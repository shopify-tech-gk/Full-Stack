import { createContext, useCallback, useContext, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';

/** Bottom-tab order — index here matches each tab's `index` prop. */
const TAB_ROUTES: string[] = ['/', '/buy-again', '/cart', '/account'];

type ZoneApi = { setZone: (active: boolean) => void };
const ZoneContext = createContext<ZoneApi | null>(null);

/**
 * Wrap a horizontal carousel/product section so a swipe that STARTS on it scrolls that section
 * instead of switching tabs. Everywhere else on the screen, a horizontal swipe changes tab.
 */
export function HScrollZone({ children }: { children: ReactNode }) {
  const zone = useContext(ZoneContext);
  return (
    <View
      onTouchStart={() => zone?.setZone(true)}
      onTouchEnd={() => zone?.setZone(false)}
      onTouchCancel={() => zone?.setZone(false)}
    >
      {children}
    </View>
  );
}

/**
 * Wraps a tab screen so a horizontal swipe moves to the previous/next bottom tab (Instagram-style).
 * Swiping right→left opens the next tab; left→right opens the previous one. Vertical drags fall
 * through to scrolling, and swipes that begin inside an {@link HScrollZone} scroll that carousel.
 */
export function SwipeTabs({
  index,
  style,
  children,
}: {
  index: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const router = useRouter();
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const decided = useSharedValue(false);
  const inZone = useSharedValue(false);

  const setZone = useCallback(
    (active: boolean) => {
      inZone.value = active;
    },
    [inZone],
  );

  const go = useCallback(
    (dir: number) => {
      const next = index + dir;
      if (next < 0 || next >= TAB_ROUTES.length) return;
      router.navigate(TAB_ROUTES[next] as Href);
    },
    [index, router],
  );

  const pan = Gesture.Pan()
    .manualActivation(true)
    .onTouchesDown((e) => {
      'worklet';
      const t = e.allTouches[0];
      if (!t) return;
      startX.value = t.absoluteX;
      startY.value = t.absoluteY;
      decided.value = false;
    })
    .onTouchesMove((e, manager) => {
      'worklet';
      if (decided.value) return;
      const t = e.allTouches[0];
      if (!t) return;
      const dx = t.absoluteX - startX.value;
      const dy = t.absoluteY - startY.value;
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return;
      decided.value = true;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.3;
      if (horizontal && !inZone.value) manager.activate();
      else manager.fail();
    })
    .onEnd((e) => {
      'worklet';
      if (Math.abs(e.translationX) < 45 && Math.abs(e.velocityX) < 400) return;
      runOnJS(go)(e.translationX < 0 ? 1 : -1);
    })
    .onFinalize(() => {
      'worklet';
      inZone.value = false;
    });

  return (
    <ZoneContext.Provider value={{ setZone }}>
      <GestureDetector gesture={pan}>
        <View style={[styles.fill, style]}>{children}</View>
      </GestureDetector>
    </ZoneContext.Provider>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
