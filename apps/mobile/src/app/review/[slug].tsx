import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError, type MyReview } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { ProductImage } from '@/components/ui';
import { colors, font, radii, space } from '@/theme';

const WORDS = ['', 'Terrible', 'Bad', 'Okay', 'Good', 'Excellent'];

/**
 * Rate & review a product (from a delivered order, or My Reviews to edit). Reviews open once the
 * item has been delivered; a second submit edits the customer's existing review.
 */
export default function RateProductScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { slug: rawSlug } = useLocalSearchParams<{ slug: string }>();
  const slug = String(rawSlug ?? '');

  const [product, setProduct] = useState<{ title: string; image?: string } | null>(null);
  const [mine, setMine] = useState<MyReview | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    api.catalog
      .getProduct(slug)
      .then((p) => setProduct({ title: p.title, image: p.images[0]?.url }))
      .catch(() => setProduct({ title: 'Product' }));
    api.catalog
      .myReview(slug)
      .then((m) => {
        setMine(m);
        if (m.review) {
          setRating(m.review.rating);
          setTitle(m.review.title ?? '');
          setBody(m.review.body);
        }
      })
      .catch(() => setMine({ canReview: false, review: null }));
  }, [slug]);

  const pick = (n: number) => {
    setRating(n);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  const submit = async () => {
    if (rating === 0) {
      setError('Tap the stars to rate it.');
      return;
    }
    if (body.trim().length < 10) {
      setError('Please write at least 10 characters about it.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api.catalog.submitReview(slug, {
        rating,
        body: body.trim(),
        ...(title.trim() ? { title: title.trim() } : {}),
      });
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your review. Try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!mine || !product) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.brand.DEFAULT} />
      </View>
    );
  }

  if (done) {
    return (
      <View style={[styles.center, { padding: space.xl, gap: space.md }]}>
        <View style={styles.doneIcon}>
          <Ionicons name="checkmark" size={36} color={colors.white} />
        </View>
        <Text style={styles.doneTitle}>Thanks for your review!</Text>
        <Text style={styles.doneText}>It helps other shoppers choose well.</Text>
        <Pressable style={styles.primary} onPress={() => router.back()}>
          <Text style={styles.primaryText}>Done</Text>
        </Pressable>
        <Pressable onPress={() => router.replace('/account/reviews')}>
          <Text style={styles.link}>See my reviews</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + space.xxl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.productRow}>
          <ProductImage src={product.image} style={styles.thumb} icon={22} />
          <Text numberOfLines={2} style={styles.productTitle}>
            {product.title}
          </Text>
        </View>

        {!mine.canReview && !mine.review ? (
          <View style={styles.notice}>
            <Ionicons name="time-outline" size={20} color={colors.brand.DEFAULT} />
            <Text style={styles.noticeText}>
              You can rate this product once it has been delivered to you.
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.heading}>
              {mine.review ? 'Edit your rating' : 'How would you rate it?'}
            </Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => pick(n)} hitSlop={6}>
                  <Ionicons
                    name={n <= rating ? 'star' : 'star-outline'}
                    size={40}
                    color={n <= rating ? '#f5a400' : colors.card.border}
                  />
                </Pressable>
              ))}
            </View>
            <Text style={styles.word}>{WORDS[rating]}</Text>

            <Text style={styles.label}>Title (optional)</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Great value for money"
              placeholderTextColor={colors.text.placeholder}
              maxLength={120}
              style={styles.input}
            />
            <Text style={styles.label}>Your review</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder="What did you like or dislike? How was the quality?"
              placeholderTextColor={colors.text.placeholder}
              multiline
              maxLength={2000}
              style={[styles.input, styles.textarea]}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable style={[styles.primary, busy && { opacity: 0.7 }]} onPress={submit}>
              {busy ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.primaryText}>
                  {mine.review ? 'Update review' : 'Submit review'}
                </Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.page },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.page },
  body: { padding: space.lg, gap: space.md },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    padding: space.md,
  },
  thumb: { width: 64, height: 64, borderRadius: 10 },
  productTitle: { flex: 1, fontFamily: font.uiSemibold, fontSize: 14.5, color: colors.text.strong },
  heading: {
    fontFamily: font.uiBold,
    fontSize: 18,
    color: colors.heading,
    textAlign: 'center',
    marginTop: space.md,
  },
  stars: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  word: {
    fontFamily: font.uiSemibold,
    fontSize: 14,
    color: '#c47f00',
    textAlign: 'center',
    minHeight: 20,
  },
  label: { fontFamily: font.uiSemibold, fontSize: 13.5, color: colors.text.strong },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.tile,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontFamily: font.body,
    fontSize: 14.5,
    color: colors.text.strong,
  },
  textarea: { minHeight: 120, textAlignVertical: 'top' },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  primary: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignItems: 'center',
    alignSelf: 'stretch',
    marginTop: space.sm,
  },
  primaryText: { fontFamily: font.uiBold, fontSize: 15, color: colors.white },
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.brandPopup.bg,
    borderRadius: radii.tile,
    padding: space.md,
  },
  noticeText: { flex: 1, fontFamily: font.uiMedium, fontSize: 14, color: colors.text.strong },
  doneIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: colors.feature.guarantee,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneTitle: { fontFamily: font.uiBold, fontSize: 20, color: colors.heading },
  doneText: { fontFamily: font.body, fontSize: 14, color: colors.text.body },
  link: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
});
