import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { common } from '../styles/common';
import { brutal, colors, typography } from '../theme/tokens';

/** Color intent → flat fill. primary = yellow, secondary = red, tertiary = blue. */
export type BrutalVariant = 'primary' | 'secondary' | 'tertiary';

type BrutalButtonProps = {
  label: string;
  onPress: () => void;
  variant?: BrutalVariant;
  /** Extra styles merged onto the button container (e.g. width overrides). */
  style?: StyleProp<ViewStyle>;
};

const fills: Record<BrutalVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer }, // yellow
  secondary: { bg: colors.secondary, fg: colors.onSecondary }, // red
  tertiary: { bg: colors.tertiary, fg: colors.onTertiary }, // blue
};

/**
 * Signature brutalist button: flat color fill, 4px ink border, hard offset
 * shadow; "stamps down" (+6/+6, shadow dropped) on press.
 */
export function BrutalButton({ label, onPress, variant = 'primary', style }: BrutalButtonProps) {
  const fill = fills[variant];
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: fill.bg },
        pressed && common.pressed,
        style,
      ]}
    >
      <Text style={[styles.label, { color: fill.fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: '100%',
    maxWidth: 320,
    paddingVertical: 16,
    alignItems: 'center',
    ...brutal.border,
    ...brutal.offset,
  },
  label: { ...typography.headlineMd, letterSpacing: 1 },
});
