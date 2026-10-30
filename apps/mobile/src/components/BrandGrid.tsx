import { useCallback, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { BrandLogo } from '@/components/BrandLogo';
import { colors, font, space } from '@/theme';

const COLUMNS = 3;
const ROWS = 4;
const PER_PAGE = COLUMNS * ROWS;
const GAP = space.sm;
const AUTO_SWIPE_MS = 4000;

/** Five swipes of brands we sell, spelled as products carry them. Mixed on purpose: every swipe
 * has several kinds of brand, spread out as far as the catalog allows. */
const BRANDS = [
  // Swipe 1
  'Apple',
  'IFFCO URBAN GARDENS',
  'Milton',
  'Pampers',
  'XERGY',
  'Samsung',
  'UGAOO',
  'The Decorshed',
  'Himalaya',
  'Realme',
  'TrustBasket',
  'Crompton',
  // Swipe 2
  'Dell',
  'UTKARSH',
  'Cello',
  'Huggies',
  'BEHOMA',
  'Vivo',
  'Erwon',
  'Borosil',
  'Beats',
  'KRAFTSKALA',
  'Go Garden',
  'Oppo',
  // Swipe 3
  'Lenovo',
  'Lazy Gardener',
  'TIED RIBBONS',
  'MamyPoko',
  'Xiaomi',
  'OrganicDews',
  'Halonix',
  'Leafy Tales',
  'Asus',
  'Urban Plant',
  'Huawei',
  'BIODROPS',
  // Swipe 4
  'OnePlus',
  'ORGANIC PLANT',
  'MAHADHAN',
  'HASTHIP',
  'KYARI',
  'PHILIPS',
  'homecrop',
  'COIR GARDEN',
  'Amazon',
  'Garden Genie',
  'Biostadt',
  'Mitti Soul',
  // Swipe 5
  'wipro',
  'Daily Dump',
  'Pi industries ltd',
  'Nestasia',
  'Hadly',
  'Brigreenery',
  'ecofynd',
  'Orgamify',
  'Sansar Green',
  'Foodie Puppies',
  'Anand Agro Care',
  'MyOwnGarden',
];

const PAGES = Array.from({ length: Math.ceil(BRANDS.length / PER_PAGE) }, (_, i) =>
  BRANDS.slice(i * PER_PAGE, (i + 1) * PER_PAGE),
);

/** v1.17 home: a grid of brand logos that swipes by itself (one page at a time, with dots). It
 * waits while the customer is swiping it or the screen is out of view. */
export function BrandGrid() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);
  const pageRef = useRef(0);
  const [focused, setFocused] = useState(true);
  const [dragging, setDragging] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    if (!focused || dragging) return;
    const timer = setInterval(() => {
      const next = (pageRef.current + 1) % PAGES.length;
      pageRef.current = next;
      setPage(next);
      scroller.current?.scrollTo({ x: next * width, animated: true });
    }, AUTO_SWIPE_MS);
    return () => clearInterval(timer);
  }, [focused, dragging, width]);
  const cell = (width - space.lg * 2 - GAP * (COLUMNS - 1)) / COLUMNS;

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    pageRef.current = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(pageRef.current);
    setDragging(false);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.band} pointerEvents="none" />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.heading}>Shop by Brand</Text>
          <Text style={styles.sub}>Trusted names, all in one place</Text>
        </View>
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        onScrollBeginDrag={() => setDragging(true)}
        onScrollEndDrag={() => setDragging(false)}
        onMomentumScrollEnd={onScrollEnd}
      >
        {PAGES.map((brands, i) => (
          <View key={i} style={[styles.page, { width }]}>
            {brands.map((name) => (
              <Pressable
                key={name}
                style={({ pressed }) => [styles.cell, { width: cell }, pressed && styles.pressed]}
                onPress={() => router.push({ pathname: '/search', params: { q: name } })}
                accessibilityRole="button"
                accessibilityLabel={`Shop ${name}`}
              >
                <BrandLogo name={name} width={cell - 22} height={48} />
              </Pressable>
            ))}
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {PAGES.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: space.xl, paddingTop: space.lg, paddingBottom: space.md },
  // Soft brand tint fading into the page, like the other home sections (no white block).
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    experimental_backgroundImage:
      'linear-gradient(180deg, rgba(1,66,170,0.09) 0%, rgba(1,66,170,0.03) 65%, rgba(255,255,255,0) 100%)',
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  heading: { fontFamily: font.uiBold, fontSize: 19, color: colors.heading },
  sub: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.text.muted, marginTop: 1 },
  page: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
    paddingHorizontal: space.lg,
    paddingVertical: 4,
  },
  cell: {
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#e3e9f3',
    shadowColor: '#0f172a',
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pressed: { opacity: 0.75, transform: [{ scale: 0.97 }] },
  dots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginTop: space.md,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#c9d3e3' },
  dotOn: { width: 20, backgroundColor: colors.brand.DEFAULT },
});
