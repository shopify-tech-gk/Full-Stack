import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { lookupCategoryImage } from '@/lib/category-images';
import { colors, font, radii } from '@/theme';

/**
 * Portrait category card — the frosted light-blue "podium" look (the desktop sub-category tile
 * placeholder aesthetic), in the YouMart theme. When a bundled image exists for `imageKey` it fills
 * the card; otherwise a soft icon placeholder shows. The category name sits below. Used for main,
 * sub, and sub-to-sub categories.
 */
export function CategoryCard({
  name,
  onPress,
  hasChildren,
  imageKey,
  compact,
}: {
  name: string;
  onPress: () => void;
  hasChildren?: boolean;
  imageKey?: string;
  /** Smaller, square tile that shows the whole image (no crop) — for dense grids (home 3×3). */
  compact?: boolean;
}) {
  const image = lookupCategoryImage(imageKey);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        compact && styles.cardCompact,
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.imageArea, compact && styles.imageAreaCompact]}>
        {image ? (
          <Image
            source={image}
            style={StyleSheet.absoluteFill}
            contentFit={compact ? 'contain' : 'cover'}
            transition={150}
          />
        ) : (
          <>
            {/* Frosted decorative circles (like the mockup) */}
            <View style={[styles.blob, styles.blobTop]} />
            <View style={[styles.blob, styles.blobBottom]} />
            <View style={styles.dots}>
              {[0, 1, 2, 3].map((i) => (
                <View key={i} style={styles.dot} />
              ))}
            </View>
            <View style={[styles.iconWrap, compact && styles.iconWrapCompact]}>
              <Ionicons name="pricetags" size={compact ? 18 : 26} color={colors.brand.DEFAULT} />
            </View>
          </>
        )}
      </View>
      <View style={[styles.footer, compact && styles.footerCompact]}>
        <Text numberOfLines={2} style={[styles.name, compact && styles.nameCompact]}>
          {name}
        </Text>
        <Ionicons
          name="chevron-forward"
          size={14}
          color={colors.brand.DEFAULT}
          style={[styles.chevron, compact && styles.chevronHidden]}
        />
      </View>
      {hasChildren ? <View style={styles.badge} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: radii.categoryCard + 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    overflow: 'hidden',
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  pressed: { opacity: 0.9 },
  imageArea: {
    aspectRatio: 2 / 3,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  blob: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.55)' },
  blobTop: { width: 54, height: 54, top: -18, right: -14 },
  blobBottom: {
    width: 40,
    height: 40,
    bottom: -12,
    left: -10,
    backgroundColor: 'rgba(1,66,170,0.06)',
  },
  dots: { position: 'absolute', top: 8, left: 8, flexDirection: 'row', gap: 3 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(1,66,170,0.18)' },
  iconWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.brandPopup.border,
  },
  name: {
    flex: 1,
    fontFamily: font.uiSemibold,
    fontSize: 12,
    lineHeight: 15,
    color: colors.heading,
  },
  chevron: { opacity: 0.8 },
  chevronHidden: { display: 'none' },
  cardCompact: {
    borderRadius: radii.categoryCard,
    shadowOpacity: 0.08,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  imageAreaCompact: { aspectRatio: 1 },
  iconWrapCompact: { width: 34, height: 34, borderRadius: 17 },
  footerCompact: { paddingHorizontal: 6, paddingVertical: 6, justifyContent: 'center' },
  nameCompact: { fontSize: 10.5, lineHeight: 13, textAlign: 'center' },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.brand.DEFAULT,
  },
});
