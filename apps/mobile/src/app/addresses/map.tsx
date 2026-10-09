import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, type Region } from 'react-native-maps';
import Animated, {
  FadeIn,
  SlideInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSession } from '@/stores/session';
import { YOUMART_MAP_STYLE } from '@/lib/map-style';
import { colors, font, radii, space } from '@/theme';

const INDIA: Region = {
  latitude: 20.5937,
  longitude: 78.9629,
  latitudeDelta: 18,
  longitudeDelta: 18,
};
const STREET_DELTA = 0.0045;
const CITY_DELTA = 0.06;

type Coords = { latitude: number; longitude: number };
type Place = {
  title: string;
  subtitle: string;
  fields: Record<string, string>;
};
type CardState =
  { kind: 'locating' } | { kind: 'loading' } | { kind: 'ready'; place: Place } | { kind: 'error' };

const uniq = (parts: (string | null | undefined)[]) =>
  parts.filter((p, i, a): p is string => Boolean(p) && a.indexOf(p) === i);

/** Reverse-geocodes a point into a display title/subtitle + address-form fields. */
async function lookup(c: Coords): Promise<Place | null> {
  const [p] = await Location.reverseGeocodeAsync(c);
  if (!p) return null;
  const line1 = uniq([p.name, p.street]).join(', ');
  const city = p.city ?? p.subregion ?? '';
  const fields: Record<string, string> = {};
  if (line1) fields.line1 = line1;
  if (p.district) fields.landmark = p.district;
  if (city) fields.city = city;
  if (p.region) fields.state = p.region;
  if (p.postalCode) fields.pincode = p.postalCode;
  return {
    title: line1 || p.district || city || 'Selected location',
    subtitle: uniq([p.district, city, p.region, p.postalCode]).join(', '),
    fields,
  };
}

/**
 * YouMart location picker: a brand-styled in-app map with a fixed centre pin. The customer moves
 * the map under the pin to their exact spot; the pin lifts while moving and drops with a bounce, the
 * address under it appears in the card, and Confirm opens the address form pre-filled.
 */
