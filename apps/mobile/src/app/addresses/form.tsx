import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import Animated, {
  interpolate,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ADDRESS_TYPES,
  EMPTY_ADDRESS_FORM,
  addressToForm,
  validateAddressForm,
  type AddressFormErrors,
  type AddressFormValues,
  type AddressType,
} from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  HOME: 'home',
  WORK: 'briefcase',
  OTHER: 'location',
};

type Params = {
  id?: string;
  source?: string;
  lat?: string;
  lng?: string;
  fullName?: string;
  phone?: string;
  line1?: string;
  line2?: string;
  landmark?: string;
  city?: string;
  state?: string;
  pincode?: string;
};

// Add / edit an address. Fields + validation come from shared-client (same rules as web + server).
export default function AddressFormScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<Params>();
  const { id } = params;
  const editing = Boolean(id);
  const fromMap = params.source === 'map' || params.source === 'location';

  const [values, setValues] = useState<AddressFormValues>(() => {
    if (id) return EMPTY_ADDRESS_FORM;
    const pick = (v?: string) => (typeof v === 'string' ? v : '');
    return {
      ...EMPTY_ADDRESS_FORM,
      fullName: pick(params.fullName),
      phone: pick(params.phone),
      line1: pick(params.line1),
      line2: pick(params.line2),
      landmark: pick(params.landmark),
      city: pick(params.city),
      state: pick(params.state),
      pincode: pick(params.pincode),
    };
  });
  const [errors, setErrors] = useState<AddressFormErrors>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);

  useEffect(() => {
    navigation.setOptions({ title: editing ? 'Edit address' : 'Add address' });
  }, [navigation, editing]);

  useEffect(() => {
    if (!id) return;
    api.addresses
      .get(String(id))
      .then((a) => setValues(addressToForm(a)))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [id]);

  const set = <K extends keyof AddressFormValues>(key: K, value: AddressFormValues[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async () => {
    const { input, errors: errs } = validateAddressForm(values);
    setErrors(errs);
    if (!input) return;
    setBusy(true);
    try {
      if (editing) await api.addresses.update(String(id), input);
      else await api.addresses.create(input);
      router.back();
    } catch {
      setErrors({ fullName: 'Could not save the address. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const openMap = () =>
    router.replace({
      pathname: '/addresses/map',
      params:
        params.lat && params.lng
          ? { mode: 'map', lat: params.lat, lng: params.lng }
          : { mode: 'map' },
    });

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }

  const placeLine = [values.city, values.state, values.pincode].filter(Boolean).join(', ');

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ScrollView
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {fromMap ? (
          <View style={styles.locCard}>
            <View style={styles.locIcon}>
              <Ionicons name="location" size={20} color={colors.white} />
            </View>
            <View style={styles.locText}>
              <Text style={styles.locEyebrow}>
                {params.source === 'location' ? 'Detected location' : 'Pinned location'}
              </Text>
              <Text numberOfLines={1} style={styles.locTitle}>
                {values.line1 || 'Selected spot'}
              </Text>
              {placeLine ? (
                <Text numberOfLines={1} style={styles.locSub}>
                  {placeLine}
                </Text>
              ) : null}
            </View>
            <Pressable onPress={openMap} hitSlop={8} style={styles.changeBtn}>
              <Text style={styles.changeText}>Change</Text>
            </Pressable>
          </View>
        ) : !editing ? (
          <Pressable onPress={openMap} style={styles.mapTip}>
            <Ionicons name="map-outline" size={18} color={colors.brand.DEFAULT} />
            <Text style={styles.mapTipText}>Prefer the map? Drop a pin on your location</Text>
            <Ionicons name="chevron-forward" size={16} color={colors.brand.DEFAULT} />
          </Pressable>
        ) : null}

        <Section title="Contact details" icon="person-circle-outline">
          <Field
            icon="person-outline"
            label="Full name"
            value={values.fullName}
            onChange={(t) => set('fullName', t)}
            error={errors.fullName}
          />
          <Field
            icon="call-outline"
            label="Phone number"
            value={values.phone}
            onChange={(t) => set('phone', t)}
            error={errors.phone}
            keyboardType="phone-pad"
            autoCapitalize="none"
          />
        </Section>

        <Section title="Address" icon="home-outline">
          <Field
            icon="business-outline"
            label="House / Flat no., Building"
            value={values.line2}
            onChange={(t) => set('line2', t)}
            error={errors.line2}
          />
          <Field
            icon="map-outline"
            label="Street, Area"
            value={values.line1}
            onChange={(t) => set('line1', t)}
            error={errors.line1}
          />
          <Field
            icon="flag-outline"
            label="Landmark (optional)"
            value={values.landmark}
            onChange={(t) => set('landmark', t)}
            error={errors.landmark}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field
                icon="location-outline"
                label="City"
                value={values.city}
                onChange={(t) => set('city', t)}
                error={errors.city}
              />
            </View>
            <View style={styles.pinCol}>
              <Field
                icon="keypad-outline"
                label="PIN code"
                value={values.pincode}
                onChange={(t) => set('pincode', t)}
                error={errors.pincode}
                keyboardType="number-pad"
                autoCapitalize="none"
              />
            </View>
          </View>
          <Field
            icon="globe-outline"
            label="State"
            value={values.state}
            onChange={(t) => set('state', t)}
            error={errors.state}
          />
        </Section>

        <Section title="Save address as" icon="bookmark-outline">
          <View style={styles.types}>
            {ADDRESS_TYPES.map((t) => {
              const on = values.addressType === t.value;
              return (
                <Pressable
                  key={t.value}
                  style={[styles.type, on && styles.typeOn]}
                  onPress={() => set('addressType', t.value as AddressType)}
                >
                  <Ionicons
                    name={TYPE_ICON[t.value] ?? 'location'}
                    size={16}
                    color={on ? colors.white : colors.brand.DEFAULT}
                  />
                  <Text style={[styles.typeText, on && styles.typeTextOn]}>{t.label}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.defaultRow}>
            <View style={styles.flex}>
              <Text style={styles.defaultTitle}>Make this my default address</Text>
              <Text style={styles.defaultSub}>Used for deliveries and checkout</Text>
            </View>
            <Switch
              value={values.isDefault}
              onValueChange={(v) => set('isDefault', v)}
              trackColor={{ true: colors.brand.DEFAULT, false: colors.card.border }}
              thumbColor={colors.white}
            />
          </View>
        </Section>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
        <Pressable
          style={({ pressed }) => [styles.save, (busy || pressed) && styles.savePressed]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color={colors.white} />
              <Text style={styles.saveText}>{editing ? 'Update address' : 'Save address'}</Text>
            </>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: ReactNode;
}) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Ionicons name={icon} size={16} color={colors.brand.DEFAULT} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

/** Icon input with a floating label and a brand focus state. */
function Field({
  icon,
  label,
  value,
  onChange,
  error,
  keyboardType,
  autoCapitalize = 'words',
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  onChange: (t: string) => void;
  error?: string;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'words';
}) {
  const [focused, setFocused] = useState(false);
  const raised = useSharedValue(value.length > 0 ? 1 : 0);
  const focus = useSharedValue(0);

  useEffect(() => {
    raised.value = withTiming(focused || value.length > 0 ? 1 : 0, { duration: 160 });
    focus.value = withTiming(focused ? 1 : 0, { duration: 160 });
  }, [focused, value, raised, focus]);

  const labelStyle = useAnimatedStyle(() => ({
    top: interpolate(raised.value, [0, 1], [17, 7]),
    fontSize: interpolate(raised.value, [0, 1], [15, 11]),
    color: interpolateColor(focus.value, [0, 1], [colors.text.muted, colors.brand.DEFAULT]),
  }));
  const hasError = Boolean(error);
  const boxStyle = useAnimatedStyle(
    () => ({
      borderColor: hasError
        ? colors.price.discount
        : interpolateColor(focus.value, [0, 1], [colors.brandPopup.border, colors.brand.DEFAULT]),
      backgroundColor: interpolateColor(focus.value, [0, 1], [colors.white, '#f7fbff']),
    }),
    [hasError],
  );

  return (
    <View>
      <Animated.View style={[styles.field, boxStyle]}>
        <Ionicons
          name={icon}
          size={18}
          color={focused ? colors.brand.DEFAULT : colors.text.muted}
          style={styles.fieldIcon}
        />
        <View style={styles.flex}>
          <Animated.Text pointerEvents="none" style={[styles.floatLabel, labelStyle]}>
            {label}
          </Animated.Text>
          <TextInput
            value={value}
            onChangeText={onChange}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={styles.input}
            keyboardType={keyboardType ?? 'default'}
            autoCapitalize={autoCapitalize}
            selectionColor={colors.brand.DEFAULT}
          />
        </View>
        {value.length > 0 && !error ? (
          <Ionicons name="checkmark-circle" size={16} color={colors.feature.guarantee} />
        ) : null}
      </Animated.View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg, gap: space.lg, paddingBottom: 120 },
  flex: { flex: 1 },
  locCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: space.md,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  locIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locText: { flex: 1 },
  locEyebrow: {
    fontFamily: font.uiSemibold,
    fontSize: 10.5,
    color: colors.feature.guarantee,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  locTitle: { fontFamily: font.uiBold, fontSize: 15, color: colors.heading, marginTop: 1 },
  locSub: { fontFamily: font.body, fontSize: 12, color: colors.text.body, marginTop: 1 },
  changeBtn: {
    borderWidth: 1,
    borderColor: colors.brand.DEFAULT,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  changeText: { fontFamily: font.uiSemibold, fontSize: 12, color: colors.brand.DEFAULT },
  mapTip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  mapTipText: { flex: 1, fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  section: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: space.lg,
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: space.md },
  sectionTitle: {
    fontFamily: font.uiBold,
    fontSize: 13,
    color: colors.heading,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionBody: { gap: space.md },
  row: { flexDirection: 'row', gap: space.sm },
  pinCol: { width: 132 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 56,
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 12,
  },
  fieldIcon: { width: 20 },
  floatLabel: { position: 'absolute', left: 0, fontFamily: font.uiMedium },
  input: {
    fontFamily: font.uiMedium,
    fontSize: 15,
    color: colors.text.strong,
    paddingTop: 22,
    paddingBottom: 8,
    paddingHorizontal: 0,
  },
  error: {
    fontFamily: font.uiMedium,
    fontSize: 12,
    color: colors.price.discount,
    marginTop: 4,
    marginLeft: 4,
  },
  types: { flexDirection: 'row', gap: space.sm },
  type: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.brandPopup.border,
    backgroundColor: colors.white,
  },
  typeOn: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  typeText: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.brand.DEFAULT },
  typeTextOn: { color: colors.white },
  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.page,
    borderRadius: 14,
    padding: space.md,
  },
  defaultTitle: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  defaultSub: { fontFamily: font.body, fontSize: 12, color: colors.text.muted, marginTop: 1 },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border.menu,
  },
  save: {
    height: 54,
    borderRadius: 16,
    backgroundColor: colors.brand.DEFAULT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  savePressed: { opacity: 0.85 },
  saveText: { fontFamily: font.uiBold, fontSize: 16, color: colors.white },
});
