import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  Extrapolation,
  ReduceMotion,
  cancelAnimation,
  interpolate,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, font, space } from '@/theme';

// v1.17 Home: big YouMart banners ("500000+ Products", "8000+ Brands") as an auto-sliding,
// swipeable slider between Top Brands and "Shop our picks". The next banner peeks in; the centred
// one is full size, the others a touch smaller and dimmer; the active dot fills like a timer until
// the next slide; a soft gloss sweeps across now and then. The artwork has a boosted-contrast
// grade (deeper mid-tones) so the pale backgrounds don't look washed out. "Let's Shop Now" opens a product list.

/* eslint-disable @typescript-eslint/no-require-imports */
const BANNERS: { id: string; image: number; href: Href; label: string }[] = [
  {
    id: 'products',
    image: require('../../assets/banners/youmart-500000-products.webp'),
    href: '/rail/explore',
    label: '500000+ products - shop now',
  },
  {
    id: 'brands',
    image: require('../../assets/banners/youmart-8000-brands.webp'),
    href: '/rail/top-deals',
    label: '8000+ brands - shop now',
  },
];
/* eslint-enable @typescript-eslint/no-require-imports */

/** The artwork is 1600 x 622; shown a little taller (2.4:1) - just a sliver of the plain left /
 * right edges is trimmed, nothing important. */
const RATIO = 2.4;
const INTERVAL_MS = 4500;
const GAP = 8;
/** How much of the next banner peeks in at the right. */
const PEEK = 8;
const RM = ReduceMotion.Never;
/** Side margin - small, so the banners are nearly full width. */
const SIDE = 6;

export function BrandBanners() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const bannerWidth = width - SIDE * 2 - PEEK;
  const step = bannerWidth + GAP;
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  const x = useSharedValue(0);
  const progress = useSharedValue(0);
  const [index, setIndex] = useState(0);
  /** Bumped to restart the timer on the same banner (after a swipe). */
  const [round, setRound] = useState(0);
  const touching = useRef(false);

  const onScroll = useAnimatedScrollHandler((e) => {
    x.value = e.contentOffset.x;
  });

  // The timer bar on the active dot; when it fills, move to the next banner.
  useEffect(() => {
    progress.value = 0;
    progress.value = withTiming(1, {
      duration: INTERVAL_MS,
      easing: Easing.linear,
      reduceMotion: RM,
    });
    const t = setTimeout(() => {
      if (touching.current) return;
      const next = (index + 1) % BANNERS.length;
      scrollRef.current?.scrollTo({ x: next * step, animated: true });
      setIndex(next);
    }, INTERVAL_MS);
    return () => clearTimeout(t);
  }, [index, round, step, progress, scrollRef]);

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.tag}>
          <Ionicons name="star" size={10} color="#1f1300" />
          <Text style={styles.tagText}>YOUMART</Text>
        </View>
        <Text style={styles.title}>
          Everything you need, <Text style={styles.titleAccent}>in one place</Text>
        </Text>
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        contentContainerStyle={styles.track}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => {
          touching.current = true;
          cancelAnimation(progress);
        }}
        onMomentumScrollEnd={(e) => {
          touching.current = false;
          const i = Math.round(e.nativeEvent.contentOffset.x / step);
          // Restart the timer from this banner (even if it's the same one).
          setIndex(Math.max(0, Math.min(BANNERS.length - 1, i)));
          setRound((r) => r + 1);
        }}
      >
        {BANNERS.map((b, i) => (
          <Banner
            key={b.id}
            i={i}
            x={x}
            step={step}
            width={bannerWidth}
            image={b.image}
            label={b.label}
            onPress={() => {
              void Haptics.selectionAsync().catch(() => undefined);
              router.push(b.href);
            }}
          />
        ))}
      </Animated.ScrollView>

      <View style={styles.dots}>
        {BANNERS.map((b, i) => (
          <Dot key={b.id} active={i === index} progress={progress} />
        ))}
      </View>
    </View>
  );
}

function Banner({
  i,
  x,
  step,
  width,
  image,
  label,
  onPress,
}: {
  i: number;
  x: SharedValue<number>;
  step: number;
  width: number;
  image: number;
  label: string;
  onPress: () => void;
}) {
  // Centred = full size and bright; neighbours slightly smaller and dimmer.
  const depth = useAnimatedStyle(() => {
    const d = Math.abs(x.value / step - i);
    return {
      opacity: interpolate(d, [0, 1], [1, 0.72], Extrapolation.CLAMP),
      transform: [{ scale: interpolate(d, [0, 1], [1, 0.93], Extrapolation.CLAMP) }],
    };
  });

  // A soft gloss sweeping across every few seconds.
  const sweep = useSharedValue(0);
  useEffect(() => {
    sweep.value = withDelay(
      900 + i * 500,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad), reduceMotion: RM }),
          withTiming(1, { duration: 3200, reduceMotion: RM }),
        ),
        -1,
        false,
        undefined,
        RM,
      ),
      RM,
    );
  }, [sweep, i]);
  const gloss = useAnimatedStyle(() => ({
    opacity: sweep.value > 0 && sweep.value < 1 ? 1 : 0,
    transform: [{ translateX: -140 + sweep.value * (width + 280) }, { rotate: '18deg' }],
  }));

  return (
    <Animated.View style={depth}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.banner,
          { width, height: width / RATIO },
          pressed && styles.pressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        <Image source={image} style={styles.image} contentFit="cover" transition={200} />
        <Animated.View style={[styles.gloss, gloss]} pointerEvents="none" />
        <View style={styles.ring} pointerEvents="none" />
      </Pressable>
    </Animated.View>
  );
}

/** A dot; the active one is a bar that fills while its banner shows. */
function Dot({ active, progress }: { active: boolean; progress: SharedValue<number> }) {
  const fill = useAnimatedStyle(() => ({ width: `${(active ? progress.value : 0) * 100}%` }));
  return (
    <View style={[styles.dot, active && styles.dotOn]}>
      {active ? <Animated.View style={[styles.dotFill, fill]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xxl },
  head: { paddingHorizontal: space.lg, marginBottom: space.md, gap: 5 },
  tag: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: '#ffe500',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: { fontFamily: font.uiBold, fontSize: 9.5, letterSpacing: 0.8, color: '#1f1300' },
  title: { fontFamily: font.uiBold, fontSize: 19, color: colors.heading },
  titleAccent: { color: colors.brand.DEFAULT },
  track: { paddingHorizontal: SIDE, gap: GAP, paddingBottom: 6 },
  banner: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: '#e6efff',
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  pressed: { opacity: 0.94, transform: [{ scale: 0.985 }] },
  image: { width: '100%', height: '100%' },
  gloss: {
    position: 'absolute',
    top: -40,
    bottom: -40,
    width: 70,
    experimental_backgroundImage:
      'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.45) 50%, rgba(255,255,255,0) 100%)',
  },
  ring: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#cfd9ea', overflow: 'hidden' },
  dotOn: { width: 26, backgroundColor: '#d6e2f7' },
  dotFill: { height: '100%', borderRadius: 4, backgroundColor: colors.brand.DEFAULT },
});
