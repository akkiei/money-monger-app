import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pressable } from 'react-native';
import { countryById } from '../src/config/countries';
import { leaveGame } from '../src/net/session';
import { useGameStore } from '../src/state/store';
import { tokenHex } from '../src/theme/playerColors';
import { brutal, colors, spacing, typography } from '../src/theme/tokens';

// Final standings after the game ends. Net worth = cash + asset value (computed
// server-side and delivered in the GAME_OVER event → store.result).
export default function GameOver() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const result = useGameStore((s) => s.result);
  const playerId = useGameStore((s) => s.playerId);
  const snapshot = useGameStore((s) => s.snapshot);

  const sym = countryById(snapshot?.countryId ?? 'india')?.currency.symbol ?? '';
  const standings = [...(result?.standings ?? [])].sort((a, b) => a.rank - b.rank);
  const colorOf: Record<string, string> = {};
  (snapshot?.players ?? []).forEach((p, i) => (colorOf[p.id] = tokenHex(p.color, i)));

  const winnerId = result?.winnerId ?? null;
  const iWon = !!winnerId && winnerId === playerId;
  const winnerName = standings.find((s) => s.playerId === winnerId)?.name ?? null;

  async function backToMenu() {
    await leaveGame();
    router.replace('/main-menu');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.stackLg }]}>
      <Text style={styles.title}>GAME OVER</Text>
      <View style={styles.winnerBox}>
        <Text style={styles.crown}>👑</Text>
        <Text style={styles.winnerText}>{winnerName ? (iWon ? 'YOU WIN!' : `${winnerName.toUpperCase()} WINS!`) : 'NO WINNER'}</Text>
      </View>

      <Text style={styles.sectionTitle}>FINAL STANDINGS</Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {standings.map((s) => {
          const isMe = s.playerId === playerId;
          return (
            <View key={s.playerId} style={[styles.row, s.rank === 1 && styles.rowWinner]}>
              <Text style={styles.rank}>#{s.rank}</Text>
              <View style={[styles.swatch, { backgroundColor: colorOf[s.playerId] ?? colors.onSurface }]} />
              <Text style={styles.name} numberOfLines={1}>
                {isMe ? 'YOU' : s.name}
                {s.status === 'bankrupt' ? ' · BANKRUPT' : ''}
              </Text>
              <Text style={styles.worth}>
                {sym}
                {s.netWorth}
              </Text>
            </View>
          );
        })}
        {standings.length === 0 && <Text style={styles.empty}>No standings available</Text>}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.gutter }]}>
        <Pressable onPress={backToMenu} style={({ pressed }) => [styles.menuBtn, pressed && styles.pressed]}>
          <Text style={styles.menuText}>BACK TO MENU</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.gutter },
  title: { ...typography.displayLg, color: colors.onSurface, textAlign: 'center' },

  winnerBox: {
    backgroundColor: colors.primaryContainer,
    ...brutal.border,
    ...brutal.offset,
    alignItems: 'center',
    paddingVertical: spacing.stackLg,
    marginTop: spacing.stackMd,
    gap: spacing.stackSm,
  },
  crown: { fontSize: 48 },
  winnerText: { ...typography.headlineLg, color: colors.onPrimaryContainer, textAlign: 'center' },

  sectionTitle: { ...typography.labelLg, color: colors.onSurface, letterSpacing: 2, marginTop: spacing.stackLg, marginBottom: spacing.stackSm },
  list: { gap: spacing.stackSm, paddingBottom: spacing.stackMd },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.stackMd,
    padding: spacing.stackMd,
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
  },
  rowWinner: { backgroundColor: colors.primaryContainer, ...brutal.offset },
  rank: { ...typography.numberDisplay, fontSize: 18, color: colors.onSurface, width: 36 },
  swatch: { width: 24, height: 24, ...brutal.borderThin },
  name: { ...typography.bodyLg, color: colors.onSurface, flex: 1 },
  worth: { ...typography.numberDisplay, fontSize: 18, color: colors.onSurface },
  empty: { ...typography.bodyMd, color: colors.onSurfaceVariant },

  footer: { paddingTop: spacing.stackMd },
  menuBtn: { backgroundColor: colors.tertiary, ...brutal.border, ...brutal.offset, alignItems: 'center', paddingVertical: 18 },
  menuText: { ...typography.headlineMd, color: colors.onTertiary, letterSpacing: 1 },
  pressed: { transform: [{ translateX: 6 }, { translateY: 6 }], shadowOffset: { width: 0, height: 0 } },
});
