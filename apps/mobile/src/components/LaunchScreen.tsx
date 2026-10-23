import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ReduceMotion,
  type SharedValue,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, font } from '@/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/logo.png');

/**
 * Shopping icons for the flow (only on this screen), drawn Flipkart-style in YouMart's colours: the
 * solid shape in logo yellow under its outline in brand blue. Each name has a `-outline` variant.
 */
const ICONS = [
  'shopping',
  'tshirt-crew',
  'lamp',
  'gift',
  'sofa',
  'bottle-tonic',
  'camera',
  'bag-personal',
  'gamepad-variant',
  'fridge',
  'food-apple',
  'toy-brick',
  'book-open-variant',
  'baby-bottle',
  'blender',
  'bag-suitcase',
  'palette',
  'flower',
] as const;
type IconName = (typeof ICONS)[number];

const BLUE = colors.brand.DEFAULT;
/** The yellow of "MART" in the logo. */
const YELLOW = '#ffe500';

/** Products drift across one after another: a new one every FLOW_GAP ms, each crossing in FLOW_MS,
 * so two or three are on screen at a time. */
const PARTICLES = 12;
const FLOW_MS = 3200;
const FLOW_GAP = 1000;
const FLOW_CYCLE = PARTICLES * FLOW_GAP;
/** The intro runs at least this long, then fades as soon as the app is ready underneath. */
const MIN_MS = 4500;
/** ...but never longer than this, even if the app is still starting (e.g. a slow sign-in check):
 * the app shows its own loading states underneath. */
const MAX_MS = 7000;
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
  icon: IconName;
  /** Vertical offset from the logo's centre line. */
  lane: number;
  size: number;
  delay: number;
  rot: number;
  /** Phase of the gentle up-and-down wave. */
  phase: number;
}

/** One small shopping icon gliding in from the left edge, into the logo, and back out of its right side.
 * Its position comes from the shared `clock` (ms into the cycle), so every product runs off one simple
 * looping animation. */
function FlowingProduct({
  p,
  clock,
  width,
  cy,
  logoHalf,
  calm,
}: {
  p: Particle;
  clock: SharedValue<number>;
  width: number;
  cy: number;
  /** Half the logo's visible width: the product is hidden while "inside" it. */
  logoHalf: number;
  /** Reduce Motion: a straight glide, no bob or tilt. */
  calm: boolean;
}) {
  const style = useAnimatedStyle(() => {
    // Where this product is in its own crossing: 0..1 while on screen, otherwise hidden.
    const local = (clock.value - p.delay + FLOW_CYCLE) % FLOW_CYCLE;
    if (local >= FLOW_MS) return { opacity: 0 };
    const v = local / FLOW_MS; // steady speed - a calm flow
    const cxp = -p.size + (width + p.size * 2) * v; // the product's centre
    const left = width / 2 - logoHalf;
    const right = width / 2 + logoHalf;
    // Distance outside the logo (0 at its edge): shrink + fade going in, grow + appear coming out.
    const out = cxp < left ? left - cxp : cxp > right ? cxp - right : 0;
    const near = Math.min(1, out / 36);
    const edge = Math.min(1, cxp / 30, (width - cxp) / 30);
    const y = cy + p.lane + (calm ? 0 : Math.sin(v * Math.PI * 4 + p.phase) * 3) - p.size / 2;
    return {
      opacity: Math.max(0, Math.min(near, edge)),
      transform: [
        { translateX: cxp - p.size / 2 },
        { translateY: y },
        { scale: 0.5 + 0.5 * near },
        { rotate: `${calm ? 0 : p.rot}deg` },
      ],
    };
  });

  return (
    <Animated.View style={[styles.particle, { width: p.size, height: p.size }, style]}>
      {/* Two-tone: yellow solid shape, blue outline on top. */}
      <MaterialCommunityIcons
        name={p.icon}
        size={p.size}
        color={YELLOW}
        style={StyleSheet.absoluteFill}
      />
      <MaterialCommunityIcons name={`${p.icon}-outline`} size={p.size} color={BLUE} />
    </Animated.View>
  );
}

