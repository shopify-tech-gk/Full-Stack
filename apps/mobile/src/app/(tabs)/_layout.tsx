import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authUserLabel } from '@youmart/shared-client';
import { colors, font } from '@/theme';
import { useCart } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { useAvatar } from '@/stores/profile';
import { Avatar } from '@/components/Avatar';
import { useOnboarding } from '@/stores/onboarding';

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
        tabBarStyle: { backgroundColor: colors.white, borderTopColor: colors.border.menu },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => <Ionicons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="buy-again"
        options={{
          title: 'Buy Again',
          tabBarIcon: ({ color, size }) => <Ionicons name="heart" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'My Cart',
          tabBarBadge: itemCount > 0 ? (itemCount > 99 ? '99+' : itemCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.price.discount, fontSize: 10 },
          tabBarIcon: ({ color, size }) => <Ionicons name="cart" size={size} color={color} />,
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
              <Ionicons name="person" size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
