import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSession } from '@/stores/session';
import { colors, font, radii, space } from '@/theme';

export type AddAddressMode = 'map' | 'detect' | 'manual';

const OPTIONS: {
  mode: AddAddressMode;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  sub: string;
  primary?: boolean;
}[] = [
  {
    mode: 'map',
    icon: 'map',
    title: 'Select on map',
    sub: 'Drop the pin on your exact spot',
    primary: true,
  },
  { mode: 'detect', icon: 'navigate', title: 'Detect my location', sub: 'Use GPS, then fine-tune' },
  {
    mode: 'manual',
    icon: 'create-outline',
    title: 'Enter manually',
    sub: 'Type in the full address',
  },
];

/** Routes to the chosen add-address flow (guests are sent to sign in first). */
export function useAddAddress(): (mode: AddAddressMode) => void {
  const router = useRouter();
  const session = useSession();
  return (mode) => {
    if (session.status !== 'authenticated') {
      router.push('/auth/login');
      return;
    }
    if (mode === 'manual') {
      const { name, phone } = session.user;
      router.push({
        pathname: '/addresses/form',
        params: {
          source: 'manual',
          ...(name ? { fullName: name } : {}),
          ...(phone ? { phone } : {}),
        },
      });
      return;
    }
    router.push({ pathname: '/addresses/map', params: { mode } });
  };
}

/** The three ways to add an address, as premium option tiles. */
export function AddAddressOptions({ onPick }: { onPick: (mode: AddAddressMode) => void }) {
  return (
    <View style={styles.wrap}>
      {OPTIONS.map((o) => (
        <Pressable
          key={o.mode}
          onPress={() => onPick(o.mode)}
          style={({ pressed }) => [
            styles.tile,
            o.primary && styles.tilePrimary,
            pressed && styles.pressed,
          ]}
        >
          <View style={[styles.icon, o.primary && styles.iconPrimary]}>
            <Ionicons
              name={o.icon}
              size={19}
              color={o.primary ? colors.white : colors.brand.DEFAULT}
            />
          </View>
          <View style={styles.body}>
            <Text style={styles.title}>{o.title}</Text>
            <Text style={styles.sub}>{o.sub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={colors.brand.DEFAULT} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile + 4,
    borderWidth: 1,
    borderColor: colors.brandPopup.border,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  tilePrimary: { borderColor: colors.brand.DEFAULT, borderWidth: 1.5 },
  pressed: { opacity: 0.85 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPrimary: { backgroundColor: colors.brand.DEFAULT },
  body: { flex: 1 },
  title: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  sub: { fontFamily: font.body, fontSize: 12, color: colors.text.muted, marginTop: 1 },
});