/** "Loading your store" with three pulsing dots, shown only while the app is still starting. */
function StillLoading() {
  return (
    <Animated.View entering={FadeIn.duration(300)} style={styles.loading}>
      <Text style={styles.loadingText}>Loading your store</Text>
      <View style={styles.dots}>
        {[0, 1, 2].map((i) => (
          <LoadingDot key={i} delay={i * 160} />
        ))}
      </View>
    </Animated.View>
  );
}

function LoadingDot({ delay }: { delay: number }) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(
      delay,
      withRepeat(
        withTiming(1, {
          duration: 450,
          easing: Easing.inOut(Easing.quad),
          reduceMotion: ReduceMotion.Never,
        }),
        -1,
        true,
        undefined,
        ReduceMotion.Never,
      ),
    );
  }, [v, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.3 + v.value * 0.7,
    transform: [{ translateY: -v.value * 3 }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
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
 * Opening animation on every cold start: the YouMart logo in the centre while small shopping icons
 * glide in from the left, disappear into it and come out of its right side, two or three at a time. Doubles as the loading screen - the app (fonts, session,
 * cart) starts underneath, and the intro fades once both the minimum time has passed and `ready`
 * is true. Tap to skip. With Reduce Motion on (common on iPhones) the products still flow, just in a
 * straight line without the bob and tilt.
 */
export function LaunchScreen({ ready, onDone }: { ready: boolean; onDone: () => void }) {
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const cy = height * 0.46;
  // The logo box (smaller than before; no white card behind it any more).
  const PLATE = Math.min(width * 0.46, 190);

  const particles = useMemo<Particle[]>(() => {
    const r = rng(20261015);
    // Along the logo's centre line, a little above / below so consecutive products vary.
    const lanes = [-8, 6, -2, 10, -10, 2];
    return Array.from({ length: PARTICLES }, (_, i) => ({
      icon: ICONS[i % ICONS.length]!,
      lane: lanes[i % lanes.length]! + (r() - 0.5) * 16,
      size: 26 + Math.round(r() * 6),
      delay: i * FLOW_GAP,
      rot: -8 + r() * 16,
      phase: r() * Math.PI * 2,
    }));
  }, [width]);

  // One clock for the whole product flow: counts 0 -> FLOW_CYCLE ms, then loops.
  const clock = useSharedValue(0);
  useEffect(() => {
    // ReduceMotion.Never: Reanimated otherwise jumps straight to the end when the phone's Reduce
    // Motion is on (common on iPhones) - the clock froze and products sat still mid-screen.
    clock.value = withRepeat(
      withTiming(FLOW_CYCLE, {
        duration: FLOW_CYCLE,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [clock]);

  const logo = useEntrance(0);
  const tagline = useEntrance(2600, 0.9);
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0.35);
  const fade = useSharedValue(1);

  useEffect(() => {
    // A gentle heartbeat while products glide past - it also covers a slow start (waiting on `ready`).
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
    const id = setTimeout(() => setMinDone(true), MIN_MS);
    return () => clearTimeout(id);
  }, []);

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

  useEffect(() => {
    const id = setTimeout(finish, MAX_MS);
    return () => clearTimeout(id);
  }, []);

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

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityLabel="Skip intro">
        <View style={[StyleSheet.absoluteFill, styles.halo]} pointerEvents="none" />

        {particles.map((p, i) => (
          <FlowingProduct
            key={i}
            p={p}
            clock={clock}
            width={width}
            cy={cy}
            logoHalf={PLATE * 0.42}
            calm={reduceMotion}
          />
        ))}

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
          {/* The intro's minimum time is up but the app is still starting: say so. */}
          {minDone && !ready ? <StillLoading /> : null}
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
  particle: { position: 'absolute', left: 0, top: 0 },
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
  plate: { alignItems: 'center', justifyContent: 'center' },
  logo: { width: '100%', height: '100%' },
  taglineWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 8 },
  tagline: {
    fontFamily: font.uiSemibold,
    fontSize: 17,
    letterSpacing: 0.6,
    color: colors.brand.DEFAULT,
  },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 },
  loadingText: { fontFamily: font.uiMedium, fontSize: 13, color: colors.text.muted },
  dots: { flexDirection: 'row', gap: 4, alignItems: 'center', height: 12 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brand.DEFAULT },
  taglineBar: { width: 44, height: 3, borderRadius: 2, backgroundColor: colors.brand.accent },
});
