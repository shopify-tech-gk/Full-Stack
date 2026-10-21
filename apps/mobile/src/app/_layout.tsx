import { useEffect, useState } from 'react';
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
import { SessionProvider, useSession } from '@/stores/session';
import { CartProvider } from '@/stores/cart';
import { WishlistProvider } from '@/stores/wishlist';
import { AvatarProvider } from '@/stores/profile';
import { AddressProvider } from '@/stores/address';
import { LaunchScreen } from '@/components/LaunchScreen';
import { WithGlobalTabBar } from '@/components/GlobalTabBar';
import { BrandHeader } from '@/components/BrandHeader';
import { colors } from '@/theme';

void SplashScreen.preventAutoHideAsync();

// Once per app process: a cold start plays the intro; returning from the background doesn't.
let introPlayed = false;

/** The opening animation, over the app while it starts underneath (session restore, cart). */
function Intro() {
  const session = useSession();
  const [show, setShow] = useState(!introPlayed);
  if (!show) return null;
  return (
    <LaunchScreen
      ready={session.status !== 'loading'}
      onDone={() => {
        introPlayed = true;
        setShow(false);
      }}
    />
  );
}

/** Inner shopping screens: back + YouMart logo + search (components/BrandHeader). */
const brandHeader = ({
  navigation,
  options,
  back,
}: {
  navigation: { goBack: () => void };
  options: { title?: string; headerRight?: (props: { canGoBack: boolean }) => React.ReactNode };
  back?: unknown;
}) => (
  <BrandHeader
    title={typeof options.title === 'string' ? options.title : undefined}
    right={options.headerRight?.({ canGoBack: Boolean(back) })}
    onBack={back ? () => navigation.goBack() : undefined}
  />
);

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
          <AvatarProvider>
            <AddressProvider>
              <CartProvider>
                <WishlistProvider>
                  <StatusBar style="dark" />
                  {/* The bottom tab bar on every screen, not only the tabs. */}
                  <WithGlobalTabBar>
                    <Stack
                      screenOptions={{
                        headerShown: false,
                        headerBackButtonDisplayMode: 'minimal',
                        contentStyle: { backgroundColor: colors.page },
                        headerTintColor: colors.brand.DEFAULT,
                        headerTitleStyle: {
                          fontFamily: 'Outfit_600SemiBold',
                          color: colors.heading,
                        },
                      }}
                    >
                      <Stack.Screen name="(tabs)" />
                      <Stack.Screen name="welcome" options={{ gestureEnabled: false }} />
                      <Stack.Screen
                        name="lens"
                        options={{ headerShown: false, presentation: 'fullScreenModal' }}
                      />
                      <Stack.Screen
                        name="scan"
                        options={{ headerShown: false, presentation: 'fullScreenModal' }}
                      />
                      <Stack.Screen
                        name="account/devices"
                        options={{ headerShown: true, title: 'Logged-in devices' }}
                      />
                      <Stack.Screen name="search" options={{ headerShown: false }} />
                      <Stack.Screen
                        name="category/[slug]"
                        options={{ headerShown: true, title: '', header: brandHeader }}
                      />
                      <Stack.Screen
                        name="product/[slug]"
                        options={{ headerShown: true, title: '', header: brandHeader }}
                      />
                      <Stack.Screen
                        name="auth/login"
                        options={{ headerShown: true, title: 'Sign in' }}
                      />
                      <Stack.Screen
                        name="auth/otp"
                        options={{ headerShown: true, title: 'Verify' }}
                      />
                      <Stack.Screen
                        name="wishlist"
                        options={{ headerShown: true, title: 'Wishlist', header: brandHeader }}
                      />
                      <Stack.Screen
                        name="addresses/index"
                        options={{ headerShown: true, title: 'Addresses' }}
                      />
                      <Stack.Screen
                        name="addresses/form"
                        options={{ headerShown: true, title: 'Address' }}
                      />
                      <Stack.Screen name="addresses/map" options={{ headerShown: false }} />
                      <Stack.Screen
                        name="my-cart"
                        options={{ headerShown: true, title: 'My Cart', header: brandHeader }}
                      />
                      <Stack.Screen
                        name="checkout"
                        options={{ headerShown: true, title: 'Checkout' }}
                      />
                      <Stack.Screen
                        name="payment"
                        options={{ headerShown: true, title: 'Payment' }}
                      />
                      <Stack.Screen name="order-success" options={{ headerShown: false }} />
                      <Stack.Screen
                        name="orders/index"
                        options={{ headerShown: true, title: 'My Orders' }}
                      />
                      <Stack.Screen
                        name="orders/[id]"
                        options={{ headerShown: true, title: 'Order' }}
                      />
                      <Stack.Screen
                        name="account/details"
                        options={{ headerShown: true, title: 'Account details' }}
                      />
                      <Stack.Screen
                        name="coupons"
                        options={{ headerShown: true, title: 'Coupons' }}
                      />
                      <Stack.Screen
                        name="inbox"
                        options={{ headerShown: true, title: 'Notifications' }}
                      />
                      <Stack.Screen
                        name="account/recently-viewed"
                        options={{
                          headerShown: true,
                          title: 'Recently viewed',
                          header: brandHeader,
                        }}
                      />
                      <Stack.Screen
                        name="account/reviews"
                        options={{ headerShown: true, title: 'My reviews' }}
                      />
                      <Stack.Screen
                        name="review/[slug]"
                        options={{ headerShown: true, title: 'Rate product' }}
                      />
                      <Stack.Screen
                        name="account/notifications"
                        options={{ headerShown: true, title: 'Notification settings' }}
                      />
                      <Stack.Screen
                        name="account/privacy"
                        options={{ headerShown: true, title: 'Privacy & account' }}
                      />
                      <Stack.Screen
                        name="wallet/index"
                        options={{ headerShown: true, title: 'YouMart Wallet' }}
                      />
                      <Stack.Screen
                        name="wallet/add"
                        options={{ headerShown: true, title: 'Add money' }}
                      />
                      <Stack.Screen
                        name="returns/index"
                        options={{ headerShown: true, title: 'Returns & refunds' }}
                      />
                      <Stack.Screen
                        name="help/index"
                        options={{ headerShown: true, title: 'Help Center' }}
                      />
                      <Stack.Screen
                        name="help/new"
                        options={{ headerShown: true, title: 'Get help' }}
                      />
                      <Stack.Screen name="info/[page]" options={{ headerShown: true, title: '' }} />
                      <Stack.Screen
                        name="track-order"
                        options={{ headerShown: true, title: 'Track Order' }}
                      />
                    </Stack>
                  </WithGlobalTabBar>
                  <Intro />
                </WishlistProvider>
              </CartProvider>
            </AddressProvider>
          </AvatarProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
