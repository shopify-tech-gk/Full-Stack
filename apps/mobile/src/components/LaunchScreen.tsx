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
import { colors, font } from '@/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/logo.png');

/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * One unique icon per store category (+ a few shopping extras), in the order they flow past - mixed
 * so neighbours differ: thin brand-blue outlines, all generated in one style from the
 * MaterialCommunityIcons glyphs (assets/intro-icons) so every line has the same light stroke.
 */
type FlowIcon = { image: number };
const ICONS: FlowIcon[] = [
  { image: require('../../assets/intro-icons/cellphone.png') }, // Electronics
  { image: require('../../assets/intro-icons/tshirt-crew.png') }, // Clothing
  { image: require('../../assets/intro-icons/shoe-sneaker.png') }, // Footwear
  { image: require('../../assets/intro-icons/sofa.png') }, // Furniture
  { image: require('../../assets/intro-icons/headphones.png') },
  { image: require('../../assets/intro-icons/lipstick.png') }, // Cosmetics
  { image: require('../../assets/intro-icons/gift.png') }, // Gifts & Frames
  { image: require('../../assets/intro-icons/fridge.png') }, // Home Appliances
  { image: require('../../assets/intro-icons/watch.png') }, // Wall Clock & Watches
  { image: require('../../assets/intro-icons/toy-brick.png') }, // Toys & Games
  { image: require('../../assets/intro-icons/bag-suitcase.png') }, // Travel & Accessories
  { image: require('../../assets/intro-icons/pot-mix.png') }, // Kitchenware
  { image: require('../../assets/intro-icons/tennis-ball.png') }, // Sports & Fitness
  { image: require('../../assets/intro-icons/lightbulb.png') }, // Electrical and Lights
  { image: require('../../assets/intro-icons/baby-bottle.png') }, // Baby Care
  { image: require('../../assets/intro-icons/pencil.png') }, // Stationary
  { image: require('../../assets/intro-icons/guitar-acoustic.png') }, // Musical Instruments
  { image: require('../../assets/intro-icons/car.png') }, // Auto Accessories
  { image: require('../../assets/intro-icons/paw.png') }, // Pet Supplies
  { image: require('../../assets/intro-icons/party-popper.png') }, // Party Decorations
  { image: require('../../assets/intro-icons/bed.png') }, // Home Furnishing
  { image: require('../../assets/intro-icons/wrench.png') }, // Tools
  { image: require('../../assets/intro-icons/toolbox.png') }, // Hardwares
  { image: require('../../assets/intro-icons/palette.png') }, // Arts and Crafts
  { image: require('../../assets/intro-icons/flower.png') }, // Artificial Flowers and Plants
  { image: require('../../assets/intro-icons/sprout.png') }, // Agri and Gardening
  { image: require('../../assets/intro-icons/bathtub.png') }, // Bath Fittings
  { image: require('../../assets/intro-icons/bucket.png') }, // Cleaning Products
  { image: require('../../assets/intro-icons/temple-hindu.png') }, // Religion
  { image: require('../../assets/intro-icons/shopping.png') },
  { image: require('../../assets/intro-icons/camera.png') },
  { image: require('../../assets/intro-icons/gamepad-variant.png') },
  { image: require('../../assets/intro-icons/coffee.png') },
  { image: require('../../assets/intro-icons/umbrella.png') },
  { image: require('../../assets/intro-icons/basket.png') },
];
/* eslint-enable @typescript-eslint/no-require-imports */

const ICON_SIZE = 36;
/** Space between neighbouring icons in the line. */
const ICON_GAP = 8;
/** How long one icon takes from the screen edge to the logo. */
const SIDE_MS = 2700;

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
  icon: FlowIcon;
  /** When this icon sets off within the cycle (ms). */
  delay: number;
  /** Phase of the gentle up-and-down bob. */
  phase: number;
}

/** The flow's timing for this screen width - steady speed, evenly spaced icons. */
interface Flow {
  /** ms for one icon to cross the whole screen. */
  crossMs: number;
  /** ms between icons. */
  gapMs: number;
  /** ms until the whole list has gone by once (then it repeats). */
  cycleMs: number;
}

