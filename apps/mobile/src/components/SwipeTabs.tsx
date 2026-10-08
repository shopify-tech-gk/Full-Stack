import { useCallback, useRef, type ReactNode } from 'react';
import {
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useRouter, type Href } from 'expo-router';

/** Bottom-tab order — index here matches each tab's `index` prop. */
const TAB_ROUTES: string[] = ['/', '/buy-again', '/cart', '/account'];

/**
 * Wraps a tab screen so a horizontal swipe moves to the previous/next bottom tab (Instagram-style).
 * Swiping right→left opens the next tab; left→right opens the previous one. Vertical drags fall
 * through to scrolling. On screens with their own horizontal carousels (Home), pass `edgeOnly` so
 * only swipes that start near the screen edge switch tabs and the inner rails keep scrolling.
 */
export function SwipeTabs({
  index,
  edgeOnly = false,
  style,
  children,
}: {
  index: number;
  edgeOnly?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const startX = useRef(0);
  const startY = useRef(0);
  const decided = useRef(false);

  const go = useCallback(
    (dir: number) => {
      const next = index + dir;
      if (next < 0 || next >= TAB_ROUTES.length) return;
      router.navigate(TAB_ROUTES[next] as Href);
    },
    [index, router],
  );

  const edge = edgeOnly ? 56 : width;

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
      const fromEdge = startX.current <= edge || startX.current >= width - edge;
      if (horizontal && fromEdge) state.activate();
      else state.fail();
    })
    .onEnd((e) => {
      if (Math.abs(e.translationX) < 55 && Math.abs(e.velocityX) < 450) return;
      go(e.translationX < 0 ? 1 : -1);
    });

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.fill, style]}>{children}</View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
