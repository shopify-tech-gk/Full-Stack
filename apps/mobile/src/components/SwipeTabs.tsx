import { createContext, useCallback, useContext, useRef, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
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
  const startX = useRef(0);
  const startY = useRef(0);
  const decided = useRef(false);
  const inZone = useRef(false);

  const setZone = useCallback((active: boolean) => {
    inZone.current = active;
  }, []);

  const go = useCallback(
    (dir: number) => {
      const next = index + dir;
      if (next < 0 || next >= TAB_ROUTES.length) return;
      router.navigate(TAB_ROUTES[next] as Href);
    },
    [index, router],
  );

  const pan = Gesture.Pan()
    .runOnJS(true)
    .manualActivation(true)
    .onTouchesDown((e) => {
      const t = e.allTouches[0];
      if (!t) return;
      startX.current = t.absoluteX;
      startY.current = t.absoluteY;
      decided.current = false;
    })
    .onTouchesMove((e, state) => {
      if (decided.current) return;
      const t = e.allTouches[0];
      if (!t) return;
      const dx = t.absoluteX - startX.current;
      const dy = t.absoluteY - startY.current;
      if (Math.abs(dx) < 14 && Math.abs(dy) < 14) return;
      decided.current = true;
      const horizontal = Math.abs(dx) > Math.abs(dy) * 1.4;
      if (horizontal && !inZone.current) state.activate();
      else state.fail();
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) < 50 && Math.abs(e.velocityX) < 420) return;
      go(e.translationX < 0 ? 1 : -1);
    })
    .onFinalize(() => {
      inZone.current = false;
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
