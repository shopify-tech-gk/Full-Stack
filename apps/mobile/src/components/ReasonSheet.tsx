import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, radii, space } from '@/theme';

/** Bottom sheet that asks "why?" (cancel / return): pick a reason, add optional details, confirm. */
export function ReasonSheet({
  visible,
  title,
  subtitle,
  reasons,
  confirmLabel,
  busy,
  error,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  title: string;
  subtitle?: string;
  reasons: readonly string[];
  confirmLabel: string;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: (reason: string, comment: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [reason, setReason] = useState<string | null>(null);
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (visible) {
      setReason(null);
      setComment('');
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.wrap}
        pointerEvents="box-none"
      >
        <View style={[styles.sheet, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.grabber} />
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={8} disabled={busy}>
              <Ionicons name="close" size={22} color={colors.text.strong} />
            </Pressable>
          </View>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

          <View style={styles.reasons}>
            {reasons.map((r) => {
              const on = r === reason;
              return (
                <Pressable
                  key={r}
                  style={[styles.reason, on && styles.reasonOn]}
                  onPress={() => setReason(r)}
                >
                  <Ionicons
                    name={on ? 'radio-button-on' : 'radio-button-off'}
                    size={18}
                    color={colors.brand.DEFAULT}
                  />
                  <Text style={styles.reasonText}>{r}</Text>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Add details (optional)"
            placeholderTextColor={colors.text.placeholder}
            multiline
            maxLength={500}
            style={styles.input}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.confirm, (!reason || busy) && styles.disabled]}
            disabled={!reason || busy}
            onPress={() => reason && onConfirm(reason, comment.trim())}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.confirmText}>{confirmLabel}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.overlay,
  },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.page,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    gap: space.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 42,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.card.border,
    marginBottom: space.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontFamily: font.uiBold, fontSize: 18, color: colors.heading },
  subtitle: { fontFamily: font.body, fontSize: 13, lineHeight: 19, color: colors.text.body },
  reasons: { gap: 6, marginTop: space.xs },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.white,
    borderRadius: radii.tile,
    borderWidth: 1,
    borderColor: colors.card.border,
    paddingHorizontal: space.md,
    paddingVertical: 11,
  },
  reasonOn: { borderColor: colors.brand.DEFAULT },
  reasonText: { fontFamily: font.uiMedium, fontSize: 14, color: colors.text.strong },
  input: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.card.border,
    borderRadius: radii.button,
    backgroundColor: colors.white,
    padding: space.md,
    fontFamily: font.body,
    fontSize: 14,
    color: colors.text.input,
    textAlignVertical: 'top',
  },
  error: { fontFamily: font.uiMedium, fontSize: 13, color: colors.price.discount },
  confirm: {
    marginTop: space.xs,
    backgroundColor: colors.brand.DEFAULT,
    borderRadius: radii.button,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  confirmText: { fontFamily: font.uiSemibold, fontSize: 16, color: colors.white },
});
