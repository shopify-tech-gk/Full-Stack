import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { addressLines, type Address } from '@youmart/shared-client';
import { useAddresses } from '@/stores/address';
import { useSession } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  HOME: 'home',
  WORK: 'briefcase',
  OTHER: 'location',
};

/**
 * "Deliver to" bar for the home header + a premium bottom-sheet to choose the delivery address.
 * Our own YouMart style: a slim brand pill that opens a rounded sheet with pin-marked address
 * cards, a current-location detector, and quick Add-new / Sign-in actions.
 */
export function DeliveryBar() {
  const router = useRouter();
  const session = useSession();
  const { addresses, selected, loading, select } = useAddresses();
  const [open, setOpen] = useState(false);
  const authed = session.status === 'authenticated';

  const summary = selected
    ? `${selected.line1}, ${selected.city}`
    : authed
      ? 'Add a delivery address'
      : 'Sign in to set delivery';

  return (
    <>
      <Pressable style={styles.bar} onPress={() => setOpen(true)}>
        <Ionicons name="location" size={14} color={colors.brand.DEFAULT} />
        <Text style={styles.barLabel}>Deliver to</Text>
        <Text numberOfLines={1} style={styles.barValue}>
          {summary}
        </Text>
        <Ionicons name="chevron-down" size={15} color={colors.brand.DEFAULT} />
      </Pressable>

      <AddressSheet
        visible={open}
        onClose={() => setOpen(false)}
        authed={authed}
        addresses={addresses}
        selectedId={selected?.id ?? null}
        loading={loading}
        onSelect={async (id) => {
          await select(id);
          setOpen(false);
        }}
        onAdd={() => {
          setOpen(false);
          router.push(authed ? '/addresses/form' : '/auth/login');
        }}
        onSignIn={() => {
          setOpen(false);
          router.push('/auth/login');
        }}
        onClose2Add={(params) => {
          setOpen(false);
          router.push({ pathname: '/addresses/form', params });
        }}
      />
    </>
  );
}

