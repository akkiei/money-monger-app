import { useRouter } from 'expo-router';
import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { common } from '../styles/common';
import { brutal, colors, spacing, typography } from '../theme/tokens';

type BackButtonProps = {
  /** Override the default `router.back()` behavior. */
  onPress?: () => void;
  /** Glyph/label shown inside the button. Default "←". */
  label?: string;
  /** Extra styles merged onto the button container (e.g. reposition). */
  style?: StyleProp<ViewStyle>;
};

/**
 * Brutalist top-left back affordance. Drop on any screen directly, or enable it
 * via `<Screen showBack>`. Defaults to `router.back()`; pass `onPress` to override.
 */
export function BackButton({ onPress, label = '←', style }: BackButtonProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={8}
      onPress={onPress ?? (() => router.back())}
      style={({ pressed }) => [
        styles.btn,
        { top: insets.top + spacing.stackMd },
        pressed && common.pressed,
        style,
      ]}
    >
      <Text style={styles.glyph}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    position: 'absolute',
    left: spacing.containerPaddingMobile,
    width: 48,
    height: 48,
    alignItems: 'center',
    backgroundColor: colors.inverseOnSurface,
    justifyContent: 'center',
    ...brutal.border,
    ...brutal.offset,
    zIndex: 10,
  },
  glyph: { ...typography.headlineMd, color: colors.onSurface },
});
