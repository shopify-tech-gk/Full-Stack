import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import {
  ApiError,
  DEMO_PRODUCT_IMAGE,
  type LensProduct,
  type LensResult,
  type ProductCardData,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { categoryMatchByNames, type CategoryMatch } from '@/lib/home-categories';
import { CategoryCard } from '@/components/CategoryCard';
import { ProductCard } from '@/components/ProductCard';
import { useSession } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

/** Longest side sent to the server: plenty to recognise a product, and keeps each search cheap. */
const MAX_SIDE = 1024;

type Phase =
  | { kind: 'camera' }
  | { kind: 'searching'; uri: string }
  | { kind: 'result'; uri: string; result: LensResult }
  | { kind: 'error'; uri: string; message: string };

const toCard = (p: LensProduct): ProductCardData => ({
  id: p.id,
  href: `/product/${p.slug}`,
  title: p.title,
  image: p.imageUrl ?? DEMO_PRODUCT_IMAGE,
  mrp: p.mrp,
  sellingPrice: p.price,
  rating: p.rating ?? 0,
  slug: p.slug,
  ...(p.skuId ? { skuId: p.skuId } : {}),
});

/** Resize to MAX_SIDE on the longest edge and re-encode as JPEG; returns base64 for the API. */
async function prepare(uri: string, width: number, height: number): Promise<string> {
  const scale = Math.min(1, MAX_SIDE / Math.max(width || MAX_SIDE, height || MAX_SIDE));
  let ctx = ImageManipulator.manipulate(uri);
  if (scale < 1 && width && height) {
    ctx = ctx.resize({ width: Math.round(width * scale), height: Math.round(height * scale) });
  }
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.7, format: SaveFormat.JPEG, base64: true });
  if (!saved.base64) throw new Error('No image data');
  return saved.base64;
}

/**
 * YouMart Lens - Google Lens style: photograph a product (or pick one from the gallery) and see
 * what it is, which categories sell it, the same product in our catalogue and related ones.
 */