export default function MapPickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const params = useLocalSearchParams<{ mode?: string; lat?: string; lng?: string }>();
  const detect = params.mode === 'detect';
  const startAt =
    params.lat && params.lng
      ? { latitude: Number(params.lat), longitude: Number(params.lng) }
      : null;

  const mapRef = useRef<MapView>(null);
  const reqId = useRef(0);
  const center = useRef<Coords | null>(startAt);
  const mapReady = useRef(false);
  const pendingFly = useRef<{ c: Coords; duration: number } | null>(null);
  const [gps, setGps] = useState<Coords | null>(null);
  // Where the map first opens. null = still finding the customer (branded loader, no map yet),
  // so the map never starts on a country-wide view when we can place them on their street.
  const [initial, setInitial] = useState<Region | null>(
    startAt ? { ...startAt, latitudeDelta: STREET_DELTA, longitudeDelta: STREET_DELTA } : null,
  );
  const [denied, setDenied] = useState(false);
  const [card, setCard] = useState<CardState>(startAt ? { kind: 'loading' } : { kind: 'locating' });

  const lift = useSharedValue(0);
  const shimmer = useSharedValue(0.45);

  useEffect(() => {
    shimmer.value = withRepeat(
      withSequence(withTiming(1, { duration: 650 }), withTiming(0.45, { duration: 650 })),
      -1,
    );
  }, [shimmer]);

  const resolve = useCallback(async (c: Coords) => {
    const id = (reqId.current += 1);
    setCard({ kind: 'loading' });
    try {
      const place = await lookup(c);
      if (reqId.current !== id) return;
      setCard(place ? { kind: 'ready', place } : { kind: 'error' });
    } catch {
      if (reqId.current === id) setCard({ kind: 'error' });
    }
  }, []);

  // Camera moves sent before the native map is ready are silently dropped, so queue them.
  const flyTo = useCallback((c: Coords, duration = 1200) => {
    if (!mapReady.current || !mapRef.current) {
      pendingFly.current = { c, duration };
      return;
    }
    mapRef.current.animateToRegion(
      { ...c, latitudeDelta: STREET_DELTA, longitudeDelta: STREET_DELTA },
      duration,
    );
  }, []);

  const onMapReady = () => {
    mapReady.current = true;
    if (pendingFly.current) {
      const { c, duration } = pendingFly.current;
      pendingFly.current = null;
      flyTo(c, duration);
    }
  };

  // Find the customer before showing the map: last-known fix opens it instantly at their city,
  // then it zooms to the street; a fresher GPS fix glides there. Reopening a spot skips this.
  useEffect(() => {
    let active = true;
    const openAt = (c: Coords) => {
      setInitial((prev) => prev ?? { ...c, latitudeDelta: CITY_DELTA, longitudeDelta: CITY_DELTA });
      flyTo(c);
    };
    const fallback = setTimeout(() => {
      if (!active) return;
      setInitial((prev) => prev ?? INDIA);
    }, 6000);
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (status !== 'granted') {
        clearTimeout(fallback);
        setDenied(true);
        setInitial((prev) => prev ?? INDIA);
        if (!startAt) setCard({ kind: 'error' });
        return;
      }
      const last = await Location.getLastKnownPositionAsync({ maxAge: 30 * 60 * 1000 }).catch(
        () => null,
      );
      if (last && active) {
        const c = { latitude: last.coords.latitude, longitude: last.coords.longitude };
        setGps(c);
        if (!startAt) openAt(c);
      }
      const now = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }).catch(() => null);
      if (!active) return;
      clearTimeout(fallback);
      if (now) {
        const c = { latitude: now.coords.latitude, longitude: now.coords.longitude };
        setGps(c);
        if (!startAt) openAt(c);
      } else if (!last) {
        setInitial((prev) => prev ?? INDIA);
        if (!startAt) setCard({ kind: 'error' });
      }
    })();
    return () => {
      active = false;
      clearTimeout(fallback);
    };
    // Runs once on open; startAt/flyTo are stable for this screen's lifetime.
  }, []);

  const onMoveStart = () => {
    lift.value = withSpring(1, { damping: 18, stiffness: 260 });
  };

  const onMoveEnd = (r: Region) => {
    lift.value = withSpring(0, { damping: 7, stiffness: 240, mass: 0.7 });
    // Ignore the country-wide starting view; only street-level positions are real picks.
    if (r.latitudeDelta > 0.2) return;
    center.current = { latitude: r.latitude, longitude: r.longitude };
    void resolve(center.current);
  };

  const confirm = () => {
    if (card.kind !== 'ready' || !center.current) return;
    const user = session.status === 'authenticated' ? session.user : null;
    router.replace({
      pathname: '/addresses/form',
      params: {
        source: detect ? 'location' : 'map',
        lat: String(center.current.latitude),
        lng: String(center.current.longitude),
        ...(user?.name ? { fullName: user.name } : {}),
        ...(user?.phone ? { phone: user.phone } : {}),
        ...card.place.fields,
      },
    });
  };

  const pinStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -lift.value * 16 }, { scale: 1 + lift.value * 0.06 }],
  }));
  const groundStyle = useAnimatedStyle(() => ({
    opacity: 0.35 - lift.value * 0.2,
    transform: [{ scaleX: 1 - lift.value * 0.45 }, { scaleY: 1 - lift.value * 0.45 }],
  }));
  const shimmerStyle = useAnimatedStyle(() => ({ opacity: shimmer.value }));

  return (
    <View style={styles.screen}>
      {initial ? (
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          customMapStyle={YOUMART_MAP_STYLE}
          mapType={Platform.OS === 'ios' ? 'mutedStandard' : 'standard'}
          initialRegion={initial}
          onMapReady={onMapReady}
          onRegionChangeStart={onMoveStart}
          onRegionChangeComplete={onMoveEnd}
          showsUserLocation={false}
          showsMyLocationButton={false}
          showsCompass={false}
          showsScale={false}
          showsBuildings={false}
          showsTraffic={false}
          showsIndoors={false}
          showsPointsOfInterests={false}
          toolbarEnabled={false}
          pitchEnabled={false}
          rotateEnabled={false}
          userInterfaceStyle="light"
        >
          {gps ? (
            <Marker coordinate={gps} anchor={{ x: 0.5, y: 0.5 }} tracksViewChanges={false}>
              <View style={styles.gpsHalo}>
                <View style={styles.gpsDot} />
              </View>
            </Marker>
          ) : null}
        </MapView>
      ) : (
        <View style={styles.finding}>
          <Animated.View style={[styles.findingRing, shimmerStyle]} />
          <View style={styles.pinHead}>
            <Ionicons name="cart" size={18} color={colors.white} />
          </View>
          <Text style={styles.findingText}>Finding your location…</Text>
        </View>
      )}

      {/* Light brand wash so Apple's muted map shares the YouMart palette (Android is styled). */}
      {initial && Platform.OS === 'ios' ? <View pointerEvents="none" style={styles.tint} /> : null}

      {/* Fixed centre pin: its tip sits exactly on the map centre. */}
      {initial ? (
        <View pointerEvents="none" style={styles.pinLayer}>
          <View style={styles.pinBox}>
            <Animated.View style={[styles.pin, pinStyle]}>
              <View style={styles.pinHead}>
                <Ionicons name="cart" size={18} color={colors.white} />
              </View>
              <View style={styles.pinStem} />
            </Animated.View>
            <View style={styles.pinSpacer}>
              <Animated.View style={[styles.ground, groundStyle]} />
            </View>
          </View>
        </View>
      ) : null}

      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={6}>
          <Ionicons name="arrow-back" size={20} color={colors.heading} />
        </Pressable>
        <Animated.View entering={FadeIn.duration(400).delay(300)} style={styles.hint}>
          <Ionicons name="hand-left-outline" size={14} color={colors.brand.DEFAULT} />
          <Text style={styles.hintText}>Move the map to place the pin</Text>
        </Animated.View>
      </View>

      <Animated.View
        entering={SlideInDown.springify().damping(18)}
        style={[styles.card, { bottom: insets.bottom + 28 }]}
      >
        <Pressable
          style={styles.locateBtn}
          onPress={() => (gps ? flyTo(gps, 700) : undefined)}
          disabled={!gps}
        >
          <Ionicons
            name="locate"
            size={20}
            color={gps ? colors.brand.DEFAULT : colors.text.muted}
          />
        </Pressable>

        <Text style={styles.cardEyebrow}>
          {detect ? 'Your current location' : 'Delivery location'}
        </Text>

        {card.kind === 'ready' ? (
          <Animated.View
            key={card.place.title + card.place.subtitle}
            entering={FadeIn.duration(220)}
          >
            <View style={styles.addrRow}>
              <View style={styles.addrIcon}>
                <Ionicons name="location" size={18} color={colors.brand.DEFAULT} />
              </View>
              <View style={styles.addrText}>
                <Text numberOfLines={1} style={styles.addrTitle}>
                  {card.place.title}
                </Text>
                {card.place.subtitle ? (
                  <Text numberOfLines={2} style={styles.addrSub}>
                    {card.place.subtitle}
                  </Text>
                ) : null}
              </View>
            </View>
          </Animated.View>
        ) : card.kind === 'error' ? (
          <View style={styles.addrRow}>
            <View style={styles.addrIcon}>
              <Ionicons name="alert-circle-outline" size={18} color={colors.price.discount} />
            </View>
            <Text style={styles.errText}>
              {denied
                ? 'Location is off for YouMart. Zoom into your area on the map, or allow location in Settings.'
                : gps || center.current
                  ? "Couldn't read this spot. Move the pin slightly and try again."
                  : "Couldn't get your GPS position. Zoom into your area on the map."}
            </Text>
          </View>
        ) : (
          <Animated.View style={[styles.addrRow, shimmerStyle]}>
            <View style={styles.addrIcon}>
              <ActivityIndicator size="small" color={colors.brand.DEFAULT} />
            </View>
            <View style={styles.addrText}>
              <View style={[styles.bar, { width: '70%' }]} />
              <View style={[styles.bar, { width: '45%', marginTop: 8 }]} />
            </View>
          </Animated.View>
        )}

        <Pressable
          style={[styles.confirm, card.kind !== 'ready' && styles.confirmOff]}
          onPress={confirm}
          disabled={card.kind !== 'ready'}
        >
          <Text style={styles.confirmText}>Confirm location</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </Pressable>
      </Animated.View>
    </View>
  );
}

