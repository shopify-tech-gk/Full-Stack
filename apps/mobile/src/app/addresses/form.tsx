import { useEffect, useState } from 'react';
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
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
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

// Add / edit an address. Fields + validation come from shared-client (same rules as web + server).
export default function AddressFormScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = Boolean(id);

  const [values, setValues] = useState<AddressFormValues>(EMPTY_ADDRESS_FORM);
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Field
          label="Full name"
          value={values.fullName}
          onChange={(t) => set('fullName', t)}
          error={errors.fullName}
        />
        <Field
          label="Phone"
          value={values.phone}
          onChange={(t) => set('phone', t)}
          error={errors.phone}
          keyboardType="phone-pad"
        />
        <Field
          label="Street address"
          value={values.line1}
          onChange={(t) => set('line1', t)}
          error={errors.line1}
        />
        <Field
          label="Apartment, suite (optional)"
          value={values.line2}
          onChange={(t) => set('line2', t)}
          error={errors.line2}
        />
        <Field
          label="Landmark (optional)"
          value={values.landmark}
          onChange={(t) => set('landmark', t)}
          error={errors.landmark}
        />
        <Field
          label="Town / City"
          value={values.city}
          onChange={(t) => set('city', t)}
          error={errors.city}
        />
        <Field
          label="State"
          value={values.state}
          onChange={(t) => set('state', t)}
          error={errors.state}
        />
        <Field
          label="PIN Code"
          value={values.pincode}
          onChange={(t) => set('pincode', t)}
          error={errors.pincode}
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Address type</Text>
        <View style={styles.chips}>
          {ADDRESS_TYPES.map((t) => (
            <Pressable
              key={t.value}
              style={[styles.chip, values.addressType === t.value && styles.chipActive]}
              onPress={() => set('addressType', t.value as AddressType)}
            >
              <Text
                style={[styles.chipText, values.addressType === t.value && styles.chipTextActive]}
              >
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Set as default address</Text>
          <Switch
            value={values.isDefault}
            onValueChange={(v) => set('isDefault', v)}
            trackColor={{ true: colors.brand.DEFAULT }}
          />
        </View>

        <Pressable
          style={[styles.button, busy && styles.disabled]}
          onPress={submit}
          disabled={busy}
        >
          {busy ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Save address</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  keyboardType,
}: {
  label: string;
  value: string;
  onChange: (t: string) => void;
  error?: string;
  keyboardType?: 'default' | 'phone-pad' | 'number-pad';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        style={[styles.input, error && styles.inputError]}
        placeholderTextColor={colors.text.placeholder}
        keyboardType={keyboardType ?? 'default'}
        autoCapitalize="words"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  field: { gap: 6 },
  label: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
  input: {
    borderWidth: 1.5,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    paddingHorizontal: space.md,
    height: 48,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text.input,
    backgroundColor: colors.white,
  },
  inputError: { borderColor: colors.price.discount },
  error: { fontFamily: font.uiMedium, fontSize: 12, color: colors.price.discount },
  chips: { flexDirection: 'row', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  chipActive: { backgroundColor: colors.brand.DEFAULT, borderColor: colors.brand.DEFAULT },
  chipText: { fontFamily: font.ui, fontSize: 13, color: colors.text.body },
  chipTextActive: { color: colors.white, fontFamily: font.uiSemibold },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
  },
  switchLabel: { fontFamily: font.uiMedium, fontSize: 14, color: colors.text.strong },
  button: {
    marginTop: space.md,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.6 },
  buttonText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
});
