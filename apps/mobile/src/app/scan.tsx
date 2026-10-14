import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import * as LocalAuthentication from 'expo-local-authentication';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { ApiError, type QrLoginRequest } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

const FRAME = 250;

type Sheet =
  | { kind: 'none' }
  | { kind: 'loading' }
  | { kind: 'confirm'; qr: string; request: QrLoginRequest }
  | { kind: 'done'; device: string }
  | { kind: 'error'; message: string };

/** What a scanned code is: a website sign-in, a YouMart page link, or something else. */
function classify(
  data: string,
): { type: 'login' } | { type: 'link'; path: string } | { type: 'other' } {
  try {
    const url = new URL(data.trim());
    if (!/(^|\.)youmart\.in$/i.test(url.hostname)) return { type: 'other' };
    if (url.pathname.startsWith('/qr-login')) return { type: 'login' };
    const [section, slug] = url.pathname.split('/').filter(Boolean);
    if ((section === 'product' || section === 'category') && slug) {
      return { type: 'link', path: `/${section}/${slug}` };
    }
    return { type: 'other' };
  } catch {
    return { type: 'other' };
  }
}

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)} min ago`;
}

/**
 * QR scanner (from the search bar): scan the youmart.in sign-in QR to sign the website in -
 * WhatsApp Web / Amazon style - after confirming with Face ID / fingerprint. YouMart product and
 * category QR codes open in the app.
 */
export default function ScanScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const session = useSession();
  const [permission, requestPermission] = useCameraPermissions();
  const [torch, setTorch] = useState(false);
  const [sheet, setSheet] = useState<Sheet>({ kind: 'none' });
  const [toast, setToast] = useState<string | null>(null);
  const busy = useRef(false);
  const line = useSharedValue(0);

  useEffect(() => {
    line.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [line]);
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: line.value * (FRAME - 8) }],
  }));

  const resume = useCallback(() => {
    busy.current = false;
    setSheet({ kind: 'none' });
  }, []);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => {
      setToast(null);
      busy.current = false;
    }, 1800);
  };

  const onScanned = async ({ data }: BarcodeScanningResult) => {
    if (busy.current) return;
    busy.current = true;
    const what = classify(data);
    if (what.type === 'link') {
      router.replace(what.path);
      return;
    }
    if (what.type === 'other') {
      showToast("This isn't a YouMart code");
      return;
    }
    if (session.status !== 'authenticated') {
      router.replace('/auth/login');
      return;
    }
    setSheet({ kind: 'loading' });
    try {
      const request = await api.auth.qrScan(data);
      setSheet({ kind: 'confirm', qr: data, request });
    } catch (err) {
      setSheet({
        kind: 'error',
        message:
          err instanceof ApiError ? err.message : 'Could not read this code. Please try again.',
      });
    }
  };

  const approve = async (qr: string, device: string) => {
    // Face ID / fingerprint (or the phone's PIN) before signing a computer in.
    const secured = await LocalAuthentication.getEnrolledLevelAsync().catch(
      () => LocalAuthentication.SecurityLevel.NONE,
    );
    if (secured !== LocalAuthentication.SecurityLevel.NONE) {
      const auth = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm to sign in on your computer',
        cancelLabel: 'Cancel',
      });
      if (!auth.success) return;
    }
    setSheet({ kind: 'loading' });
    try {
      await api.auth.qrApprove(qr);
      setSheet({ kind: 'done', device });
    } catch (err) {
      setSheet({
        kind: 'error',
        message: err instanceof ApiError ? err.message : 'Could not sign in. Please try again.',
      });
    }
  };

  const reject = async (qr: string) => {
    await api.auth.qrReject(qr).catch(() => undefined);
    router.back();
  };

  if (!permission) {
    return <View style={styles.black} />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.permission, { paddingTop: insets.top + space.xl }]}>
        <Pressable style={styles.closeDark} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="close" size={24} color={colors.text.strong} />
        </Pressable>
        <View style={styles.permIcon}>
          <Ionicons name="scan" size={40} color={colors.brand.DEFAULT} />
        </View>
        <Text style={styles.permTitle}>Allow camera to scan</Text>
        <Text style={styles.permText}>
          Scan the QR code on youmart.in to sign in on your computer, or scan YouMart product codes.
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
      </View>
    );
  }

  return (
    <View style={styles.black}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={sheet.kind === 'none' && !toast ? onScanned : undefined}
      />

      {/* Dimmed surround + frame */}
      <View style={styles.overlay} pointerEvents="none">
        <View style={styles.dim} />
        <View style={styles.middle}>
          <View style={styles.dim} />
          <View style={styles.frame}>
            {['tl', 'tr', 'bl', 'br'].map((c) => (
              <View key={c} style={[styles.corner, styles[c as 'tl']]} />
            ))}
            <Animated.View style={[styles.scanLine, lineStyle]} />
          </View>
          <View style={styles.dim} />
        </View>
        <View style={[styles.dim, styles.bottomDim]}>
          <Text style={styles.hint}>Scan the QR code on youmart.in to sign in</Text>
          <Text style={styles.subHint}>or scan a YouMart product code</Text>
        </View>
      </View>

      <View style={[styles.topBar, { paddingTop: insets.top + space.sm }]}>
        <Pressable style={styles.roundBtn} onPress={() => router.back()} hitSlop={8}>
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
        <Text style={styles.topTitle}>Scan</Text>
        <Pressable style={styles.roundBtn} onPress={() => setTorch((t) => !t)} hitSlop={8}>
          <Ionicons name={torch ? 'flash' : 'flash-off'} size={22} color={colors.white} />
        </Pressable>
      </View>

      {toast ? (
        <View style={[styles.toast, { bottom: insets.bottom + 40 }]}>
          <Ionicons name="alert-circle" size={18} color={colors.white} />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <Modal
        visible={sheet.kind !== 'none'}
        transparent
        animationType="slide"
        onRequestClose={resume}
      >
        <View style={styles.sheetBackdrop} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
          <View style={styles.grabber} />
          {sheet.kind === 'loading' ? (
            <ActivityIndicator
              size="large"
              color={colors.brand.DEFAULT}
              style={{ marginVertical: space.xxl }}
            />
          ) : sheet.kind === 'confirm' ? (
            <>
              <View style={styles.deviceIcon}>
                <Ionicons name="desktop-outline" size={30} color={colors.brand.DEFAULT} />
              </View>
              <Text style={styles.sheetTitle}>Sign in on {sheet.request.device}?</Text>
              <Text style={styles.sheetText}>
                Requested {timeAgo(sheet.request.requestedAt)} on youmart.in. You&apos;ll be signed
                in to your YouMart account on that computer.
              </Text>
              <View style={styles.warn}>
                <Ionicons name="shield-checkmark" size={18} color={colors.price.discount} />
                <Text style={styles.warnText}>
                  Only confirm if you&apos;re signing in on your own computer right now. Never scan
                  a code someone sent you.
                </Text>
              </View>
              <Pressable
                style={styles.primary}
                onPress={() => void approve(sheet.qr, sheet.request.device)}
              >
                <Ionicons name="finger-print" size={20} color={colors.white} />
                <Text style={styles.primaryText}>Confirm sign-in</Text>
              </Pressable>
              <Pressable style={styles.secondary} onPress={() => void reject(sheet.qr)}>
                <Text style={styles.secondaryText}>Cancel</Text>
              </Pressable>
            </>
          ) : sheet.kind === 'done' ? (
            <>
              <View style={[styles.deviceIcon, styles.doneIcon]}>
                <Ionicons name="checkmark" size={34} color={colors.white} />
              </View>
              <Text style={styles.sheetTitle}>Signed in on {sheet.device}</Text>
              <Text style={styles.sheetText}>
                You can see and sign out your devices anytime in Account › Privacy & account ›
                Logged-in devices.
              </Text>
              <Pressable style={styles.primary} onPress={() => router.back()}>
                <Text style={styles.primaryText}>Done</Text>
              </Pressable>
            </>
          ) : sheet.kind === 'error' ? (
            <>
              <View style={[styles.deviceIcon, styles.errorIcon]}>
                <Ionicons name="alert" size={30} color={colors.white} />
              </View>
              <Text style={styles.sheetTitle}>Couldn&apos;t sign in</Text>
              <Text style={styles.sheetText}>{sheet.message}</Text>
              <Pressable style={styles.primary} onPress={resume}>
                <Text style={styles.primaryText}>Scan again</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const CORNER = 34;
const FILL = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const;

const styles = StyleSheet.create({
  black: { flex: 1, backgroundColor: '#000' },
  overlay: { ...FILL },
  dim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  middle: { flexDirection: 'row', height: FRAME },
  frame: { width: FRAME, height: FRAME },
  corner: { position: 'absolute', width: CORNER, height: CORNER, borderColor: colors.white },
  tl: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 18 },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 4,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#4da3ff',
    shadowColor: '#4da3ff',
    shadowOpacity: 0.9,
    shadowRadius: 8,
  },
  bottomDim: { alignItems: 'center', paddingTop: space.xl, gap: 4 },
  hint: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  subHint: { fontFamily: font.body, fontSize: 13, color: 'rgba(255,255,255,0.75)' },
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
  topTitle: { fontFamily: font.uiBold, fontSize: 18, color: colors.white },
  roundBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  toast: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    backgroundColor: 'rgba(214,51,91,0.95)',
    borderRadius: radii.pill,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  toastText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.white },
  sheetBackdrop: { ...FILL, backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    alignItems: 'center',
    gap: space.md,
  },
  grabber: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.card.border },
  deviceIcon: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.sm,
  },
  doneIcon: { backgroundColor: colors.feature.guarantee },
  errorIcon: { backgroundColor: colors.price.discount },
  sheetTitle: { fontFamily: font.uiBold, fontSize: 20, color: colors.heading, textAlign: 'center' },
  sheetText: {
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text.body,
    textAlign: 'center',
  },
  warn: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#fdecef',
    borderRadius: radii.tile,
    padding: space.md,
  },
  warnText: {
    flex: 1,
    fontFamily: font.uiMedium,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.strong,
  },
  primary: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    height: 52,
    marginTop: space.xs,
  },
  primaryText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
  secondary: { paddingVertical: 8 },
  secondaryText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.text.muted },
  permission: {
    flex: 1,
    backgroundColor: colors.page,
    alignItems: 'center',
    paddingHorizontal: space.xl,
    gap: space.md,
  },
  closeDark: { alignSelf: 'flex-end' },
  permIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space.xxl,
  },
  permTitle: { fontFamily: font.uiBold, fontSize: 22, color: colors.heading },
  permText: {
    fontFamily: font.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.text.body,
    textAlign: 'center',
  },
  permBtn: {
    marginTop: space.md,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 32,
    paddingVertical: 13,
  },
  permBtnText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
});
