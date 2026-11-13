import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ScrollViewInstance,
  type TextInputProps,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import {
  ApiError,
  STORE_CATEGORIES,
  type SellerApplication,
  type SellerBusinessType,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useRouter } from '@/lib/router';
import { useSession } from '@/stores/session';
import { BUSINESS_TYPE_LABEL, SELLER_GOLD } from '@/components/SellerComingSoon';
import { colors, font, space } from '@/theme';

// v1.19 "Sell on YouMart" early-access application. Sent to seller-service; the admin team sees
// it under Admin -> Seller applications and the customer follows its status on /sell.

const NAVY = '#0a2463';
const GOLD_INK = '#1f1300';
const RM = ReduceMotion.Never;
const OTHER = 'Other';

const TYPES = Object.keys(BUSINESS_TYPE_LABEL) as SellerBusinessType[];
const TYPE_ICON: Record<SellerBusinessType, keyof typeof Ionicons.glyphMap> = {
  INDIVIDUAL: 'person',
  SHOP: 'storefront',
  BRAND: 'ribbon',
  MANUFACTURER: 'construct',
  WHOLESALER: 'cube',
};

const digits = (v: string) => v.replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Field({
  label,
  optional,
  error,
  ...input
}: TextInputProps & { label: string; optional?: boolean; error?: string | null }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      <TextInput
        {...input}
        placeholderTextColor="#9aa6bd"
        onFocus={(e) => {
          setFocused(true);
          input.onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          input.onBlur?.(e);
        }}
        style={[
          styles.input,
          input.multiline && styles.inputMulti,
          focused && styles.inputFocused,
          error ? styles.inputError : null,
        ]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

function Success({ app, onDone }: { app: SellerApplication; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await Clipboard.setStringAsync(app.referenceCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <View style={[styles.successScreen, { paddingTop: insets.top + 40 }]}>
      <Animated.View entering={ZoomIn.springify().damping(12).reduceMotion(RM)} style={styles.tick}>
        <Ionicons name="checkmark" size={46} color={GOLD_INK} />
      </Animated.View>
      <Animated.View
        entering={FadeInDown.delay(200).duration(450).reduceMotion(RM)}
        style={styles.successBody}
      >
        <Text style={styles.successTitle}>Application submitted</Text>
        <Text style={styles.successSub}>
          Thanks, {app.contactName.split(' ')[0]}. {app.businessName} is on the YouMart seller
          early-access list.
        </Text>

        <Pressable onPress={() => void copy()} style={styles.refCard}>
          <View>
            <Text style={styles.refLabel}>REFERENCE NUMBER</Text>
            <Text style={styles.refCode}>{app.referenceCode}</Text>
          </View>
          <View style={styles.copyPill}>
            <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color="#c3cfee" />
            <Text style={styles.copyText}>{copied ? 'Copied' : 'Copy'}</Text>
          </View>
        </Pressable>

        <Text style={styles.nextLabel}>WHAT HAPPENS NEXT</Text>
        {[
          { icon: 'search' as const, text: 'Our seller team reviews your details.' },
          {
            icon: 'call' as const,
            text: `We'll contact you on +91 ${app.phone.replace(/(\d{5})(\d{5})/, '$1 $2')}.`,
          },
          {
            icon: 'notifications' as const,
            text: 'Follow your status anytime under Account › Sell on YouMart.',
          },
        ].map((n) => (
          <View key={n.text} style={styles.nextRow}>
            <View style={styles.nextIcon}>
              <Ionicons name={n.icon} size={15} color={NAVY} />
            </View>
            <Text style={styles.nextText}>{n.text}</Text>
          </View>
        ))}
      </Animated.View>

      <Animated.View
        entering={FadeIn.delay(450).duration(400).reduceMotion(RM)}
        style={[styles.successFooter, { paddingBottom: insets.bottom + 12 }]}
      >
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
        >
          <Text style={styles.submitText}>View application status</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

export default function SellApplyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const session = useSession();
  const user = session.status === 'authenticated' ? session.user : null;

  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(user?.phone ? digits(user.phone) : '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [city, setCity] = useState('');
  const [type, setType] = useState<SellerBusinessType | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [otherCategory, setOtherCategory] = useState('');
  const [hasGstin, setHasGstin] = useState<boolean | null>(null);
  const [note, setNote] = useState('');

  const [tried, setTried] = useState(false);
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [done, setDone] = useState<SellerApplication | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);

  const categories = useMemo(() => [...STORE_CATEGORIES.map((c) => c.name), OTHER], []);
  const finalCategory = category === OTHER ? otherCategory.trim() : (category ?? '');

  const errors = {
    businessName: businessName.trim() ? null : 'Enter your business or store name',
    contactName: contactName.trim() ? null : 'Enter your name',
    phone: /^[6-9]\d{9}$/.test(digits(phone)) ? null : 'Enter a valid 10-digit mobile number',
    email: !email.trim() || EMAIL_RE.test(email.trim()) ? null : 'Enter a valid email',
    city: city.trim() ? null : 'Enter your city',
    type: type ? null : 'Choose one',
    category: finalCategory ? null : category === OTHER ? 'Tell us what you sell' : 'Choose one',
    gst: hasGstin === null ? 'Choose one' : null,
  };
  const valid = Object.values(errors).every((e) => e === null);
  const show = (e: string | null) => (tried ? e : null);

  const submit = async () => {
    setTried(true);
    setServerError(null);
    if (!valid || !type || hasGstin === null) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    setSending(true);
    try {
      const res = await api.sellers.apply({
        businessName: businessName.trim(),
        contactName: contactName.trim(),
        phone: digits(phone),
        ...(email.trim() ? { email: email.trim() } : {}),
        city: city.trim(),
        businessType: type,
        category: finalCategory,
        hasGstin,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(res.application);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        router.replace('/sell');
        return;
      }
      setServerError(
        err instanceof ApiError
          ? err.message
          : 'Could not submit. Check your connection and try again.',
      );
    } finally {
      setSending(false);
    }
  };

  if (done) return <Success app={done} onDone={() => router.back()} />;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.text.strong} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Seller early access</Text>
          <Text style={styles.headerSub}>Sell on YouMart</Text>
        </View>
      </View>

      <ScrollView
        ref={scroll}
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 120 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Tell us about your business. Our seller team reviews every application and contacts you
          before launch.
        </Text>

        {tried && !valid ? (
          <View style={styles.banner}>
            <Ionicons name="alert-circle" size={16} color="#b42318" />
            <Text style={styles.bannerText}>Please fill in the highlighted details.</Text>
          </View>
        ) : null}

        {/* Business */}
        <Text style={styles.group}>YOUR BUSINESS</Text>
        <View style={styles.card}>
          <Field
            label="Business or store name"
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. Green Leaf Agro Store"
            maxLength={120}
            autoCapitalize="words"
            error={show(errors.businessName)}
          />
          <Field
            label="City"
            value={city}
            onChangeText={setCity}
            placeholder="e.g. Coimbatore"
            maxLength={80}
            autoCapitalize="words"
            error={show(errors.city)}
          />

          <Text style={styles.label}>You are a</Text>
          <View style={styles.typeGrid}>
            {TYPES.map((t) => {
              const on = type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[styles.typeTile, on && styles.typeTileOn]}
                >
                  <Ionicons name={TYPE_ICON[t]} size={17} color={on ? NAVY : '#5d6b85'} />
                  <Text style={[styles.typeText, on && styles.typeTextOn]}>
                    {BUSINESS_TYPE_LABEL[t]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {show(errors.type) ? <Text style={styles.errorText}>{errors.type}</Text> : null}

          <Text style={[styles.label, { marginTop: 14 }]}>What do you sell?</Text>
          <View style={styles.chips}>
            {categories.map((c) => {
              const on = category === c;
              return (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, on && styles.chipOn]}
                >
                  {on ? <Ionicons name="checkmark" size={13} color="#ffffff" /> : null}
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
          {category === OTHER ? (
            <View style={{ marginTop: 10 }}>
              <Field
                label="Your products"
                value={otherCategory}
                onChangeText={setOtherCategory}
                placeholder="e.g. Handmade candles"
                maxLength={80}
                error={show(errors.category)}
              />
            </View>
          ) : show(errors.category) ? (
            <Text style={styles.errorText}>{errors.category}</Text>
          ) : null}

          <Text style={[styles.label, { marginTop: 14 }]}>GST registered?</Text>
          <View style={styles.segment}>
            {[
              { v: true, l: 'Yes, I have GSTIN' },
              { v: false, l: 'Not yet' },
            ].map((o) => {
              const on = hasGstin === o.v;
              return (
                <Pressable
                  key={o.l}
                  onPress={() => setHasGstin(o.v)}
                  style={[styles.segBtn, on && styles.segBtnOn]}
                >
                  <Text style={[styles.segText, on && styles.segTextOn]}>{o.l}</Text>
                </Pressable>
              );
            })}
          </View>
          {show(errors.gst) ? <Text style={styles.errorText}>{errors.gst}</Text> : null}
        </View>

        {/* Contact */}
        <Text style={styles.group}>CONTACT DETAILS</Text>
        <View style={styles.card}>
          <Field
            label="Your name"
            value={contactName}
            onChangeText={setContactName}
            placeholder="Full name"
            maxLength={80}
            autoCapitalize="words"
            error={show(errors.contactName)}
          />
          <Field
            label="Mobile number"
            value={phone}
            onChangeText={(v) => setPhone(v.replace(/[^\d+ ]/g, ''))}
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={14}
            error={show(errors.phone)}
          />
          <Field
            label="Email"
            optional
            value={email}
            onChangeText={setEmail}
            placeholder="you@business.com"
            keyboardType="email-address"
            autoCapitalize="none"
            maxLength={160}
            error={show(errors.email)}
          />
          <Field
            label="Anything else we should know"
            optional
            value={note}
            onChangeText={setNote}
            placeholder="e.g. number of products, where you sell today"
            multiline
            maxLength={500}
          />
        </View>

        <View style={styles.privacy}>
          <Ionicons name="lock-closed" size={13} color={colors.text.muted} />
          <Text style={styles.privacyText}>
            Only the YouMart seller team sees these details. We use them to contact you about
            selling on YouMart.
          </Text>
        </View>
        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={() => void submit()}
          disabled={sending}
          style={({ pressed }) => [styles.submit, (pressed || sending) && styles.pressed]}
        >
          {sending ? (
            <>
              <ActivityIndicator color={GOLD_INK} />
              <Text style={styles.submitText}>Submitting…</Text>
            </>
          ) : (
            <>
              <Text style={styles.submitText}>Submit application</Text>
              <Ionicons name="arrow-forward" size={18} color={GOLD_INK} />
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f6fb' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.lg,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e8f3',
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f4fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.text.strong },
  headerSub: { fontFamily: font.body, fontSize: 12, color: colors.text.muted, marginTop: 1 },
  intro: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: colors.text.body },
  banner: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fef3f2',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  bannerText: { fontFamily: font.uiMedium, fontSize: 13, color: '#b42318' },
  group: {
    marginTop: 22,
    marginBottom: 8,
    marginLeft: 2,
    fontFamily: font.uiBold,
    fontSize: 11.5,
    letterSpacing: 1.3,
    color: '#5d6b85',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6ebf5',
  },
  field: { marginBottom: 14 },
  label: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong, marginBottom: 7 },
  optional: { fontFamily: font.body, color: colors.text.muted },
  input: {
    borderWidth: 1.2,
    borderColor: '#d5ddec',
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text.strong,
    backgroundColor: '#fbfcfe',
  },
  inputMulti: { minHeight: 84, textAlignVertical: 'top' },
  inputFocused: { borderColor: colors.brand.DEFAULT, backgroundColor: colors.white },
  inputError: { borderColor: '#e5484d' },
  errorText: { marginTop: 5, fontFamily: font.uiMedium, fontSize: 12, color: '#d92d20' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderWidth: 1.2,
    borderColor: '#d5ddec',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fbfcfe',
  },
  typeTileOn: { borderColor: NAVY, backgroundColor: '#eef3ff' },
  typeText: { fontFamily: font.uiMedium, fontSize: 13, color: '#334155' },
  typeTextOn: { color: NAVY, fontFamily: font.uiSemibold },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#d5ddec',
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.white,
  },
  chipOn: { backgroundColor: NAVY, borderColor: NAVY },
  chipText: { fontFamily: font.uiMedium, fontSize: 12.5, color: '#334155' },
  chipTextOn: { color: '#ffffff' },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#f1f4fa',
    borderRadius: 11,
    padding: 3,
    gap: 3,
  },
  segBtn: { flex: 1, alignItems: 'center', borderRadius: 9, paddingVertical: 9 },
  segBtnOn: {
    backgroundColor: colors.white,
    shadowColor: NAVY,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  segText: { fontFamily: font.uiMedium, fontSize: 13, color: '#5d6b85' },
  segTextOn: { color: NAVY, fontFamily: font.uiSemibold },
  privacy: { marginTop: 16, flexDirection: 'row', gap: 7, paddingHorizontal: 2 },
  privacyText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.muted,
  },
  serverError: {
    marginTop: 12,
    textAlign: 'center',
    fontFamily: font.uiMedium,
    fontSize: 13,
    color: '#d92d20',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: 12,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e3e8f3',
  },
  submit: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: SELLER_GOLD,
    borderRadius: 14,
    paddingVertical: 15,
  },
  pressed: { opacity: 0.85 },
  submitText: { fontFamily: font.uiBold, fontSize: 16, color: GOLD_INK },
  // Success
  successScreen: {
    flex: 1,
    backgroundColor: NAVY,
    experimental_backgroundImage: 'linear-gradient(170deg, #050f26 0%, #0a2463 60%, #0142aa 100%)',
    paddingHorizontal: space.lg,
  },
  tick: {
    alignSelf: 'center',
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: SELLER_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: SELLER_GOLD,
    shadowOpacity: 0.55,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 0 },
    elevation: 12,
  },
  successBody: { marginTop: 26 },
  successTitle: {
    textAlign: 'center',
    fontFamily: font.uiBold,
    fontSize: 25,
    color: '#ffffff',
  },
  successSub: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#c3cfee',
  },
  refCard: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,214,10,0.35)',
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  refLabel: { fontFamily: font.uiBold, fontSize: 10.5, letterSpacing: 1.3, color: '#8fa6dc' },
  refCode: {
    marginTop: 3,
    fontFamily: font.uiBold,
    fontSize: 20,
    letterSpacing: 1,
    color: SELLER_GOLD,
  },
  copyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  copyText: { fontFamily: font.uiSemibold, fontSize: 12, color: '#c3cfee' },
  nextLabel: {
    marginTop: 26,
    marginBottom: 10,
    fontFamily: font.uiBold,
    fontSize: 11,
    letterSpacing: 1.4,
    color: '#8fa6dc',
  },
  nextRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 11 },
  nextIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: SELLER_GOLD,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { flex: 1, fontFamily: font.body, fontSize: 13.5, lineHeight: 19, color: '#e2e9f9' },
  successFooter: { position: 'absolute', left: space.lg, right: space.lg, bottom: 0 },
});
