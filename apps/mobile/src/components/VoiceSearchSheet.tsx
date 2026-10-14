import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getVoicePermission,
  requestVoicePermission,
  startListening,
  voiceAvailable,
} from '@/lib/voice';
import { colors, font, space } from '@/theme';

type Phase = 'starting' | 'listening' | 'error' | 'blocked' | 'unavailable';

const EXAMPLES = ['“running shoes”', '“Samsung mobiles”', '“steel water bottle”'];

/**
 * YouMart voice search: a bottom sheet with a pulsing mic that reacts to the voice level and the
 * live transcript. A final phrase is handed to `onResult` (the caller runs the search).
 */
export function VoiceSearchSheet({
  visible,
  onClose,
  onResult,
}: {
  visible: boolean;
  onClose: () => void;
  onResult: (text: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [phase, setPhase] = useState<Phase>('starting');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const finalRef = useRef('');

  const pulse = useSharedValue(0);
  const level = useSharedValue(0);

  const stop = useCallback(() => {
    stopRef.current?.();
    stopRef.current = null;
  }, []);

  const begin = useCallback(async () => {
    setTranscript('');
    setError(null);
    finalRef.current = '';
    if (!voiceAvailable) {
      setPhase('unavailable');
      return;
    }
    setPhase('starting');
    let permission = await getVoicePermission();
    if (permission === 'denied') permission = await requestVoicePermission();
    if (permission === 'blocked' || permission === 'denied') {
      setPhase('blocked');
      return;
    }
    setPhase('listening');
    stopRef.current = startListening({
      onTranscript: (text, final) => {
        setTranscript(text);
        if (final && text.trim()) finalRef.current = text.trim();
      },
      onVolume: (v) => {
        // Android reports roughly -2..10; iOS similar. Normalise to 0..1.
        level.value = withTiming(Math.max(0, Math.min(1, (v + 2) / 12)), { duration: 120 });
      },
      onError: (message) => {
        setError(message);
        setPhase('error');
      },
      onEnd: () => {
        stopRef.current = null;
        const text = finalRef.current;
        if (text) onResult(text);
      },
    });
  }, [level, onResult]);

  useEffect(() => {
    if (!visible) {
      stop();
      return;
    }
    void begin();
    return stop;
  }, [visible, begin, stop]);

  useEffect(() => {
    if (phase === 'listening') {
      pulse.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
      );
    } else {
      cancelAnimation(pulse);
      pulse.value = 0;
      level.value = 0;
    }
  }, [phase, pulse, level]);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.9 }],
  }));
  const levelStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + level.value * 0.35 }],
  }));

  const listening = phase === 'listening' || phase === 'starting';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + space.xl }]}>
        <View style={styles.grabber} />
        <Pressable
          style={styles.close}
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="Close voice search"
        >
          <Ionicons name="close" size={22} color={colors.text.strong} />
        </Pressable>

        <Text style={styles.title}>
          {phase === 'unavailable'
            ? 'Voice search'
            : phase === 'blocked'
              ? 'Microphone is off'
              : phase === 'error'
                ? 'Try again'
                : transcript
                  ? 'Listening…'
                  : 'Speak now'}
        </Text>

        <Text style={[styles.transcript, !transcript && styles.placeholder]} numberOfLines={3}>
          {phase === 'unavailable'
            ? 'Voice search works in the YouMart app. It isn’t available while testing in Expo Go.'
            : phase === 'blocked'
              ? 'Allow microphone and speech recognition for YouMart in your phone’s Settings to search by voice.'
              : phase === 'error'
                ? error
                : transcript || `Try ${EXAMPLES.join(', ')}`}
        </Text>

        <View style={styles.micWrap}>
          {listening ? <Animated.View style={[styles.ring, ringStyle]} /> : null}
          <Animated.View style={[styles.levelRing, listening && levelStyle]} />
          <Pressable
            style={[styles.mic, !listening && styles.micIdle]}
            onPress={() => {
              if (phase === 'blocked') {
                void Linking.openSettings();
              } else if (phase === 'unavailable') {
                onClose();
              } else if (listening) {
                stop();
                if (finalRef.current) onResult(finalRef.current);
                else if (transcript.trim()) onResult(transcript.trim());
                else onClose();
              } else {
                void begin();
              }
            }}
            accessibilityLabel={listening ? 'Stop listening' : 'Start voice search'}
          >
            <Ionicons
              name={
                phase === 'blocked'
                  ? 'settings-outline'
                  : phase === 'unavailable'
                    ? 'checkmark'
                    : 'mic'
              }
              size={34}
              color={colors.white}
            />
          </Pressable>
        </View>

        <Text style={styles.hint}>
          {phase === 'blocked'
            ? 'Tap to open Settings'
            : phase === 'unavailable'
              ? 'Got it'
              : listening
                ? 'Tap the mic when you’re done'
                : 'Tap the mic to speak again'}
        </Text>
      </View>
    </Modal>
  );
}

const MIC = 84;

const styles = StyleSheet.create({
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
    backgroundColor: colors.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: space.xl,
    paddingTop: space.md,
    alignItems: 'center',
    gap: space.md,
  },
  grabber: { width: 42, height: 5, borderRadius: 3, backgroundColor: colors.card.border },
  close: { position: 'absolute', top: space.lg, right: space.lg },
  title: {
    fontFamily: font.uiBold,
    fontSize: 22,
    color: colors.brand.DEFAULT,
    marginTop: space.md,
  },
  transcript: {
    minHeight: 54,
    fontFamily: font.uiSemibold,
    fontSize: 18,
    lineHeight: 26,
    color: colors.text.strong,
    textAlign: 'center',
  },
  placeholder: { fontFamily: font.body, fontSize: 15, lineHeight: 22, color: colors.text.muted },
  micWrap: {
    width: MIC * 2.2,
    height: MIC * 2.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: colors.brand.DEFAULT,
  },
  levelRing: {
    position: 'absolute',
    width: MIC + 26,
    height: MIC + 26,
    borderRadius: (MIC + 26) / 2,
    backgroundColor: colors.brandPopup.bg,
  },
  mic: {
    width: MIC,
    height: MIC,
    borderRadius: MIC / 2,
    backgroundColor: colors.brand.DEFAULT,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.brand.DEFAULT,
    shadowOpacity: 0.35,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  micIdle: { backgroundColor: colors.brand.accent },
  hint: { fontFamily: font.uiMedium, fontSize: 13, color: colors.text.muted },
});
