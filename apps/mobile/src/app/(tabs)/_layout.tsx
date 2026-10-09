import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@/theme';
import { useCart } from '@/stores/cart';

export default function TabsLayout() {
  const { itemCount } = useCart();
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
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
