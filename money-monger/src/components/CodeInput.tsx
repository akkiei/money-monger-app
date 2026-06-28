import { useRef } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CODE_CHARS } from '../shared/codes';
import { brutal, colors, typography } from '../theme/tokens';

const ALLOWED = new Set([...CODE_CHARS]);

type CodeInputProps = {
  /** Number of characters (room codes are 4). */
  length?: number;
  /** Controlled value (uppercase, already filtered to CODE_CHARS). */
  value: string;
  onChange: (code: string) => void;
  autoFocus?: boolean;
};

/**
 * Brutalist segmented code entry: a row of ink-bordered boxes backed by a single
 * invisible TextInput, so paste / backspace / auto-advance work natively. The
 * box at the caret position is yellow-highlighted. Input is uppercased and
 * filtered to CODE_CHARS (excludes ambiguous 0/O/1/I/L).
 */
export function CodeInput({ length = 4, value, onChange, autoFocus }: CodeInputProps) {
  const ref = useRef<TextInput>(null);

  function handle(text: string) {
    const clean = [...text.toUpperCase()]
      .filter((c) => ALLOWED.has(c))
      .slice(0, length)
      .join('');
    onChange(clean);
  }

  return (
    <Pressable style={styles.row} onPress={() => ref.current?.focus()}>
      {Array.from({ length }).map((_, i) => {
        const char = value[i] ?? '';
        const active = i === value.length;
        return (
          <View key={i} style={[styles.box, (char || active) && styles.boxActive]}>
            <Text style={styles.char}>{char}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        value={value}
        onChangeText={handle}
        maxLength={length}
        autoFocus={autoFocus}
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        importantForAutofill="no"
        caretHidden
        style={styles.hidden}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, position: 'relative' },
  box: {
    flex: 1,
    aspectRatio: 0.8,
    maxWidth: 72,
    backgroundColor: colors.surfaceContainerLowest,
    ...brutal.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { backgroundColor: colors.primaryContainer },
  char: { ...typography.displayLg, color: colors.onSurface },
  hidden: { position: 'absolute', width: '100%', height: '100%', opacity: 0 },
});
