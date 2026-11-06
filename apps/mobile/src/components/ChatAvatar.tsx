import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { API_URL } from '@/lib/api';
import { USERNAME_RX } from '@/lib/username';
import { colors, font } from '@/theme';

// v1.18 a shopper's picture in YouFind Bot: their profile photo (served by username), or
// their initial on a soft colour when they have none. Photos refresh at most once an hour.

const TINTS = ['#dbe6fb', '#fde2e4', '#dcfce7', '#fef3c7', '#ede9fe', '#cffafe', '#fce7f3'];
const INKS = ['#0142aa', '#be123c', '#047857', '#b45309', '#6d28d9', '#0e7490', '#be185d'];

const hourBucket = () => Math.floor(Date.now() / 3_600_000);

export function ChatAvatar({ name, size = 30 }: { name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const isUsername = USERNAME_RX.test(name);
  const index = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % TINTS.length;
  const round = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[styles.wrap, round, { backgroundColor: TINTS[index] }]}>
      <Text style={[styles.initial, { fontSize: size * 0.43, color: INKS[index] }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
      {isUsername && !failed ? (
        <Image
          source={{ uri: `${API_URL}/auth/users/${name}/avatar?v=${hourBucket()}` }}
          style={[StyleSheet.absoluteFill, round]}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: colors.white,
  },
  initial: { fontFamily: font.uiBold },
});
