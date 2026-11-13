import { useEffect, useRef, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import type { LiveAd } from '@youmart/shared-client';
import { adUrl, openAdLink } from '@/lib/ads';
import { colors, font, space } from '@/theme';

// v1.19 Home "Sponsored" slot: the live image ad (approved + paid), its photos as a swipeable
// carousel that also moves on its own. Nothing shows when no image ad is live.

const AUTO_MS = 3500;

export function SponsoredCarousel({
  ad,
  preview,
  width: fixedWidth,
}: {
  ad: LiveAd | null;
  /** The create-ad preview: no page margins, at `width`. */
  preview?: boolean;
  width?: number;
}) {
  const { width } = useWindowDimensions();
  const cardW = fixedWidth ?? width - space.lg * 2;
  const imgH = Math.round(cardW * 0.56);
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<string>>(null);
  const touching = useRef(false);
  const photos = ad?.media ?? [];

  useEffect(() => setIndex(0), [ad?.adId]);

  useEffect(() => {
    if (photos.length < 2) return;
    const t = setInterval(() => {
      if (touching.current) return;
      setIndex((i) => {
        const next = (i + 1) % photos.length;
        list.current?.scrollToOffset({ offset: next * cardW, animated: true });
        return next;
      });
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [photos.length, cardW]);

  if (!ad || photos.length === 0) return null;

  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    touching.current = false;
    setIndex(Math.round(e.nativeEvent.contentOffset.x / cardW));
  };

  return (
    <View style={[styles.wrap, preview && styles.wrapPreview]}>
      <View style={styles.card}>
        <View style={{ height: imgH }}>
          <FlatList
            ref={list}
            data={photos}
            keyExtractor={(m, i) => `${m}-${i}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScrollBeginDrag={() => {
              touching.current = true;
            }}
            onMomentumScrollEnd={onEnd}
            getItemLayout={(_d, i) => ({ length: cardW, offset: cardW * i, index: i })}
            renderItem={({ item }) => (
              <Pressable onPress={() => openAdLink(ad)} disabled={!ad.linkUrl}>
                <Image
                  source={{ uri: item.startsWith('/') ? adUrl(item) : item }}
                  style={{ width: cardW, height: imgH }}
                  contentFit="cover"
                  transition={200}
                />
              </Pressable>
            )}
          />
          <View style={styles.tag}>
            <Text style={styles.tagText}>Sponsored</Text>
          </View>
          {photos.length > 1 ? (
            <View style={styles.dots}>
              {photos.map((m, i) => (
                <View key={`${m}-${i}`} style={[styles.dot, i === index && styles.dotOn]} />
              ))}
            </View>
          ) : null}
        </View>
        <Pressable
          style={styles.info}
          onPress={() => openAdLink(ad)}
          disabled={!ad.linkUrl}
          accessibilityRole={ad.linkUrl ? 'link' : undefined}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.headline} numberOfLines={1}>
              {ad.headline}
            </Text>
            <Text style={styles.by} numberOfLines={1}>
              {ad.caption ? `${ad.advertiserName} · ${ad.caption}` : ad.advertiserName}
            </Text>
          </View>
          {ad.linkUrl ? (
            <View style={styles.cta}>
              <Text style={styles.ctaText}>Visit</Text>
              <Ionicons name="open-outline" size={13} color={colors.brand.DEFAULT} />
            </View>
          ) : null}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, marginTop: space.md },
  wrapPreview: { paddingHorizontal: 0, marginTop: 0 },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#0b1b3f',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  tag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(15,23,42,0.62)',
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: { fontFamily: font.uiBold, fontSize: 10.5, letterSpacing: 0.4, color: '#ffffff' },
  dots: {
    position: 'absolute',
    bottom: 9,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 5,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.55)' },
  dotOn: { width: 16, backgroundColor: '#ffffff' },
  info: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  headline: { fontFamily: font.uiBold, fontSize: 14.5, color: colors.heading },
  by: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#eef3ff',
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  ctaText: { fontFamily: font.uiBold, fontSize: 12, color: colors.brand.DEFAULT },
});
