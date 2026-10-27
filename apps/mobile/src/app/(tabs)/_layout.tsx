import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authUserLabel } from '@youmart/shared-client';
import { colors, font } from '@/theme';
import { useCart } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { useAvatar } from '@/stores/profile';
import { Avatar } from '@/components/Avatar';
import { useOnboarding } from '@/stores/onboarding';
import { SwipeTabBar } from '@/components/SwipeTabBar';
import { emitHomeLogoTap } from '@/lib/home-tap';
import { AiNavButton } from '@/components/AiNavButton';
import { BAR_HEIGHT, BAR_SPACE } from '@/components/GlobalTabBar';

export default function TabsLayout() {
  const { itemCount } = useCart();
  const session = useSession();
  const { uri } = useAvatar();
  const avatarName = session.status === 'authenticated' ? authUserLabel(session.user) : '';
  const hasAvatar = Boolean(uri) || avatarName.length > 0;
  const onboarding = useOnboarding();

  // First launch (or new Terms): welcome + accept Terms & Privacy before using the app.
  if (onboarding === 'loading') return null;
  if (onboarding === 'needed') return <Redirect href="/welcome" />;

  return (
    <Tabs
      // Swipe across the bottom bar to move between tabs, like swiping on the screen itself.
      tabBar={(props) => <SwipeTabBar {...props} />}
      // Solid icons on every tab (active = brand blue, inactive = grey): outline icons in the same
      // grey read too pale.
      screenOptions={{
        headerShown: false,
        // No tab transition: the 'shift' animation sometimes left the new tab parked off-screen
        // (a blank page until the tab was tapped again), especially on quick taps / swipe-to-tab.
        animation: 'none',
        tabBarActiveTintColor: colors.brand.DEFAULT,
        tabBarInactiveTintColor: colors.nav.inactiveIcon,
        tabBarLabelStyle: { fontFamily: font.uiMedium, fontSize: 11 },
        // Same height and bottom spacing as the bar on the other screens (GlobalTabBar).
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border.menu,
          height: BAR_SPACE,
          paddingBottom: BAR_SPACE - BAR_HEIGHT,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        // Instagram-style: tapping Home while already on Home scrolls it to the top, and tapping
        // again at the top reloads it (same as tapping the YouMart logo there).
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) emitHomeLogoTap();
          },
        })}
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="buy-again"
        options={{
          title: 'Favourites',
          // Saved items: a solid bookmark, grey / blue like the other tab icons.
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="bookmark" size={size} color={color as string} />
          ),
        }}
      />
      {/* v1.17: YouMart AI in the middle - a raised button that opens the assistant on top. */}
      <Tabs.Screen
        name="ai"
        options={{ title: 'YouMart AI', tabBarButton: () => <AiNavButton /> }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'My Cart',
          tabBarBadge: itemCount > 0 ? (itemCount > 99 ? '99+' : itemCount) : undefined,
          // Red count with a white ring so it stands out against the cart icon.
          tabBarBadgeStyle: {
            backgroundColor: colors.price.discount,
            fontSize: 10,
            borderWidth: 1.5,
            borderColor: colors.white,
            minWidth: 19,
            height: 19,
            borderRadius: 10,
            lineHeight: 16,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="cart" size={size} color={color as string} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size, focused }) =>
            hasAvatar ? (
              <View
                style={{
                  borderRadius: (size + 6) / 2,
                  borderWidth: focused ? 2 : 0,
                  borderColor: colors.brand.DEFAULT,
                  padding: focused ? 1 : 0,
                }}
              >
                <Avatar name={avatarName} uri={uri} size={size} />
              </View>
            ) : (
              <Ionicons name="person" size={size} color={color as string} />
            ),
        }}
      />
    </Tabs>
  );
}
