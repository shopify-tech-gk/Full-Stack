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
            </Stack>
          </WishlistProvider>
        </CartProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