/**
 * One icon gliding along a line just below the logo, from the left edge straight across to the
 * right edge. Its position comes from the shared `clock` (ms into the cycle), so every icon runs
 * off one simple looping animation.
 */
function FlowingIcon({
  p,
  flow,
  clock,
  width,
  lineY,
  calm,
}: {
  p: Particle;
  flow: Flow;
  clock: SharedValue<number>;
  width: number;
  /** The flow line's vertical centre (just below the logo). */
  lineY: number;
  /** Reduce Motion: a straight glide, no bob. */
  calm: boolean;
}) {
  const style = useAnimatedStyle(() => {
    // Where this icon is in its own crossing: 0..1 while on screen, otherwise hidden.
    const local = (clock.value - p.delay + flow.cycleMs) % flow.cycleMs;
    if (local >= flow.crossMs) return { opacity: 0 };
    const v = local / flow.crossMs; // steady speed
    const cxp = -ICON_SIZE + (width + ICON_SIZE * 2) * v; // the icon's centre
    const edge = Math.min(1, (cxp + ICON_SIZE / 2) / 24, (width - cxp + ICON_SIZE / 2) / 24);
    const bob = calm ? 0 : Math.sin(v * Math.PI * 6 + p.phase) * 2.5;
    return {
      opacity: Math.max(0, edge),
      transform: [{ translateX: cxp - ICON_SIZE / 2 }, { translateY: lineY + bob - ICON_SIZE / 2 }],
    };
  });

  return (
    <Animated.View style={[styles.particle, { width: ICON_SIZE, height: ICON_SIZE }, style]}>
      <Image source={p.icon.image} style={styles.iconImage} contentFit="contain" />
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
 * Opening animation on every cold start: the YouMart logo in the centre with a steady line of
 * category icons flowing one by one from left to right just below it. Doubles as the loading screen - the app (fonts, session,
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

  const logoHalf = PLATE * 0.42;
  // The icon line sits just under the logo artwork (the logo is ~PLATE/2.64 tall, centred on cy),
  // and the tagline moves below the line.
  const lineY = cy + PLATE * 0.19 + 30;
  const taglineTop = lineY + ICON_SIZE / 2 + 22;
  // Steady flow tuned to the screen: icons close together (ICON_GAP apart) along the line, at the
  // same calm speed as before (SIDE_MS to cover the stretch from the edge to the logo's side).
  const flow = useMemo<Flow>(() => {
    const side = width / 2 - logoHalf + ICON_SIZE;
    const speed = side / SIDE_MS; // px per ms
    const gapMs = Math.round((ICON_SIZE + ICON_GAP) / speed);
    const crossMs = Math.round((width + ICON_SIZE * 2) / speed);
    return { crossMs, gapMs, cycleMs: Math.max(ICONS.length * gapMs, crossMs + gapMs) };
  }, [width, logoHalf]);

  const particles = useMemo<Particle[]>(() => {
    const r = rng(20261015);
    // Delays start one full crossing "in the past", so at time 0 the line is already full on both
    // sides of the logo (icons 0, 1, 2... are mid-way across) instead of starting empty.
    return ICONS.map((icon, i) => ({
      icon,
      delay: (i * flow.gapMs - flow.crossMs + flow.cycleMs) % flow.cycleMs,
      phase: r() * Math.PI * 2,
    }));
  }, [flow]);

  // One clock for the whole flow: counts 0 -> cycle ms, then loops.
  const clock = useSharedValue(0);
  useEffect(() => {
    // ReduceMotion.Never: Reanimated otherwise jumps straight to the end when the phone's Reduce
    // Motion is on (common on iPhones) - the clock froze and icons sat still mid-screen.
    clock.value = 0;
    clock.value = withRepeat(
      withTiming(flow.cycleMs, {
        duration: flow.cycleMs,
        easing: Easing.linear,
        reduceMotion: ReduceMotion.Never,
      }),
      -1,
      false,
      undefined,
      ReduceMotion.Never,
    );
  }, [clock, flow]);

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
          <FlowingIcon
            key={i}
            p={p}
            flow={flow}
            clock={clock}
            width={width}
            lineY={lineY}
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
          style={[styles.taglineWrap, { top: taglineTop }, taglineStyle]}
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
  iconImage: { width: '100%', height: '100%' },
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
