import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BOARD_CONFIG, BoardTile } from '../src/config/board.config';
import { countryById, tileLabelsFor } from '../src/config/countries';
import { brutal, colors, radius, spacing, typography } from '../src/theme/tokens';

// ─── Board ring geometry: index 0 = Start (bottom-right), clockwise. 32 tiles
//     on a 9×9 perimeter; the inner 7×7 is the hollow center. ──────────────
function tilePos(i: number): { row: number; col: number } {
  if (i <= 8) return { row: 8, col: 8 - i }; // bottom row, right→left
  if (i <= 16) return { row: 16 - i, col: 0 }; // left col, bottom→top
  if (i <= 24) return { row: 0, col: i - 16 }; // top row, left→right
  return { row: i - 24, col: 8 }; // right col, top→bottom
}
const INDEX_AT: (number | null)[][] = Array.from({ length: 9 }, () => Array<number | null>(9).fill(null));
for (let i = 0; i < 32; i++) {
  const { row, col } = tilePos(i);
  INDEX_AT[row][col] = i;
}
const TILE_BY_INDEX = new Map<number, BoardTile>(BOARD_CONFIG.tiles.map((t) => [t.index, t]));

// District (tier) fills + short labels for non-property tiles. Board-specific.
const GROUP_COLORS: Record<string, string> = {
  d1: '#9b6a43',
  d2: '#8fd0ee',
  d3: '#e95fa0',
  d4: '#ff8c2e',
  d5: '#d12f2f',
};
const SPECIAL_LABEL: Record<string, string> = {
  start: 'GO',
  rest_stop: 'REST',
  go_to_audit: 'GOTO',
  audit: 'AUDIT',
  tax: 'TAX',
  utility: 'UTIL',
  card_govt_notice: '?',
  card_govt_grant: '?',
};
const TOKEN_HEX: Record<string, string> = {
  red: '#e63b2e',
  blue: '#0055ff',
  green: '#1aa64b',
  yellow: '#ffcc00',
  black: '#1a1a1a',
  white: '#ffffff',
  purple: '#7b2ff7',
  orange: '#ff8c2e',
  pink: '#ff4fa3',
  cyan: '#00b3c4',
};

type MockPlayer = { id: string; name: string; color: string; cash: number; position: number };

