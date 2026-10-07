import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { EXPLORE_FEATURES, type ApiCategory } from '@youmart/shared-client';
import { AppHeader } from '@/components/AppHeader';
import { PromoCarousel } from '@/components/PromoCarousel';
import { ProductRail } from '@/components/ProductRail';
import { BrandStrip } from '@/components/BrandStrip';
import { BestCategories } from '@/components/BestCategories';
import { ProductShowcase } from '@/components/ProductShowcase';
import { getHome, type HomeData } from '@/lib/catalog';
import { colors, font, radii, space } from '@/theme';

const FEATURE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  delivery: 'rocket-outline',
  genuine: 'shield-checkmark-outline',
  returns: 'refresh-outline',
  support: 'headset-outline',
};

type State = { status: 'loading' } | { status: 'error' } | { status: 'ready'; data: HomeData };

export default function HomeScreen() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    try {
      const data = await getHome();
      setState({ status: 'ready', data });
    } catch {
      setState({ status: 'error' });
    } finally {
      if (refresh) setRefreshing(false);
    }
  }, []);

  // Re-fetch on focus so recently-viewed rails reflect products viewed since last visit.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <View style={styles.screen}>
      <AppHeader />
      {state.status === 'loading' ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
        </View>
      ) : state.status === 'error' ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Could not reach the store</Text>
          <Pressable style={styles.retry} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.body}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => load(true)}
              tintColor={colors.brand.DEFAULT}
            />
          }
        >
          <PromoCarousel />
          <CategoryStrip
            categories={state.data.categories}
            onPress={(slug) => router.push(`/category/${slug}`)}
          />
          {state.data.rails.slice(0, 2).map((rail) => (
            <ProductRail key={rail.key} rail={rail} />
          ))}
          <BrandStrip />
          {state.data.rails.slice(2).map((rail) => (
            <ProductRail key={rail.key} rail={rail} />
          ))}
          <ProductShowcase showcase={state.data.showcase} />
          {state.data.best ? <BestCategories best={state.data.best} /> : null}
          <FeatureStrip />
          <View style={{ height: space.xxl }} />
        </ScrollView>
      )}
    </View>
  );
}

function CategoryStrip({
  categories,
  onPress,
}: {
  categories: ApiCategory[];
  onPress: (slug: string) => void;
}) {
  const roots = categories.filter((c) => !c.parentId);
  const list = (roots.length > 0 ? roots : categories).slice(0, 14);
  if (list.length === 0) return null;
  return (
    <View style={styles.catWrap}>
      <Text style={styles.catTitle}>Shop by category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catList}
      >
        {list.map((c) => (
          <Pressable key={c.id} style={styles.catChip} onPress={() => onPress(c.slug)}>
            <View style={styles.catIcon}>
              <Ionicons name="pricetag" size={18} color={colors.brand.DEFAULT} />
            </View>
            <Text numberOfLines={2} style={styles.catLabel}>
              {c.name}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function FeatureStrip() {
  return (
    <View style={styles.features}>
      {EXPLORE_FEATURES.map((f) => (
        <View key={f.id} style={styles.feature}>
          <Ionicons
            name={FEATURE_ICON[f.id] ?? 'star-outline'}
            size={22}
            color={colors.brand.DEFAULT}
          />
          <Text style={styles.featureTitle}>{f.title}</Text>
          <Text style={styles.featureText} numberOfLines={2}>
            {f.text}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  errorTitle: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.text.strong },
  retry: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  retryText: { fontFamily: font.uiSemibold, color: colors.white, fontSize: 14 },
  body: { paddingTop: space.md },
  catWrap: { marginTop: space.xl },
  catTitle: {
    fontFamily: font.uiBold,
    fontSize: 17,
    color: colors.heading,
    paddingHorizontal: space.lg,
    marginBottom: space.md,
  },
  catList: { paddingHorizontal: space.lg, gap: space.md },
  catChip: { width: 76, alignItems: 'center', gap: 6 },
  catIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  catLabel: { fontFamily: font.ui, fontSize: 11.5, color: colors.text.body, textAlign: 'center' },
  features: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: space.xxl,
    paddingHorizontal: space.lg,
    gap: space.md,
  },
  feature: {
    flexGrow: 1,
    flexBasis: '46%',
    backgroundColor: colors.white,
    borderRadius: radii.featureCard,
    padding: space.lg,
    gap: 4,
    borderWidth: 1,
    borderColor: colors.card.border,
  },
  featureTitle: {
    fontFamily: font.uiSemibold,
    fontSize: 13.5,
    color: colors.text.strong,
    marginTop: 4,
  },
  featureText: { fontFamily: font.body, fontSize: 12, color: colors.text.body },
});
