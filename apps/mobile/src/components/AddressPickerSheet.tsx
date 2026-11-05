import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Address } from '@youmart/shared-client';
import { AddressCard, addressTypeOf } from '@/components/AddressCard';
import { colors, font, radii, space } from '@/theme';

/** "12 Main Road, Gandhipuram, Coimbatore - 641012" on one or two lines. */
export function addressLine(a: Address): string {
  return [a.line1, a.line2, a.landmark ? `Near ${a.landmark}` : null, `${a.city} - ${a.pincode}`]
    .filter(Boolean)
    .join(', ');
}

/**
 * v1.18 checkout: the chosen address, compact (type icon, name, two lines, Change). Tapping it
 * opens the picker.
 */
export function AddressSummary({ address, onChange }: { address: Address; onChange: () => void }) {
  const type = addressTypeOf(address.addressType);
  return (
    <Pressable
      style={({ pressed }) => [styles.summary, pressed && { opacity: 0.9 }]}
      onPress={onChange}
      accessibilityLabel={`${address.fullName}, ${addressLine(address)}. Change address`}
    >
      <View style={[styles.typeIcon, { backgroundColor: type.bg }]}>
        <Ionicons name={type.icon} size={16} color={type.fg} />
      </View>
      <View style={{ flex: 1, gap: 1 }}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {address.fullName}
          </Text>
          <View style={[styles.typeTag, { backgroundColor: type.bg }]}>
            <Text style={[styles.typeTagText, { color: type.fg }]}>{type.label}</Text>
          </View>
        </View>
        <Text style={styles.line} numberOfLines={2}>
          {addressLine(address)}
        </Text>
        <Text style={styles.phone}>{address.phone}</Text>
      </View>
      <View style={styles.change}>
        <Text style={styles.changeText}>Change</Text>
      </View>
    </Pressable>
  );
}

/** v1.18 checkout: choose one of the saved addresses (or add a new one) in a bottom sheet. */
export function AddressPickerSheet({
  visible,
  title,
  addresses,
  selectedId,
  onPick,
  onAdd,
  onClose,
}: {
  visible: boolean;
  title: string;
  addresses: Address[];
  selectedId: string | null;
  onPick: (id: string) => void;
  onAdd: () => void;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.md }]}>
        <View style={styles.grabber} />
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
            <Ionicons name="close" size={22} color={colors.text.strong} />
          </Pressable>
        </View>
        <ScrollView
          style={{ flexGrow: 0 }}
          contentContainerStyle={{ gap: space.sm, paddingBottom: space.sm }}
          showsVerticalScrollIndicator={false}
        >
          {addresses.map((a) => (
            <AddressCard
              key={a.id}
              address={a}
              selected={selectedId === a.id}
              onPress={() => onPick(a.id)}
            />
          ))}
        </ScrollView>
        <Pressable style={styles.add} onPress={onAdd}>
          <Ionicons name="add-circle" size={20} color={colors.brand.DEFAULT} />
          <Text style={styles.addText}>Add a new address</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  typeIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flexShrink: 1, fontFamily: font.uiBold, fontSize: 14.5, color: colors.text.strong },
  typeTag: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  typeTagText: { fontFamily: font.uiSemibold, fontSize: 10.5 },
  line: { fontFamily: font.body, fontSize: 12.5, lineHeight: 17, color: colors.text.body },
  phone: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.muted },
  change: {
    borderWidth: 1.2,
    borderColor: colors.brand.DEFAULT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 2,
  },
  changeText: { fontFamily: font.uiBold, fontSize: 12.5, color: colors.brand.DEFAULT },
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
    maxHeight: '80%',
    backgroundColor: colors.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.card.border,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  add: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: colors.white,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    borderStyle: 'dashed',
    paddingVertical: 11,
  },
  addText: { fontFamily: font.uiBold, fontSize: 14, color: colors.brand.DEFAULT },
});