export default function Board() {
  const insets = useSafeAreaInsets();

  // ── mock state (presentational; TODO: replace with room.state) ──
  const countryId = 'india';
  const sym = countryById(countryId)?.currency.symbol ?? '';
  const labels = tileLabelsFor(countryId);

  const [players, setPlayers] = useState<MockPlayer[]>([
    { id: 'p1', name: 'ALEX', color: 'red', cash: 1500, position: 0 },
    { id: 'you', name: 'YOU', color: 'blue', cash: 1320, position: 7 },
    { id: 'p3', name: 'MIRA', color: 'green', cash: 980, position: 13 },
  ]);
  const myId = 'you';
  const me = players.find((p) => p.id === myId);
  const turnId = 'you'; // TODO: room.state turn
  const isMyTurn = turnId === myId;
  const turnName = players.find((p) => p.id === turnId)?.name ?? '';
  const round = 3;
  const maxRounds = 20;
  const deeds: Record<number, string | undefined> = { 1: 'p1', 5: 'p1', 13: 'you', 17: 'p3', 25: 'p1' };
  const [lastRoll, setLastRoll] = useState<{ d1: number; d2: number } | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  function roll() {
    const d1 = 1 + Math.floor(Math.random() * 6);
    const d2 = 1 + Math.floor(Math.random() * 6);
    setLastRoll({ d1, d2 });
    setPlayers((prev) => prev.map((p) => (p.id === turnId ? { ...p, position: (p.position + d1 + d2) % 32 } : p)));
  }

  function groupColor(tile?: BoardTile): string | undefined {
    if (tile?.type === 'property') return GROUP_COLORS[tile.districtId];
    return undefined;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + spacing.stackSm }]}>
      {/* header */}
      <View style={styles.header}>
        <Text style={styles.brand}>MONEY MONGER</Text>
        <View style={styles.roundChip}>
          <Text style={styles.roundChipText}>
            ROUND {round}/{maxRounds}
          </Text>
        </View>
      </View>

      {/* current user's stats */}
      {me && (
        <View style={styles.meBar}>
          <View style={[styles.swatch, { backgroundColor: TOKEN_HEX[me.color] }]} />
          <Text style={styles.meName}>{me.name}</Text>
          <Text style={styles.meCash}>
            {sym}
            {me.cash}
          </Text>
        </View>
      )}

      {/* board */}
      <View style={styles.boardWrap}>
        <View style={styles.board}>
          {INDEX_AT.map((rowArr, r) => (
            <View key={r} style={styles.boardRow}>
              {rowArr.map((idx, c) => {
                if (idx === null) return <View key={c} style={styles.cellEmpty} />;
                const tile = TILE_BY_INDEX.get(idx);
                const stripe = groupColor(tile);
                const label = tile && tile.type !== 'property' ? SPECIAL_LABEL[tile.type] : undefined;
                const ownerId = deeds[idx];
                const ownerColor = ownerId ? TOKEN_HEX[players.find((p) => p.id === ownerId)?.color ?? ''] : undefined;
                const here = players.filter((p) => p.position === idx);
                return (
                  <Pressable key={c} style={styles.cell} onPress={() => setSelected(idx)}>
                    {stripe && <View style={[styles.stripe, { backgroundColor: stripe }]} />}
                    {label && <Text style={styles.cellLabel}>{label}</Text>}
                    {ownerColor && <View style={[styles.ownerBar, { backgroundColor: ownerColor }]} />}
                    {here.length > 0 && (
                      <View style={styles.tokenRow}>
                        {here.map((p) => (
                          <View key={p.id} style={[styles.token, { backgroundColor: TOKEN_HEX[p.color] }]} />
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
          {/* hollow center */}
          <View style={styles.center} pointerEvents="none">
            <Text style={styles.centerMark}>MM</Text>
          </View>
        </View>
      </View>

      {/* middle band: turn + dice + roll */}
      <View style={styles.band}>
        <Text style={styles.turnText}>{isMyTurn ? 'YOUR TURN' : `${turnName}'S TURN`}</Text>
        {lastRoll && (
          <View style={styles.diceRow}>
            <View style={styles.die}>
              <Text style={styles.dieNum}>{lastRoll.d1}</Text>
            </View>
            <View style={styles.die}>
              <Text style={styles.dieNum}>{lastRoll.d2}</Text>
            </View>
            <Text style={styles.diceTotal}>= {lastRoll.d1 + lastRoll.d2}</Text>
          </View>
        )}
        {isMyTurn ? (
          <Pressable onPress={roll} style={({ pressed }) => [styles.roll, pressed && styles.pressed]}>
            <Text style={styles.rollText}>ROLL DICE</Text>
          </Pressable>
        ) : (
          <Text style={styles.waitText}>WAITING…</Text>
        )}
      </View>

      {/* ticker */}
      <View style={[styles.ticker, { paddingBottom: insets.bottom + spacing.stackSm }]}>
        <View style={styles.tickerTag}>
          <Text style={styles.tickerTagText}>FEED</Text>
        </View>
        <Text style={styles.tickerText} numberOfLines={1}>
          ALEX landed on {labels[1]?.name ?? 'GO'} · MIRA paid {sym}40 rent
        </Text>
      </View>

      {/* tile detail popup */}
      <TileModal
        index={selected}
        onClose={() => setSelected(null)}
        sym={sym}
        labels={labels}
        players={players}
        deeds={deeds}
      />
    </View>
  );
}

// ─── Tile detail popup ─────────────────────────────────────────
function TileModal({
  index,
  onClose,
  sym,
  labels,
  players,
  deeds,
}: {
  index: number | null;
  onClose: () => void;
  sym: string;
  labels: Record<number, { name: string; region: string; tier: number }>;
  players: MockPlayer[];
  deeds: Record<number, string | undefined>;
}) {
  const open = index !== null;
  const tile = index !== null ? TILE_BY_INDEX.get(index) : undefined;
  if (!tile || index === null) {
    return <Modal visible={false} transparent />;
  }

  const title = labels[index]?.name ?? SPECIAL_LABEL[tile.type] ?? tile.type.toUpperCase();
  const ownerId = deeds[index];
  const owner = ownerId ? (players.find((p) => p.id === ownerId)?.name ?? 'OWNED') : 'BANK · UNOWNED';
  const stripe = tile.type === 'property' ? GROUP_COLORS[tile.districtId] : colors.surfaceVariant;

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={() => {}}>
          <View style={[styles.modalStripe, { backgroundColor: stripe }]} />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalSub}>
            {labels[index]?.region ? `${labels[index]?.region} · ` : ''}
            {tile.type.replace(/_/g, ' ').toUpperCase()}
          </Text>

          <View style={styles.modalRows}>
            {tile.type === 'property' && (
              <>
                <ModalRow k="PRICE" v={`${sym}${tile.price}`} />
                <ModalRow k="BASE RENT" v={`${sym}${tile.rentLadder[0]}`} />
                <ModalRow k="MORTGAGE" v={`${sym}${tile.mortgageValue}`} />
              </>
            )}
            {tile.type === 'utility' && (
              <>
                <ModalRow k="PRICE" v={`${sym}${tile.price}`} />
                <ModalRow k="MORTGAGE" v={`${sym}${tile.mortgageValue}`} />
              </>
            )}
            <ModalRow k="OWNER" v={owner} />
          </View>

          <Pressable onPress={onClose} style={({ pressed }) => [styles.modalClose, pressed && styles.pressed]}>
            <Text style={styles.modalCloseText}>CLOSE</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ModalRow({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.modalRow}>
      <Text style={styles.modalRowK}>{k}</Text>
      <Text style={styles.modalRowV}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.gutter },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: spacing.stackSm },
  brand: { ...typography.headlineMd, color: colors.onSurface, letterSpacing: -0.5 },
  roundChip: { backgroundColor: colors.onSurface, paddingHorizontal: spacing.stackSm, paddingVertical: 4 },
  roundChipText: { ...typography.labelMd, color: colors.surface, letterSpacing: 1 },

  // current user's stat bar
  meBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.stackMd,
    paddingHorizontal: spacing.stackMd,
    paddingVertical: spacing.stackSm,
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
    ...brutal.offset,
    marginBottom: spacing.stackSm,
  },
  swatch: { width: 24, height: 24, ...brutal.borderThin },
  meName: { ...typography.headlineMd, color: colors.onSurface, flex: 1 },
  meCash: { ...typography.numberDisplay, color: colors.onSurface },

  // board
  boardWrap: { alignItems: 'center', paddingVertical: spacing.stackSm },
  board: { width: '100%', maxWidth: 420, aspectRatio: 1, ...brutal.border, backgroundColor: colors.surfaceBright },
  boardRow: { flex: 1, flexDirection: 'row' },
  cellEmpty: { flex: 1 },
  cell: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.outline,
    backgroundColor: colors.surfaceContainerLowest,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stripe: { position: 'absolute', top: 0, left: 0, right: 0, height: '32%' },
  cellLabel: { fontFamily: typography.labelMd.fontFamily, fontSize: 7, lineHeight: 9, color: colors.onSurface, textAlign: 'center' },
  ownerBar: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 4 },
  tokenRow: { position: 'absolute', bottom: 5, flexDirection: 'row', gap: 1, flexWrap: 'wrap', justifyContent: 'center' },
  token: { width: 8, height: 8, borderRadius: radius.full, borderWidth: 1, borderColor: colors.outline },

  center: { position: 'absolute', top: '33%', bottom: '33%', left: '33%', right: '33%', alignItems: 'center', justifyContent: 'center' },
  centerMark: { ...typography.displayLg, color: colors.outlineVariant },

  // middle band
  band: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.stackMd, paddingVertical: spacing.stackSm },
  turnText: { ...typography.headlineLg, color: colors.onSurface },
  diceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.stackSm },
  die: { width: 40, height: 40, backgroundColor: colors.surfaceContainerLowest, ...brutal.border, alignItems: 'center', justifyContent: 'center' },
  dieNum: { ...typography.headlineMd, color: colors.onSurface },
  diceTotal: { ...typography.headlineMd, color: colors.onSurfaceVariant },
  roll: { backgroundColor: colors.primaryContainer, ...brutal.border, ...brutal.offset, paddingVertical: 16, paddingHorizontal: 48 },
  rollText: { ...typography.headlineMd, color: colors.onPrimaryContainer, letterSpacing: 1 },
  waitText: { ...typography.labelLg, color: colors.onSurfaceVariant, letterSpacing: 2 },

  // ticker
  ticker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.stackSm,
    borderTopWidth: 4,
    borderColor: colors.outline,
    paddingTop: spacing.stackSm,
    marginHorizontal: -spacing.gutter,
    paddingHorizontal: spacing.gutter,
  },
  tickerTag: { backgroundColor: colors.secondary, paddingHorizontal: spacing.stackSm, paddingVertical: 2 },
  tickerTagText: { ...typography.labelMd, color: colors.onError, letterSpacing: 1 },
  tickerText: { ...typography.bodyMd, color: colors.onSurface, flex: 1 },

  // modal
  backdrop: { flex: 1, backgroundColor: '#1a1a1aaa', alignItems: 'center', justifyContent: 'center', padding: spacing.gutter },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: colors.surfaceContainerLowest, ...brutal.border, ...brutal.offset, padding: spacing.stackLg, gap: spacing.stackMd },
  modalStripe: { height: 24, ...brutal.borderThin, marginBottom: spacing.stackSm },
  modalTitle: { ...typography.headlineLg, color: colors.onSurface },
  modalSub: { ...typography.labelMd, color: colors.onSurfaceVariant, letterSpacing: 1 },
  modalRows: { gap: spacing.stackSm },
  modalRow: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderColor: colors.outlineVariant, paddingBottom: 4 },
  modalRowK: { ...typography.labelLg, color: colors.onSurfaceVariant },
  modalRowV: { ...typography.bodyLg, color: colors.onSurface },
  modalClose: { backgroundColor: colors.onSurface, alignItems: 'center', paddingVertical: 14, ...brutal.border, marginTop: spacing.stackSm },
  modalCloseText: { ...typography.headlineMd, color: colors.surface, letterSpacing: 1 },

  pressed: { transform: [{ translateX: 6 }, { translateY: 6 }], shadowOffset: { width: 0, height: 0 } },
});
