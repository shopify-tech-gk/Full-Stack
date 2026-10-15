import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { lookupCategoryImage } from '@/lib/category-images';
import { colors, font } from '@/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/logo.png');

/** Mixed products for the rain - the app's own bundled category artwork (works offline). */
const PRODUCT_KEYS = [
  'electronics/headphones/over-ear-headphones',
  'electronics/headphones/tws-earbuds',
  'electronics/speakers/bluetooth-speakers',
  'electronics/cameras/dslr-cameras',
  'clothing/sarees-and-saree-essentials/sarees',
  'clothing/ethnic-wear/kurtas',
  'cosmetics/makeup/lipstick',
  'cosmetics/fragrances/perfumes',
  'footwear/sports-footwear/running-shoes',
  'wall-clock-watches/watches/analog-watches',
  'fashion-jewellery/rings/cocktail-rings',
  'fashion-jewellery/earrings/drop-earrings',
  'travel-accessories/travel-bags/backpacks',
  'electrical-and-lights/decorative-lights/table-lamps',
  'home-appliances/small-kitchen-appliances/air-fryers',
  'musical-instruments/guitars/acoustic-guitars',
  'sports-fitness/cricket/cricket-bats',
  'furniture/chairs/office-chairs',
  'agri-and-gardening/plant-saplings/indoor-plants',
  'kitchenware/plastic-household/water-bottles',
];
const SOURCES = PRODUCT_KEYS.map(lookupCategoryImage).filter((s) => s !== undefined);

const PARTICLES = 54;
/** The intro runs at least this long, then fades as soon as the app is ready underneath. */
const MIN_MS = 5600;
const FADE_MS = 450;

/** Deterministic pseudo-random, so the layout is stable across re-renders. */
function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Particle {
  source: (typeof SOURCES)[number];
  startX: number;
  size: number;
  duration: number;
  delay: number;
  rot: number;
  spin: number;
}

function FallingProduct({ p, cx, cy }: { p: Particle; cx: number; cy: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    // Staggered start, then a continuous loop - a steady stream, never one by one.
    t.value = withDelay(
      p.delay,
      withRepeat(withTiming(1, { duration: p.duration, easing: Easing.linear }), -1, false),
    );
  }, [t, p.delay, p.duration]);

  const style = useAnimatedStyle(() => {
    const v = t.value;
    // Falls mostly straight at first, then is pulled sideways into the logo (ease-in on x).
    const pull = v * v * v;
    const x = p.startX + (cx - p.startX) * pull - p.size / 2;
    const y = -p.size + (cy + p.size) * (v * (0.55 + 0.45 * v)) - p.size / 2;
    const shrink = v < 0.72 ? 1 : 1 - ((v - 0.72) / 0.28) * 0.85;
    const opacity = v < 0.06 ? v / 0.06 : v > 0.82 ? Math.max(0, (1 - v) / 0.18) : 1;
    return {
      opacity,
      transform: [
        { translateX: x },
        { translateY: y },
        { scale: shrink },
        { rotate: `${p.rot + p.spin * v}deg` },
      ],
    };
  });

  return (
    <Animated.View
      style={[
        styles.particle,
        { width: p.size, height: p.size, borderRadius: p.size * 0.28 },
        style,
      ]}
    >
      <Image source={p.source} style={styles.particleImage} contentFit="cover" />
    </Animated.View>
  );
}

function useEntrance(
  delay: number,
  from = 0.6,
): {
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
} {
  const opacity = useSharedValue(0);
  const scale = useSharedValue(from);
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 450 }));
    scale.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 120 }));
  }, [opacity, scale, delay]);
  return { opacity, scale };
}

/**
 * Opening animation on every cold start: the YouMart logo in the centre while a continuous rain of
 * mini product pictures pours into it. Doubles as the loading screen - the app (fonts, session,
 * cart) starts underneath, and the intro fades once both the minimum time has passed and `ready`
 * is true. Tap to skip. With Reduce Motion on, only the logo fades in.
 */