function AddressSheet({
  visible,
  onClose,
  authed,
  addresses,
  selectedId,
  loading,
  onSelect,
  onAdd,
  onSignIn,
  onClose2Add,
}: {
  visible: boolean;
  onClose: () => void;
  authed: boolean;
  addresses: Address[] | null;
  selectedId: string | null;
  loading: boolean;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onSignIn: () => void;
  onClose2Add: (params: Record<string, string>) => void;
}) {
  const insets = useSafeAreaInsets();
  const [locating, setLocating] = useState(false);

  const useCurrentLocation = async () => {
    if (!authed) {
      onSignIn();
      return;
    }
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location permission needed',
          'Allow location access to detect your current address, or add one manually.',
        );
        return;
      }
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const [place] = await Location.reverseGeocodeAsync({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      const line1 = [place?.name, place?.street]
        .filter((p): p is string => Boolean(p))
        .filter((p, i, arr) => arr.indexOf(p) === i)
        .join(', ');
      const params: Record<string, string> = {};
      if (line1) params.line1 = line1;
      if (place?.district) params.landmark = place.district;
      if (place?.city || place?.subregion) params.city = place.city ?? place.subregion ?? '';
      if (place?.region) params.state = place.region;
      if (place?.postalCode) params.pincode = place.postalCode;
      onClose2Add(params);
    } catch {
      Alert.alert('Could not detect location', 'Please add your address manually.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
        <View style={styles.grabber} />
        <View style={styles.sheetHead}>
          <View>
            <Text style={styles.sheetEyebrow}>Delivery</Text>
            <Text style={styles.sheetTitle}>Where should we deliver?</Text>
          </View>
          <Pressable onPress={onClose} hitSlop={8} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color={colors.text.strong} />
          </Pressable>
        </View>

        <Pressable style={styles.locTile} onPress={useCurrentLocation} disabled={locating}>
          <View style={styles.locIcon}>
            {locating ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Ionicons name="navigate" size={18} color={colors.white} />
            )}
          </View>
          <View style={styles.locBody}>
            <Text style={styles.locTitle}>Use my current location</Text>
            <Text style={styles.locSub}>Detect your address automatically</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.brand.DEFAULT} />
        </Pressable>

        <Pressable style={styles.addTile} onPress={onAdd}>
          <View style={styles.addIcon}>
            <Ionicons name="add" size={20} color={colors.brand.DEFAULT} />
          </View>
          <Text style={styles.addText}>Add a new address</Text>
          <Ionicons name="chevron-forward" size={16} color={colors.brand.DEFAULT} />
        </Pressable>

        {!authed ? (
          <View style={styles.signInBox}>
            <Ionicons name="lock-closed-outline" size={22} color={colors.brand.DEFAULT} />
            <Text style={styles.signInText}>Sign in to save and choose delivery addresses.</Text>
            <Pressable style={styles.signInBtn} onPress={onSignIn}>
              <Text style={styles.signInBtnText}>Sign in</Text>
            </Pressable>
          </View>
        ) : loading && !addresses ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.brand.DEFAULT} />
          </View>
        ) : addresses && addresses.length > 0 ? (
          <>
            <Text style={styles.savedLabel}>Saved addresses</Text>
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              {addresses.map((a) => {
                const on = a.id === selectedId;
                const lines = addressLines(a);
                return (
                  <Pressable
                    key={a.id}
                    style={[styles.addrCard, on && styles.addrCardOn]}
                    onPress={() => onSelect(a.id)}
                  >
                    <View style={[styles.addrIcon, on && styles.addrIconOn]}>
                      <Ionicons
                        name={TYPE_ICON[a.addressType] ?? 'location'}
                        size={20}
                        color={on ? colors.white : colors.brand.DEFAULT}
                      />
                    </View>
                    <View style={styles.addrBody}>
                      <View style={styles.addrTop}>
                        <Text style={styles.addrName}>{lines[0]}</Text>
                        {on ? (
                          <View style={styles.selectedPill}>
                            <Ionicons name="checkmark" size={11} color={colors.white} />
                            <Text style={styles.selectedPillText}>Delivering here</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text numberOfLines={2} style={styles.addrLines}>
                        {lines.slice(1).join(', ')}
                      </Text>
                      <Text style={styles.addrPhone}>{a.phone}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </>
        ) : (
          <View style={styles.center}>
            <Ionicons name="location-outline" size={40} color={colors.card.border} />
            <Text style={styles.emptyText}>No saved addresses yet.</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space.sm,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    paddingLeft: 10,
    paddingRight: 8,
    paddingVertical: 5,
  },
  barLabel: {
    fontFamily: font.uiSemibold,
    fontSize: 11.5,
    color: colors.brand.DEFAULT,
  },
  barValue: {
    flexShrink: 1,
    fontFamily: font.uiSemibold,
    fontSize: 11.5,
    color: colors.text.strong,
  },

  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '82%',
    backgroundColor: colors.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.card.border,
    marginBottom: space.md,
  },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: space.md,
  },
  sheetEyebrow: {
    fontFamily: font.uiSemibold,
    fontSize: 11,
    color: colors.brand.DEFAULT,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sheetTitle: { fontFamily: font.uiBold, fontSize: 20, color: colors.heading, marginTop: 2 },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.sm,
  },
  locIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locBody: { flex: 1 },
  locTitle: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  locSub: { fontFamily: font.body, fontSize: 12, color: colors.text.muted, marginTop: 1 },
  addTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    borderStyle: 'dashed',
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    marginBottom: space.md,
  },
  addIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addText: { flex: 1, fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.brand.DEFAULT },
  signInBox: {
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.xl,
  },
  signInText: {
    fontFamily: font.body,
    fontSize: 13.5,
    color: colors.text.body,
    textAlign: 'center',
  },
  signInBtn: {
    marginTop: space.sm,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 28,
    paddingVertical: 10,
  },
  signInBtnText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.white },
  savedLabel: {
    fontFamily: font.uiSemibold,
    fontSize: 12,
    color: colors.text.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: space.sm,
  },
  scroll: { flexGrow: 0 },
  addrCard: {
    flexDirection: 'row',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.md,
    marginBottom: space.sm,
  },
  addrCardOn: { borderColor: colors.brand.DEFAULT, borderWidth: 1.5 },
  addrIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrIconOn: { backgroundColor: colors.brand.DEFAULT },
  addrBody: { flex: 1, gap: 2 },
  addrTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  addrName: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  selectedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  selectedPillText: { fontFamily: font.uiSemibold, fontSize: 10, color: colors.white },
  addrLines: { fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: colors.text.body },
  addrPhone: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.text.muted, marginTop: 2 },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingVertical: 40 },
  emptyText: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
});
