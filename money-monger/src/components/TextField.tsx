import { useState } from 'react';
import { StyleProp, StyleSheet, TextInput, TextInputProps, ViewStyle } from 'react-native';
import { brutal, colors, spacing, typography } from '../theme/tokens';

type TextFieldProps = {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoCapitalize?: TextInputProps['autoCapitalize'];
  /** Extra styles merged onto the input box. */
  style?: StyleProp<ViewStyle>;
};

/**
 * Brutalist single-line text input: white fill, 4px ink border + hard offset
 * shadow; fill flips to yellow while focused. Labels live in the screen (a
 * Text above this), so this stays a pure input.
 */
export function TextField({
  value,
  onChangeText,
  placeholder,
  maxLength,
  autoCapitalize = 'words',
  style,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      placeholder={placeholder}
      placeholderTextColor={colors.onSurfaceVariant}
      maxLength={maxLength}
      autoCapitalize={autoCapitalize}
      autoCorrect={false}
      style={[styles.input, focused && styles.inputFocused, style]}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
    ...brutal.offset,
    paddingHorizontal: spacing.stackMd,
    paddingVertical: 16,
    ...typography.bodyLg,
    color: colors.onSurface,
  },
  inputFocused: { backgroundColor: colors.primaryContainer },
});
