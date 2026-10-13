import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { NotificationSettings } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

type Group = keyof NotificationSettings;
type Channel = 'whatsapp' | 'email';

const GROUPS: { key: Group; title: string; sub: string }[] = [
  {
    key: 'orderUpdates',
    title: 'Order updates',
    sub: 'Order confirmed, shipped and delivered, refunds and wallet credits.',
  },
  { key: 'offers', title: 'Offers & promotions', sub: 'Deals, sales and new arrivals.' },
];

const CHANNELS: { key: Channel; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'logo-whatsapp' },
  { key: 'email', label: 'Email', icon: 'mail-outline' },
];

/** W9: which channels order updates and offers are sent on. Saves on every toggle. */
export default function NotificationSettingsScreen() {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.auth
      .getNotificationSettings()
      .then(setSettings)
      .catch(() => setError('Could not load your settings.'));
  }, []);

  const toggle = async (group: Group, channel: Channel, value: boolean) => {
    if (!settings) return;
    const previous = settings;
    const next: NotificationSettings = {
      ...settings,
      [group]: { ...settings[group], [channel]: value },
    };
    setSettings(next);
    setSaving(true);
    setError(null);
    try {
      setSettings(await api.auth.setNotificationSettings(next));
    } catch {
      setSettings(previous);
      setError('Could not save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return (
      <View style={styles.center}>
        {error ? (
          <Text style={styles.error}>{error}</Text>
        ) : (
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
        )}
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.body}>
      {GROUPS.map((g) => (
        <View key={g.key} style={styles.card}>
          <Text style={styles.title}>{g.title}</Text>
          <Text style={styles.sub}>{g.sub}</Text>
          {CHANNELS.map((c) => (
            <View key={c.key} style={styles.row}>
              <Ionicons name={c.icon} size={20} color={colors.brand.DEFAULT} />
              <Text style={styles.rowText}>{c.label}</Text>
              <Switch
                value={settings[g.key][c.key]}
                onValueChange={(v) => void toggle(g.key, c.key, v)}
                disabled={saving}
                trackColor={{ true: colors.brand.DEFAULT, false: colors.card.border }}
                thumbColor={colors.white}
              />
            </View>
          ))}
        </View>
      ))}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.note}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.text.muted} />
        <Text style={styles.noteText}>
          Sign-in codes (OTP) are always sent - they keep your account secure and can&apos;t be
          turned off.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.md },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: 4,
  },
  title: { fontFamily: font.uiBold, fontSize: 16, color: colors.text.strong },
  sub: { fontFamily: font.body, fontSize: 12.5, color: colors.text.muted, marginBottom: space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cart.line,
  },
  rowText: { flex: 1, fontFamily: font.uiMedium, fontSize: 14.5, color: colors.text.strong },
  error: {
    fontFamily: font.uiMedium,
    fontSize: 13,
    color: colors.price.discount,
    textAlign: 'center',
  },
  note: { flexDirection: 'row', gap: 8, paddingHorizontal: space.xs },
  noteText: {
    flex: 1,
    fontFamily: font.body,
    fontSize: 12.5,
    lineHeight: 18,
    color: colors.text.muted,
  },
});
