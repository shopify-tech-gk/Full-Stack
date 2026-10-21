import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
// expo-router vendors React Navigation; its bottom tab bar is reached through the build path.
import {
  BottomTabBar,
  type BottomTabBarProps,
} from 'expo-router/build/react-navigation/bottom-tabs';

const SWIPE_DISTANCE = 40;
const SWIPE_VELOCITY = 500;

/**
 * The normal bottom tab bar, plus swiping across it: right-to-left opens the next tab
 * (Home -> Favourites -> My Cart -> Account), left-to-right the previous one - the same as swiping
 * on the screen itself (SwipeTabs). Taps on the icons behave exactly as before: the swipe only
 * takes over once the finger has clearly moved sideways.
 */
export function SwipeTabBar(props: BottomTabBarProps) {
  const { state, navigation } = props;

  const go = (dir: number) => {
    const next = state.index + dir;
    const route = state.routes[next];
    if (!route) return;
    void Haptics.selectionAsync().catch(() => undefined);
    navigation.navigate(route.name);
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