const HEAD = 42;
const STEM = 14;

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  finding: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandPopup.bg,
    gap: space.lg,
  },
  findingRing: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(1,66,170,0.12)',
  },
  findingText: {
    position: 'absolute',
    top: '58%',
    fontFamily: font.uiSemibold,
    fontSize: 14,
    color: colors.brand.DEFAULT,
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(1,66,170,0.05)',
  },
  pinLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Column of [pin][equal spacer] centred on screen, so the pin's tip lands on the exact centre.
  pinBox: { alignItems: 'center' },
  pin: { alignItems: 'center', height: HEAD + STEM },
  pinHead: {
    width: HEAD,
    height: HEAD,
    borderRadius: HEAD / 2,
    backgroundColor: colors.brand.DEFAULT,
    borderWidth: 3,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  pinStem: {
    width: 3,
    height: STEM,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
    backgroundColor: colors.brand.DEFAULT,
  },
  pinSpacer: { height: HEAD + STEM, alignItems: 'center' },
  ground: {
    width: 18,
    height: 6,
    borderRadius: 3,
    marginTop: -3,
    backgroundColor: colors.heading,
  },
  gpsHalo: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(1,66,170,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.brand.DEFAULT,
    borderWidth: 2.5,
    borderColor: colors.white,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
  },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  hintText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.heading },
  card: {
    position: 'absolute',
    left: space.lg,
    right: space.lg,
    backgroundColor: colors.white,
    borderRadius: 22,
    padding: space.lg,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 10,
  },
  locateBtn: {
    position: 'absolute',
    right: 0,
    top: -58,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  cardEyebrow: {
    fontFamily: font.uiSemibold,
    fontSize: 11,
    color: colors.brand.DEFAULT,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: space.sm,
  },
  addrRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 48 },
  addrIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrText: { flex: 1 },
  addrTitle: { fontFamily: font.uiBold, fontSize: 16, color: colors.heading },
  addrSub: {
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.body,
    marginTop: 2,
  },
  errText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 13,
    lineHeight: 19,
    color: colors.text.body,
  },
  bar: { height: 10, borderRadius: 5, backgroundColor: colors.brandPopup.border },
  confirm: {
    marginTop: space.lg,
    height: 52,
    borderRadius: radii.button + 4,
    backgroundColor: colors.brand.DEFAULT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmOff: { opacity: 0.45 },
  confirmText: { fontFamily: font.uiBold, fontSize: 16, color: colors.white },
});
