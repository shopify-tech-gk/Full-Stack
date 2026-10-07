import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { MyReview, ReviewPage } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { useSession } from '@/stores/session';
import { Stars } from './ui';
import { colors, font, radii, space } from '@/theme';

function reviewDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

/** Product reviews: rating breakdown + list + a submit form (requireAuth, canReview) — mirrors web. */
export function ProductReviews({ slug }: { slug: string }) {
  const router = useRouter();
  const session = useSession();
  const [page, setPage] = useState<ReviewPage | null>(null);
  const [mine, setMine] = useState<MyReview | null>(null);

  const [rating, setRating] = useState(0);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    api.catalog
      .listReviews(slug)
      .then(setPage)
      .catch(() =>
        setPage({
          items: [],
          total: 0,
          page: 1,
          perPage: 10,
          breakdown: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        }),
      );
    if (session.status === 'authenticated')
      api.catalog
        .myReview(slug)
        .then(setMine)
        .catch(() => setMine(null));
    else setMine(null);
  };

  useEffect(load, [slug, session.status]);

  const submit = async () => {
    if (rating < 1 || body.trim().length < 3) {
      setError('Please choose a rating and write a short review.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.catalog.submitReview(slug, { rating, body: body.trim() });
      setBody('');
      setRating(0);
      load();
    } catch {
      setError('Could not submit your review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!page) {
    return <ActivityIndicator color={colors.brand.DEFAULT} style={{ margin: space.lg }} />;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.heading}>Ratings & Reviews</Text>

      {page.total > 0 ? (
        <View style={styles.breakdown}>
          {([5, 4, 3, 2, 1] as const).map((star) => {
            const count = page.breakdown[String(star) as '1' | '2' | '3' | '4' | '5'] ?? 0;
            const pct = page.total > 0 ? (count / page.total) * 100 : 0;
            return (
              <View key={star} style={styles.barRow}>
                <Text style={styles.barStar}>{star}★</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${pct}%` }]} />
                </View>
                <Text style={styles.barCount}>{count}</Text>
              </View>
            );
          })}
        </View>
      ) : (
        <Text style={styles.empty}>No reviews yet. Be the first to review this product.</Text>
      )}

      {/* Submit */}
      {session.status !== 'authenticated' ? (
        <Pressable style={styles.loginPrompt} onPress={() => router.push('/auth/login')}>
          <Ionicons name="create-outline" size={18} color={colors.brand.DEFAULT} />
          <Text style={styles.loginText}>Sign in to write a review</Text>
        </Pressable>
      ) : mine?.canReview ? (
        <View style={styles.form}>
          <Text style={styles.formTitle}>Write a review</Text>
          <View style={styles.starPicker}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={4}>
                <Ionicons
                  name={n <= rating ? 'star' : 'star-outline'}
                  size={28}
                  color={colors.star.filled}
                />
              </Pressable>
            ))}
          </View>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="Share your experience with this product"
            placeholderTextColor={colors.text.placeholder}
            multiline
            style={styles.textarea}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Pressable
            style={[styles.submit, submitting && styles.disabled]}
            onPress={submit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.submitText}>Submit review</Text>
            )}
          </Pressable>
        </View>
      ) : mine?.review ? (
        <Text style={styles.youReviewed}>You reviewed this product.</Text>
      ) : null}

      {/* List */}
      {page.items.map((review) => (
        <View key={review.id} style={styles.review}>
          <View style={styles.reviewHead}>
            <Stars rating={review.rating} size={14} />
            {review.verifiedPurchase ? (
              <View style={styles.verified}>
                <Ionicons name="checkmark-circle" size={12} color={colors.feature.guarantee} />
                <Text style={styles.verifiedText}>Verified</Text>
              </View>
            ) : null}
          </View>
          {review.title ? <Text style={styles.reviewTitle}>{review.title}</Text> : null}
          <Text style={styles.reviewBody}>{review.body}</Text>
          <Text style={styles.reviewMeta}>
            {review.author} · {reviewDate(review.createdAt)}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: space.lg, gap: space.md, backgroundColor: colors.page },
  heading: { fontFamily: font.uiBold, fontSize: 17, color: colors.heading },
  breakdown: { gap: 6 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barStar: { fontFamily: font.uiMedium, fontSize: 12, color: colors.text.body, width: 26 },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.filter.track,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 4, backgroundColor: colors.star.filled },
  barCount: {
    fontFamily: font.body,
    fontSize: 12,
    color: colors.text.muted,
    width: 26,
    textAlign: 'right',
  },
  empty: { fontFamily: font.body, fontSize: 13.5, color: colors.text.body },
  loginPrompt: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 12,
  },
  loginText: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.brand.DEFAULT },
  form: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: space.md,
  },
  formTitle: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.text.strong },
  starPicker: { flexDirection: 'row', gap: 6 },
  textarea: {
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    padding: space.md,
    minHeight: 80,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text.input,
    textAlignVertical: 'top',
  },
  error: { fontFamily: font.uiMedium, fontSize: 12.5, color: colors.price.discount },
  submit: {
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    paddingVertical: 12,
    alignItems: 'center',
  },
  disabled: { opacity: 0.6 },
  submitText: { fontFamily: font.uiSemibold, fontSize: 15, color: colors.white },
  youReviewed: { fontFamily: font.uiMedium, fontSize: 13.5, color: colors.feature.guarantee },
  review: {
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    padding: space.lg,
    gap: 6,
  },
  reviewHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verified: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  verifiedText: { fontFamily: font.uiMedium, fontSize: 11, color: colors.feature.guarantee },
  reviewTitle: { fontFamily: font.uiSemibold, fontSize: 14, color: colors.text.strong },
  reviewBody: { fontFamily: font.body, fontSize: 13.5, lineHeight: 20, color: colors.text.body },
  reviewMeta: { fontFamily: font.body, fontSize: 12, color: colors.text.muted },
});
