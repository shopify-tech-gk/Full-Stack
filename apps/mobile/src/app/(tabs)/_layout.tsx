import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { authUserLabel } from '@youmart/shared-client';
import { colors, font } from '@/theme';
import { useCart } from '@/stores/cart';
import { useSession } from '@/stores/session';
import { useAvatar } from '@/stores/profile';
import { Avatar } from '@/components/Avatar';

export default function TabsLayout() {
  const { itemCount } = useCart();
  const session = useSession();
  const { uri } = useAvatar();
  const avatarName = session.status === 'authenticated' ? authUserLabel(session.user) : '';
  const hasAvatar = Boolean(uri) || avatarName.length > 0;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: 'shift',
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
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="buy-again"
        options={{
          title: 'Buy Again',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'heart' : 'heart-outline'} size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'My Cart',
          tabBarBadge: itemCount > 0 ? (itemCount > 99 ? '99+' : itemCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.price.discount, fontSize: 10 },
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'cart' : 'cart-outline'} size={size} color={color} />
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
              <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}
