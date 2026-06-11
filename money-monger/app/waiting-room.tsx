import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { PlayerRow } from '../src/components';
import { brutal, colors, spacing, typography } from '../src/theme/tokens';

type Status = 'connecting' | 'error' | 'waiting';

// Guest Waiting Room. Three states: connecting (joining), error (join failed),
// waiting (in room, roster + waiting for host). Presentational for now —
// TODO: drive `status` from the joinGame() promise, code/players from room.state,
// errorMessage mapped from the ERROR event's ErrorCode.
export default function WaitingRoom() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [status] = useState<Status>('waiting');
  const code = 'K7P2'; // TODO: from active-game pointer / room.state.code
  const errorMessage = 'ROOM NOT FOUND'; // TODO: map from ErrorCode
  const players = [
    { id: 'host', name: 'ALEX', isHost: true },
    { id: 'you', name: 'YOU', isHost: false, isYou: true },
  ];

  // slow spin for the connecting indicator (core Animated — no extra dep)
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(spin, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true }),
    );
    anim.start();
    return () => anim.stop();
  }, [spin]);
  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  const top = { paddingTop: insets.top + spacing.stackLg };

  // ── connecting ──────────────────────────────────────────────
  if (status === 'connecting') {
    return (
      <View style={[styles.center, top]}>
        <Animated.View style={[styles.spinner, { transform: [{ rotate }] }]}>
          <View style={styles.spinnerInner} />
        </Animated.View>
        <Text style={styles.bigTitle}>CONNECTING…</Text>
        <Text style={styles.subtitle}>ROOM: {code}</Text>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.btn, styles.btnLight, styles.btnWide, pressed && styles.pressed]}
        >
          <Text style={styles.btnTextDark}>CANCEL</Text>
        </Pressable>
      </View>
    );
  }

  // ── error ───────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <View style={[styles.center, styles.errorBg, top]}>
        <View style={styles.errorMark}>
          <Text style={styles.errorMarkGlyph}>✕</Text>
        </View>
        <Text style={styles.errorTitle}>{errorMessage}</Text>
        <View style={styles.errorActions}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.btn, styles.btnYellow, styles.btnFlex, pressed && styles.pressed]}
          >
            <Text style={styles.btnTextDark}>TRY AGAIN</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace('/main-menu')}
            style={({ pressed }) => [styles.btn, styles.btnLight, styles.btnFlex, pressed && styles.pressed]}
          >
            <Text style={styles.btnTextDark}>CANCEL</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  // ── waiting (connected) ─────────────────────────────────────
  return (
    <View style={styles.root}>
      <View style={[styles.header, top]}>
        <Text style={styles.headerTitle}>WAITING ROOM</Text>
        <View style={styles.codeChip}>
          <Text style={styles.codeChipText}>ROOM {code}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>PLAYERS ({players.length})</Text>
        {players.map((p) => (
          <PlayerRow key={p.id} name={p.name} isHost={p.isHost} isYou={p.isYou} />
        ))}

        <View style={styles.waitingBanner}>
          <Animated.View style={[styles.waitDot, { transform: [{ rotate }] }]} />
          <Text style={styles.waitingText}>WAITING FOR HOST TO START…</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.gutter }]}>
        <Pressable
          onPress={() => router.replace('/main-menu')}
          // TODO: send LEAVE + clearPointer() before navigating
          style={({ pressed }) => [styles.btn, styles.btnRed, pressed && styles.pressed]}
        >
          <Text style={styles.btnTextLight}>LEAVE</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  // shared centered layout (connecting / error)
  center: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.gutter,
    gap: spacing.stackLg,
  },

  // connecting
  spinner: {
    width: 120,
    height: 120,
    backgroundColor: colors.tertiary,
    ...brutal.border,
    ...brutal.offset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spinnerInner: { width: 44, height: 44, backgroundColor: colors.surfaceContainerLowest, ...brutal.borderThin },
  bigTitle: { ...typography.displayLg, color: colors.onSurface, textAlign: 'center' },
  subtitle: { ...typography.headlineMd, color: colors.onSurfaceVariant },

  // error
  errorBg: { backgroundColor: colors.secondary },
  errorMark: {
    width: 96,
    height: 96,
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
    ...brutal.offset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorMarkGlyph: { ...typography.displayLg, fontSize: 56, lineHeight: 60, color: colors.secondary },
  errorTitle: { ...typography.displayLg, fontSize: 56, lineHeight: 56, color: colors.surfaceContainerLowest, textAlign: 'center' },
  errorActions: { flexDirection: 'row', gap: spacing.stackMd, width: '100%' },

  // waiting (connected)
  header: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.stackMd,
    borderBottomWidth: 4,
    borderColor: colors.outline,
    alignItems: 'center',
    gap: spacing.stackSm,
  },
  headerTitle: { ...typography.headlineMd, color: colors.onSurface, letterSpacing: -0.5 },
  codeChip: { backgroundColor: colors.primaryContainer, ...brutal.borderThin, paddingHorizontal: spacing.stackMd, paddingVertical: 4 },
  codeChipText: { ...typography.labelLg, color: colors.onPrimaryContainer, letterSpacing: 2 },

  content: { padding: spacing.gutter, gap: spacing.stackMd },
  sectionTitle: { ...typography.headlineMd, color: colors.onSurface, borderBottomWidth: 4, borderColor: colors.outline, paddingBottom: spacing.stackSm },

  waitingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.stackMd,
    borderWidth: 4,
    borderColor: colors.outlineVariant,
    borderStyle: 'dashed',
    padding: spacing.stackLg,
    marginTop: spacing.stackSm,
  },
  waitDot: { width: 18, height: 18, backgroundColor: colors.tertiary, ...brutal.borderThin },
  waitingText: { ...typography.labelLg, color: colors.onSurfaceVariant, letterSpacing: 1 },

  footer: { padding: spacing.gutter, borderTopWidth: 4, borderColor: colors.outline },

  // buttons
  btn: { paddingVertical: 16, alignItems: 'center', ...brutal.border, ...brutal.offset },
  btnWide: { width: '100%', maxWidth: 360 },
  btnFlex: { flex: 1 },
  btnLight: { backgroundColor: colors.surfaceContainerLowest },
  btnYellow: { backgroundColor: colors.primaryContainer },
  btnRed: { backgroundColor: colors.secondary },
  btnTextDark: { ...typography.headlineMd, color: colors.onSurface, letterSpacing: 1 },
  btnTextLight: { ...typography.headlineMd, color: colors.onPrimary, letterSpacing: 1 },

  pressed: { transform: [{ translateX: 6 }, { translateY: 6 }], shadowOffset: { width: 0, height: 0 } },
});
