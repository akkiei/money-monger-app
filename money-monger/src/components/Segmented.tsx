import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { brutal, colors, typography } from '../theme/tokens';

type Option<T> = { label: string; value: T };

type SegmentedProps<T> = {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Brutalist segmented single-select: a bordered row of equal-width cells; the
 * selected cell is ink-filled. For small fixed option sets (e.g. rounds, cash).
 */
export function Segmented<T extends string | number | null>({
  options,
  value,
  onChange,
  style,
}: SegmentedProps<T>) {
  return (
    <View style={[styles.row, style]}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={String(opt.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(opt.value)}
            style={[styles.cell, i < options.length - 1 && styles.divider, selected ? styles.cellOn : styles.cellOff]}
          >
            <Text style={[styles.label, selected ? styles.labelOn : styles.labelOff]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', ...brutal.border, ...brutal.offset },
  cell: { flex: 1, paddingVertical: 14, alignItems: 'center', justifyContent: 'center' },
  divider: { borderRightWidth: 4, borderColor: colors.outline },
  cellOn: { backgroundColor: colors.onSurface },
  cellOff: { backgroundColor: colors.surfaceVariant },
  label: { ...typography.headlineMd },
  labelOn: { color: colors.surface },
  labelOff: { color: colors.onSurfaceVariant },
});