export default function LensScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenW } = useWindowDimensions();
  const session = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<Phase>({ kind: 'camera' });
  const camera = useRef<CameraView>(null);
  const shooting = useRef(false);

  useEffect(() => {
    if (session.status === 'anonymous') router.replace('/auth/login');
  }, [session.status, router]);

  const search = async (uri: string, width: number, height: number) => {
    setPhase({ kind: 'searching', uri });
    try {
      const image = await prepare(uri, width, height);
      const result = await api.search.lens(image, 'image/jpeg');
      setPhase({ kind: 'result', uri, result });
    } catch (err) {
      setPhase({
        kind: 'error',
        uri,
        message:
          err instanceof ApiError
            ? err.message
            : 'Could not search with this photo. Check your connection and try again.',
      });
    }
  };

  const shoot = async () => {
    if (shooting.current || !camera.current) return;
    shooting.current = true;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.8 });
      if (photo) await search(photo.uri, photo.width, photo.height);
    } catch {
      setPhase({ kind: 'camera' });
    } finally {
      shooting.current = false;
    }
  };

  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    const asset = !res.canceled ? res.assets[0] : undefined;
    if (asset) await search(asset.uri, asset.width, asset.height);
  };

  const openCategory = (c: CategoryMatch) =>
    router.push(`/category/${c.path[c.path.length - 1]}?taxo=${c.path.join('~')}`);

  // ---------- Camera ----------
  if (phase.kind === 'camera') {
    if (!permission) return <View style={styles.black} />;
    if (!permission.granted) {
      return (
        <View style={[styles.permission, { paddingTop: insets.top + space.xl }]}>
          <Pressable style={styles.closeDark} onPress={() => router.back()} hitSlop={10}>
            <Ionicons name="close" size={24} color={colors.text.strong} />
          </Pressable>
          <View style={styles.permIcon}>
            <Ionicons name="camera" size={40} color={colors.brand.DEFAULT} />
          </View>
          <Text style={styles.permTitle}>Search with your camera</Text>
          <Text style={styles.permText}>
            Point your camera at any product and YouMart finds it - or similar ones - for you.
          </Text>
          <Pressable
            style={styles.permBtn}
            onPress={() =>
              permission.canAskAgain ? void requestPermission() : void Linking.openSettings()
            }
          >
            <Text style={styles.permBtnText}>
              {permission.canAskAgain ? 'Allow camera' : 'Open Settings'}
            </Text>
          </Pressable>
          <Pressable style={styles.permLink} onPress={() => void pick()}>
            <Ionicons name="images-outline" size={18} color={colors.brand.DEFAULT} />
            <Text style={styles.permLinkText}>Choose a photo instead</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.black}>
        <CameraView
          ref={camera}
          style={StyleSheet.absoluteFill}
          facing="back"
          enableTorch={torch}
        />
        <View style={styles.guide} pointerEvents="none">
          {['tl', 'tr', 'bl', 'br'].map((c) => (
            <View key={c} style={[styles.corner, styles[c as 'tl']]} />
          ))}
        </View>
        <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
          <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
          <View style={styles.titlePill}>
            <Ionicons name="sparkles" size={15} color={colors.white} />
            <Text style={styles.topTitle}>YouMart Lens</Text>
          </View>
          <Pressable style={styles.roundBtn} onPress={() => setTorch((t) => !t)} hitSlop={8}>
            <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color={colors.white} />
          </Pressable>
        </View>
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + space.xl }]}>
          <Text style={styles.hint}>Point at a product and tap the button</Text>
          <View style={styles.controls}>
            <Pressable style={styles.sideBtn} onPress={() => void pick()} hitSlop={8}>
              <Ionicons name="images" size={24} color={colors.white} />
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.shutter, pressed && { transform: [{ scale: 0.94 }] }]}
              onPress={() => void shoot()}
              accessibilityLabel="Search with this photo"
            >
              <View style={styles.shutterInner}>
                <Ionicons name="search" size={28} color={colors.brand.DEFAULT} />
              </View>
            </Pressable>
            <View style={styles.sideBtnGhost} />
          </View>
        </View>
      </View>
    );
  }

  // ---------- Searching / results ----------
  const cardW = (screenW - space.lg * 2 - space.md) / 2;
  const grid = (items: LensProduct[]) => (
    <View style={styles.grid}>
      {items.map((p) => (
        <ProductCard key={p.id} product={toCard(p)} width={cardW} />
      ))}
    </View>
  );

  const result = phase.kind === 'result' ? phase.result : null;
  const categories = (result?.categories ?? [])
    .map((c) => categoryMatchByNames(c.main, c.sub))
    .filter((c): c is CategoryMatch => c !== null);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={26} color={colors.text.strong} />
        </Pressable>
        <Text style={styles.headerTitle}>YouMart Lens</Text>
        <Pressable
          style={styles.retake}
          onPress={() => setPhase({ kind: 'camera' })}
          disabled={phase.kind === 'searching'}
        >
          <Ionicons name="camera" size={16} color={colors.brand.DEFAULT} />
          <Text style={styles.retakeText}>New photo</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoCard}>
          <Image source={{ uri: phase.uri }} style={styles.photo} contentFit="cover" />
          {phase.kind === 'searching' ? (
            <View style={styles.photoShade}>
              <ActivityIndicator color={colors.white} size="large" />
              <Text style={styles.shadeText}>Finding this product…</Text>
            </View>
          ) : null}
        </View>

        {phase.kind === 'error' ? (
          <View style={styles.message}>
            <Ionicons name="alert-circle" size={36} color={colors.price.discount} />
            <Text style={styles.messageTitle}>Something went wrong</Text>
            <Text style={styles.messageText}>{phase.message}</Text>
            <Pressable style={styles.primary} onPress={() => setPhase({ kind: 'camera' })}>
              <Text style={styles.primaryText}>Try again</Text>
            </Pressable>
          </View>
        ) : null}

        {result && !result.identified ? (
          <View style={styles.message}>
            <Ionicons name="help-circle" size={36} color={colors.text.muted} />
            <Text style={styles.messageTitle}>We couldn&apos;t spot a product</Text>
            <Text style={styles.messageText}>
              Fill the frame with one product, in good light, and try again.
            </Text>
            <Pressable style={styles.primary} onPress={() => setPhase({ kind: 'camera' })}>
              <Text style={styles.primaryText}>Take another photo</Text>
            </Pressable>
          </View>
        ) : null}

        {result?.identified ? (
          <>
            <View style={styles.idCard}>
              <Text style={styles.looksLike}>Looks like</Text>
              <Text style={styles.label}>{result.label}</Text>
              <View style={styles.chips}>
                {[result.brand, result.productType, result.colour]
                  .filter((x): x is string => Boolean(x))
                  .map((x) => (
                    <View key={x} style={styles.chip}>
                      <Text style={styles.chipText}>{x}</Text>
                    </View>
                  ))}
              </View>
              {result.catalogCategories.length > 0 ? (
                <View style={styles.listedRow}>
                  <Text style={styles.listedIn}>Listed in</Text>
                  {result.catalogCategories.map((c) => (
                    <Pressable
                      key={c.id}
                      style={styles.listedChip}
                      onPress={() => router.push(`/category/${c.slug}`)}
                    >
                      <Text style={styles.listedChipText}>{c.name}</Text>
                      <Ionicons name="chevron-forward" size={13} color={colors.white} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

            {categories.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Shop this category</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.catRow}
                >
                  {categories.map((c) => (
                    <View key={c.path.join('/')} style={styles.catItem}>
                      <CategoryCard
                        name={c.name}
                        imageKey={c.imageKey}
                        compact
                        style={styles.catCard}
                        onPress={() => openCategory(c)}
                      />
                      {c.trail ? (
                        <Text style={styles.catTrail} numberOfLines={1}>
                          in {c.trail}
                        </Text>
                      ) : null}
                    </View>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {result.matches.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Same product on YouMart</Text>
                {grid(result.matches)}
              </View>
            ) : (
              <View style={styles.notSold}>
                <Ionicons name="storefront-outline" size={20} color={colors.brand.DEFAULT} />
                <Text style={styles.notSoldText}>
                  We don&apos;t have this exact product yet
                  {result.related.length > 0 ? ' - here are similar ones.' : '.'}
                </Text>
              </View>
            )}

            {result.related.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Related products</Text>
                {grid(result.related)}
              </View>
            ) : null}

            {result.query ? (
              <Pressable
                style={styles.secondary}
                onPress={() => router.push(`/search?q=${encodeURIComponent(result.query ?? '')}`)}
              >
                <Ionicons name="search" size={18} color={colors.brand.DEFAULT} />
                <Text style={styles.secondaryText}>See all results for “{result.query}”</Text>
              </Pressable>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const CORNER = 40;
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  guide: { position: 'absolute', top: '22%', bottom: '28%', left: '10%', right: '10%' },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.white },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 22 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 22 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 22 },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 22,
  },
  topBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  titlePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topTitle: { fontFamily: font.uiBold, fontSize: 16, color: colors.white },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 18 },
  hint: {
    fontFamily: font.uiSemibold,
    fontSize: 14,
    color: colors.white,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '78%',
  },
  sideBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBtnGhost: { width: 50, height: 50 },
  shutter: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 4,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: { flex: 1, backgroundColor: colors.white, alignItems: 'center', padding: space.xl },
  closeDark: { alignSelf: 'flex-start' },
  permIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xxl,
  },
  permTitle: {
    fontFamily: font.uiBold,
    fontSize: 22,
    color: colors.heading,
    marginTop: space.xl,
    textAlign: 'center',
  },
  permText: {
    fontFamily: font.body,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.text.body,
    textAlign: 'center',
    marginTop: space.sm,
  },
  permBtn: {
    marginTop: space.xl,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 32,
    paddingVertical: 14,
  },
  permBtnText: { fontFamily: font.uiBold, fontSize: 15, color: colors.white },
  permLink: { flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: space.lg },
  permLinkText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
  screen: { flex: 1, backgroundColor: colors.page },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    backgroundColor: colors.white,
  },
  headerTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  retake: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  retakeText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  body: { padding: space.lg, gap: space.lg },
  photoCard: { height: 210, borderRadius: 20, overflow: 'hidden', backgroundColor: '#111' },
  photo: { width: '100%', height: '100%' },
  photoShade: {
    ...FILL,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  shadeText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  message: {
    backgroundColor: colors.white,
    borderRadius: 20,
    padding: space.xl,
    alignItems: 'center',
    gap: space.sm,
  },
  messageTitle: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  messageText: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.body,
    textAlign: 'center',
  },
  primary: {
    marginTop: space.sm,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  primaryText: { fontFamily: font.uiBold, fontSize: 15, color: colors.white },
  idCard: { backgroundColor: colors.white, borderRadius: 20, padding: space.lg, gap: 6 },
  looksLike: {
    fontFamily: font.uiSemibold,
    fontSize: 12,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  label: { fontFamily: font.uiBold, fontSize: 22, color: colors.heading },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  chip: {
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  chipText: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.brand.DEFAULT },
  listedRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 6,
    marginTop: 6,
  },
  listedIn: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
  listedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 5,
  },
  listedChipText: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.white },
  section: { gap: space.sm },
  sectionTitle: { fontFamily: font.uiBold, fontSize: 16, color: colors.heading },
  catRow: { gap: space.sm },
  catItem: { width: 104, gap: 4 },
  catCard: { flex: 0 },
  catTrail: {
    fontFamily: font.body,
    fontSize: 10.5,
    color: colors.text.muted,
    textAlign: 'center',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
  notSold: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: space.md,
  },
  notSoldText: { flex: 1, fontFamily: font.uiMedium, fontSize: 14, color: colors.text.strong },
  secondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingVertical: 13,
  },
  secondaryText: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.brand.DEFAULT },
});
