import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { addressLines, type Address } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { colors, font, radii, space } from '@/theme';

// Address book: list + add/edit/delete/set-default via /api/addresses. `select=1` -> picking one
// for checkout (tapping returns the chosen id).
export default function AddressesScreen() {
  const router = useRouter();
  const { select } = useLocalSearchParams<{ select?: string }>();
  const selecting = select === '1';
  const [list, setList] = useState<Address[] | null>(null);

  const load = useCallback(() => {
    api.addresses
      .list()
      .then((r) => setList(r.items))
      .catch(() => setList([]));
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onPick = (a: Address) => {
    if (selecting) router.replace({ pathname: '/checkout', params: { addressId: a.id } });
  };

  const onDelete = (a: Address) => {
    Alert.alert('Delete address', 'Remove this address?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void api.addresses.remove(a.id).then(load),
      },
    ]);
  };

  const onDefault = (a: Address) => void api.addresses.setDefault(a.id).then(load);

  if (!list) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={list}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="location-outline" size={48} color={colors.card.border} />
            <Text style={styles.emptyText}>No addresses saved yet.</Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => onPick(item)} disabled={!selecting}>
            <View style={styles.cardHead}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeText}>{item.addressType}</Text>
              </View>
              {item.isDefault ? <Text style={styles.default}>Default</Text> : null}
              {selecting ? (
                <Ionicons name="chevron-forward" size={18} color={colors.text.chevron} />
              ) : null}
            </View>
            {addressLines(item).map((line, i) => (
              <Text key={i} style={i === 0 ? styles.name : styles.line}>
                {line}
              </Text>
            ))}
            {!selecting ? (
              <View style={styles.cardActions}>
                {!item.isDefault ? (
                  <Pressable onPress={() => onDefault(item)} hitSlop={6}>
                    <Text style={styles.action}>Set default</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() =>
                    router.push({ pathname: '/addresses/form', params: { id: item.id } })
                  }
                  hitSlop={6}
                >
                  <Text style={styles.action}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => onDelete(item)} hitSlop={6}>
                  <Text style={[styles.action, styles.danger]}>Delete</Text>
                </Pressable>
              </View>
            ) : null}
          </Pressable>
        )}
      />
      <Pressable style={styles.addBtn} onPress={() => router.push('/addresses/form')}>
        <Ionicons name="add" size={20} color={colors.white} />
        <Text style={styles.addText}>Add a new address</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: space.lg, gap: space.md },
  empty: { alignItems: 'center', gap: space.md, paddingVertical: space.xxxl },
  emptyText: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  card: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: 3,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: 4 },
  typeBadge: {
    backgroundColor: colors.page,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  typeText: { fontFamily: font.uiSemibold, fontSize: 11, color: colors.brand.DEFAULT },
  default: { fontFamily: font.uiSemibold, fontSize: 11, color: colors.feature.guarantee },
  name: { fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  line: { fontFamily: font.body, fontSize: 13, color: colors.text.body },
  cardActions: { flexDirection: 'row', gap: space.lg, marginTop: space.sm },
  action: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.brand.DEFAULT },
  danger: { color: colors.cart.danger },
  addBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    margin: space.lg,
    paddingVertical: 14,
  },
  addText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
});
