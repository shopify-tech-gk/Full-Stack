import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Address } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { AddAddressOptions, useAddAddress } from '@/components/AddAddressOptions';
import { AddressAction, AddressCard } from '@/components/AddressCard';
import { colors, font, radii, space } from '@/theme';

// Address book: list + add/edit/delete/set-default via /api/addresses. `select=1` -> picking one
// for checkout (tapping returns the chosen id). v1.17: icon cards (components/AddressCard.tsx),
// the default address first, a count header and a friendlier empty state.
export default function AddressesScreen() {
  const router = useRouter();
  const { select } = useLocalSearchParams<{ select?: string }>();
  const selecting = select === '1';
  const [list, setList] = useState<Address[] | null>(null);
  const [adding, setAdding] = useState(false);
  const addAddress = useAddAddress();
  const insets = useSafeAreaInsets();

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

  // The default address first, then the rest as saved.
  const sorted = list ? [...list].sort((x, y) => Number(y.isDefault) - Number(x.isDefault)) : [];

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
        data={sorted}
        keyExtractor={(a) => a.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          list.length > 0 ? (
            <Text style={styles.count}>
              {list.length} saved address{list.length === 1 ? '' : 'es'}
              {selecting ? ' · tap one to deliver there' : ''}
            </Text>
          ) : undefined
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Ionicons name="location" size={34} color={colors.brand.DEFAULT} />
            </View>
            <Text style={styles.emptyTitle}>No addresses saved yet</Text>
            <Text style={styles.emptyText}>
              Add your home, work or any other address for faster checkout.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <AddressCard
            address={item}
            onPress={selecting ? () => onPick(item) : undefined}
            actions={
              selecting ? undefined : (
                <>
                  {!item.isDefault ? (
                    <AddressAction
                      icon="star-outline"
                      label="Set default"
                      onPress={() => onDefault(item)}
                    />
                  ) : null}
                  <AddressAction
                    icon="create-outline"
                    label="Edit"
                    onPress={() =>
                      router.push({ pathname: '/addresses/form', params: { id: item.id } })
                    }
                  />
                  <AddressAction
                    icon="trash-outline"
                    label="Delete"
                    danger
                    onPress={() => onDelete(item)}
                  />
                </>
              )
            }
          />
        )}
      />
      <View style={[styles.addBar, { paddingBottom: space.lg }]}>
        <Pressable
          style={({ pressed }) => [styles.addBtn, pressed && { opacity: 0.9 }]}
          onPress={() => setAdding(true)}
        >
          <Ionicons name="add-circle" size={20} color={colors.white} />
          <Text style={styles.addText}>Add a new address</Text>
        </Pressable>
      </View>

      <Modal
        visible={adding}
        transparent
        animationType="slide"
        onRequestClose={() => setAdding(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setAdding(false)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grabber} />
          <Text style={styles.sheetTitle}>Add a new address</Text>
          <AddAddressOptions
            onPick={(mode) => {
              setAdding(false);
              addAddress(mode);
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { paddingHorizontal: space.md, paddingVertical: space.sm, gap: space.sm, flexGrow: 1 },
  count: {
    fontFamily: font.uiSemibold,
    fontSize: 12.5,
    color: colors.text.muted,
    marginBottom: -2,
  },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl },
  emptyIcon: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.brandPopup.bg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space.sm,
  },
  emptyTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  emptyText: {
    fontFamily: font.body,
    fontSize: 13.5,
    color: colors.text.body,
    textAlign: 'center',
    paddingHorizontal: space.xl,
  },
  addBar: {
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    backgroundColor: colors.page,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#dfe5ee',
  },
  addBtn: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 11,
  },
  addText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
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
    backgroundColor: colors.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.card.border,
    marginBottom: space.md,
  },
  sheetTitle: {
    fontFamily: font.uiBold,
    fontSize: 19,
    color: colors.heading,
    marginBottom: space.md,
  },
});
