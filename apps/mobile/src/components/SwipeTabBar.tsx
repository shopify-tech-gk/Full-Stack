import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
// expo-router vendors React Navigation and exposes its bottom tab bar from `expo-router/js-tabs`.
import { BottomTabBar, type BottomTabBarProps } from 'expo-router/js-tabs';

const SWIPE_DISTANCE = 40;
const SWIPE_VELOCITY = 500;

/**
 * The normal bottom tab bar, plus swiping across it: right-to-left opens the next tab
 * (Home -> Favourites -> My Cart -> Account), left-to-right the previous one - the same as swiping
 * on the screen itself (SwipeTabs). Taps on the icons behave exactly as before: the swipe only
 * takes over once the finger has clearly moved sideways.
 */
export function SwipeTabBar(props: BottomTabBarProps) {
  const { state, navigateToTab } = props;

  const go = (dir: number) => {
    // Skip the centre YouMart AI button: it opens the assistant, it is not a page to swipe to.
    let next = state.index + dir;
    if (state.routes[next]?.name === 'ai') next += dir;
    const route = state.routes[next];
    if (!route) return;
    void Haptics.selectionAsync().catch(() => undefined);
    navigateToTab(route.key);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-15, 15])
    .failOffsetY([-12, 12])
    .onEnd((e) => {
      'worklet';
      const far = Math.abs(e.translationX) > SWIPE_DISTANCE;
      const fast = Math.abs(e.velocityX) > SWIPE_VELOCITY;
      if (!far && !fast) return;
      runOnJS(go)(e.translationX < 0 ? 1 : -1);
    });

  return (
    <GestureDetector gesture={pan}>
      <View collapsable={false}>
        <BottomTabBar {...props} />
      </View>
    </GestureDetector>
  );
}
