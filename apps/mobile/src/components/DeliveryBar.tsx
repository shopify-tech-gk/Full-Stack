import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { addressLines } from '@youmart/shared-client';
import { useAddresses } from '@/stores/address';
import { useSession } from '@/stores/session';
import { AddAddressOptions, useAddAddress } from '@/components/AddAddressOptions';
import { colors, font, radii, space } from '@/theme';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  HOME: 'home',
  WORK: 'briefcase',
  OTHER: 'location',
};

/**
 * "Deliver to" pill for the home header + a premium bottom sheet to choose the delivery address:
 * three ways to add one (map pin, GPS detect, manual) and the saved addresses to switch between.
 */
export function DeliveryBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const { addresses, selected, loading, reload, select } = useAddresses();
  const addAddress = useAddAddress();
  const [open, setOpen] = useState(false);
  const authed = session.status === 'authenticated';

  // Refresh when the screen regains focus (e.g. after adding an address) so the pill updates.
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

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

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.sheetHead}>
            <View>
              <Text style={styles.sheetEyebrow}>Delivery</Text>
              <Text style={styles.sheetTitle}>Where should we deliver?</Text>
            </View>
            <Pressable onPress={() => setOpen(false)} hitSlop={8} style={styles.closeBtn}>
              <Ionicons name="close" size={20} color={colors.text.strong} />
            </Pressable>
          </View>

          {authed ? (
            <AddAddressOptions
              onPick={(mode) => {
                setOpen(false);
                addAddress(mode);
              }}
            />
          ) : (
            <View style={styles.signInBox}>
              <Ionicons name="lock-closed-outline" size={22} color={colors.brand.DEFAULT} />
              <Text style={styles.signInText}>Sign in to save and choose delivery addresses.</Text>
              <Pressable
                style={styles.signInBtn}
                onPress={() => {
                  setOpen(false);
                  router.push('/auth/login');
                }}
              >
                <Text style={styles.signInBtnText}>Sign in</Text>
              </Pressable>
            </View>
          )}

          {authed && loading && !addresses ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.brand.DEFAULT} />
            </View>
          ) : authed && addresses && addresses.length > 0 ? (
            <>
              <Text style={styles.savedLabel}>Saved addresses</Text>
              <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {addresses.map((a) => {
                  const on = a.id === selected?.id;
                  const lines = addressLines(a);
                  return (
                    <Pressable
                      key={a.id}
                      style={[styles.addrCard, on && styles.addrCardOn]}
                      onPress={async () => {
                        await select(a.id);
                        setOpen(false);
                      }}
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
          ) : null}
        </View>
      </Modal>
    </>
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
  barLabel: { fontFamily: font.uiSemibold, fontSize: 11.5, color: colors.brand.DEFAULT },
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
    marginTop: space.lg,
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
  addrTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 6,
  },
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
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: 30 },
});
