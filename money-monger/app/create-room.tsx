import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, PlayerRow, Segmented, TextField } from '../src/components';
import { COUNTRIES, countryById } from '../src/config/countries';
import { generateRoomCode } from '../src/shared/codes';
import { brutal, colors, spacing, typography } from '../src/theme/tokens';

// Host Lobby (Create Room). Host knobs: rounds · country · starting cash · theme.
// Presentational + local state for now; TODO: wire to createGame() + room.state
// (live 4-char code, live player list) and SET_CONFIG / START_GAME commands.
const ROUND_OPTIONS: { label: string; value: number | null }[] = [
  { label: '10', value: 10 },
  { label: '20', value: 20 },
  { label: '30', value: 30 },
  { label: '∞', value: null }, // null = Unlimited (maxRounds)
];
const CASH_VALUES = [1000, 1500, 2000, 2500];

export default function CreateRoom() {
  const insets = useSafeAreaInsets();

  // host identity + knobs (local until wired to createGame() / SET_CONFIG)
  const [hostName, setHostName] = useState('');
  const [maxRounds, setMaxRounds] = useState<number | null>(20);
  const [countryId, setCountryId] = useState<string>(COUNTRIES[0]?.id ?? 'india');
  const [startingCash, setStartingCash] = useState<number>(1500);
  const [copied, setCopied] = useState(false);

  // TODO: code + players come from room.state once createGame() is wired.
  const [code] = useState(() => generateRoomCode());
  const players = [{ id: 'host', name: hostName.trim().toUpperCase() || 'YOU', isHost: true }];
  const canStart = hostName.trim().length > 0 && players.length >= 2;

  const country = countryById(countryId) ?? COUNTRIES[0];
  const sym = country?.currency.symbol ?? '';
  const cashOptions = CASH_VALUES.map((v) => ({ label: `${sym}${v}`, value: v }));

  function copyCode() {
    const nav = (globalThis as unknown as { navigator?: { clipboard?: { writeText?: (t: string) => Promise<void> } } }).navigator;
    if (Platform.OS === 'web' && nav?.clipboard?.writeText) void nav.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <View style={styles.root}>
      <BackButton />
      <View style={[styles.header, { paddingTop: insets.top + spacing.stackLg }]}>
        <Text style={styles.headerTitle}>GAME ROOM</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* host name */}
        <Text style={styles.knobLabel}>YOUR NAME</Text>
        <TextField value={hostName} onChangeText={setHostName} placeholder="e.g. ALEX" maxLength={16} />

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
        {players.map((p) => (
          <PlayerRow key={p.id} name={p.name} isHost={p.isHost} />
        ))}
        <View style={styles.waitingRow}>
          <Text style={styles.waitingText}>WAITING FOR PLAYERS…</Text>
        </View>

        {/* settings */}
        <View style={styles.sectionHeadRow}>
          <Text style={styles.sectionTitle}>SETTINGS</Text>
          <View style={styles.hostOnly}>
            <Text style={styles.hostOnlyText}>HOST ONLY</Text>
          </View>
        </View>

        <Text style={styles.knobLabel}>ROUNDS TO WIN</Text>
        <Segmented options={ROUND_OPTIONS} value={maxRounds} onChange={setMaxRounds} />

        <Text style={styles.knobLabel}>COUNTRY</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.countryRow}
        >
          {COUNTRIES.map((c) => {
            const selected = c.id === countryId;
            return (
              <Pressable
                key={c.id}
                onPress={() => setCountryId(c.id)}
                style={[styles.countryChip, selected ? styles.countryChipOn : styles.countryChipOff]}
              >
                <Text style={styles.countryFlag}>{c.flag}</Text>
                <Text style={styles.countryName}>{c.name.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <Text style={styles.knobLabel}>STARTING CASH</Text>
        <Segmented options={cashOptions} value={startingCash} onChange={setStartingCash} />

        <Text style={styles.knobLabel}>THEME</Text>
        <View style={styles.themeRow}>
          <View style={[styles.themeChip, styles.themeChipOn]}>
            <Text style={styles.themeChipText}>CLASSIC</Text>
          </View>
          <Text style={styles.themeNote}>More themes soon</Text>
        </View>

        {/* start */}
        <Pressable
          disabled={!canStart}
          style={({ pressed }) => [
            styles.start,
            canStart ? styles.startOn : styles.startOff,
            canStart && pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.startText, !canStart && styles.startTextOff]}>START GAME</Text>
        </Pressable>
        {!canStart && (
          <Text style={styles.startHint}>
            {hostName.trim().length === 0 ? 'ENTER YOUR NAME' : 'NEED AT LEAST 2 PLAYERS'}
          </Text>
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
  themeNote: { ...typography.bodyMd, color: colors.onSurfaceVariant },

  // start
  start: { paddingVertical: 20, alignItems: 'center', ...brutal.border, marginTop: spacing.stackLg },
  startOn: { backgroundColor: colors.secondary, ...brutal.offset },
  startOff: { backgroundColor: colors.surfaceVariant },
  startText: { ...typography.displayLg, fontSize: 32, lineHeight: 36, color: colors.onPrimary },
  startTextOff: { color: colors.onSurfaceVariant },
  startHint: { ...typography.labelMd, color: colors.onSurfaceVariant, textAlign: 'center', letterSpacing: 1 },

  pressed: { transform: [{ translateX: 6 }, { translateY: 6 }], shadowOffset: { width: 0, height: 0 } },
});
