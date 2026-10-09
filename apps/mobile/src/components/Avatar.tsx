import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { colors, font } from '@/theme';

// A spread of distinct, legible tile colours; a name maps to one deterministically.
const PALETTE = [
  '#0142aa',
  '#c0392b',
  '#2a9d8f',
  '#8e44ad',
  '#2980b9',
  '#d35400',
  '#16a085',
  '#e6397a',
  '#6d28d9',
  '#b45309',
];

function hash(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i += 1) h = (h * 31 + value.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic tile colour for a name (same name → same colour). */
export function avatarColor(name: string): string {
  return PALETTE[hash(name || 'YouMart') % PALETTE.length]!;
}

/** Initials from a name: first letter (plus the last word's first letter), letters only. */
export function avatarInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? '';
  if (!/[a-z]/i.test(first)) return '';
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + (/[a-z]/i.test(second) ? second : '')).toUpperCase();
}

/**
 * Profile avatar: the uploaded photo when present, otherwise the user's initials on a colour
 * derived from their name (e.g. "V" for Vijesh), or a person glyph when there's no name.
 */
export function Avatar({ name, uri, size }: { name: string; uri?: string | null; size: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        transition={150}
      />
    );
  }
  const initials = avatarInitials(name);
  return (
    <View
      style={[
        styles.fallback,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name) },
      ]}
    >
      {initials ? (
        <Text style={{ fontFamily: font.uiBold, fontSize: size * 0.42, color: colors.white }}>
          {initials}
        </Text>
      ) : (
        <Ionicons name="person" size={size * 0.55} color={colors.white} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
