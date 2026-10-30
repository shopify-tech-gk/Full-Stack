import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Address } from '@youmart/shared-client';
import { colors, font, space } from '@/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const BLUE = colors.brand.DEFAULT;
const BLUE_BG = colors.brandPopup.bg;

/** Each address type's icon and name (Home / Work / Other), all in the brand blue. */
export const ADDRESS_TYPE: Record<
  string,
  { icon: IconName; fg: string; bg: string; label: string }
> = {
  HOME: { icon: 'home', fg: BLUE, bg: BLUE_BG, label: 'Home' },
  WORK: { icon: 'briefcase', fg: BLUE, bg: BLUE_BG, label: 'Work' },
  OTHER: { icon: 'location', fg: BLUE, bg: BLUE_BG, label: 'Other' },
};

export const addressTypeOf = (type: string) => ADDRESS_TYPE[type] ?? ADDRESS_TYPE.OTHER!;

/**
 * v1.17 one saved address: a type icon (Home / Work / Other), the type and Default tags, the name,
 * the address and the phone with a call icon. `selected` (true / false) turns it into a radio
 * choice (checkout); `actions` adds a row of buttons under it (the address book).
 */
export function AddressCard({
  address: a,
  selected,
  onPress,
  actions,
}: {
  address: Address;
  selected?: boolean;
  onPress?: () => void;
  actions?: ReactNode;
}) {
  const type = addressTypeOf(a.addressType);
  const place = [
    a.line1,
    a.line2,
    a.landmark ? `Near ${a.landmark}` : null,
    `${a.city}, ${a.state} - ${a.pincode}`,
  ]
    .filter(Boolean)
    .join(', ');
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        selected && styles.cardOn,
        pressed && onPress ? { opacity: 0.92 } : null,
      ]}
      accessibilityRole={selected === undefined ? undefined : 'radio'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
    >
      <View style={styles.row}>
        <View style={[styles.icon, { backgroundColor: type.bg }]}>
          <Ionicons name={type.icon} size={17} color={type.fg} />
        </View>
        <View style={styles.body}>
          <View style={styles.tags}>
            <View style={[styles.tag, { backgroundColor: type.bg }]}>
              <Text style={[styles.tagText, { color: type.fg }]}>{type.label}</Text>
            </View>
            {a.isDefault ? (
              <View style={[styles.tag, styles.defaultTag]}>
                <Ionicons name="star" size={10} color="#15803d" />
                <Text style={[styles.tagText, { color: '#15803d' }]}>Default</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.name}>{a.fullName}</Text>
          <Text style={styles.place}>{place}</Text>
          <View style={styles.phone}>
            <Ionicons name="call-outline" size={13} color={colors.text.muted} />
            <Text style={styles.phoneText}>{a.phone}</Text>
          </View>
        </View>
        {selected !== undefined ? (
          <Ionicons
            name={selected ? 'checkmark-circle' : 'ellipse-outline'}
            size={24}
            color={selected ? colors.brand.DEFAULT : colors.card.border}
          />
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </Pressable>
  );
}

/** A small icon + text button for the address card's action row. */
export function AddressAction({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const color = danger ? colors.cart.danger : colors.brand.DEFAULT;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.action,
        danger && styles.actionDanger,
        pressed && { opacity: 0.7 },
      ]}
    >
      <Ionicons name={icon} size={15} color={color} />
      <Text style={[styles.actionText, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#0f172a',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  cardOn: { borderColor: colors.brand.DEFAULT, backgroundColor: '#f7faff' },
  row: { flexDirection: 'row', gap: 10 },
  icon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 1 },
  tags: { flexDirection: 'row', gap: 6, marginBottom: 1 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  defaultTag: { backgroundColor: '#e8f7ee' },
  tagText: { fontFamily: font.uiBold, fontSize: 10.5, letterSpacing: 0.3 },
  name: { fontFamily: font.uiBold, fontSize: 14, color: colors.text.strong },
  place: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17, color: colors.text.body },
  phone: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 },
  phoneText: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.strong },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: space.sm,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dfe5ee',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: 10,
    backgroundColor: colors.brandPopup.bg,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  actionDanger: { backgroundColor: '#fdecec', marginLeft: 'auto' },
  actionText: { fontFamily: font.uiSemibold, fontSize: 12 },
});
