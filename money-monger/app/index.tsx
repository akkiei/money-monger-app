import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { BrutalButton, Screen } from '../src/components';
import { clearPointer, loadPointer, type GamePointer } from '../src/lib/storage';
import { leaveGame, tryRejoin } from '../src/net/session';
import { isInProgress } from '../src/state/snapshot';
import { useGameStore } from '../src/state/store';
import { brutal, colors, spacing, typography } from '../src/theme/tokens';

export default function Splash() {
  const router = useRouter();
  // On launch (incl. a web page refresh) check for an active-game pointer. If
  // one exists, prompt the player to resume it before showing the menu.
  const [pointer, setPointer] = useState<GamePointer | null>(null);
  const [joining, setJoining] = useState(false);
  const [failed, setFailed] = useState(false);
  const status = useGameStore((s) => s.status);
  const snapshot = useGameStore((s) => s.snapshot);

  useEffect(() => {
    void loadPointer().then(setPointer);
  }, []);

  // Once the resumed room's state has decoded, route into the right screen.
  useEffect(() => {
    if (!joining || status !== 'connected' || !snapshot) return;
    const phase = snapshot.phase;
    if (phase === 'game_over') {
      void leaveGame(); // the game's over — clear the pointer and show the menu
      setJoining(false);
      setPointer(null);
      return;
    }
    router.replace(isInProgress(phase) ? '/board' : '/waiting-room');
  }, [joining, status, snapshot, router]);

  const resume = async () => {
    setFailed(false);
    setJoining(true);
    let ok = false;
    try {
      ok = await tryRejoin();
    } catch {
      ok = false;
    }
    if (!ok) {
      // pointer was stale/unreachable (tryRejoin clears it on failure)
      setJoining(false);
      setFailed(true);
    }
    // success → the routing effect navigates once the snapshot arrives
  };

  const dismiss = async () => {
    await clearPointer();
    setPointer(null);
    setFailed(false);
  };

  return (
    <Screen>
      {/* corner accents */}
      <View style={[styles.corner, styles.cornerSolid]} />
      <View style={[styles.corner, styles.cornerOutline]} />

      {/* stacked-block tycoon logo: blocks → pointed roof → grey spire */}
      <View style={styles.logo}>
        <View style={[styles.block, styles.blockBase]} />
        <View style={[styles.block, styles.blockMid]} />
        {/* ink triangle behind blue triangle = brutalist outlined roof */}
        <View style={styles.roofOutline} />
        <View style={styles.roof} />
        {/* straight grey spire rising from the apex, centered */}
        <View style={styles.spire} />
      </View>

      <Text style={styles.title}>MONEY{'\n'}MONGER</Text>
      <View style={styles.rule} />

      <View style={styles.taglineWrap}>
        <Text style={styles.tagline}>BUY · BUILD · OUTLAST</Text>
      </View>

      <BrutalButton
        label="Let's GO!"
        variant="primary"
        style={styles.cta}
        onPress={() => router.replace('/main-menu')}
      />

      <View style={styles.version}>
        <Text style={styles.versionText}>v1.0.0</Text>
      </View>

      {/* Resume prompt — shown when an active-game pointer is found on launch. */}
      <Modal visible={!!pointer} transparent animationType="fade" onRequestClose={dismiss}>
        <View style={styles.backdrop}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{failed ? 'COULDN’T RECONNECT' : 'RESUME GAME?'}</Text>
            <Text style={styles.cardSub}>{failed ? 'THE GAME MAY BE STARTING UP — TRY AGAIN.' : 'YOU HAVE AN ACTIVE GAME.'}</Text>
            <View style={styles.codeChip}>
              <Text style={styles.codeChipText}>{pointer?.code ?? ''}</Text>
            </View>
            {!failed && !!pointer?.name && <Text style={styles.cardName}>as {pointer.name}</Text>}

            {joining ? (
              <View style={styles.joiningRow}>
                <ActivityIndicator color={colors.onSurface} />
                <Text style={styles.joiningText}>RECONNECTING…</Text>
              </View>
            ) : failed ? (
              <View style={styles.cardActions}>
                <Pressable onPress={resume} style={({ pressed }) => [styles.cardBtn, styles.cardBtnBlue, pressed && styles.cardPressed]}>
                  <Text style={styles.cardBtnTextLight}>RETRY</Text>
                </Pressable>
                <Pressable onPress={dismiss} style={({ pressed }) => [styles.cardBtn, styles.cardBtnLight, pressed && styles.cardPressed]}>
                  <Text style={styles.cardBtnText}>LEAVE</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.cardActions}>
                <Pressable onPress={resume} style={({ pressed }) => [styles.cardBtn, styles.cardBtnBlue, pressed && styles.cardPressed]}>
                  <Text style={styles.cardBtnTextLight}>RESUME</Text>
                </Pressable>
                <Pressable onPress={dismiss} style={({ pressed }) => [styles.cardBtn, styles.cardBtnLight, pressed && styles.cardPressed]}>
                  <Text style={styles.cardBtnText}>LEAVE</Text>
                </Pressable>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { width: 120, height: 200, marginBottom: spacing.stackLg, alignItems: 'center', justifyContent: 'flex-end' },
  block: { position: 'absolute', ...brutal.border, ...brutal.offset },
  blockBase: { bottom: 0, width: 96, height: 72, backgroundColor: colors.secondary }, // red
  blockMid: { bottom: 70, width: 64, height: 64, backgroundColor: colors.primaryContainer }, // yellow

  // Pointed roof via the border-trick triangle; an ink triangle sits behind a
  // slightly smaller blue one to fake the 4px brutalist outline.
  roofOutline: {
    position: 'absolute',
    bottom: 134,
    width: 0,
    height: 0,
    borderLeftWidth: 28,
    borderRightWidth: 28,
    borderBottomWidth: 48,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.outline, // ink
  },
  roof: {
    position: 'absolute',
    bottom: 135,
    width: 0,
    height: 0,
    borderLeftWidth: 23,
    borderRightWidth: 23,
    borderBottomWidth: 42,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.tertiary, // blue
  },
  // straight grey antenna/spire from the apex, centered
  spire: { position: 'absolute', bottom: 179, width: 4, height: 26, backgroundColor: colors.outlineVariant },

  title: { ...typography.displayLg, color: colors.onSurface, textAlign: 'center' },
  rule: { width: 200, height: 6, backgroundColor: colors.onSurface },

  taglineWrap: {
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
    paddingHorizontal: spacing.stackLg,
    paddingVertical: spacing.stackSm,
  },
  tagline: { ...typography.labelLg, color: colors.onSurfaceVariant, letterSpacing: 2 },

  cta: { marginTop: spacing.stackLg, maxWidth: 280 },

  corner: { position: 'absolute', top: 50, width: 28, height: 28 },
  cornerSolid: { left: 24, backgroundColor: colors.onSurface },
  cornerOutline: { right: 24, ...brutal.border },

  version: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.secondary, // red tag
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderColor: colors.outline,
    paddingHorizontal: spacing.stackMd,
    paddingVertical: spacing.stackSm,
  },
  versionText: { ...typography.labelMd, color: colors.onError, letterSpacing: 2 },

  // resume-game prompt
  backdrop: { flex: 1, backgroundColor: 'rgba(26,26,26,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing.gutter },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: colors.surfaceBright,
    ...brutal.border,
    ...brutal.offset,
    padding: spacing.stackLg,
    alignItems: 'center',
    gap: spacing.stackSm,
  },
  cardTitle: { ...typography.headlineMd, color: colors.onSurface, letterSpacing: 1 },
  cardSub: { ...typography.labelMd, color: colors.onSurfaceVariant, letterSpacing: 1, textAlign: 'center' },
  codeChip: { backgroundColor: colors.onSurface, paddingHorizontal: spacing.stackMd, paddingVertical: spacing.stackSm, marginTop: spacing.stackSm },
  codeChipText: { ...typography.numberDisplay, color: colors.surface, letterSpacing: 4 },
  cardName: { ...typography.labelLg, color: colors.onSurface, letterSpacing: 1 },
  cardActions: { flexDirection: 'row', gap: spacing.stackSm, marginTop: spacing.stackMd, width: '100%' },
  cardBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', ...brutal.border },
  cardBtnBlue: { backgroundColor: colors.tertiary },
  cardBtnLight: { backgroundColor: colors.surfaceContainerLowest },
  cardBtnText: { ...typography.labelLg, color: colors.onSurface, letterSpacing: 1 },
  cardBtnTextLight: { ...typography.labelLg, color: colors.onTertiary, letterSpacing: 1 },
  cardPressed: { opacity: 0.85, transform: [{ translateX: 2 }, { translateY: 2 }] },
  joiningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackSm, marginTop: spacing.stackMd },
  joiningText: { ...typography.labelLg, color: colors.onSurface, letterSpacing: 1 },
});
