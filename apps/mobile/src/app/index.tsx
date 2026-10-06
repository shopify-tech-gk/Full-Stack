import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ApiCategory } from '@youmart/shared-client';

import { api, API_URL } from '@/lib/api';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: ApiCategory[] };

/**
 * Proof-of-life: this Phase-1 screen proves the plumbing end-to-end —
 * app -> @youmart/shared-client (the SAME api-client the web uses) -> gateway -> backend -> rendered.
 * It fetches the real catalog categories through the gateway and lists them.
 */
export default function HomeScreen() {
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    api.catalog
      .listCategories()
      .then((res) => {
        if (active) setState({ status: 'ready', items: res.items });
      })
      .catch((err: unknown) => {
        if (active)
          setState({
            status: 'error',
            message: err instanceof Error ? err.message : 'Request failed',
          });
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>YouMart mobile</Text>
      <Text style={styles.subtitle}>Phase 1 — shared-client proof of life</Text>
      <Text style={styles.meta}>Gateway: {API_URL}</Text>

      {state.status === 'loading' && <ActivityIndicator style={styles.spinner} size="large" />}

      {state.status === 'error' && (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Could not reach the backend</Text>
          <Text style={styles.errorText}>{state.message}</Text>
          <Text style={styles.hint}>
            On a real phone, set EXPO_PUBLIC_API_URL to your PC&apos;s LAN IP (see README).
          </Text>
        </View>
      )}

      {state.status === 'ready' && (
        <>
          <Text style={styles.count}>
            {state.items.length} categories from the real backend via @youmart/shared-client
          </Text>
          <FlatList
            style={styles.list}
            data={state.items}
            keyExtractor={(c) => c.id ?? c.slug}
            renderItem={({ item }) => <Text style={styles.row}>• {item.name}</Text>}
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 12 },
  title: { fontSize: 24, fontWeight: '700', color: '#0142aa' },
  subtitle: { fontSize: 14, color: '#444', marginTop: 2 },
  meta: { fontSize: 12, color: '#888', marginTop: 8 },
  spinner: { marginTop: 32 },
  count: { fontSize: 13, color: '#333', marginTop: 16, marginBottom: 8 },
  list: { flex: 1 },
  row: { fontSize: 16, paddingVertical: 6 },
  errorBox: { marginTop: 24, padding: 16, borderRadius: 10, backgroundColor: '#fdecec' },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#b00020' },
  errorText: { fontSize: 13, color: '#b00020', marginTop: 6 },
  hint: { fontSize: 12, color: '#666', marginTop: 10 },
});
