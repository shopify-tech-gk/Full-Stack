import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import {
  Outfit_400Regular,
  Outfit_500Medium,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';
import { Arimo_400Regular, Arimo_700Bold } from '@expo-google-fonts/arimo';
import { SessionProvider } from '@/stores/session';
import { CartProvider } from '@/stores/cart';
import { WishlistProvider } from '@/stores/wishlist';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Arimo_400Regular,
    Arimo_700Bold,
  });

  useEffect(() => {
    if (loaded) void SplashScreen.hideAsync();
  }, [loaded]);

  if (!loaded) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <CartProvider>
            <WishlistProvider>
              <StatusBar style="dark" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.page },
                  headerTintColor: colors.brand.DEFAULT,
                  headerTitleStyle: { fontFamily: 'Outfit_600SemiBold', color: colors.heading },
                }}
              >
                <Stack.Screen name="(tabs)" />
                <Stack.Screen name="category/[slug]" options={{ headerShown: true, title: '' }} />
                <Stack.Screen name="product/[slug]" options={{ headerShown: true, title: '' }} />
                <Stack.Screen name="auth/login" options={{ headerShown: true, title: 'Sign in' }} />
                <Stack.Screen name="auth/otp" options={{ headerShown: true, title: 'Verify' }} />
                <Stack.Screen name="wishlist" options={{ headerShown: true, title: 'Wishlist' }} />
                <Stack.Screen
                  name="addresses/index"
                  options={{ headerShown: true, title: 'Addresses' }}
                />
                <Stack.Screen
                  name="addresses/form"
                  options={{ headerShown: true, title: 'Address' }}
                />
                <Stack.Screen name="checkout" options={{ headerShown: true, title: 'Checkout' }} />
                <Stack.Screen name="payment" options={{ headerShown: true, title: 'Payment' }} />
                <Stack.Screen name="order-success" options={{ headerShown: false }} />
                <Stack.Screen
                  name="orders/index"
                  options={{ headerShown: true, title: 'My Orders' }}
                />
                <Stack.Screen name="orders/[id]" options={{ headerShown: true, title: 'Order' }} />
                <Stack.Screen
                  name="track-order"
                  options={{ headerShown: true, title: 'Track Order' }}
                />
              </Stack>
            </WishlistProvider>
          </CartProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