export function LaunchScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const cx = width / 2;
  const cy = height * 0.46;

  const particles = useMemo<Particle[]>(() => {
    if (SOURCES.length === 0) return [];
    const r = rng(20261015);
    return Array.from({ length: PARTICLES }, (_, i) => ({
      source: SOURCES[i % SOURCES.length]!,
      startX: -20 + r() * (width + 40),
      size: 24 + Math.round(r() * 16),
      duration: 1500 + Math.round(r() * 900),
      // Spread the first drops over ~1.6s so the stream is already full, then it just keeps going.
      delay: Math.round(r() * 1600),
      rot: -25 + r() * 50,
      spin: -120 + r() * 240,
    }));
  }, [width]);

  const logo = useEntrance(0);
  const tagline = useEntrance(2600, 0.9);
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.35);
  const fade = useSharedValue(1);

  useEffect(() => {
    // A gentle heartbeat while products pour in - it also covers a slow start (waiting on `ready`).
    pulse.value = withDelay(
      500,
      withRepeat(
        withSequence(withTiming(1.06, { duration: 320 }), withTiming(1, { duration: 420 })),
        -1,
        false,
      ),
    );
    glow.value = withRepeat(
      withSequence(withTiming(0.75, { duration: 900 }), withTiming(0.35, { duration: 900 })),
      -1,
      false,
    );
  }, [pulse, glow]);

  const [minDone, setMinDone] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setMinDone(true), reduceMotion ? 1000 : MIN_MS);
    return () => clearTimeout(id);
  }, [reduceMotion]);

  const finished = useRef(false);
  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    fade.value = withTiming(0, { duration: FADE_MS, easing: Easing.out(Easing.quad) });
    setTimeout(onDone, FADE_MS + 20);
  };

  useEffect(() => {
    if (minDone && ready) finish();
  }, [minDone, ready]);

  const rootStyle = useAnimatedStyle(() => ({
    opacity: fade.value,
    transform: [{ scale: 1 + (1 - fade.value) * 0.08 }],
  }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: logo.opacity.value,
    transform: [{ scale: logo.scale.value * pulse.value }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value * logo.opacity.value,
    transform: [{ scale: 0.9 + glow.value * 0.25 }],
  }));
  const taglineStyle = useAnimatedStyle(() => ({
    opacity: tagline.opacity.value,
    transform: [{ translateY: (1 - tagline.scale.value) * 60 }],
  }));

  const PLATE = Math.min(width * 0.62, 260);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityLabel="Skip intro">
        <View style={[StyleSheet.absoluteFill, styles.halo]} pointerEvents="none" />

        {reduceMotion
          ? null
          : particles.map((p, i) => <FallingProduct key={i} p={p} cx={cx} cy={cy} />)}

        <View
          pointerEvents="none"
          style={[styles.center, { top: cy - PLATE * 0.42, height: PLATE * 0.84 }]}
        >
          <Animated.View
            style={[
              styles.glow,
              { width: PLATE * 1.25, height: PLATE * 1.25, borderRadius: PLATE },
              glowStyle,
            ]}
          />
          <Animated.View
            style={[
              styles.plate,
              { width: PLATE, height: PLATE * 0.62, borderRadius: PLATE * 0.16 },
              logoStyle,
            ]}
          >
            <Image source={LOGO} style={styles.logo} contentFit="contain" />
          </Animated.View>
        </View>

        <Animated.View
          pointerEvents="none"
          style={[styles.taglineWrap, { top: cy + PLATE * 0.42 + 18 }, taglineStyle]}
        >
          <Text style={styles.tagline}>Shop Easy, Live Better</Text>
          <View style={styles.taglineBar} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: {
    zIndex: 1000,
    elevation: 1000,
    backgroundColor: '#e3f0ff',
    experimental_backgroundImage: 'linear-gradient(180deg, #f4f9ff 0%, #dcecff 55%, #c7e0ff 100%)',
  },
  halo: {
    experimental_backgroundImage:
      'radial-gradient(circle at 50% 46%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 45%)',
  },
  particle: {
    position: 'absolute',
    left: 0,
    top: 0,
    overflow: 'hidden',
    backgroundColor: colors.white,
    borderWidth: 1.5,
    borderColor: colors.white,
    shadowColor: '#0b3d91',
    shadowOpacity: 0.18,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  particleImage: { width: '100%', height: '100%' },
  center: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    experimental_backgroundImage:
      'radial-gradient(circle, rgba(32,138,239,0.45) 0%, rgba(32,138,239,0) 65%)',
  },
  plate: {
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    shadowColor: '#0b3d91',
    shadowOpacity: 0.25,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(32,138,239,0.18)',
  },
  logo: { width: '100%', height: '78%' },
  taglineWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  tagline: {
    fontFamily: font.uiSemibold,
    fontSize: 17,
    letterSpacing: 0.6,
    color: colors.brand.DEFAULT,
  },
  taglineBar: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.brand.accent },
});
