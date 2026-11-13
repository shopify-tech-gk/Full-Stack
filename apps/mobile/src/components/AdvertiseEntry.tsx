import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from '@/lib/router';
import { colors, font, space } from '@/theme';

/** v1.19 Account-tab entry to "Advertise on YouMart" (/ads). */
export function AdvertiseEntry() {
  const router = useRouter();
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => router.push('/ads')}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel="Advertise on YouMart"
      >
        <View style={styles.icon}>
          <Ionicons name="megaphone" size={19} color="#ffffff" />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.title}>Advertise on YouMart</Text>
          <Text style={styles.sub} numberOfLines={1}>
            Photo or video ads · ₹1,000 per day
          </Text>
        </View>
        <View style={styles.newTag}>
          <Text style={styles.newText}>NEW</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.text.chevron} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: space.lg, marginTop: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#fde3cf',
  },
  pressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f97316',
    experimental_backgroundImage: 'linear-gradient(135deg, #ea580c 0%, #f59e0b 100%)',
  },
  title: { fontFamily: font.uiBold, fontSize: 15, color: colors.text.strong },
  sub: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
  newTag: {
    backgroundColor: '#fff1e6',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  newText: { fontFamily: font.uiBold, fontSize: 9.5, letterSpacing: 0.8, color: '#c2410c' },
});
