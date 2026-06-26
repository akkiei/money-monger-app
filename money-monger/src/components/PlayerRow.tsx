import { StyleSheet, Text, View } from 'react-native';
import { tokenHex } from '../theme/playerColors';
import { brutal, colors, spacing, typography } from '../theme/tokens';

type PlayerRowProps = {
  name: string;
  /** Server-assigned token color (drives the avatar swatch). */
  color?: string;
  /** Seat index — fallback color when `color` is unset. */
  seatIndex?: number;
  isHost?: boolean;
  /** Tag this row as the local player. */
  isYou?: boolean;
};

/** Brutalist lobby/roster row: color avatar + name + role badge. Host row is
 *  yellow-filled; others are white. Shared by the host lobby and waiting room. */
export function PlayerRow({ name, color, seatIndex = 0, isHost, isYou }: PlayerRowProps) {
  return (
    <View style={[styles.row, isHost ? styles.host : styles.player]}>
      <View style={[styles.avatar, { backgroundColor: tokenHex(color, seatIndex) }]} />
      <Text style={styles.name} numberOfLines={1}>
        {name}
      </Text>
      {isHost ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>HOST</Text>
        </View>
      ) : (
        isYou && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>YOU</Text>
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.stackMd,
    padding: spacing.stackMd,
    ...brutal.border,
    ...brutal.offset,
  },
  host: { backgroundColor: colors.primaryContainer },
  player: { backgroundColor: colors.surfaceContainerLowest },
  avatar: { width: 40, height: 40, ...brutal.borderThin },
  name: { ...typography.bodyLg, color: colors.onSurface, flex: 1 },
  badge: { backgroundColor: colors.onSurface, paddingHorizontal: spacing.stackSm, paddingVertical: 2 },
  badgeText: { ...typography.labelMd, color: colors.surface },
});
