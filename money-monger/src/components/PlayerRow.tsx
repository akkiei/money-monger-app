import { StyleSheet, Text, View } from 'react-native';
import { brutal, colors, spacing, typography } from '../theme/tokens';

type PlayerRowProps = {
  name: string;
  isHost?: boolean;
  /** Tag this row as the local player. */
  isYou?: boolean;
};

/** Brutalist lobby/roster row: ink avatar + name + role badge. Host row is
 *  yellow-filled; others are white. Shared by the host lobby and waiting room. */
export function PlayerRow({ name, isHost, isYou }: PlayerRowProps) {
  return (
    <View style={[styles.row, isHost ? styles.host : styles.player]}>
      <View style={styles.avatar} />
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
  avatar: { width: 40, height: 40, backgroundColor: colors.onSurface, ...brutal.borderThin },
  name: { ...typography.bodyLg, color: colors.onSurface, flex: 1 },
  badge: { backgroundColor: colors.onSurface, paddingHorizontal: spacing.stackSm, paddingVertical: 2 },
  badgeText: { ...typography.labelMd, color: colors.surface },
});
