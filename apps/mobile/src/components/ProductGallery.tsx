import { useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { colors, font } from '@/theme';

// v1.17 Product image gallery: swipe between edge-to-edge images (v1.18: the frame takes the first
// photo's shape - tall for clothing, square for packs - so there's no white box around them), a "2 / 5" counter, dots that
// follow the finger while swiping, and a thumbnail strip to jump straight to any image. `children`
// are overlays on the image (save / share buttons).

const BRAND = colors.brand.DEFAULT;
const THUMB = 56;
/** What a View's ref points at (for measuring it on screen). */
type ViewHandle = ComponentRef<typeof View>;

/** v1.18 the photo being held and where it sits on screen (window coordinates). */
export interface PeekTarget {
  src: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function ProductGallery({
  images,
  width,
  children,
  onPeek,
}: {
  images: readonly string[];
  width: number;
  children?: ReactNode;
  /** v1.18 press-and-hold an image: the photo to show full screen; null when the finger lifts. */
  onPeek?: (target: PeekTarget | null) => void;
}) {
  const [index, setIndex] = useState(0);
  const scrollX = useSharedValue(0);
  const ref = useAnimatedRef<Animated.ScrollView>();
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollX.value = e.contentOffset.x;
  });
  const many = images.length > 1;
  // v1.18 photo shapes (height / width) as they load: the frame follows the first one.
  const [ratios, setRatios] = useState<Record<string, number>>({});
  // At most square: a tall clothing photo would otherwise fill the whole screen.
  const frame = Math.min(1, Math.max(0.85, ratios[images[0] ?? ''] ?? 1));
  const height = Math.round(width * frame);
  const fitOf = (src: string) => {
    const r = ratios[src];
    // Close to the frame's shape: fill it (trims only the photo's own white edge); a very
    // different shape stays whole.
    return r == null || Math.abs(r - frame) / frame < 0.18 ? 'cover' : 'contain';
  };

  const [peeking, setPeeking] = useState(false);
  const slides = useRef<Record<number, ViewHandle | null>>({});
  // Still holding? (A quick lift can land before the photo is measured.)
  const holding = useRef(false);
  const peek = (i: number | null) => {
    holding.current = i !== null;
    if (i === null) {
      setPeeking(false);
      onPeek?.(null);
      return;
    }
    const src = images[i];
    const slide = slides.current[i];
    if (!src || !slide) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
    setPeeking(true);
    // Measured so the full view grows out of the photo itself (and shrinks back into it).
    slide.measureInWindow((x, y, w, h) => {
      if (holding.current) onPeek?.({ src, x, y, w, h });
    });
  };

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
          scrollEnabled={!peeking}
          onMomentumScrollEnd={(e) =>
            setIndex(Math.round(e.nativeEvent.contentOffset.x / Math.max(1, width)))
          }
        >
          {images.map((src, i) => (
            <Pressable
              key={`${src}-${i}`}
              ref={(v) => {
                slides.current[i] = v;
              }}
              style={[styles.slide, { width, height }]}
              delayLongPress={220}
              onLongPress={src && onPeek ? () => peek(i) : undefined}
              onPressOut={() => {
                if (peeking) peek(null);
              }}
              accessibilityHint={onPeek ? 'Press and hold to view the full image' : undefined}
            >
              {src && fitOf(src) === 'contain' ? (
                // A tall / wide photo shown whole: the sides are a soft blur of itself, not
                // a white box.
                <Image
                  source={{ uri: src }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  blurRadius={28}
                />
              ) : null}
              {src ? (
                <Image
                  source={{ uri: src }}
                  style={styles.img}
                  contentFit={fitOf(src)}
                  transition={180}
                  onLoad={(e) => {
                    const { width: w, height: h } = e.source;
                    if (w > 0 && h > 0 && ratios[src] == null) {
                      setRatios((prev) => ({ ...prev, [src]: h / w }));
                    }
                  }}
                />
              ) : (
                <Ionicons name="image-outline" size={56} color={colors.card.border} />
              )}
            </Pressable>
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
                    style={[styles.thumbImg, !on && { opacity: 0.6 }]}
                    contentFit="cover"
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

/**
 * v1.18 The photo being held, whole and full screen over the page (Instagram-style peek): it grows
 * out of its place in the gallery on a soft spring, the page dims behind it, and when the finger
 * lifts it glides back into place. It never takes touches, so the lift still reaches the gallery.
 * Mount it once over the whole screen.
 */
export function ImagePeek({ target }: { target: PeekTarget | null }) {
  const root = useRef<ViewHandle>(null);
  // Where this overlay sits in the window (to place the photo's start), and its size.
  const [box, setBox] = useState({ x: 0, y: 0, w: 0, h: 0 });
  const [shown, setShown] = useState<PeekTarget | null>(null);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (target) {
      setShown(target);
      progress.value = withSpring(1, { damping: 21, stiffness: 210, mass: 0.85 });
    } else {
      progress.value = withTiming(
        0,
        { duration: 240, easing: Easing.out(Easing.cubic) },
        (done) => {
          if (done) runOnJS(setShown)(null);
        },
      );
    }
  }, [target, progress]);

  const from = shown
    ? { x: shown.x - box.x, y: shown.y - box.y, w: shown.w, h: shown.h }
    : { x: 0, y: 0, w: 0, h: 0 };
  const to = { x: 0, y: box.h * 0.08, w: box.w, h: box.h * 0.84 };

  const backdrop = useAnimatedStyle(() => ({
    opacity: Math.min(1, Math.max(0, progress.value)),
  }));
  const frame = useAnimatedStyle(() => {
    const t = progress.value;
    const k = Math.min(1, Math.max(0, t));
    return {
      left: from.x + (to.x - from.x) * t,
      top: from.y + (to.y - from.y) * t,
      width: from.w + (to.w - from.w) * t,
      height: from.h + (to.h - from.h) * t,
      borderRadius: 18 * (1 - k),
    };
  });

  return (
    <View
      ref={root}
      pointerEvents="none"
      style={styles.peek}
      onLayout={() => root.current?.measureInWindow((x, y, w, h) => setBox({ x, y, w, h }))}
    >
      {shown ? (
        <>
          <Animated.View style={[styles.peekShade, backdrop]} />
          <Animated.View style={[styles.peekFrame, frame]}>
            <Image source={{ uri: shown.src }} style={styles.img} contentFit="contain" />
          </Animated.View>
        </>
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
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  img: { width: '100%', height: '100%' },
  counter: {
    position: 'absolute',
    top: 14,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(17,24,39,0.62)',
    borderRadius: 6,
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
    overflow: 'hidden',
  },
  thumbOn: { borderColor: BRAND, borderWidth: 2 },
  thumbImg: { width: '100%', height: '100%' },
  peek: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    elevation: 50,
  },
  peekShade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,14,22,0.94)',
  },
  peekFrame: { position: 'absolute', overflow: 'hidden' },
});
