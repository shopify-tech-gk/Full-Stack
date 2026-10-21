import { useState } from 'react';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radii, space } from '@/theme';
import { VoiceSearchSheet } from '@/components/VoiceSearchSheet';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/logo.png');

/** The search box shares the row with the logo here, so it gets the short wording. */
const SHORT_PLACEHOLDER = 'Search products & brands';

/**
 * Header for the inner shopping screens (category, product, wishlist...): back, the YouMart logo
 * (tap = Home) and the same search bar as Home - photo and voice search included - so a shopper
 * can search from anywhere. The Home-only shortcuts (QR login, track order, care, alerts) are left
 * out. `title` (the screen's title, e.g. the category name) shows underneath when set.
 */
export function BrandHeader({
  title,
  right,
  onBack,
}: {
  title?: string;
  /** The screen's own header button (e.g. Recently viewed's "Clear"), shown beside the title. */
  right?: React.ReactNode;
  /** Shown when there is a screen to go back to. */
  onBack?: () => void;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [voice, setVoice] = useState(false);

  const home = () => {
    if (router.canDismiss()) router.dismissAll();
    router.navigate('/');
  };

  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 4 }]}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            hitSlop={10}
            style={({ pressed }) => [styles.back, pressed && styles.pressed]}
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={24} color={colors.brand.DEFAULT} />
          </Pressable>
        ) : null}
        <Pressable onPress={home} hitSlop={6} accessibilityLabel="YouMart home">
          <Image source={LOGO} style={styles.logo} contentFit="contain" />
        </Pressable>

        <View style={styles.search}>
          <Pressable style={styles.searchTap} onPress={() => router.push('/search')}>
            <Ionicons name="search" size={18} color={colors.text.placeholder} />
            <Text style={styles.searchText} numberOfLines={1}>
              {SHORT_PLACEHOLDER}
            </Text>
          </Pressable>
          <Pressable
            style={styles.scan}
            onPress={() => router.push('/lens')}
            hitSlop={8}
            accessibilityLabel="Search with a photo"
          >
            <Ionicons name="camera-outline" size={20} color={colors.brand.DEFAULT} />
          </Pressable>
          <Pressable
            style={styles.mic}
            onPress={() => setVoice(true)}
            hitSlop={8}
            accessibilityLabel="Search by voice"
          >
            <Ionicons name="mic" size={16} color={colors.white} />
          </Pressable>
        </View>
      </View>

      {title || right ? (
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {right}
        </View>
      ) : null}

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
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border.menu,
  },
  // One row: back, logo on the left, then the search bar filling the rest.
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  back: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { backgroundColor: '#eef3ff' },
  logo: { width: 84, height: 34, marginRight: 8 },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: colors.brand.accent,
    borderRadius: radii.pill,
    paddingLeft: space.md,
    paddingRight: 3,
    height: 38,
  },
  searchTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, height: '100%' },
  searchText: {
    fontFamily: font.body,
    fontSize: 13.5,
    color: colors.text.placeholder,
    flexShrink: 1,
  },
  scan: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  mic: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    marginTop: space.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  title: {
    flex: 1,
    fontFamily: font.uiBold,
    fontSize: 16,
    color: colors.heading,
  },
});
