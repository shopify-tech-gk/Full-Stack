import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SEARCH_PLACEHOLDER } from '@youmart/shared-client';
import { colors, font, radii, space } from '@/theme';
import { DeliveryBar } from '@/components/DeliveryBar';
import { VoiceSearchSheet } from '@/components/VoiceSearchSheet';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/logo.png');

/** App header for the tab screens: the YouMart logo, Track Order + Customer Care quick tiles on the
 * right (like youmartshop.com), the delivery address and a search entry. The cart lives in the tab
 * bar. */
export function AppHeader() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [voice, setVoice] = useState(false);

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        <Image source={LOGO} style={styles.logo} contentFit="contain" />
        <View style={styles.actions}>
          <Pressable style={styles.tile} onPress={() => router.push('/track-order')} hitSlop={6}>
            <Ionicons name="cube-outline" size={22} color={colors.brand.DEFAULT} />
            <Text style={styles.tileLabel}>Track{'\n'}Order</Text>
          </Pressable>
          <Pressable
            style={styles.tile}
            onPress={() => router.push('/info/customer-care')}
            hitSlop={6}
          >
            <Ionicons name="headset-outline" size={22} color={colors.brand.DEFAULT} />
            <Text style={styles.tileLabel}>Customer{'\n'}Care</Text>
          </Pressable>
        </View>
      </View>
      <DeliveryBar />
      <View style={styles.search}>
        <Pressable style={styles.searchTap} onPress={() => router.push('/search')}>
          <Ionicons name="search" size={18} color={colors.text.placeholder} />
          <Text style={styles.searchText} numberOfLines={1}>
            {SEARCH_PLACEHOLDER}
          </Text>
        </Pressable>
        <Pressable
          style={styles.mic}
          onPress={() => setVoice(true)}
          hitSlop={8}
          accessibilityLabel="Search by voice"
        >
          <Ionicons name="mic" size={18} color={colors.white} />
        </Pressable>
      </View>
      <VoiceSearchSheet
        visible={voice}
        onClose={() => setVoice(false)}
        onResult={(text) => {
          setVoice(false);
          router.push({ pathname: '/search', params: { q: text } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.white,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  logo: { width: 140, height: 53 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 'auto' },
  tile: { alignItems: 'center', gap: 2, width: 52 },
  tileLabel: {
    fontFamily: font.uiSemibold,
    fontSize: 9.5,
    lineHeight: 11,
    color: colors.brand.DEFAULT,
    textAlign: 'center',
  },
  search: {
    marginTop: space.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.brand.accent,
    borderRadius: radii.pill,
    paddingLeft: space.lg,
    paddingRight: 4,
    height: 42,
  },
  searchTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, height: '100%' },
  mic: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchText: {
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text.placeholder,
    flexShrink: 1,
  },
});
