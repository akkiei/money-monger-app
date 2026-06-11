import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BackButton, CodeInput, TextField } from '../src/components';
import { brutal, colors, spacing, typography } from '../src/theme/tokens';

const CODE_LENGTH = 4;
const NAME_MAX = 16;

// Join Game — name + 4-char room code. Presentational + local state for now;
// TODO: onJoin → ensureAnonSession() → joinGame(code, name, token) → Waiting Room.
// (Scan QR / paste invite link from the design are post-MVP — need camera + deep links.)
export default function JoinGame() {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');

  const canJoin = name.trim().length > 0 && code.length === CODE_LENGTH;

  return (
    <View style={styles.root}>
      <BackButton />
      <View style={[styles.header, { paddingTop: insets.top + spacing.stackMd }]}>
        <Text style={styles.headerTitle}>JOIN GAME</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heading}>JOIN A GAME</Text>
        <Text style={styles.subheading}>ENTER YOUR NAME & ROOM CODE</Text>

        {/* name */}
        <Text style={styles.label}>YOUR NAME</Text>
        <TextField value={name} onChangeText={setName} placeholder="e.g. ALEX" maxLength={NAME_MAX} />

        {/* code */}
        <Text style={styles.label}>ROOM CODE</Text>
        <CodeInput length={CODE_LENGTH} value={code} onChange={setCode} />

        {/* join */}
        <Pressable
          disabled={!canJoin}
          // TODO: wire to joinGame(code, name, token) → navigate to Waiting Room
          style={({ pressed }) => [
            styles.join,
            canJoin ? styles.joinOn : styles.joinOff,
            canJoin && pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.joinText, !canJoin && styles.joinTextOff]}>JOIN GAME</Text>
        </Pressable>
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

  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.gutter, gap: spacing.stackMd },

  heading: { ...typography.displayLg, color: colors.onSurface, textAlign: 'center' },
  subheading: {
    ...typography.labelLg,
    color: colors.onSurfaceVariant,
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: spacing.stackMd,
  },

  label: { ...typography.labelLg, color: colors.onSurface, marginTop: spacing.stackSm },

  join: { paddingVertical: 18, alignItems: 'center', ...brutal.border, marginTop: spacing.stackLg },
  joinOn: { backgroundColor: colors.primaryContainer, ...brutal.offset },
  joinOff: { backgroundColor: colors.surfaceVariant },
  joinText: { ...typography.headlineMd, color: colors.onPrimaryContainer, letterSpacing: 1 },
  joinTextOff: { color: colors.onSurfaceVariant },

  pressed: { transform: [{ translateX: 6 }, { translateY: 6 }], shadowOffset: { width: 0, height: 0 } },
});
