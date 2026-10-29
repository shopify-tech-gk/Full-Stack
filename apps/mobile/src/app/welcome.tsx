import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { Camera } from 'expo-camera';
import { completeOnboarding } from '@/stores/onboarding';
import { getVoicePermission, requestVoicePermission, type VoicePermission } from '@/lib/voice';
import { colors, font, radii, space } from '@/theme';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../assets/images/logo.png');

type Perm = VoicePermission | 'unknown';

const BENEFITS: { icon: keyof typeof Ionicons.glyphMap; title: string; sub: string }[] = [
  { icon: 'flash', title: 'Fast, reliable delivery', sub: 'Track every order right in the app' },
  { icon: 'wallet', title: 'Instant refunds to your wallet', sub: 'Shop again straight away' },
  {
    icon: 'shield-checkmark',
    title: 'Safe & secure payments',
    sub: 'UPI, cards, net banking & wallet',
  },
];

/**
 * First launch: welcome + accept the Terms & Privacy Policy (required to continue), then an
 * optional permissions step - location (delivery address) and microphone (voice search).
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<'terms' | 'permissions'>('terms');
  const [agreed, setAgreed] = useState(false);
  const [location, setLocation] = useState<Perm>('unknown');
  const [mic, setMic] = useState<Perm>('unknown');
  const [camera, setCamera] = useState<Perm>('unknown');
  const [asking, setAsking] = useState<'location' | 'mic' | 'camera' | null>(null);
  const [finishing, setFinishing] = useState(false);

  const refresh = useCallback(async () => {
    const loc = await Location.getForegroundPermissionsAsync().catch(() => null);
    setLocation(
      !loc ? 'unavailable' : loc.granted ? 'granted' : loc.canAskAgain ? 'denied' : 'blocked',
    );
    setMic(await getVoicePermission());
    const cam = await Camera.getCameraPermissionsAsync().catch(() => null);
    setCamera(
      !cam ? 'unavailable' : cam.granted ? 'granted' : cam.canAskAgain ? 'denied' : 'blocked',
    );
  }, []);

  useEffect(() => {
    if (step === 'permissions') void refresh();
  }, [step, refresh]);

  const askLocation = async () => {
    setAsking('location');
    try {
      const r = await Location.requestForegroundPermissionsAsync();
      setLocation(r.granted ? 'granted' : r.canAskAgain ? 'denied' : 'blocked');
    } finally {
      setAsking(null);
    }
  };

  const askMic = async () => {
    setAsking('mic');
    try {
      setMic(await requestVoicePermission());
    } finally {
      setAsking(null);
    }
  };

  const askCamera = async () => {
    setAsking('camera');
    try {
      const r = await Camera.requestCameraPermissionsAsync();
      setCamera(r.granted ? 'granted' : r.canAskAgain ? 'denied' : 'blocked');
    } finally {
      setAsking(null);
    }
  };

  const finish = async () => {
    setFinishing(true);
    await completeOnboarding();
    router.replace('/');
  };

  if (step === 'terms') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <ScrollView contentContainerStyle={styles.body} bounces={false}>
          <View style={styles.hero}>
            <View style={styles.logoCard}>
              <Image source={LOGO} style={styles.logo} contentFit="contain" />
            </View>
            <Text style={styles.heroTitle}>Welcome to YouMart</Text>
            <Text style={styles.heroSub}>
              Shop Easy, Live Better — everything you need, delivered.
            </Text>
          </View>

          <View style={styles.benefits}>
            {BENEFITS.map((b) => (
              <View key={b.title} style={styles.benefit}>
                <View style={styles.benefitIcon}>
                  <Ionicons name={b.icon} size={20} color={colors.brand.DEFAULT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.benefitTitle}>{b.title}</Text>
                  <Text style={styles.benefitSub}>{b.sub}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
          <Pressable
            style={styles.agreeRow}
            onPress={() => setAgreed((v) => !v)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
          >
            <Ionicons
              name={agreed ? 'checkbox' : 'square-outline'}
              size={24}
              color={agreed ? colors.brand.DEFAULT : colors.text.muted}
            />
            <Text style={styles.agreeText}>
              I have read and agree to the{' '}
              <Text style={styles.link} onPress={() => router.push('/info/terms')}>
                Terms & Conditions
              </Text>{' '}
              and{' '}
              <Text style={styles.link} onPress={() => router.push('/info/privacy-policy')}>
                Privacy Policy
              </Text>
              , including the YouMart Wallet terms.
            </Text>
          </Pressable>
          <Pressable
            style={[styles.primary, !agreed && styles.disabled]}
            disabled={!agreed}
            onPress={() => setStep('permissions')}
          >
            <Text style={styles.primaryText}>Agree & continue</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.white} />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <ScrollView contentContainerStyle={styles.body} bounces={false}>
        <Text style={styles.stepTitle}>A couple of permissions</Text>
        <Text style={styles.stepSub}>
          They make YouMart faster to use. You can change them anytime in your phone’s Settings.
        </Text>

        <PermissionCard
          icon="location"
          title="Location"
          sub="Detect your delivery address and show what we deliver near you."
          state={location}
          busy={asking === 'location'}
          onAllow={askLocation}
        />
        <PermissionCard
          icon="mic"
          title="Microphone"
          sub="Search for products by voice — just tap the mic and speak."
          state={mic}
          busy={asking === 'mic'}
          onAllow={askMic}
        />
        <PermissionCard
          icon="scan"
          title="Camera"
          sub="Scan a QR code to sign in on youmart.in, or scan product codes."
          state={camera}
          busy={asking === 'camera'}
          onAllow={askCamera}
        />
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.lg }]}>
        <Pressable
          style={[styles.primary, finishing && styles.disabled]}
          disabled={finishing}
          onPress={finish}
        >
          {finishing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Text style={styles.primaryText}>Start shopping</Text>
              <Ionicons name="arrow-forward" size={18} color={colors.white} />
            </>
          )}
        </Pressable>
        {location !== 'granted' ||
        camera !== 'granted' ||
        (mic !== 'granted' && mic !== 'unavailable') ? (
          <Pressable onPress={finish} disabled={finishing}>
            <Text style={styles.skip}>Not now</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function PermissionCard({
  icon,
  title,
  sub,
  state,
  busy,
  onAllow,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  state: Perm;
  busy: boolean;
  onAllow: () => void;
}) {
  return (
    <View style={[styles.permCard, state === 'granted' && styles.permCardOn]}>
      <View style={[styles.permIcon, state === 'granted' && styles.permIconOn]}>
        <Ionicons
          name={icon}
          size={22}
          color={state === 'granted' ? colors.white : colors.brand.DEFAULT}
        />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.permTitle}>{title}</Text>
        <Text style={styles.permSub}>{sub}</Text>
        {state === 'unavailable' ? (
          <Text style={styles.permNote}>Available in the YouMart app (not in Expo Go).</Text>
        ) : state === 'blocked' ? (
          <Text style={styles.permNote} onPress={() => void Linking.openSettings()}>
            Turned off — tap to open Settings.
          </Text>
        ) : null}
      </View>
      {state === 'granted' ? (
        <Ionicons name="checkmark-circle" size={26} color={colors.feature.guarantee} />
      ) : state === 'denied' || state === 'unknown' ? (
        <Pressable style={styles.allow} onPress={onAllow} disabled={busy || state === 'unknown'}>
          {busy ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.allowText}>Allow</Text>
          )}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  body: { padding: space.xl, gap: space.lg },
  hero: { alignItems: 'center', gap: space.sm, marginTop: space.xl },
  logoCard: {
    backgroundColor: colors.white,
    borderRadius: 28,
    paddingHorizontal: space.xl,
    paddingVertical: space.lg,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.15,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  logo: { width: 200, height: 76 },
  heroTitle: { fontFamily: font.uiBold, fontSize: 26, color: colors.heading, marginTop: space.lg },
  heroSub: {
    fontFamily: font.body,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.text.body,
    textAlign: 'center',
  },
  benefits: { gap: space.sm, marginTop: space.md },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile + 4,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    padding: space.md,
  },
  benefitIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitTitle: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  benefitSub: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted, marginTop: 1 },
  footer: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    gap: space.md,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 8,
  },
  agreeRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  agreeText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.text.body,
  },
  link: {
    fontFamily: font.uiSemibold,
    color: colors.brand.DEFAULT,
    textDecorationLine: 'underline',
  },
  primary: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.tile,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.45 },
  primaryText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
  skip: {
    fontFamily: font.uiSemibold,
    fontSize: 14,
    color: colors.text.muted,
    textAlign: 'center',
  },
  stepTitle: { fontFamily: font.uiBold, fontSize: 24, color: colors.heading, marginTop: space.xl },
  stepSub: { fontFamily: font.body, fontSize: 14, lineHeight: 21, color: colors.text.body },
  permCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile + 6,
    borderWidth: 1.5,
    borderColor: colors.brandPopup.border,
    padding: space.lg,
  },
  permCardOn: { borderColor: colors.feature.guarantee },
  permIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permIconOn: { backgroundColor: colors.feature.guarantee },
  permTitle: { fontFamily: font.uiBold, fontSize: 15.5, color: colors.text.strong },
  permSub: { fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: colors.text.body },
  permNote: { fontFamily: font.uiMedium, fontSize: 12, color: colors.brand.DEFAULT, marginTop: 2 },
  allow: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.tile,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 70,
    alignItems: 'center',
  },
  allowText: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.white },
});
