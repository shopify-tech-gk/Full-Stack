import { useCallback, useEffect, useRef, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  measure,
  runOnJS,
  useAnimatedRef,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { CategoryCard } from '@/components/CategoryCard';
import type { CatNode } from '@/lib/home-categories';
import { colors, font, space } from '@/theme';

const PER_PAGE = 9;
const COLS = 3;
const HPAD = 12; // page horizontal padding (space.md)
const EDGE = 38; // edge zone width that triggers paging while dragging
const EDGE_MS = 450; // dwell between auto-page steps

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/**
 * The home category grid with drag-to-rearrange: long-press a card to pick it up, drag it over
 * another slot to drop it there (everything else shifts relatively), and hold it at the left/right
 * screen edge to page to the next/previous set of 9. The new order is persisted by the caller.
 */
export function DraggableCategoryGrid({
  cats,
  onOpen,
  onMove,
}: {
  cats: CatNode[];
  onOpen: (c: CatNode) => void;
  onMove: (from: number, to: number) => void;
}) {
  const { width } = useWindowDimensions();
  const aref = useAnimatedRef<Animated.ScrollView>();

  const pages = chunk(cats, PER_PAGE);
  const slotW = (width - HPAD * 2) / COLS;
  const [slotH, setSlotH] = useState(slotW * 1.32);

  const [dragging, setDragging] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [activeNode, setActiveNode] = useState<CatNode | null>(null);
  const activeRef = useRef(-1);
  const pageRef = useRef(0);
  const edgeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  // No layout ("slide into place") animation on the tiles: on iOS it left cards stuck mid-move
  // after a drop (overlapping cards, empty slots). Tiles jump to their new places and the one that
  // was dropped gives a small pop instead.
  const [dropped, setDropped] = useState<{ slug: string; n: number } | null>(null);

  // Shared values driven on the UI thread by the pan gesture.
  const overlayX = useSharedValue(0);
  const overlayY = useSharedValue(0);
  const gridX = useSharedValue(0);
  const gridY = useSharedValue(0);
  const viewW = useSharedValue(width);
  const slotHSV = useSharedValue(slotW * 1.32);
  const pageSV = useSharedValue(0);
  const edgeDir = useSharedValue(0);
  const lift = useSharedValue(0); // 0 = resting, 1 = picked up (drives scale/shadow)

  const clearEdge = useCallback(() => {
    if (edgeTimer.current) {
      clearInterval(edgeTimer.current);
      edgeTimer.current = null;
    }
  }, []);

  const setEdge = useCallback(
    (dir: number) => {
      clearEdge();
      if (dir === 0) return;
      edgeTimer.current = setInterval(() => {
        const next = clamp(pageRef.current + dir, 0, pages.length - 1);
        if (next !== pageRef.current) {
          pageRef.current = next;
          pageSV.value = next;
          aref.current?.scrollTo({ x: next * width, animated: true });
        }
      }, EDGE_MS);
    },
    [clearEdge, pages.length, width, aref, pageSV],
  );

  const beginDrag = useCallback(
    (index: number) => {
      activeRef.current = index;
      setActiveIndex(index);
      setActiveNode(cats[index] ?? null);
      setDragging(true);
    },
    [cats],
  );

  const endDrag = useCallback(
    (target: number) => {
      clearEdge();
      const from = activeRef.current;
      activeRef.current = -1;
      setDragging(false);
      setActiveIndex(-1);
      setActiveNode(null);
      if (from >= 0) {
        const slug = cats[from]?.slug;
        if (slug) setDropped((d) => ({ slug, n: (d?.n ?? 0) + 1 }));
        onMove(from, clamp(target, 0, cats.length - 1));
      }
    },
    [clearEdge, onMove, cats],
  );

  const onScrollEnd = useCallback(
    (x: number) => {
      const p = Math.round(x / width);
      pageRef.current = p;
      pageSV.value = p;
    },
    [width, pageSV],
  );

  const makePan = (globalIndex: number) =>
    Gesture.Pan()
      .activateAfterLongPress(250)
      .onStart((e) => {
        'worklet';
        const m = measure(aref);
        if (m) {
          gridX.value = m.pageX;
          gridY.value = m.pageY;
          viewW.value = m.width;
          if (m.height > 0) slotHSV.value = m.height / 3;
        }
        overlayX.value = e.absoluteX;
        overlayY.value = e.absoluteY;
        edgeDir.value = 0;
        lift.value = withSpring(1, { damping: 16, stiffness: 220, mass: 0.6 });
        runOnJS(beginDrag)(globalIndex);
      })
      .onUpdate((e) => {
        'worklet';
        overlayX.value = e.absoluteX;
        overlayY.value = e.absoluteY;
        let dir = 0;
        if (e.absoluteX < gridX.value + EDGE) dir = -1;
        else if (e.absoluteX > gridX.value + viewW.value - EDGE) dir = 1;
        if (dir !== edgeDir.value) {
          edgeDir.value = dir;
          runOnJS(setEdge)(dir);
        }
      })
      .onEnd((e) => {
        'worklet';
        const sw = (viewW.value - HPAD * 2) / COLS;
        const localX = e.absoluteX - gridX.value - HPAD;
        const localY = e.absoluteY - gridY.value;
        let col = Math.floor(localX / sw);
        if (col < 0) col = 0;
        if (col > 2) col = 2;
        let row = Math.floor(localY / slotHSV.value);
        if (row < 0) row = 0;
        if (row > 2) row = 2;
        const target = pageSV.value * PER_PAGE + row * COLS + col;
        lift.value = withTiming(0, { duration: 160 });
        runOnJS(endDrag)(target);
      })
      .onFinalize(() => {
        'worklet';
        if (edgeDir.value !== 0) {
          edgeDir.value = 0;
          runOnJS(setEdge)(0);
        }
      });

  const overlayStyle = useAnimatedStyle(() => {
    const sw = (viewW.value - HPAD * 2) / COLS;
    const scale = 1 + lift.value * 0.08;
    return {
      opacity: 0.6 + lift.value * 0.4,
      shadowOpacity: lift.value * 0.3,
      shadowRadius: 6 + lift.value * 10,
      transform: [
        { translateX: overlayX.value - gridX.value - sw / 2 },
        { translateY: overlayY.value - gridY.value - slotHSV.value / 2 - lift.value * 6 },
        { scale },
      ],
    };
  });

  if (pages.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Shop by category</Text>
        <Text style={styles.hint}>Hold & drag to rearrange</Text>
      </View>

      <View style={styles.gridWrap}>
        <Animated.ScrollView
          ref={aref}
          horizontal
          pagingEnabled
          scrollEnabled={!dragging}
          showsHorizontalScrollIndicator={false}
          decelerationRate="fast"
          onMomentumScrollEnd={(e) => onScrollEnd(e.nativeEvent.contentOffset.x)}
        >
          {pages.map((pageItems, p) => (
            <View
              key={p}
              style={[styles.page, { width }]}
              onLayout={p === 0 ? (e) => setSlotH(e.nativeEvent.layout.height / 3) : undefined}
            >
              {pageItems.map((c, i) => {
                const globalIndex = p * PER_PAGE + i;
                const hidden = dragging && activeIndex === globalIndex;
                return (
                  <DropPop
                    key={c.slug}
                    pop={dropped?.slug === c.slug ? dropped.n : 0}
                    style={styles.slot}
                  >
                    <GestureDetector gesture={makePan(globalIndex)}>
                      <View style={hidden ? styles.hidden : undefined}>
                        <CategoryCard
                          name={c.name}
                          hasChildren={c.hasChildren}
                          imageKey={`mobile/${c.slug}`}
                          compact
                          onPress={() => onOpen(c)}
                        />
                      </View>
                    </GestureDetector>
                  </DropPop>
                );
              })}
            </View>
          ))}
        </Animated.ScrollView>

        {activeNode ? (
          <Animated.View
            pointerEvents="none"
            style={[styles.overlay, { width: slotW, height: slotH }, overlayStyle]}
          >
            <CategoryCard
              name={activeNode.name}
              hasChildren={activeNode.hasChildren}
              imageKey={`mobile/${activeNode.slug}`}
              compact
              onPress={() => {}}
            />
          </Animated.View>
        ) : null}
      </View>

      {pages.length > 1 ? (
        <View style={styles.dots}>
          {pages.map((_, i) => (
            <PageDot key={i} index={i} pageSV={pageSV} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

/** A grid slot; when `pop` changes (this tile was just dropped) it does a quick scale pop. */
function DropPop({
  pop,
  style,
  children,
}: {
  pop: number;
  style: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!pop) return;
    scale.value = withSequence(
      withTiming(1.08, { duration: 120 }),
      withSpring(1, { damping: 9, stiffness: 220 }),
    );
  }, [pop, scale]);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

function PageDot({
  index,
  pageSV,
}: {
  index: number;
  pageSV: ReturnType<typeof useSharedValue<number>>;
}) {
  const style = useAnimatedStyle(() => {
    const on = Math.round(pageSV.value) === index;
    return {
      width: on ? 18 : 7,
      backgroundColor: on ? colors.brand.DEFAULT : colors.card.border,
    };
  });
  return <Animated.View style={[styles.dot, style]} />;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.md },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  title: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  hint: { fontFamily: font.uiMedium, fontSize: 11.5, color: colors.text.muted },
  gridWrap: { position: 'relative', overflow: 'visible' },
  page: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: HPAD,
    rowGap: space.sm,
  },
  slot: { width: '33.333%', paddingHorizontal: space.xs, paddingVertical: space.xs / 2 },
  hidden: { opacity: 0 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: space.xs,
    zIndex: 20,
    elevation: 12,
    shadowColor: colors.brand.DEFAULT,
    shadowOffset: { width: 0, height: 8 },
  },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.lg },
  dot: { height: 7, borderRadius: 4 },
});
