import { useCallback, useEffect, useMemo, useState } from 'react';
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
  useWindowDimensions,
  type TextInputProps,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import Animated, { FadeInDown, ReduceMotion, ZoomIn } from 'react-native-reanimated';
import { ApiError, type AdAvailability, type AdKind, type AdView } from '@youmart/shared-client';
import { api } from '@/lib/api';
import { AD_PRICE_FALLBACK, fmtWhen, mimeOf, rupees, uploadAdMedia } from '@/lib/ads';
import { useRouter } from '@/lib/router';
import { SponsoredCarousel } from '@/components/SponsoredCarousel';
import { colors, font, space } from '@/theme';

// v1.19 Create an ad: format (photo carousel / video) -> media (uploaded right away) -> details ->
// when (a day, a start hour, how many 24-hour days; booked windows are greyed out - one ad per
// format at a time) -> live preview and the price. Submitting costs nothing: payment comes after
// the team approves it (/ads).

const RM = ReduceMotion.Never;
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MAX_IMAGES = 5;
const PURPLE = '#3b1a8f';

type Item = {
  key: string;
  uri: string;
  mime: string;
  status: 'uploading' | 'done' | 'error';
  fileName?: string;
  error?: string;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? 'AM' : 'PM'}`;

function Field({
  label,
  hint,
  optional,
  ...input
}: TextInputProps & { label: string; hint?: string; optional?: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>
        {label}
        {optional ? <Text style={styles.optional}> (optional)</Text> : null}
      </Text>
      <TextInput
        {...input}
        placeholderTextColor="#9aa6bd"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, focused && styles.inputFocused]}
      />
      {hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </View>
  );
}

function Done({ ad, onDone }: { ad: AdView; onDone: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.doneScreen, { paddingTop: insets.top + 50 }]}>
      <Animated.View entering={ZoomIn.springify().damping(12).reduceMotion(RM)} style={styles.tick}>
        <Ionicons name="paper-plane" size={40} color="#1f1300" />
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(200).duration(450).reduceMotion(RM)}>
        <Text style={styles.doneTitle}>Sent for review</Text>
        <Text style={styles.doneText}>
          “{ad.headline}” is with our team. Once it&apos;s approved you&apos;ll pay{' '}
          {rupees(ad.amount)} from your YouMart Wallet to book it.
        </Text>
        <View style={styles.doneCard}>
          {[
            ['Reference', ad.referenceCode],
            ['Format', ad.kind === 'IMAGE' ? `Photo carousel (${ad.media.length})` : 'Video'],
            ['Starts', fmtWhen(ad.startsAt)],
            ['Ends', fmtWhen(ad.endsAt)],
            ['Total', rupees(ad.amount)],
          ].map(([k, v]) => (
            <View key={k} style={styles.doneRow}>
              <Text style={styles.doneKey}>{k}</Text>
              <Text style={styles.doneVal}>{v}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
      <View style={[styles.doneFooter, { paddingBottom: insets.bottom + 12 }]}>
        <Pressable
          onPress={onDone}
          style={({ pressed }) => [styles.submit, pressed && styles.pressed]}
        >
          <Text style={styles.submitText}>View my ads</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function NewAd() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();

  const [kind, setKind] = useState<AdKind>('IMAGE');
  const [items, setItems] = useState<Item[]>([]);
  const [advertiserName, setAdvertiserName] = useState('');
  const [headline, setHeadline] = useState('');
  const [caption, setCaption] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [avail, setAvail] = useState<AdAvailability | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [days, setDays] = useState(1);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<AdView | null>(null);

  // Earliest start: the next whole hour that is at least an hour away (time for review).
  const earliest = useMemo(() => Math.ceil((Date.now() + HOUR) / HOUR) * HOUR, []);
  const dates = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => new Date(startOfDay(new Date()).getTime() + i * DAY)),
    [],
  );

  const loadAvail = useCallback((k: AdKind) => {
    setAvail(null);
    api.ads
      .availability(k)
      .then(setAvail)
      .catch(() => setAvail({ kind: k, pricePerDay: AD_PRICE_FALLBACK, maxDays: 30, booked: [] }));
  }, []);
  useEffect(() => loadAvail(kind), [kind, loadAvail]);

  const booked = useMemo(
    () =>
      (avail?.booked ?? []).map((b) => ({
        from: new Date(b.startsAt).getTime(),
        to: new Date(b.endsAt).getTime(),
      })),
    [avail],
  );
  const clashes = useCallback(
    (start: number, n: number) => booked.some((b) => b.from < start + n * DAY && b.to > start),
    [booked],
  );
  const startOf = (d: Date, h: number) => d.getTime() + h * HOUR;
  const hourOk = (d: Date, h: number) => startOf(d, h) >= earliest && !clashes(startOf(d, h), days);
  const dayOk = (d: Date) => Array.from({ length: 24 }, (_, h) => h).some((h) => hourOk(d, h));

  // Keep the picked time valid when the format / length changes.
  useEffect(() => {
    if (day && hour !== null && !hourOk(day, hour)) setHour(null);
  }, [days, booked]);

  const switchKind = (k: AdKind) => {
    if (k === kind) return;
    setKind(k);
    setItems([]);
    setHour(null);
  };

  const upload = async (item: Item) => {
    try {
      const res = await uploadAdMedia(item.uri, item.mime);
      setItems((cur) =>
        cur.map((x) => (x.key === item.key ? { ...x, status: 'done', fileName: res.fileName } : x)),
      );
    } catch (err) {
      setItems((cur) =>
        cur.map((x) =>
          x.key === item.key
            ? { ...x, status: 'error', error: err instanceof Error ? err.message : 'Upload failed' }
            : x,
        ),
      );
    }
  };

  const pick = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const video = kind === 'VIDEO';
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: video ? ['videos'] : ['images'],
      allowsMultipleSelection: !video,
      selectionLimit: video ? 1 : MAX_IMAGES - items.length,
      quality: 0.85,
      videoMaxDuration: 60,
      preferredAssetRepresentationMode:
        ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
    });
    if (res.canceled) return;
    const picked: Item[] = res.assets.slice(0, video ? 1 : MAX_IMAGES - items.length).map((a) => ({
      key: `${a.uri}-${Math.random()}`,
      uri: a.uri,
      mime: mimeOf(a.uri, a.mimeType, video),
      status: 'uploading',
    }));
    setItems((cur) => (video ? picked : [...cur, ...picked]));
    picked.forEach((p) => void upload(p));
  };

  const remove = (key: string) => setItems((cur) => cur.filter((x) => x.key !== key));

  const price = Number(avail?.pricePerDay ?? AD_PRICE_FALLBACK);
  const start = day && hour !== null ? startOf(day, hour) : null;
  const uploading = items.some((x) => x.status === 'uploading');
  const ready =
    items.length > 0 &&
    items.every((x) => x.status === 'done') &&
    advertiserName.trim() &&
    headline.trim() &&
    start !== null &&
    (!linkUrl.trim() || /^https:\/\/\S+\.\S+/.test(linkUrl.trim()));

  const missing = [
    items.length === 0 ? (kind === 'IMAGE' ? 'add photos' : 'add a video') : null,
    !advertiserName.trim() || !headline.trim() ? 'fill in the details' : null,
    start === null ? 'pick a start time' : null,
  ].filter(Boolean);

  const submit = async () => {
    if (!ready || start === null) return;
    setSending(true);
    setError(null);
    try {
      const res = await api.ads.create({
        kind,
        advertiserName: advertiserName.trim(),
        headline: headline.trim(),
        ...(caption.trim() ? { caption: caption.trim() } : {}),
        ...(linkUrl.trim() ? { linkUrl: linkUrl.trim() } : {}),
        media: items.map((x) => x.fileName!),
        startsAt: new Date(start).toISOString(),
        days,
      });
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setDone(res.ad);
    } catch (err) {
      const reason = (
        err instanceof ApiError ? (err.details as { reason?: string } | undefined) : null
      )?.reason;
      if (reason === 'SLOT_TAKEN') {
        loadAvail(kind);
        setHour(null);
      }
      setError(err instanceof ApiError ? err.message : 'Could not submit. Please try again.');
    } finally {
      setSending(false);
    }
  };

  if (done) return <Done ad={done} onDone={() => router.back()} />;

  const previewW = width - space.lg * 2 - 28;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 6 }]}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="arrow-back" size={20} color={colors.text.strong} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Create an ad</Text>
          <Text style={styles.headerSub}>
            {rupees(String(price))} per 24 hours · pay after approval
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: space.lg, paddingBottom: insets.bottom + 130 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* 1. Format */}
        <Text style={styles.step}>1 · FORMAT</Text>
        <View style={styles.kinds}>
          {(
            [
              ['IMAGE', 'images', 'Photo carousel', `Up to ${MAX_IMAGES} photos · Home Sponsored`],
              ['VIDEO', 'videocam', 'Video', 'One video · floating player'],
            ] as const
          ).map(([k, icon, title, sub]) => {
            const on = kind === k;
            return (
              <Pressable
                key={k}
                onPress={() => switchKind(k)}
                style={[styles.kind, on && styles.kindOn]}
              >
                <View style={[styles.kindIcon, on && styles.kindIconOn]}>
                  <Ionicons name={icon} size={20} color={on ? '#ffffff' : PURPLE} />
                </View>
                <Text style={[styles.kindTitle, on && { color: PURPLE }]}>{title}</Text>
                <Text style={styles.kindSub}>{sub}</Text>
                {on ? (
                  <View style={styles.kindCheck}>
                    <Ionicons name="checkmark" size={12} color="#ffffff" />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* 2. Media */}
        <Text style={styles.step}>
          2 · {kind === 'IMAGE' ? `PHOTOS (${items.length}/${MAX_IMAGES})` : 'VIDEO'}
        </Text>
        <View style={styles.card}>
          <View style={styles.mediaGrid}>
            {items.map((x, i) => (
              <View key={x.key} style={styles.tile}>
                {kind === 'IMAGE' ? (
                  <Image source={{ uri: x.uri }} style={styles.tileImg} contentFit="cover" />
                ) : (
                  <View style={[styles.tileImg, styles.videoTile]}>
                    <Ionicons name="film" size={26} color="#ffffff" />
                    <Text style={styles.videoTileText}>Video</Text>
                  </View>
                )}
                {x.status === 'uploading' ? (
                  <View style={styles.tileOverlay}>
                    <ActivityIndicator color="#ffffff" />
                  </View>
                ) : null}
                {x.status === 'error' ? (
                  <Pressable
                    style={[styles.tileOverlay, styles.tileError]}
                    onPress={() => void upload({ ...x, status: 'uploading' })}
                  >
                    <Ionicons name="refresh" size={18} color="#ffffff" />
                    <Text style={styles.tileErrorText}>Retry</Text>
                  </Pressable>
                ) : null}
                {x.status === 'done' && kind === 'IMAGE' ? (
                  <View style={styles.tileNum}>
                    <Text style={styles.tileNumText}>{i + 1}</Text>
                  </View>
                ) : null}
                <Pressable style={styles.tileRemove} onPress={() => remove(x.key)} hitSlop={6}>
                  <Ionicons name="close" size={13} color="#ffffff" />
                </Pressable>
              </View>
            ))}
            {(kind === 'IMAGE' && items.length < MAX_IMAGES) ||
            (kind === 'VIDEO' && items.length === 0) ? (
              <Pressable
                onPress={() => void pick()}
                style={({ pressed }) => [styles.addTile, pressed && styles.pressed]}
              >
                <Ionicons
                  name={kind === 'IMAGE' ? 'add' : 'cloud-upload'}
                  size={24}
                  color={PURPLE}
                />
                <Text style={styles.addText}>{kind === 'IMAGE' ? 'Add photos' : 'Add video'}</Text>
              </Pressable>
            ) : null}
          </View>
          {items.find((x) => x.status === 'error') ? (
            <Text style={styles.errorText}>{items.find((x) => x.status === 'error')?.error}</Text>
          ) : null}
          <Text style={styles.mediaHint}>
            {kind === 'IMAGE'
              ? 'Wide photos (16:9) look best. JPG, PNG or WEBP, up to 8 MB each. They play in this order.'
              : 'Portrait (9:16) video, up to 60 seconds and 60 MB. It plays muted on loop until tapped.'}
          </Text>
        </View>

        {/* 3. Details */}
        <Text style={styles.step}>3 · DETAILS</Text>
        <View style={styles.card}>
          <Field
            label="Brand or business name"
            value={advertiserName}
            onChangeText={setAdvertiserName}
            placeholder="e.g. Green Leaf Agro"
            maxLength={60}
            autoCapitalize="words"
          />
          <Field
            label="Headline"
            value={headline}
            onChangeText={setHeadline}
            placeholder="e.g. Organic seeds - 20% off this week"
            maxLength={80}
          />
          <Field
            label="Short line"
            optional
            value={caption}
            onChangeText={setCaption}
            placeholder="e.g. Free delivery in Coimbatore"
            maxLength={200}
          />
          <Field
            label="Link"
            optional
            value={linkUrl}
            onChangeText={setLinkUrl}
            placeholder="https://your-website.com"
            autoCapitalize="none"
            keyboardType="url"
            maxLength={300}
            hint="Opens when shoppers tap your ad. Must start with https://"
          />
        </View>

        {/* 4. When */}
        <Text style={styles.step}>4 · WHEN</Text>
        <View style={styles.card}>
          <Text style={styles.label}>How many days?</Text>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setDays((d) => Math.max(1, d - 1))}
              style={styles.stepBtn}
              disabled={days <= 1}
            >
              <Ionicons name="remove" size={18} color={days <= 1 ? '#c0c7d6' : PURPLE} />
            </Pressable>
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={styles.daysBig}>
                {days} {days === 1 ? 'day' : 'days'}
              </Text>
              <Text style={styles.daysSub}>{days * 24} hours</Text>
            </View>
            <Pressable
              onPress={() => setDays((d) => Math.min(avail?.maxDays ?? 30, d + 1))}
              style={styles.stepBtn}
            >
              <Ionicons name="add" size={18} color={PURPLE} />
            </Pressable>
          </View>

          <Text style={[styles.label, { marginTop: 16 }]}>Start date</Text>
          {avail === null ? (
            <ActivityIndicator color={PURPLE} style={{ marginVertical: 12 }} />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {dates.map((d) => {
                const ok = dayOk(d);
                const on = day?.getTime() === d.getTime();
                return (
                  <Pressable
                    key={d.getTime()}
                    disabled={!ok}
                    onPress={() => {
                      setDay(d);
                      if (hour !== null && !hourOk(d, hour)) setHour(null);
                    }}
                    style={[styles.date, on && styles.dateOn, !ok && styles.dateOff]}
                  >
                    <Text
                      style={[styles.dateDow, on && styles.dateTextOn, !ok && styles.dateTextOff]}
                    >
                      {d.toLocaleDateString('en-IN', { weekday: 'short' })}
                    </Text>
                    <Text
                      style={[styles.dateNum, on && styles.dateTextOn, !ok && styles.dateTextOff]}
                    >
                      {d.getDate()}
                    </Text>
                    <Text
                      style={[styles.dateMon, on && styles.dateTextOn, !ok && styles.dateTextOff]}
                    >
                      {ok ? d.toLocaleDateString('en-IN', { month: 'short' }) : 'Booked'}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {day ? (
            <>
              <Text style={[styles.label, { marginTop: 16 }]}>Start time</Text>
              <View style={styles.hours}>
                {Array.from({ length: 24 }, (_, h) => h).map((h) => {
                  const ok = hourOk(day, h);
                  const on = hour === h;
                  return (
                    <Pressable
                      key={h}
                      disabled={!ok}
                      onPress={() => setHour(h)}
                      style={[styles.hour, on && styles.hourOn, !ok && styles.hourOff]}
                    >
                      <Text
                        style={[
                          styles.hourText,
                          on && styles.dateTextOn,
                          !ok && styles.hourTextOff,
                        ]}
                      >
                        {hourLabel(h)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          ) : null}

          {start !== null ? (
            <View style={styles.window}>
              <Ionicons name="time" size={16} color={PURPLE} />
              <Text style={styles.windowText}>
                Runs <Text style={styles.windowStrong}>{fmtWhen(new Date(start))}</Text> to{' '}
                <Text style={styles.windowStrong}>{fmtWhen(new Date(start + days * DAY))}</Text>
              </Text>
            </View>
          ) : null}

          {booked.length > 0 ? (
            <View style={styles.bookedBox}>
              <Text style={styles.bookedTitle}>
                Already booked ({kind === 'IMAGE' ? 'photo' : 'video'} ads)
              </Text>
              {booked.slice(0, 4).map((b) => (
                <Text key={b.from} style={styles.bookedRow}>
                  • {fmtWhen(new Date(b.from))} → {fmtWhen(new Date(b.to))}
                </Text>
              ))}
              <Text style={styles.bookedNote}>
                One ad per format at a time - pick another day or time.
              </Text>
            </View>
          ) : null}
        </View>

        {/* 5. Preview */}
        {items.length > 0 && (headline.trim() || advertiserName.trim()) ? (
          <>
            <Text style={styles.step}>PREVIEW</Text>
            <View style={styles.card}>
              {kind === 'IMAGE' ? (
                <SponsoredCarousel
                  preview
                  width={previewW}
                  ad={{
                    adId: 'preview',
                    kind,
                    advertiserName: advertiserName.trim() || 'Your brand',
                    headline: headline.trim() || 'Your headline',
                    caption: caption.trim() || null,
                    linkUrl: linkUrl.trim() || null,
                    media: items.map((x) => x.uri),
                    endsAt: new Date().toISOString(),
                  }}
                />
              ) : (
                <View style={styles.pipPreview}>
                  <View style={styles.pipScreen}>
                    <Text style={styles.pipScreenText}>Home screen</Text>
                  </View>
                  <View style={styles.pipBox}>
                    <View style={styles.pipVideo}>
                      <Ionicons name="play" size={22} color="#ffffff" />
                    </View>
                    <View style={styles.pipBand}>
                      <Text style={styles.pipBrand} numberOfLines={1}>
                        {advertiserName.trim() || 'Your brand'}
                      </Text>
                      <Text style={styles.pipAd}>Ad</Text>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </>
        ) : null}
        {error ? <Text style={styles.serverError}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        <View style={styles.totalRow}>
          <View>
            <Text style={styles.totalLabel}>
              {days} {days === 1 ? 'day' : 'days'} × {rupees(String(price))}
            </Text>
            <Text style={styles.totalSub}>Pay after approval</Text>
          </View>
          <Text style={styles.total}>{rupees(String(price * days))}</Text>
        </View>
        <Pressable
          onPress={() => void submit()}
          disabled={!ready || sending}
          style={({ pressed }) => [
            styles.submit,
            (!ready || sending) && styles.submitOff,
            pressed && styles.pressed,
          ]}
        >
          {sending ? (
            <ActivityIndicator color="#1f1300" />
          ) : (
            <Text style={styles.submitText}>
              {ready
                ? 'Submit for review'
                : uploading
                  ? 'Uploading…'
                  : `To continue: ${missing.join(', ')}`}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f5fb' },
  pressed: { opacity: 0.88 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: space.lg,
    paddingBottom: 12,
    backgroundColor: colors.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e3e8f3',
  },
  back: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#f1f4fa',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { fontFamily: font.uiBold, fontSize: 17, color: colors.text.strong },
  headerSub: { fontFamily: font.body, fontSize: 12, color: colors.text.muted, marginTop: 1 },
  step: {
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 2,
    fontFamily: font.uiBold,
    fontSize: 11.5,
    letterSpacing: 1.3,
    color: '#5d6b85',
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e7e9f3',
  },
  kinds: { flexDirection: 'row', gap: 10 },
  kind: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#e7e9f3',
    padding: 14,
    gap: 5,
  },
  kindOn: { borderColor: PURPLE, backgroundColor: '#f6f3ff' },
  kindIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#ede9fe',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  kindIconOn: { backgroundColor: PURPLE },
  kindTitle: { fontFamily: font.uiBold, fontSize: 14.5, color: colors.heading },
  kindSub: { fontFamily: font.body, fontSize: 11.5, lineHeight: 16, color: colors.text.muted },
  kindCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { width: 92, height: 92, borderRadius: 12, overflow: 'hidden' },
  tileImg: { width: '100%', height: '100%' },
  videoTile: {
    backgroundColor: '#1e1b4b',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  videoTileText: { fontFamily: font.uiSemibold, fontSize: 11, color: '#ddd6fe' },
  tileOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileError: { backgroundColor: 'rgba(185,28,28,0.75)', gap: 2 },
  tileErrorText: { fontFamily: font.uiBold, fontSize: 11, color: '#ffffff' },
  tileNum: {
    position: 'absolute',
    left: 5,
    bottom: 5,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileNumText: { fontFamily: font.uiBold, fontSize: 10, color: '#ffffff' },
  tileRemove: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: 92,
    height: 92,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#b9a8ef',
    backgroundColor: '#faf8ff',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  addText: { fontFamily: font.uiSemibold, fontSize: 11.5, color: PURPLE },
  mediaHint: {
    marginTop: 10,
    fontFamily: font.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.text.muted,
  },
  errorText: { marginTop: 8, fontFamily: font.uiMedium, fontSize: 12.5, color: '#d92d20' },
  field: { marginBottom: 13 },
  label: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong, marginBottom: 7 },
  optional: { fontFamily: font.body, color: colors.text.muted },
  input: {
    borderWidth: 1.2,
    borderColor: '#d5ddec',
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: Platform.OS === 'ios' ? 12 : 9,
    fontFamily: font.body,
    fontSize: 15,
    color: colors.text.strong,
    backgroundColor: '#fbfcfe',
  },
  inputFocused: { borderColor: PURPLE, backgroundColor: colors.white },
  fieldHint: { marginTop: 5, fontFamily: font.body, fontSize: 11.5, color: colors.text.muted },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f6f3ff',
    borderRadius: 14,
    padding: 6,
  },
  stepBtn: {
    width: 42,
    height: 42,
    borderRadius: 11,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daysBig: { fontFamily: font.uiBold, fontSize: 18, color: PURPLE },
  daysSub: { fontFamily: font.body, fontSize: 11.5, color: colors.text.muted },
  date: {
    width: 58,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.2,
    borderColor: '#e1e5ef',
    paddingVertical: 9,
    backgroundColor: colors.white,
  },
  dateOn: { backgroundColor: PURPLE, borderColor: PURPLE },
  dateOff: { backgroundColor: '#f3f4f7', borderColor: '#f3f4f7' },
  dateDow: { fontFamily: font.uiMedium, fontSize: 11, color: colors.text.muted },
  dateNum: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading, marginVertical: 1 },
  dateMon: { fontFamily: font.uiMedium, fontSize: 10.5, color: colors.text.muted },
  dateTextOn: { color: '#ffffff' },
  dateTextOff: { color: '#b4bccb' },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  hour: {
    width: '22.5%',
    flexGrow: 1,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.2,
    borderColor: '#e1e5ef',
    paddingVertical: 8,
    backgroundColor: colors.white,
  },
  hourOn: { backgroundColor: PURPLE, borderColor: PURPLE },
  hourOff: { backgroundColor: '#f3f4f7', borderColor: '#f3f4f7' },
  hourText: { fontFamily: font.uiSemibold, fontSize: 12.5, color: colors.heading },
  hourTextOff: { color: '#c0c7d6', textDecorationLine: 'line-through' },
  window: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#f6f3ff',
    borderRadius: 12,
    padding: 11,
  },
  windowText: { flex: 1, fontFamily: font.body, fontSize: 12.5, lineHeight: 18, color: '#334155' },
  windowStrong: { fontFamily: font.uiBold, color: PURPLE },
  bookedBox: {
    marginTop: 12,
    backgroundColor: '#fff7ed',
    borderRadius: 12,
    padding: 11,
    gap: 3,
  },
  bookedTitle: { fontFamily: font.uiBold, fontSize: 12.5, color: '#9a3412' },
  bookedRow: { fontFamily: font.body, fontSize: 12, color: '#9a3412' },
  bookedNote: { marginTop: 3, fontFamily: font.body, fontSize: 11.5, color: '#b45309' },
  pipPreview: { height: 210, borderRadius: 14, backgroundColor: '#eef1f7', overflow: 'hidden' },
  pipScreen: { padding: 12 },
  pipScreenText: { fontFamily: font.uiSemibold, fontSize: 12, color: '#94a3b8' },
  pipBox: {
    position: 'absolute',
    right: 12,
    bottom: 12,
    width: 92,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#ffffff',
    backgroundColor: '#000',
  },
  pipVideo: {
    height: 136,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e1b4b',
  },
  pipBand: {
    height: 26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 6,
    backgroundColor: '#0142aa',
  },
  pipBrand: { flex: 1, fontFamily: font.uiBold, fontSize: 10, color: '#ffffff' },
  pipAd: {
    fontFamily: font.uiBold,
    fontSize: 9,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    borderRadius: 4,
    paddingHorizontal: 3,
  },
  serverError: {
    marginTop: 14,
    textAlign: 'center',
    fontFamily: font.uiMedium,
    fontSize: 13,
    color: '#d92d20',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: space.lg,
    paddingTop: 10,
    backgroundColor: colors.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e3e8f3',
    gap: 10,
  },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  totalLabel: { fontFamily: font.uiSemibold, fontSize: 13, color: colors.text.strong },
  totalSub: { fontFamily: font.body, fontSize: 11.5, color: colors.text.muted },
  total: { fontFamily: font.uiBold, fontSize: 21, color: colors.heading },
  submit: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffd60a',
    borderRadius: 14,
    paddingVertical: 15,
  },
  submitOff: { backgroundColor: '#f1f3f7' },
  submitText: { fontFamily: font.uiBold, fontSize: 15, color: '#1f1300' },
  // Done
  doneScreen: {
    flex: 1,
    paddingHorizontal: space.lg,
    backgroundColor: '#3b1a8f',
    experimental_backgroundImage: 'linear-gradient(165deg, #1a0b3d 0%, #3b1a8f 60%, #6d28d9 100%)',
  },
  tick: {
    alignSelf: 'center',
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#ffd60a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  doneTitle: { textAlign: 'center', fontFamily: font.uiBold, fontSize: 25, color: '#ffffff' },
  doneText: {
    marginTop: 8,
    textAlign: 'center',
    fontFamily: font.body,
    fontSize: 14,
    lineHeight: 21,
    color: '#ddd6fe',
  },
  doneCard: {
    marginTop: 22,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    borderRadius: 16,
    padding: 14,
    gap: 9,
  },
  doneRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  doneKey: { fontFamily: font.body, fontSize: 13, color: '#c4b5fd' },
  doneVal: {
    flexShrink: 1,
    textAlign: 'right',
    fontFamily: font.uiBold,
    fontSize: 13,
    color: '#ffffff',
  },
  doneFooter: { position: 'absolute', left: space.lg, right: space.lg, bottom: 0 },
});
