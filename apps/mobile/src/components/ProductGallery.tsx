import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, font } from '@/theme';

// v1.17 Product image gallery: swipe between full (uncropped) images, a "2 / 5" counter, dots that
// follow the finger while swiping, and a thumbnail strip to jump straight to any image. `children`
// are overlays on the image (save / share buttons).

const BRAND = colors.brand.DEFAULT;
const THUMB = 56;

export function ProductGallery({
  images,
  width,
  children,
}: {
  images: readonly string[];
  width: number;
  children?: ReactNode;
}) {
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const ref = useAnimatedRef<Animated.ScrollView>();
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  const many = images.length > 1;
  const height = Math.round(width * 0.92);

  const jump = (i: number) => {
    void Haptics.selectionAsync().catch(() => undefined);
    ref.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  return (
    <View style={styles.wrap}>
      <View style={{ width, height }}>
        <Animated.ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))
          }
        >
          {images.map((src, i) => (
            <View key={`${src}-${i}`} style={[styles.slide, { width, height }]}>
              {src ? (
                <Image
                  source={{ uri: src }}
                  style={styles.img}
                  contentFit="contain"
                  transition={180}
                />
              ) : (
                <Ionicons name="image-outline" size={56} color={colors.card.border} />
              )}
            </View>
          ))}
        </Animated.ScrollView>

        {many ? (
          <>
            <View style={styles.counter} pointerEvents="none">
              <Ionicons name="images-outline" size={12} color={colors.white} />
              <Text style={styles.counterText}>
                {index + 1} / {images.length}
              </Text>
            </View>
            <View style={styles.dots} pointerEvents="none">
              {images.map((_, i) => (
                <Dot key={i} i={i} width={width} scrollX={scrollX} />
              ))}
            </View>
          </>
        ) : null}
        {children}
      </View>

      {many ? (
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.thumbs}
        >
          {images.map((src, i) => {
            const on = i === index;
            return (
              <Pressable
                key={`t-${src}-${i}`}
                onPress={() => jump(i)}
                style={[styles.thumb, on && styles.thumbOn]}
                accessibilityLabel={`Image ${i + 1} of ${images.length}`}
                accessibilityState={{ selected: on }}
              >
                {src ? (
                  <Image
                    source={{ uri: src }}
                    style={[styles.thumbImg, !on && { opacity: 0.55 }]}
                    contentFit="contain"
                  />
                ) : null}
              </Pressable>
            );
          })}
        </Animated.ScrollView>
      ) : null}
    </View>
  );
}

/** Grows into a pill as its image slides in - follows the finger, not just the final page. */
function Dot({ i, width, scrollX }: { i: number; width: number; scrollX: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, 1 - Math.abs(scrollX.value / Math.max(1, width) - i));
    return { width: 6 + 14 * t, opacity: 0.35 + 0.65 * t };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

const styles = StyleSheet.create({
  // The info panel below overlaps 16px (rounded top): the strip's bottom padding keeps it clear.
  wrap: { backgroundColor: colors.white, paddingBottom: 22 },
  slide: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  img: { width: '88%', height: '92%' },
  counter: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(17,24,39,0.62)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  counterText: { fontFamily: font.uiBold, fontSize: 12, color: colors.white, letterSpacing: 0.3 },
  dots: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  dot: { height: 6, borderRadius: 3, backgroundColor: BRAND },
  thumbs: { gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  thumb: {
    width: THUMB,
    height: THUMB,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#e3e8f1',
    backgroundColor: colors.white,
    padding: 4,
    overflow: 'hidden',
  },
  thumbOn: { borderColor: BRAND, borderWidth: 2 },
  thumbImg: { width: '100%', height: '100%' },
});
