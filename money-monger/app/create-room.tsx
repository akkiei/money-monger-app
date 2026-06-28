import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, PlayerRow, Segmented, TextField } from '../src/components';
import { COUNTRIES, countryById } from '../src/config/countries';
import { command, host, leaveGame } from '../src/net/session';
import { isInProgress } from '../src/state/snapshot';
import { useGameStore } from '../src/state/store';
import { brutal, colors, spacing, typography } from '../src/theme/tokens';

// Host Lobby. Setup phase: enter name + knobs → CREATE ROOM (host()). Lobby
// phase: live code + roster + editable settings (SET_CONFIG) → START_GAME.
// Navigates to /board once the game leaves the lobby phase.
const ROUND_OPTIONS: { label: string; value: number | null }[] = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '30', value: 30 },
  { label: '∞', value: null }, // null = Unlimited (maxRounds)
];
const CASH_VALUES = [1000, 1500, 2000, 2500];
const THEME_ID = 'default';
const MAX_PLAYERS = 10; // matches the server seat cap / color palette size

export default function CreateRoom() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const snapshot = useGameStore((s) => s.snapshot);
  const status = useGameStore((s) => s.status);
  const error = useGameStore((s) => s.error);
  // setup → lobby is gated on an explicit flag (not snapshot presence) so a
  // stale snapshot from a prior session can't skip the setup form.
  const [hosting, setHosting] = useState(false);
  const inLobby = hosting;

  // host identity + knobs (local editing model; pushed via SET_CONFIG in lobby)
  const [hostName, setHostName] = useState('');
  const [maxRounds, setMaxRounds] = useState<number | null>(20);
  const [countryId, setCountryId] = useState<string>(COUNTRIES[0]?.id ?? 'india');
  const [startingCash, setStartingCash] = useState<number>(1500);
  const [copied, setCopied] = useState(false);

  // host starts the game → everyone moves to the board (only after we've created)
  useEffect(() => {
    if (hosting && status === 'connected' && isInProgress(snapshot?.phase)) {
      router.replace('/board');
    }
  }, [hosting, status, snapshot?.phase, router]); // eslint-disable-line react-hooks/exhaustive-deps

  const country = countryById(countryId) ?? COUNTRIES[0];
  const sym = country?.currency.symbol ?? '';
  const cashOptions = CASH_VALUES.map((v) => ({ label: `${sym}${v}`, value: v }));

  const code = snapshot?.code || '----';
  const players = snapshot?.players ?? [];
  const connecting = status === 'connecting';
  const canCreate = hostName.trim().length > 0 && !connecting;
  const canStart = players.length >= 2;

  function pushConfig(r = maxRounds, c = countryId, cash = startingCash) {
    command('SET_CONFIG', { maxRounds: r, countryId: c, startingCash: cash, themeId: THEME_ID });
  }
  const onRounds = (v: number | null) => {
    setMaxRounds(v);
    if (inLobby) pushConfig(v, countryId, startingCash);
  };
  const onCountry = (v: string) => {
    setCountryId(v);
    if (inLobby) pushConfig(maxRounds, v, startingCash);
  };
  const onCash = (v: number) => {
    setStartingCash(v);
    if (inLobby) pushConfig(maxRounds, countryId, v);
  };

  async function onCreate() {
    try {
      await host({ name: hostName.trim(), maxRounds, countryId, startingCash, themeId: THEME_ID });
      setHosting(true);
      pushConfig(); // lock exact knobs (create coerces null rounds → default)
    } catch {
      /* status/error already set in the store */
    }
  }

  async function onBack() {
    if (inLobby) {
      await leaveGame();
      setHosting(false);
    }
    router.back();
  }

  function copyCode() {
    const nav = (globalThis as unknown as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
    if (Platform.OS === 'web' && nav?.clipboard?.writeText) void nav.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View style={styles.root}>
      <BackButton onPress={onBack} />
      <View style={[styles.header, { paddingTop: insets.top + spacing.stackLg }]}>
        <Text style={styles.headerTitle}>GAME ROOM</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {inLobby ? (
          <>
            {/* room code */}
            <View style={styles.codeCard}>
              <View style={styles.codeTag}>
                <Text style={styles.codeTagText}>ROOM CODE</Text>
              </View>
              <Text style={styles.code}>{code}</Text>
            </View>
            <View style={styles.codeActions}>
              <Pressable onPress={copyCode} style={({ pressed }) => [styles.codeBtn, styles.codeBtnDark, pressed && styles.pressed]}>
                <Text style={styles.codeBtnTextLight}>{copied ? 'COPIED!' : 'COPY CODE'}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.codeBtn, styles.codeBtnLight, pressed && styles.pressed]}>
                <Text style={styles.codeBtnText}>SHARE</Text>
              </Pressable>
            </View>

            {/* players */}
            <Text style={styles.sectionTitle}>PLAYERS ({players.length})</Text>
            {players.map((p, i) => (
              <PlayerRow key={p.id} name={p.name || 'PLAYER'} color={p.color} seatIndex={i} isHost={p.isHost} />
            ))}
            {!canStart && (
              <View style={styles.waitingRow}>
                <Text style={styles.waitingText}>WAITING FOR PLAYERS…</Text>
              </View>
            )}

            {/* settings (host-only, editable after creating the room) */}
            <View style={styles.sectionHeadRow}>
              <Text style={styles.sectionTitle}>SETTINGS</Text>
              <View style={styles.hostOnly}>
                <Text style={styles.hostOnlyText}>HOST ONLY</Text>
              </View>
            </View>

            <View style={styles.maxPlayersRow}>
              <Text style={styles.knobLabel}>MAX PLAYERS</Text>
              <Text style={styles.maxPlayersValue}>{MAX_PLAYERS}</Text>
            </View>

            <Text style={styles.knobLabel}>ROUNDS TO WIN</Text>
            <Segmented options={ROUND_OPTIONS} value={maxRounds} onChange={onRounds} />

            <Text style={styles.knobLabel}>COUNTRY</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryRow}>
              {COUNTRIES.map((c) => {
                const selected = c.id === countryId;
                return (
                  <Pressable key={c.id} onPress={() => onCountry(c.id)} style={[styles.countryChip, selected ? styles.countryChipOn : styles.countryChipOff]}>
                    <Text style={styles.countryFlag}>{c.flag}</Text>
                    <Text style={styles.countryName}>{c.name.toUpperCase()}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.knobLabel}>STARTING CASH</Text>
            <Segmented options={cashOptions} value={startingCash} onChange={onCash} />

            <Text style={styles.knobLabel}>THEME</Text>
            <View style={styles.themeRow}>
              <View style={[styles.themeChip, styles.themeChipOn]}>
                <Text style={styles.themeChipText}>CLASSIC</Text>
              </View>
              <Text style={styles.themeNote}>More themes coming soon...</Text>
            </View>

            {/* start */}
            <Pressable
              disabled={!canStart}
              onPress={() => command('START_GAME', undefined)}
              style={({ pressed }) => [styles.action, canStart ? styles.startOn : styles.actionOff, canStart && pressed && styles.pressed]}
            >
              <Text style={[styles.actionText, !canStart && styles.actionTextOff]} numberOfLines={1} adjustsFontSizeToFit>
                {canStart ? 'START GAME' : 'WAITING FOR PLAYERS…'}
              </Text>
            </Pressable>
            {!canStart && <Text style={styles.hint}>SHARE THE CODE ABOVE TO INVITE PLAYERS</Text>}
          </>
        ) : (
          <>
            {/* setup: name only — settings are configured in the lobby after creating */}
            <Text style={styles.knobLabel}>YOUR NAME</Text>
            <TextField value={hostName} onChangeText={setHostName} placeholder="e.g. ALEX" maxLength={16} />

            <Pressable
              disabled={!canCreate}
              onPress={onCreate}
              style={({ pressed }) => [styles.action, canCreate ? styles.createOn : styles.actionOff, canCreate && pressed && styles.pressed]}
            >
              <Text style={[styles.actionText, styles.actionTextDark, !canCreate && styles.actionTextOff]}>
                {connecting ? 'CREATING…' : 'CREATE ROOM'}
              </Text>
            </Pressable>
            {hostName.trim().length === 0 && <Text style={styles.hint}>ENTER YOUR NAME</Text>}
            {error && <Text style={styles.errorHint}>COULDN’T CREATE ROOM — TRY AGAIN</Text>}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },

  header: {
    paddingBottom: spacing.stackMd,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 4,
    borderColor: colors.outline,
  },
  headerTitle: { ...typography.headlineMd, color: colors.onSurface, letterSpacing: -0.5 },

  content: { padding: spacing.gutter, gap: spacing.stackMd, paddingBottom: spacing.stackLg * 2 },

  // room code
  codeCard: {
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
    ...brutal.offset,
    paddingVertical: spacing.stackLg,
    alignItems: 'center',
    marginTop: spacing.stackSm,
  },
  codeTag: {
    position: 'absolute',
    top: spacing.stackSm,
    left: spacing.stackSm,
    backgroundColor: colors.primaryContainer,
    ...brutal.borderThin,
    paddingHorizontal: spacing.stackSm,
    paddingVertical: 2,
  },
  codeTagText: { ...typography.labelMd, color: colors.onPrimaryContainer },
  code: { ...typography.displayLg, fontSize: 56, lineHeight: 60, letterSpacing: 8, color: colors.onSurface, marginTop: spacing.stackMd },

  codeActions: { flexDirection: 'row', gap: spacing.stackMd },
  codeBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', ...brutal.border, ...brutal.offset },
  codeBtnDark: { backgroundColor: colors.onSurface },
  codeBtnLight: { backgroundColor: colors.surfaceContainerLowest },
  codeBtnText: { ...typography.labelLg, color: colors.onSurface },
  codeBtnTextLight: { ...typography.labelLg, color: colors.surface },

  // sections
  sectionTitle: { ...typography.headlineMd, color: colors.onSurface, borderBottomWidth: 4, borderColor: colors.outline, paddingBottom: spacing.stackSm, marginTop: spacing.stackMd },
  sectionHeadRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: spacing.stackMd },
  hostOnly: { backgroundColor: colors.onSurface, paddingHorizontal: spacing.stackSm, paddingVertical: 2, marginBottom: spacing.stackSm },
  hostOnlyText: { ...typography.labelMd, color: colors.surface },

  // players
  waitingRow: { borderWidth: 4, borderColor: colors.outlineVariant, borderStyle: 'dashed', padding: spacing.stackLg, alignItems: 'center' },
  waitingText: { ...typography.labelLg, color: colors.onSurfaceVariant, letterSpacing: 2 },

  // knobs
  knobLabel: { ...typography.labelLg, color: colors.onSurface, marginTop: spacing.stackMd },
  maxPlayersRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  maxPlayersValue: { ...typography.numberDisplay, fontSize: 18, color: colors.onSurfaceVariant, marginTop: spacing.stackMd },
  countryRow: { gap: spacing.stackSm, paddingVertical: spacing.stackSm, paddingRight: spacing.stackSm },
  countryChip: { alignItems: 'center', gap: 4, paddingHorizontal: spacing.stackMd, paddingVertical: spacing.stackSm, ...brutal.border, minWidth: 92 },
  countryChipOn: { backgroundColor: colors.primaryContainer, ...brutal.offset },
  countryChipOff: { backgroundColor: colors.surfaceContainerLowest },
  countryFlag: { fontSize: 28 },
  countryName: { ...typography.labelMd, color: colors.onSurface },

  // theme
  themeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackMd },
  themeChip: { paddingHorizontal: spacing.stackMd, paddingVertical: spacing.stackSm, ...brutal.border, ...brutal.offset },
  themeChipOn: { backgroundColor: colors.tertiary },
  themeChipText: { ...typography.labelLg, color: colors.onTertiary },
  themeNote: { ...typography.labelMd, color: colors.onSurfaceVariant },

  // primary action
  action: { paddingVertical: 20, alignItems: 'center', ...brutal.border, marginTop: spacing.stackLg },
  startOn: { backgroundColor: colors.secondary, ...brutal.offset },
  createOn: { backgroundColor: colors.primaryContainer, ...brutal.offset },
  actionOff: { backgroundColor: colors.surfaceVariant },
  actionText: { ...typography.displayLg, fontSize: 32, lineHeight: 36, color: colors.onPrimary },
  actionTextDark: { color: colors.onPrimaryContainer },
  actionTextOff: { color: colors.onSurfaceVariant },
  hint: { ...typography.labelMd, color: colors.onSurfaceVariant, textAlign: 'center', letterSpacing: 1 },
  errorHint: { ...typography.labelMd, color: colors.error, textAlign: 'center', letterSpacing: 1 },

  pressed: { transform: [{ translateX: 6 }, { translateY: 6 }], shadowOffset: { width: 0, height: 0 } },
});
